import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export default async function checkinRoutes(app: FastifyInstance) {
    app.get('/api/checkin/lookup', async (req) => {
        const { q, branch } = req.query as { q: string, branch: string };
        if (!q || !branch) throw new Error('q and branch are required');

        // Prioritize phone exactly, then phone like, then member_no like
        const [[member]] = await app.db.query<RowDataPacket[]>(
            `SELECT m.id, m.name, m.phone, m.member_no
       FROM member m
       WHERE m.phone = ? OR m.phone LIKE ? OR m.member_no LIKE ?
       LIMIT 1`,
            [q, `%${q}%`, `%${q}%`]
        );
        if (!member) throw new Error('Member not found');

        const [[ms]] = await app.db.query<RowDataPacket[]>(
            `SELECT ms.id, ms.status, ms.expires_on, p.name as planName,
              DATEDIFF(ms.expires_on, CURRENT_DATE) as daysLeft
       FROM membership ms
       JOIN plan p ON ms.plan_id = p.id
       WHERE ms.member_id = ? AND ms.is_live = 1
       ORDER BY ms.expires_on DESC LIMIT 1`,
            [member.id]
        );

        const [[todayCheckin]] = await app.db.query<RowDataPacket[]>(
            `SELECT id FROM check_in WHERE member_id = ? AND on_date = CURRENT_DATE LIMIT 1`,
            [member.id]
        );

        let verdict = 'RED';
        if (ms) {
            if (ms.status === 'ACTIVE') verdict = 'GREEN';
            else if (ms.status === 'EXPIRING') verdict = 'AMBER';
        }

        return {
            memberId: member.id,
            memberName: member.name,
            phone: member.phone,
            memberNo: member.member_no,
            planName: ms?.planName,
            expiresOn: ms?.expires_on,
            daysLeft: ms?.daysLeft,
            verdict,
            alreadyCheckedIn: !!todayCheckin
        };
    });

    app.post('/api/checkin', async (req) => {
        const { memberId, branchId } = req.body as { memberId: string, branchId: string };

        // For demo, we just record a green checkin if successful
        const [[ms]] = await app.db.query<RowDataPacket[]>(
            `SELECT status FROM membership WHERE member_id = ? AND is_live = 1 ORDER BY expires_on DESC LIMIT 1`,
            [memberId]
        );
        const verdictLevel = ms?.status === 'EXPIRING' ? 'AMBER' : ms?.status === 'ACTIVE' ? 'GREEN' : 'RED';

        const id = require('crypto').randomUUID();
        await app.db.query(
            `INSERT INTO check_in (id, member_id, branch_id, on_date, at, method, verdict_level)
       VALUES (?, ?, ?, CURRENT_DATE, CURRENT_TIMESTAMP, 'MANUAL', ?)`,
            [id, memberId, branchId, verdictLevel]
        );
        return { success: true, id };
    });

    app.get('/api/checkin/live', async (req) => {
        const branchId = (req.query as { branch: string }).branch;
        const [[res]] = await app.db.query<RowDataPacket[]>(
            `SELECT COUNT(*) as c FROM check_in WHERE on_date = CURRENT_DATE AND branch_id = ?`,
            [branchId]
        );
        // Note: Real gyms use entry/exit gates for exact count, but for here checking in == in gym today.
        return { inGymNow: res?.c ?? 0 };
    });
}
