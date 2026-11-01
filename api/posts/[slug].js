import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';

function parseTags(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[,，]/);
  return list.map((t) => String(t).trim()).filter(Boolean).slice(0, 10);
}

export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  const slug = String(req.query.slug || '');

  try {
    // 详情 JSON：供编辑器用，仅作者或管理员
    if (req.method === 'GET') {
      if (!user) return res.status(401).json({ error: '请先登录' });
      const rows = await sql`SELECT * FROM posts WHERE slug = ${slug}`;
      const post = rows[0];
      if (!post) return res.status(404).json({ error: '文章不存在' });
      if (post.author_id !== user.id && !user.is_admin) {
        return res.status(403).json({ error: '只能编辑自己的文章' });
      }
      return res.status(200).json(post);
    }

    // 编辑（作者或管理员）：slug 不可改，评论挂在 slug 上
    if (req.method === 'PUT') {
      if (!user) return res.status(401).json({ error: '请先登录' });
      const rows = await sql`SELECT author_id FROM posts WHERE slug = ${slug}`;
      if (!rows.length) return res.status(404).json({ error: '文章不存在' });
      if (rows[0].author_id !== user.id && !user.is_admin) {
        return res.status(403).json({ error: '只能编辑自己的文章' });
      }

      const body = req.body || {};
      const title = body.title !== undefined ? String(body.title).trim() : undefined;
      const content = body.content !== undefined ? String(body.content) : undefined;
      const published = body.published !== undefined ? Boolean(body.published) : undefined;
      const tags = body.tags !== undefined ? parseTags(body.tags) : undefined;

      if (title === '') return res.status(400).json({ error: '标题不能为空' });

      const updated = await sql`
        UPDATE posts SET
          title     = ${title ?? sql`title`},
          content   = ${content ?? sql`content`},
          tags      = ${tags ?? sql`tags`},
          published = ${published ?? sql`published`},
          updated_at = now()
        WHERE slug = ${slug}
        RETURNING slug, title, tags, published, updated_at
      `;
      return res.status(200).json(updated[0]);
    }

    // 删除（作者或管理员）：文章连同其评论一起删除
    if (req.method === 'DELETE') {
      if (!user) return res.status(401).json({ error: '请先登录' });
      const rows = await sql`SELECT author_id FROM posts WHERE slug = ${slug}`;
      if (!rows.length) return res.status(404).json({ error: '文章不存在' });
      if (rows[0].author_id !== user.id && !user.is_admin) {
        return res.status(403).json({ error: '只能删除自己的文章' });
      }
      await sql`DELETE FROM comments WHERE post_slug = ${slug}`;
      await sql`DELETE FROM posts WHERE slug = ${slug}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
