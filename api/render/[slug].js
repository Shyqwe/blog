import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';
import { layout, redirectToLogin } from '../_layout.js';
import { esc, fmtDate } from '../_html.js';

/**
 * 文章阅读页：/posts/:slug 经 vercel.json rewrite 到这里。
 * 整站登录墙的一部分：未登录一律跳转 /login。
 * 服务端渲染正文（利于 SEO），评论与点赞由 /js/post.js 客户端加载。
 */
export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();
  const user = await currentUser(req);
  if (!user) return redirectToLogin(res);

  const slug = String(req.query.slug || '');

  try {
    const rows = await sql`
      SELECT p.*, u.username AS author
      FROM posts p LEFT JOIN users u ON u.id = p.author_id
      WHERE p.slug = ${slug}
    `;
    const post = rows[0];
    const canPreview = post && (post.published || post.author_id === user.id || user.is_admin);

    if (!canPreview) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(
        layout('文章不存在', '<main><h2>404</h2><p>文章不存在或未发布。</p><p><a href="/">返回首页</a></p></main>', user)
      );
    }

    // 浏览量 +1（草稿预览不计数）
    if (post.published) {
      await sql`UPDATE posts SET views = views + 1 WHERE id = ${post.id}`;
      post.views += 1;
    }

    // markdown → HTML，再过滤掉危险标签，防 XSS
    const contentHtml = sanitizeHtml(marked.parse(post.content));

    const tagsHtml = post.tags.length
      ? post.tags
          .map((t) => `<a class="tag" href="/?tag=${encodeURIComponent(t)}">${esc(t)}</a>`)
          .join('')
      : '';

    const body = `
  <main>
    <article class="post">
      <h1 class="post-title">${esc(post.title)}</h1>
      <p class="post-meta">
        ${post.author ? `${esc(post.author)} · ` : ''}<time>${fmtDate(post.created_at)}</time> · ${post.views} 次浏览${
          post.published ? '' : ' · <span class="draft-badge">草稿</span>'
        }
      </p>
      ${tagsHtml ? `<p class="post-tags">${tagsHtml}</p>` : ''}
      <div class="post-content">${contentHtml}</div>
      <div class="post-actions">
        <button id="like-btn" data-slug="${esc(post.slug)}">👍 点赞 <span id="like-count">${post.likes}</span></button>
      </div>
    </article>

    <section class="comments">
      <h2>评论</h2>
      <form id="comment-form" class="stack">
        <!-- 蜜罐字段：正常用户不可见也不填写，机器人填了就被静默丢弃 -->
        <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off">
        <textarea name="body" rows="4" required maxlength="2000" placeholder="说点什么…"></textarea>
        <div><button type="submit">发表评论</button></div>
      </form>
      <div id="comment-list">加载中…</div>
    </section>
  </main>
  <script src="/js/post.js" defer></script>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(layout(post.title, body, user));
  } catch (err) {
    console.error(err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(layout('服务器错误', '<main><h2>500</h2><p>服务器开小差了，请稍后再试。</p></main>', user));
  }
}
