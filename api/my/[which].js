import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';

/** 我的评论数据：/api/my/comments 或 /api/my/liked-comments（动态路由，两接口合一） */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const which = String(req.query.which || '');
  if (which !== 'comments' && which !== 'liked-comments') {
    return res.status(404).json({ error: '未知的接口' });
  }

  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  try {
    const comments =
      which === 'comments'
        ? await sql`
            SELECT c.id, c.body, c.created_at, c.post_slug,
                   p.title AS post_title, p.published AS post_published
            FROM comments c LEFT JOIN posts p ON p.slug = c.post_slug
            WHERE c.user_id = ${user.id}
            ORDER BY c.created_at DESC
            LIMIT 200
          `
        : await sql`
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
