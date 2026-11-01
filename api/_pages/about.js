import { currentUser } from '../_auth.js';
import { layout, redirectToLogin } from '../_layout.js';
import { logVisit } from '../_visits.js';

/** 关于页：内容固定，仅做登录墙 */
export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return redirectToLogin(res);
  await logVisit(req, user);

  const body = `
  <main>
    <h2>关于我</h2>
    <p>前端初学者，正在通过手写页面练习 HTML 和 CSS。</p>
  </main>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(layout('关于', body, user));
}
