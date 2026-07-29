import type { Pool } from 'mysql2/promise';

declare module 'fastify' {
    export interface FastifyInstance {
        db: Pool;
    }
}
