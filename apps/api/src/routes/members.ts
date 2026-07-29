import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

export default async function memberRoutes(app: FastifyInstance) {
    app.get('/api/members', async (req) => {
        const { q, branch } = req.query as { q?: string, branch?: string };

        let query = `
      SELECT m.id, m.member_no as memberNo, m.name, m.phone, b.name as homeBranchName,
             ms.status as membershipStatus, ms.expires_on as expiresOn, p.name as planName
      FROM member m
      JOIN branch b ON m.home_branch_id = b.id
      LEFT JOIN membership ms ON ms.member_id = m.id AND ms.is_live = 1
      LEFT JOIN plan p ON ms.plan_id = p.id
      WHERE 1=1
    `;
        const params: any[] = [];

        if (branch) {
            query += ` AND m.home_branch_id = ?`;
            params.push(branch);
        }

        if (q) {
            query += ` AND (m.phone LIKE ? OR m.member_no LIKE ? OR m.name LIKE ?)`;
            const likeQ = `%${q}%`;
            params.push(likeQ, likeQ, likeQ);
        }

        query += ` ORDER BY m.joined_on DESC LIMIT 50`;

        const [rows] = await app.db.query<RowDataPacket[]>(query, params);
        return rows;
    });

    app.get('/api/members/:id', async (req) => {
        const id = (req.params as { id: string }).id;

        const [[member]] = await app.db.query<RowDataPacket[]>(
            `SELECT m.id, m.member_no as memberNo, m.name, m.phone, m.email, m.sex, m.goal,
              m.joined_on as joinedOn, b.name as homeBranchName
       FROM member m
       JOIN branch b ON m.home_branch_id = b.id
       WHERE m.id = ?`,
            [id]
        );
        if (!member) throw new Error('Member not found');

        const [memberships] = await app.db.query<RowDataPacket[]>(
            `SELECT ms.id, p.name as planName, ms.starts_on as startsOn, ms.expires_on as expiresOn,
              ms.status, ms.balance_due_paise as balanceDuePaise
       FROM membership ms
       JOIN plan p ON ms.plan_id = p.id
       WHERE ms.member_id = ?
       ORDER BY ms.starts_on DESC`,
            [id]
        );

        const [checkins] = await app.db.query<RowDataPacket[]>(
            `SELECT c.id, c.on_date as onDate, c.at, b.name as branchName, c.method, c.verdict_level as verdictLevel
       FROM check_in c
       JOIN branch b ON c.branch_id = b.id
       WHERE c.member_id = ?
       ORDER BY c.at DESC LIMIT 10`,
            [id]
        );

        const liveMs = memberships.find(m => m.status === 'ACTIVE' || m.status === 'EXPIRING');

        return {
            ...member,
            membershipStatus: liveMs ? liveMs.status : (memberships.length ? 'EXPIRED' : 'NONE'),
            balanceDue: memberships.reduce((sum, m) => sum + m.balanceDuePaise, 0),
            memberships,
            recentCheckins: checkins
        };
    });
}
