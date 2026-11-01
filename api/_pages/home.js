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

    const [posts, tags] = await Promise.all([
      sql`
        SELECT p.slug, p.title, p.created_at, u.username AS author
        FROM posts p LEFT JOIN users u ON u.id = p.author_id
        WHERE ${where}
        ORDER BY p.created_at DESC
      `,
      sql`
        SELECT tag, count(*)::int AS count
        FROM (SELECT unnest(tags) AS tag FROM posts WHERE published = true) t
        GROUP BY tag ORDER BY count DESC, tag
      `,
    ]);

    const tagBar =
      (tag ? `<a class="tag" href="${q ? `/?q=${encodeURIComponent(q)}` : '/'}">全部</a>` : '') +
      tags
        .map(
          (t) =>
            `<a class="tag${t.tag === tag ? ' active' : ''}" href="/?tag=${encodeURIComponent(t.tag)}${q ? `&q=${encodeURIComponent(q)}` : ''}">${esc(t.tag)} (${t.count})</a>`
        )
        .join('');

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

    const body = `
  <main>
    <form class="toolbar" method="get" action="/">
      ${tag ? `<input type="hidden" name="tag" value="${esc(tag)}">` : ''}
      <input type="search" name="q" value="${esc(q)}" placeholder="搜索文章…">
    </form>
    ${tags.length ? `<div class="tag-bar">${tagBar}</div>` : ''}
    <ul class="post-list">${list}</ul>
    ${posts.length ? '' : '<p class="muted">没有找到匹配的文章。</p>'}
  </main>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(layout('我的博客', body, user));
  } catch (err) {
    console.error(err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(layout('服务器错误', '<main><h2>500</h2><p>服务器开小差了，请稍后再试。</p></main>', user));
  }
}
