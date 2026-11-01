import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';

/** 我发表的评论（带所属文章信息） */
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
      SELECT c.id, c.body, c.created_at, c.post_slug,
             p.title AS post_title, p.published AS post_published
      FROM comments c LEFT JOIN posts p ON p.slug = c.post_slug
      WHERE c.user_id = ${user.id}
      ORDER BY c.created_at DESC
      LIMIT 200
    `;
    return res.status(200).json(comments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
