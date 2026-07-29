import Fastify from 'fastify';
import { createPool, dbConfig } from './db/connect.js';
import { migrate } from './db/migrate.js';

const app = Fastify({ logger: true });
const pool = createPool(dbConfig());

app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    const conn = await pool.getConnection();
    await migrate(conn, {
      log: (msg) => app.log.info(msg),
    });
    conn.release();
  } catch (err) {
    app.log.error(err, 'migration failed');
    process.exit(1);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
};

start();
