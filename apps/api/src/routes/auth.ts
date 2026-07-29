import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';

export default async function authRoutes(app: FastifyInstance) {
    // DEMO SHORTCUT: bypass OTP, log in directly by role key
    app.post('/api/auth/demo', async (req) => {
        const { roleKey } = req.body as { roleKey: string };
        const role = roleKey.toUpperCase() === 'FRONTDESK' ? 'FRONT_DESK' :
            roleKey.toUpperCase() === 'MANAGER' ? 'BRANCH_MANAGER' : 'ADMIN';

        // Find the staff member seeded for this role
        const [staff] = await app.db.query<RowDataPacket[]>(
            `SELECT id, name, role FROM staff WHERE role = ? LIMIT 1`,
            [role]
        );
        if (!staff.length) throw new Error(`No demo user for ${role}`);

        const user = staff[0]!;

        // Find their branch access
        let branchIds: string[] = [];
        let branches: { id: string, name: string }[] = [];

        if (role === 'ADMIN') {
            const [allBranches] = await app.db.query<RowDataPacket[]>(
                `SELECT id, name FROM branch WHERE is_active = 1 ORDER BY created_at ASC`
            );
            branches = allBranches as any;
        } else {
            const [assigned] = await app.db.query<RowDataPacket[]>(
                `SELECT b.id, b.name FROM branch b
         JOIN staff_branch sb ON sb.branch_id = b.id
         WHERE sb.staff_id = ? AND b.is_active = 1
         ORDER BY b.created_at ASC`,
                [user.id]
            );
            branches = assigned as any;
            branchIds = branches.map(b => b.id);
        }

        // In a real app we'd sign a JWT here. For the demo, just return a fake token.
        return {
            token: `${user.id}.${role}`,
            staffId: user.id,
            name: user.name,
            role: user.role,
            branchIds,
            branches
        };
    });
}
