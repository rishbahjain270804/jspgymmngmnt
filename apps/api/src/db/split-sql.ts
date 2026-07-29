/**
 * Split a .sql file into individual statements.
 *
 * `DELIMITER $$` is a directive the *mysql client* understands — the server has
 * never heard of it. Since our migrations contain stored routines and triggers
 * whose bodies are full of semicolons, we have to do the splitting ourselves
 * and get it right, rather than naively cutting on every `;`.
 *
 * The rules that matter:
 *   · semicolons inside quotes, backticks or comments are not separators
 *   · semicolons inside a BEGIN … END block are not separators
 *   · `END IF`, `END WHILE`, `END LOOP`, `END CASE`, `END REPEAT` close their
 *     own constructs, not the enclosing block, so they must not decrement depth
 *     — which is why only bare `BEGIN`/`END` are counted
 */

const BLOCK_CLOSERS = new Set(['IF', 'WHILE', 'LOOP', 'CASE', 'REPEAT']);

export function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let depth = 0;
  let i = 0;

  const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9_$]/.test(c);

  while (i < sql.length) {
    const c = sql[i]!;
    const next = sql[i + 1];

    // -- line comment (MySQL requires whitespace after the dashes)
    if (c === '-' && next === '-' && (sql[i + 2] === undefined || /\s/.test(sql[i + 2]!))) {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }

    // # line comment
    if (c === '#') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }

    // /* block comment */
    if (c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }

    // quoted string or quoted identifier — copied through verbatim
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      buf += c;
      i++;
      while (i < sql.length) {
        const q = sql[i]!;
        if (q === '\\' && quote !== '`') {
          buf += q + (sql[i + 1] ?? '');
          i += 2;
          continue;
        }
        // doubled quote is an escaped quote, not a terminator
        if (q === quote && sql[i + 1] === quote) {
          buf += q + q;
          i += 2;
          continue;
        }
        buf += q;
        i++;
        if (q === quote) break;
      }
      continue;
    }

    // BEGIN / END, only on word boundaries
    if (/[A-Za-z]/.test(c) && !isWordChar(sql[i - 1])) {
      const rest = sql.slice(i);
      const word = /^[A-Za-z]+/.exec(rest)?.[0]?.toUpperCase();

      if (word === 'BEGIN' && !isWordChar(sql[i + 5])) {
        depth++;
        buf += sql.slice(i, i + 5);
        i += 5;
        continue;
      }

      if (word === 'END' && !isWordChar(sql[i + 3])) {
        // Look ahead: `END IF` and friends close their own construct.
        const after = /^\s+([A-Za-z]+)/.exec(rest.slice(3))?.[1]?.toUpperCase();
        if (!after || !BLOCK_CLOSERS.has(after)) {
          depth = Math.max(0, depth - 1);
        }
        buf += sql.slice(i, i + 3);
        i += 3;
        continue;
      }
    }

    // statement terminator, but only outside a routine body
    if (c === ';' && depth === 0) {
      const trimmed = buf.trim();
      if (trimmed) statements.push(trimmed);
      buf = '';
      i++;
      continue;
    }

    buf += c;
    i++;
  }

  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}
