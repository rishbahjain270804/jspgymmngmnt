import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createPool, dbConfig } from './db/connect.js';
import { migrate } from './db/migrate.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import membersRoutes from './routes/members.js';
import checkinRoutes from './routes/checkin.js';
import equipmentRoutes from './routes/equipment.js';
import accountsRoutes from './routes/accounts.js';
import progressRoutes from './routes/progress.js';
import paymentsRoutes from './routes/payments.js';

const app = Fastify({ logger: true });
const pool = createPool(dbConfig());

app.decorate('db', pool);

app.register(cors, { origin: '*' });

app.get('/health', async () => ({ status: 'ok' }));

app.register(authRoutes);
app.register(dashboardRoutes);
app.register(membersRoutes);
app.register(checkinRoutes);
app.register(equipmentRoutes);
app.register(accountsRoutes);
app.register(progressRoutes);
app.register(paymentsRoutes);

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
