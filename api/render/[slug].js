import { db, ensureSchema } from '../_db.js';
import { currentUser } from '../_auth.js';
import { layout, redirectToLogin } from '../_layout.js';
import { esc, fmtDate } from '../_html.js';
import { logVisit } from '../_visits.js';

/**
 * 文章阅读页：/posts/:slug 经 vercel.json rewrite 到这里。
 * 整站登录墙的一部分：未登录一律跳转 /login。
 * markdown 渲染包改为函数内动态加载：一是便于把加载错误显示在诊断页，
 * 二是静态引入它们曾导致 Vercel 上整个函数启动失败（本地无法复现）。
 */
export default async function handler(req, res) {
  const sql = db();

  try {
    await ensureSchema();
    const user = await currentUser(req);
    if (!user) return redirectToLogin(res);
    await logVisit(req, user);

    const slug = String(req.query.slug || '');
    const { marked } = await import('marked');
    const sanitizeHtml = (await import('sanitize-html')).default;

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

    // 当前用户是否已赞过这篇文章（服务端下发，替代原来的 localStorage 记忆）
    const likedRows = await sql`
      SELECT 1 FROM likes WHERE post_slug = ${post.slug} AND user_id = ${user.id}
    `;
    const liked = likedRows.length > 0;

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
        <button id="like-btn" data-slug="${esc(post.slug)}" data-liked="${liked ? 1 : 0}" ${liked ? 'disabled' : ''}>👍 点赞 <span id="like-count">${post.likes}</span></button>
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
    console.error('[render] 文章页出错:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(
      layout(
        '服务器错误',
        '<main><h2>500</h2><p>服务器开小差了，请稍后再试。</p><p><a href="/">返回首页</a></p></main>'
      )
    );
  }
}
