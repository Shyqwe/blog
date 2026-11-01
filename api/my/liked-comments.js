import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';

/** 我赞过的评论 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  try {
    const comments = await sql`
      SELECT c.id, c.name, c.body, c.likes, c.created_at, c.post_slug,
             p.title AS post_title
      FROM comment_likes cl
      JOIN comments c ON c.id = cl.comment_id
      LEFT JOIN posts p ON p.slug = c.post_slug
      WHERE cl.user_id = ${user.id}
      ORDER BY cl.created_at DESC
      LIMIT 200
    `;
    return res.status(200).json(comments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
