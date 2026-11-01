import { db, ensureSchema } from './_db.js';
import { currentUser } from './_auth.js';

/** 访问记录：仅管理员。返回今日/总访问量与最近 100 条明细 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });
  if (!user.is_admin) return res.status(403).json({ error: '仅管理员可查看访问记录' });

  try {
    const total = await sql`SELECT count(*)::int AS n FROM visits`;
    const today = await sql`
      SELECT count(*)::int AS n FROM visits
      WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai')
    `;
    const recent = await sql`
      SELECT id, username, path, created_at
      FROM visits ORDER BY created_at DESC LIMIT 100
    `;
    return res.status(200).json({
      total: total[0].n,
      today: today[0].n,
      recent,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
