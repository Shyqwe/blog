import { db, ensureSchema } from './_db.js';
import { currentUser } from './_auth.js';

export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();

  try {
    // 读取某篇文章的评论（带点赞数与当前用户是否已赞）
    if (req.method === 'GET') {
      const slug = String(req.query.slug || '');
      if (!slug) return res.status(400).json({ error: '缺少 slug' });
      const comments = await sql`
        SELECT id, name, body, likes, created_at
        FROM comments
        WHERE post_slug = ${slug}
        ORDER BY created_at DESC
      `;
      const user = await currentUser(req);
      if (user && comments.length) {
        const liked = await sql`
          SELECT comment_id FROM comment_likes
          WHERE user_id = ${user.id}
            AND comment_id = ANY(${comments.map((c) => c.id)})
        `;
        const likedSet = new Set(liked.map((r) => r.comment_id));
        for (const c of comments) c.liked = likedSet.has(c.id);
      } else {
        for (const c of comments) c.liked = false;
      }
      return res.status(200).json(comments);
    }

    // 发表评论：需登录，昵称即用户名
    if (req.method === 'POST') {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: '请先登录后再评论' });

      const slug = String(req.body?.slug || '');
      const text = String(req.body?.body || '').trim().slice(0, 2000);

      // 蜜罐字段被填写 → 判定为机器人，假装成功即可
      if (req.body?.website) return res.status(200).json({ ok: true });

      if (!slug) return res.status(400).json({ error: '缺少 slug' });
      if (!text) return res.status(400).json({ error: '评论内容不能为空' });

      const posts = await sql`SELECT slug FROM posts WHERE slug = ${slug} AND published = true`;
      if (!posts.length) return res.status(404).json({ error: '文章不存在' });

      const rows = await sql`
        INSERT INTO comments (post_slug, name, body, user_id)
        VALUES (${slug}, ${user.username}, ${text}, ${user.id})
        RETURNING id, name, body, created_at
      `;
      return res.status(201).json(rows[0]);
    }

    // 删除评论：仅管理员
    if (req.method === 'DELETE') {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: '请先登录' });
      if (!user.is_admin) return res.status(403).json({ error: '仅管理员可删除评论' });

      const id = Number(req.query.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: '缺少评论 id' });
      }
      const rows = await sql`DELETE FROM comments WHERE id = ${id} RETURNING id`;
      if (!rows.length) return res.status(404).json({ error: '评论不存在' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
