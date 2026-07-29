import { describe, expect, it } from 'vitest';
import { splitSql } from './split-sql.js';

describe('splitSql', () => {
  it('splits ordinary statements', () => {
    expect(splitSql('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('keeps a trailing statement without a semicolon', () => {
    expect(splitSql('SELECT 1')).toEqual(['SELECT 1']);
  });

  it('ignores semicolons inside strings', () => {
    expect(splitSql(`INSERT INTO t VALUES ('a;b'); SELECT 1;`)).toEqual([
      `INSERT INTO t VALUES ('a;b')`,
      'SELECT 1',
    ]);
  });

  it('handles doubled quotes inside strings', () => {
    const out = splitSql(`INSERT INTO t VALUES ('Owner''s Capital'); SELECT 1;`);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("Owner''s Capital");
  });

  it('ignores semicolons inside backtick identifiers', () => {
    expect(splitSql('SELECT `we;ird` FROM t; SELECT 2;')).toHaveLength(2);
  });

  it('strips line and block comments', () => {
    const sql = `
      -- a comment with ; in it
      SELECT 1;
      # another ; comment
      /* block ; comment */
      SELECT 2;`;
    expect(splitSql(sql)).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('does not treat a decrement operator as a comment', () => {
    // "--" without following whitespace is not a MySQL comment.
    expect(splitSql('SELECT 1--2; SELECT 3;')).toEqual(['SELECT 1--2', 'SELECT 3']);
  });

  it('keeps a whole trigger body as one statement', () => {
    const sql = `
      CREATE TRIGGER t BEFORE INSERT ON x
      FOR EACH ROW
      BEGIN
        SET @a = 1;
        SET @b = 2;
      END;
      SELECT 1;`;
    const out = splitSql(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('SET @b = 2');
    expect(out[1]).toBe('SELECT 1');
  });

  it('does not let END IF close the enclosing BEGIN block', () => {
    // The bug this guards: counting `END IF` as a block close would end the
    // routine early and split its body across two broken statements.
    const sql = `
      CREATE PROCEDURE p()
      BEGIN
        IF 1 = 1 THEN
          SET @a = 1;
        END IF;
        WHILE 0 DO
          SET @b = 2;
        END WHILE;
        SET @c = 3;
      END;
      SELECT 9;`;
    const out = splitSql(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('SET @c = 3');
    expect(out[1]).toBe('SELECT 9');
  });

  it('handles nested BEGIN blocks', () => {
    const sql = `
      CREATE PROCEDURE p()
      BEGIN
        BEGIN
          SET @a = 1;
        END;
        SET @b = 2;
      END;
      SELECT 1;`;
    const out = splitSql(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('SET @b = 2');
  });

  it('does not mistake BEGIN inside an identifier for a block', () => {
    expect(splitSql('SELECT beginning FROM t; SELECT 2;')).toHaveLength(2);
    expect(splitSql('SELECT weekend FROM t; SELECT 2;')).toHaveLength(2);
  });

  it('returns nothing for an empty or comment-only file', () => {
    expect(splitSql('')).toEqual([]);
    expect(splitSql('-- nothing here\n')).toEqual([]);
    expect(splitSql('   \n\n  ')).toEqual([]);
  });
});
