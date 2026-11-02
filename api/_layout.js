import { esc } from './_html.js';

/** 头像颜色：由用户名稳定地映射到调色板中的一种 */
const AVATAR_COLORS = ['#e8a33d', '#5b8def', '#50b87a', '#e0654f', '#9a6dd7', '#38a3c6', '#d75f94'];

function avatarColor(username) {
  let hash = 0;
  for (const ch of String(username)) hash = (hash + ch.codePointAt(0)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** 在页面渲染前应用本地保存的主题，避免深色模式闪白 */
const THEME_SCRIPT = `<script>
  (function () {
    try {
      if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (e) {}
  })();
</script>`;

/** 公共页面骨架：所有需要登录的页面共用，user 为当前登录用户 */
export function layout(title, bodyHtml, user = null) {
  const fullTitle = title === '我的博客' ? title : `${esc(title)} - 我的博客`;
  const firstChar = user ? [...String(user.username).trim()][0] || '?' : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fullTitle}</title>
  ${THEME_SCRIPT}
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header class="site-header">
    <h1><a href="/">我的博客</a></h1>
    <nav>
      <a href="/">首页</a>
      <a href="/archive">归档</a>
      <a href="/about">关于</a>
      <a href="/admin" class="nav-cta">✏️ 写文章</a>${
        user
          ? `
      <div class="user-menu" id="user-menu">
        <button class="user-chip" type="button" title="${esc(user.username)}">
          <span class="avatar" style="background:${avatarColor(user.username)}">${esc(firstChar)}</span>
          <span class="user-name">${esc(user.username)}</span>
        </button>
        <div class="user-dropdown">
          <div class="menu-panel">
            <a href="/my/posts">我的文章</a>
            <a href="/my/comments">我的评论</a>
            <a href="/my/liked-posts">赞过的文章</a>
            <a href="/my/liked-comments">赞过的评论</a>
            <button type="button" id="settings-link">⚙️ 设置</button>
          </div>
          <div class="settings-panel">
            <button type="button" id="settings-back" class="settings-back">‹ 返回</button>
            <label class="theme-toggle">
              <span>深色模式</span>
              <input type="checkbox" id="theme-switch">
              <span class="switch"></span>
            </label>
            <button type="button" id="logout-link">退出登录</button>
          </div>
        </div>
      </div>`
          : ''
      }
    </nav>
  </header>
  ${bodyHtml}
  <footer class="site-footer">
    <span class="muted">${user ? `${esc(user.username)} 已登录` : ''}</span>
    ${user?.is_admin ? '<a href="/admin">管理</a>' : ''}
  </footer>
  <script src="/js/user-menu.js" defer></script>
</body>
</html>`;
}

/** 未登录时的统一跳转 */
export function redirectToLogin(res) {
  res.setHeader('Location', '/login');
  return res.status(302).end();
}
