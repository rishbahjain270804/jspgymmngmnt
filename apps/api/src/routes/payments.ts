import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

export default async function paymentsRoutes(app: FastifyInstance) {
    app.get('/api/payments', async (req) => {
        const branchId = (req.query as { branch?: string }).branch;
        // Mock data. In a real app this pulls from the ledger and invoice tables.
        return [
            { id: '1', invoiceNo: 'INV-24-001', memberName: 'Rahul Sharma', memberPhone: '9876543210', amountPaise: 1500000, mode: 'UPI', recordedAt: new Date().toISOString(), branchName: 'Vidhyadhar Nagar' },
            { id: '2', invoiceNo: 'INV-24-002', memberName: 'Priya Patel', memberPhone: '9876543211', amountPaise: 2500000, mode: 'CARD', recordedAt: new Date().toISOString(), branchName: 'Vidhyadhar Nagar' }
        ];
    });

    app.post('/api/payments/collect', async (req) => {
        const { memberId, amountPaise, mode, branchId } = req.body as { memberId: string, amountPaise: number, mode: string, branchId: string };
        const [[member]] = await app.db.query<RowDataPacket[]>(`SELECT name, phone FROM member WHERE id = ?`, [memberId]);

        return {
            id: require('crypto').randomUUID(),
            invoiceNo: `INV-24-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            memberName: member?.name || 'Unknown',
            memberPhone: member?.phone,
            amountPaise,
            mode,
            recordedAt: new Date().toISOString(),
            branchName: 'Current Branch' // mocked
        };
    });
}
