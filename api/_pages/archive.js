import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';
import { layout, redirectToLogin } from '../_layout.js';
import { esc, fmtDate } from '../_html.js';
import { logVisit } from '../_visits.js';

/** 归档页：标签云 + 按月分组，服务端渲染 */
export default async function handler(req, res) {
  // 先查会话：未登录直接跳走，不碰数据库（冷启动时省掉整段数据库等待）
  const user = await currentUser(req);
  if (!user) return redirectToLogin(res);

  const sql = db();
  await ensureSchema();
  await logVisit(req, user);

  try {
    const [posts, tags] = await Promise.all([
      sql`
        SELECT p.slug, p.title, p.created_at
        FROM posts p WHERE p.published = true
        ORDER BY p.created_at DESC
      `,
      sql`
        SELECT tag, count(*)::int AS count
        FROM (SELECT unnest(tags) AS tag FROM posts WHERE published = true) t
        GROUP BY tag ORDER BY count DESC, tag
      `,
    ]);

    // 按月分组（zh-CN 格式化形如「2026年11月」）
    const groups = {};
    for (const p of posts) {
      const month = new Date(p.created_at).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        timeZone: 'Asia/Shanghai',
      });
      (groups[month] ||= []).push(p);
    }
    const months = Object.keys(groups).sort().reverse();

    const tagCloud = tags
      .map((t) => `<a class="tag" href="/?tag=${encodeURIComponent(t.tag)}">${esc(t.tag)} (${t.count})</a>`)
      .join('');

    const archive = months.length
      ? months
          .map(
            (m) => `
    <section class="archive-month">
      <h2>${m}</h2>
      <ul class="post-list">
        ${groups[m]
          .map(
            (p) => `
        <li>
          <a href="/posts/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
          <time>${fmtDate(p.created_at)}</time>
        </li>`
          )
          .join('')}
      </ul>
    </section>`
          )
          .join('')
      : '<p class="muted">还没有文章。</p>';

    const body = `
  <main>
    ${tags.length ? `<h2>标签</h2>\n    <div class="tag-bar">${tagCloud}</div>` : ''}
    <h2>归档</h2>
    ${archive}
  </main>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(layout('归档', body, user));
  } catch (err) {
    console.error(err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(layout('服务器错误', '<main><h2>500</h2><p>服务器开小差了，请稍后再试。</p></main>', user));
  }
}
