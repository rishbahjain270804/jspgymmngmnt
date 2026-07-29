import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSql } from './split-sql.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, '..', '..', 'db', 'migrations');

export interface Migration {
  readonly name: string;
  readonly statements: readonly string[];
}

/** Migrations in filename order — `0001_`, `0002_`, and so on. */
export async function loadMigrations(dir = MIGRATIONS_DIR): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (name) => ({
      name,
      statements: splitSql(await readFile(join(dir, name), 'utf8')),
    })),
  );
}

/** Anything that can run one SQL statement — a mysql2 connection or pool. */
export interface SqlRunner {
  query(sql: string): Promise<unknown>;
}

/**
 * Apply every migration that has not run yet.
 *
 * Each file is recorded in `schema_migration` once it completes, so re-running
 * is a no-op. Statements are applied one at a time rather than with
 * `multipleStatements`, so a failure names the exact statement that broke —
 * MySQL's DDL is not transactional, and a half-applied file is much easier to
 * fix when you know where it stopped.
 */
export async function migrate(
  db: SqlRunner,
  opts: { dir?: string; log?: (msg: string) => void } = {},
): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migration (
      name       VARCHAR(160) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB
  `);

  const rows = (await db.query('SELECT name FROM schema_migration')) as [{ name: string }[], unknown];
  const done = new Set((rows[0] ?? []).map((r) => r.name));

  const applied: string[] = [];
  for (const m of await loadMigrations(opts.dir)) {
    if (done.has(m.name)) continue;

    for (const [n, statement] of m.statements.entries()) {
      try {
        await db.query(statement);
      } catch (err) {
        const head = statement.slice(0, 200).replace(/\s+/g, ' ');
        throw new Error(
          `Migration ${m.name} failed at statement ${n + 1}/${m.statements.length}: ` +
            `${(err as Error).message}\n  → ${head}…`,
          { cause: err },
        );
      }
    }

    await db.query(
      `INSERT INTO schema_migration (name) VALUES (${JSON.stringify(m.name)})`,
    );
    applied.push(m.name);
    opts.log?.(`applied ${m.name} (${m.statements.length} statements)`);
  }
  return applied;
}
