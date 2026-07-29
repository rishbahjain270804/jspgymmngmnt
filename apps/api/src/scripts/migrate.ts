import { createPool, dbConfig } from '../db/connect.js';
import { migrate } from '../db/migrate.js';

const pool = createPool(dbConfig());

try {
  const conn = await pool.getConnection();
  const applied = await migrate(conn, {
    log: (msg) => console.log(msg),
  });
  conn.release();
  if (applied.length === 0) {
    console.log('no new migrations');
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
