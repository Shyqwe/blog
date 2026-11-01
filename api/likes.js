import { db, ensureSchema } from './_db.js';
import { currentUser } from './_auth.js';

export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });

  try {
    // 点赞：按用户记录，一人一文一赞（服务端去重）
    if (req.method === 'POST') {
      const slug = String(req.body?.slug || '');
      if (!slug) return res.status(400).json({ error: '缺少 slug' });

      const posts = await sql`SELECT slug FROM posts WHERE slug = ${slug} AND published = true`;
      if (!posts.length) return res.status(404).json({ error: '文章不存在' });

      const inserted = await sql`
        INSERT INTO likes (post_slug, user_id)
        VALUES (${slug}, ${user.id})
        ON CONFLICT (post_slug, user_id) DO NOTHING
        RETURNING id
      `;
      let likes;
      if (inserted.length) {
        const rows = await sql`
          UPDATE posts SET likes = likes + 1
          WHERE slug = ${slug} RETURNING likes
        `;
        likes = rows[0].likes;
      } else {
        const rows = await sql`SELECT likes FROM posts WHERE slug = ${slug}`;
        likes = rows[0].likes;
      }
      return res.status(200).json({ likes, liked: true });
    }

    // 我赞过的文章
    if (req.method === 'GET') {
      const posts = await sql`
        SELECT p.slug, p.title, p.likes, p.created_at
        FROM likes l JOIN posts p ON p.slug = l.post_slug
        WHERE l.user_id = ${user.id} AND p.published = true
        ORDER BY l.created_at DESC
        LIMIT 200
      `;
      return res.status(200).json(posts);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
