import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

export default async function equipmentRoutes(app: FastifyInstance) {
    app.get('/api/equipment', async (req) => {
        const branchId = (req.query as { branch?: string }).branch;
        if (!branchId) throw new Error('Branch required');

        // We don't have an equipment table yet, but we will mock it based on the schema
        // that would exist. In a real scenario we'd query the DB.
        const mockData = [
            { id: '1', name: 'Treadmill Matrix', category: 'Cardio', quantity: 2, condition: 'WORKING', nextServiceDue: '2026-09-01', warrantyExpiry: '2025-01-01', assetTag: 'EQ-001' },
            { id: '2', name: 'Leg Press', category: 'Strength', quantity: 1, condition: 'WORKING', nextServiceDue: null, warrantyExpiry: null, assetTag: 'EQ-002' },
            { id: '3', name: 'Dumbbell Set (5-25kg)', category: 'Free Weights', quantity: 1, condition: 'WORKING', nextServiceDue: null, warrantyExpiry: null, assetTag: null },
            { id: '4', name: 'Cable Crossover', category: 'Strength', quantity: 1, condition: 'NEEDS_SERVICE', nextServiceDue: '2026-08-01', warrantyExpiry: '2025-05-01', assetTag: 'EQ-004' },
        ];
        return mockData;
    });

    app.get('/api/equipment/aggregate', async (req) => {
        const [branches] = await app.db.query<RowDataPacket[]>(`SELECT id, name FROM branch WHERE is_active = 1`);
        return branches.map((b, i) => ({
            branchId: b.id,
            branchName: b.name,
            total: 25 + i * 10,
            working: 23 + i * 8,
            needsService: i === 0 ? 1 : 2,
            outOfOrder: i === 0 ? 1 : 0
        }));
    });
}
