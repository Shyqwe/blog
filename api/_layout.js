import { esc } from './_html.js';

/** 公共页面骨架：所有需要登录的页面共用，user 为当前登录用户 */
export function layout(title, bodyHtml, user = null) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} - 我的博客</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header class="site-header">
    <h1><a href="/">我的博客</a></h1>
    <nav>
      <a href="/">首页</a>
      <a href="/archive">归档</a>
      <a href="/about">关于</a>
    </nav>
  </header>
  ${bodyHtml}
  <footer class="site-footer">
    <span class="muted">${user ? `${esc(user.username)} 已登录` : ''}</span>
    <a href="/admin">管理</a>
  </footer>
</body>
</html>`;
}

/** 未登录时的统一跳转 */
export function redirectToLogin(res) {
  res.setHeader('Location', '/login');
  return res.status(302).end();
}
