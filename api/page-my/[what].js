import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';
import { layout, redirectToLogin } from '../_layout.js';
import { esc, fmtDate } from '../_html.js';
import { logVisit } from '../_visits.js';

const TITLES = {
  posts: '我的文章',
  comments: '我的评论',
  'liked-posts': '赞过的文章',
  'liked-comments': '赞过的评论',
};

/** 「我的…」页面：/my/posts | /my/comments | /my/liked-posts | /my/liked-comments */
export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return redirectToLogin(res);
  try {
    await logVisit(req, user);
  } catch {}

  const what = String(req.query.what || '');
  const title = TITLES[what];
  if (!title) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(layout('页面不存在', '<main><h2>404</h2><p><a href="/">返回首页</a></p></main>', user));
  }

  try {
    let listHtml = '';

    if (what === 'posts') {
      const posts = await sql`
        SELECT slug, title, published, views, likes, created_at
        FROM posts WHERE author_id = ${user.id}
        ORDER BY created_at DESC
      `;
      listHtml = posts.length
        ? `<ul class="post-list">${posts
            .map(
              (p) => `
        <li>
          <a href="/posts/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
          <time>${fmtDate(p.created_at)}</time>
        </li>`
            )
            .join('')}</ul>${posts.some((p) => !p.published) ? '<p class="muted">提示：草稿只有你自己能看到。</p>' : ''}`
        : '<p class="muted">还没有发过文章，点右上角「写文章」写第一篇吧。</p>';
    } else if (what === 'comments') {
      const comments = await sql`
        SELECT c.id, c.body, c.created_at, c.post_slug, p.title AS post_title
        FROM comments c LEFT JOIN posts p ON p.slug = c.post_slug
        WHERE c.user_id = ${user.id}
        ORDER BY c.created_at DESC
        LIMIT 200
      `;
      listHtml = comments.length
        ? comments
            .map(
              (c) => `
      <div class="my-item">
        <p class="my-item-body">${esc(c.body)}</p>
        <p class="my-item-meta">
          评论于 <a href="/posts/${encodeURIComponent(c.post_slug)}">${esc(c.post_title || '已删除的文章')}</a>
          · <time>${fmtDate(c.created_at)}</time>
        </p>
      </div>`
            )
            .join('')
        : '<p class="muted">还没有发过评论。</p>';
    } else if (what === 'liked-posts') {
      const posts = await sql`
        SELECT p.slug, p.title, p.author_id, u.username AS author, p.created_at
        FROM likes l JOIN posts p ON p.slug = l.post_slug
        LEFT JOIN users u ON u.id = p.author_id
        WHERE l.user_id = ${user.id} AND p.published = true
        ORDER BY l.created_at DESC
        LIMIT 200
      `;
      listHtml = posts.length
        ? `<ul class="post-list">${posts
            .map(
              (p) => `
        <li>
          <a href="/posts/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
          <time>${fmtDate(p.created_at)}</time>
        </li>`
            )
            .join('')}</ul>`
        : '<p class="muted">还没有赞过文章。打开文章页点「👍 点赞」试试。</p>';
    } else {
      const comments = await sql`
        SELECT c.id, c.name, c.body, c.likes, c.created_at, c.post_slug, p.title AS post_title
        FROM comment_likes cl
        JOIN comments c ON c.id = cl.comment_id
        LEFT JOIN posts p ON p.slug = c.post_slug
        WHERE cl.user_id = ${user.id}
        ORDER BY cl.created_at DESC
        LIMIT 200
      `;
      listHtml = comments.length
        ? comments
            .map(
              (c) => `
      <div class="my-item">
        <p class="my-item-body">${esc(c.body)}</p>
        <p class="my-item-meta">
          ${esc(c.name)} 的评论 · <a href="/posts/${encodeURIComponent(c.post_slug)}">${esc(c.post_title || '已删除的文章')}</a>
          · 👍 ${c.likes} · <time>${fmtDate(c.created_at)}</time>
        </p>
      </div>`
            )
            .join('')
        : '<p class="muted">还没有赞过评论。评论旁的 👍 就是点赞按钮。</p>';
    }

    const body = `
  <main>
    <h2>${esc(title)}</h2>
    ${listHtml}
  </main>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(layout(title, body, user));
  } catch (err) {
    console.error(err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(layout('服务器错误', '<main><h2>500</h2><p>服务器开小差了，请稍后再试。</p></main>', user));
  }
}
