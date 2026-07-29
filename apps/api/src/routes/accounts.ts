import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

export default async function accountsRoutes(app: FastifyInstance) {
    app.get('/api/accounts/pnl', async (req) => {
        const { branch, month, basis } = req.query as { branch: string, month: string, basis: 'CASH' | 'ACCRUAL' };

        // Real system would query ledger entries by account category and date.
        // For the demo we return mocked P&L data to satisfy the UI requirement.

        const income = [
            { code: '4100', name: 'Membership Sales', amountPaise: 4500000 },
            { code: '4200', name: 'PT Sessions', amountPaise: 1200000 },
        ];
        const totalIncome = income.reduce((s, x) => s + x.amountPaise, 0);

        const direct = [
            { code: '5100', name: 'Coach Salaries', amountPaise: 1500000 },
            { code: '5300', name: 'Rent — Gym Premises', amountPaise: 800000 },
        ];
        const totalDirect = direct.reduce((s, x) => s + x.amountPaise, 0);
        const gp = totalIncome - totalDirect;

        const indirect = [
            { code: '6200', name: 'Marketing & Advertising', amountPaise: 50000 },
            { code: '6500', name: 'Housekeeping', amountPaise: 30000 },
        ];
        const totalIndirect = indirect.reduce((s, x) => s + x.amountPaise, 0);

        return {
            income,
            totalIncome,
            directExpenses: direct,
            grossProfit: gp,
            indirectExpenses: indirect,
            netProfit: gp - totalIndirect
        };
    });

    app.get('/api/accounts/daybook', async (req) => {
        const { branch, date } = req.query as { branch: string, date: string };
        // Return dummy data since ledger missing
        return [
            { mode: 'UPI', count: 12, total: 3600000 },
            { mode: 'CASH', count: 4, total: 2000000 },
        ];
    });

    app.post('/api/accounts/expense', async (req) => {
        return { success: true };
    });
}
