import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

export default async function progressRoutes(app: FastifyInstance) {
    app.get('/api/members/:id/measurements', async (req) => {
        const memberId = (req.params as { id: string }).id;
        const [rows] = await app.db.query<RowDataPacket[]>(
            `SELECT pm.id, pm.value, pm.unit, pm.recorded_on as recordedOn, mt.name as typeName, mt.code as typeCode
       FROM progress_measurement pm
       JOIN measurement_type mt ON pm.type_id = mt.id
       WHERE pm.member_id = ?
       ORDER BY pm.recorded_on ASC`,
            [memberId]
        );
        return rows;
    });

    app.post('/api/members/:id/measurements', async (req) => {
        const memberId = (req.params as { id: string }).id;
        const { typeCode, value, unit } = req.body as { typeCode: string, value: number, unit: string };
        const [[mt]] = await app.db.query<RowDataPacket[]>(
            `SELECT id FROM measurement_type WHERE code = ?`, [typeCode]
        );
        if (!mt) throw new Error('Invalid type');

        const id = require('crypto').randomUUID();
        await app.db.query(
            `INSERT INTO progress_measurement (id, member_id, type_id, value, unit, recorded_on)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [id, memberId, mt.id, value, unit]
        );
        return { success: true, id };
    });
}
