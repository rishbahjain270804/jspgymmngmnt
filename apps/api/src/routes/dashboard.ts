import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

export default async function dashboardRoutes(app: FastifyInstance) {
    app.get('/api/dashboard', async (req) => {
        const branchId = (req.query as { branch?: string }).branch;

        const today = new Date().toISOString().slice(0, 10);
        const branchFilter = branchId ? `AND branch_id = ${app.db.escape(branchId)}` : '';
        const homeBranchFilter = branchId ? `AND home_branch_id = ${app.db.escape(branchId)}` : '';

        const [r1] = await app.db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as c FROM check_in WHERE on_date = ? ${branchFilter}`, [today]
        );
        const checkins = r1[0]?.c ?? 0;

        const [r2] = await app.db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as c FROM member WHERE joined_on >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') ${homeBranchFilter}`
        );
        const newJoins = r2[0]?.c ?? 0;

        const [r3] = await app.db.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT member_id) as c FROM membership WHERE is_live = 1 AND expires_on >= CURRENT_DATE ${branchFilter}`
        );
        const activeMembers = r3[0]?.c ?? 0;

        const [r4] = await app.db.query<RowDataPacket[]>(
            `SELECT COUNT(DISTINCT member_id) as c FROM membership
       WHERE is_live = 1 AND expires_on BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY) ${branchFilter}`
        );
        const expiring = r4[0]?.c ?? 0;

        const [r5] = await app.db.query<RowDataPacket[]>(
            `SELECT SUM(balance_due_paise) as s FROM membership WHERE has_dues = 1 ${branchFilter}`
        );
        const pendingDues = r5[0]?.s ?? 0;

        let branchesBreakdown: any[] = [];
        if (!branchId) {
            const [branches] = await app.db.query<RowDataPacket[]>(
                `SELECT id, name FROM branch WHERE is_active = 1`
            );
            for (const b of branches) {
                const [rbc] = await app.db.query<RowDataPacket[]>(`SELECT COUNT(*) as c FROM check_in WHERE on_date = ? AND branch_id = ?`, [today, b.id]);
                const [rbm] = await app.db.query<RowDataPacket[]>(`SELECT COUNT(DISTINCT member_id) as c FROM membership WHERE is_live = 1 AND expires_on >= CURRENT_DATE AND branch_id = ?`, [b.id]);
                branchesBreakdown.push({
                    branchId: b.id,
                    branchName: b.name,
                    activeMembers: rbm[0]?.c ?? 0,
                    todayCheckins: rbc[0]?.c ?? 0,
                    todayCollection: (rbm[0]?.c ?? 0) * 15000
                });
            }
        }

        return {
            todayCollection: activeMembers * 15000,
            todayCheckins: checkins,
            newJoinsThisMonth: newJoins,
            expiringThisWeek: expiring,
            pendingDues: pendingDues,
            activeMembers: activeMembers,
            branchBreakdown: branchesBreakdown
        };
    });
}
