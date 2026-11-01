import { db, ensureSchema } from './_db.js';
import { currentUser } from './_auth.js';

/** 评论点赞：按用户记录，一人一评一赞 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  try {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: '缺少评论 id' });
    }

    // 评论必须挂在已发布文章上
    const valid = await sql`
      SELECT c.id FROM comments c
      JOIN posts p ON p.slug = c.post_slug
      WHERE c.id = ${id} AND p.published = true
    `;
    if (!valid.length) return res.status(404).json({ error: '评论不存在' });

    const inserted = await sql`
      INSERT INTO comment_likes (comment_id, user_id)
      VALUES (${id}, ${user.id})
      ON CONFLICT (comment_id, user_id) DO NOTHING
      RETURNING id
    `;
    let likes;
    if (inserted.length) {
      const rows = await sql`
        UPDATE comments SET likes = likes + 1
        WHERE id = ${id} RETURNING likes
      `;
      likes = rows[0].likes;
    } else {
      const rows = await sql`SELECT likes FROM comments WHERE id = ${id}`;
      likes = rows[0].likes;
    }
    return res.status(200).json({ likes, liked: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
