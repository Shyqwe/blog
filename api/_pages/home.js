import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';
import { layout, redirectToLogin } from '../_layout.js';
import { esc, fmtDate } from '../_html.js';
import { logVisit } from '../_visits.js';

/** 首页：整站登录墙，未登录跳 /login；列表、搜索、标签全部服务端渲染 */
export default async function handler(req, res) {
  // 先查会话：未登录直接跳走，不碰数据库（冷启动时省掉整段数据库等待）
  const user = await currentUser(req);
  if (!user) return redirectToLogin(res);

  const sql = db();
  await ensureSchema();
  await logVisit(req, user);

  try {
    const q = String(req.query.q || '').trim();
    const tag = String(req.query.tag || '').trim();

    let where = sql`published = true`;
    if (q) {
      const like = `%${q}%`;
      where = sql`${where} AND (p.title ILIKE ${like} OR p.content ILIKE ${like})`;
    }
    if (tag) {
      where = sql`${where} AND ${tag} = ANY(p.tags)`;
    }

    const posts = await sql`
      SELECT p.slug, p.title, p.created_at, u.username AS author
      FROM posts p LEFT JOIN users u ON u.id = p.author_id
      WHERE ${where}
      ORDER BY p.created_at DESC
    `;

    const list = posts.length
      ? posts
          .map(
            (p) => `
      <li>
        <a href="/posts/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
        <time>${fmtDate(p.created_at)}</time>
      </li>`
          )
          .join('')
      : '';

    // 标签云在归档页；筛选/搜索时在这里给一条提示，首页正文只保留文章列表
    const notices =
      (tag ? `<p class="filter-notice">标签「${esc(tag)}」 · <a href="${q ? `/?q=${encodeURIComponent(q)}` : '/'}">清除筛选</a></p>` : '') +
      (q ? `<p class="filter-notice">搜索「${esc(q)}」：共 ${posts.length} 篇</p>` : '');

    const heading = q ? '搜索结果' : tag ? '标签筛选' : '最新文章';

    const body = `
  <h2 class="section-title">${heading}</h2>
  ${notices}
  <ul class="post-list">${list}</ul>
  ${posts.length ? '' : '<p class="muted">没有找到匹配的文章。</p>'}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(layout('我的博客', body, user, { active: '/', search: q }));
  } catch (err) {
    console.error(err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(layout('服务器错误', '<h2>500</h2><p>服务器开小差了，请稍后再试。</p>', user));
  }
}
