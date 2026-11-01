import { db, ensureSchema } from './_db.js';

/** 标签与归档统计，供首页标签栏和归档页使用 */
export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();

  try {
    const tags = await sql`
      SELECT tag, count(*)::int AS count
      FROM (SELECT unnest(tags) AS tag FROM posts WHERE published = true) t
      GROUP BY tag
      ORDER BY count DESC, tag
    `;
    const months = await sql`
      SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') AS month,
             count(*)::int AS count
      FROM posts
      WHERE published = true
      GROUP BY month
      ORDER BY month DESC
    `;
    return res.status(200).json({ tags, months });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
