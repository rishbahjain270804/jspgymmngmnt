import mysql from 'mysql2/promise';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function dbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 3307),
    user: env.DB_USER ?? 'oan',
    password: env.DB_PASSWORD ?? 'oan_dev',
    database: env.DB_NAME ?? 'oan',
  };
}

/**
 * A pool configured the way this application needs it.
 *
 * `timezone: 'Z'` and `dateStrings` together are what stop MySQL and Node from
 * quietly disagreeing about dates: a membership expiring on 2026-12-31 must
 * come back as the string "2026-12-31", not a Date that a browser in IST
 * renders as the 30th. Calendar dates are strings all the way through, which
 * is the same decision made in @oan/core's date module.
 */
export function createPool(config: DbConfig = dbConfig()): mysql.Pool {
  return mysql.createPool({
    ...config,
    timezone: 'Z',
    dateStrings: ['DATE', 'DATETIME'],
    // Money is BIGINT paise. Returning it as a JS string would break arithmetic
    // silently; paise values stay far inside Number.MAX_SAFE_INTEGER, so let
    // mysql2 hand back numbers.
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4_0900_ai_ci',
  });
}
