import { db, ensureSchema } from './_db.js';
import { verifyPasswordHash, createSessionToken, setSessionCookie, clearSessionCookie } from './_auth.js';

export default async function handler(req, res) {
  // 登录：账号 + 密码，签发 7 天有效的会话 cookie
  if (req.method === 'POST') {
    const sql = db();
    await ensureSchema();

    const account = String(req.body?.account || '').trim();
    const password = String(req.body?.password || '');
    if (!account || !password) {
      return res.status(400).json({ error: '请输入账号和密码' });
    }

    const rows = await sql`SELECT * FROM users WHERE account = ${account}`;
    const user = rows[0];
    // 不区分「账号不存在」和「密码错误」，避免被用来探测已注册账号
    if (!user || !verifyPasswordHash(password, user.password_hash)) {
      return res.status(401).json({ error: '账号或密码错误' });
    }

    setSessionCookie(res, createSessionToken(user.id));
    return res.status(200).json({ ok: true });
  }

  // 退出登录
  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
