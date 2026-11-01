import { db, ensureSchema } from './_db.js';
import { currentUser } from './_auth.js';

/** 标题/slug 转成 URL 友好形式；纯中文标题会得到空串，由调用方回退到时间戳 slug */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function parseTags(input) {
  const list = Array.isArray(input) ? input : String(input || '').split(/[,，]/);
  return list.map((t) => String(t).trim()).filter(Boolean).slice(0, 10);
}

export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);

  try {
    // 列表：?q= 搜索，?tag= 按标签过滤
    // ?mine=1 登录用户看自己的（含草稿）；?all=1 仅管理员（所有人的含草稿）
    if (req.method === 'GET') {
      const mine = req.query.mine === '1';
      const all = req.query.all === '1';
      if ((mine && !user) || (all && !user?.is_admin)) {
        return res.status(401).json({ error: '请先登录' });
      }

      const q = String(req.query.q || '').trim();
      const tag = String(req.query.tag || '').trim();

      let where = sql`published = true`;
      if (all && user.is_admin) where = sql`true`;
      else if (mine) where = sql`author_id = ${user.id}`;

      if (q) {
        const like = `%${q}%`;
        where = sql`${where} AND (title ILIKE ${like} OR content ILIKE ${like})`;
      }
      if (tag) {
        where = sql`${where} AND ${tag} = ANY(tags)`;
      }

      const posts = await sql`
        SELECT p.slug, p.title, p.tags, p.published, p.views, p.likes,
               p.created_at, p.updated_at, p.author_id, u.username AS author
        FROM posts p
        LEFT JOIN users u ON u.id = p.author_id
        WHERE ${where}
        ORDER BY p.created_at DESC
      `;
      return res.status(200).json(posts);
    }

    // 新建文章：任何登录用户
    if (req.method === 'POST') {
      if (!user) return res.status(401).json({ error: '请先登录' });

      const title = String(req.body?.title || '').trim();
      const content = String(req.body?.content || '');
      const tags = parseTags(req.body?.tags);
      const published = req.body?.published !== false;
      const slug =
        slugify(req.body?.slug) || slugify(title) || `post-${Date.now()}`;

      if (!title) return res.status(400).json({ error: '标题不能为空' });
      if (!content.trim()) return res.status(400).json({ error: '正文不能为空' });

      const rows = await sql`
        INSERT INTO posts (slug, title, content, tags, published, author_id)
        VALUES (${slug}, ${title}, ${content}, ${tags}, ${published}, ${user.id})
        RETURNING slug, title, tags, published, created_at
      `;
      return res.status(201).json(rows[0]);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: '该 slug 已存在，请换一个' });
    }
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
