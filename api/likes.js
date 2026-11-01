import { db, ensureSchema } from './_db.js';

/** 点赞：浏览量级别的简化实现，防重复靠前端 localStorage */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sql = db();
  await ensureSchema();

  try {
    const slug = String(req.body?.slug || '');
    if (!slug) return res.status(400).json({ error: '缺少 slug' });

    const rows = await sql`
      UPDATE posts SET likes = likes + 1
      WHERE slug = ${slug} AND published = true
      RETURNING likes
    `;
    if (!rows.length) return res.status(404).json({ error: '文章不存在' });
    return res.status(200).json({ likes: rows[0].likes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
