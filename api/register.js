import { db, ensureSchema } from './_db.js';
import { hashPassword, createSessionToken, setSessionCookie } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sql = db();
  await ensureSchema();

  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || username.length > 20) {
      return res.status(400).json({ error: '用户名不能为空且不超过 20 字' });
    }
    if (password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: '密码长度需在 6-72 位之间' });
    }

    // 第一位注册的用户自动成为管理员
    const existing = await sql`SELECT count(*)::int AS n FROM users`;
    const isFirstUser = existing[0].n === 0;

    const rows = await sql`
      INSERT INTO users (username, password_hash, is_admin)
      VALUES (${username}, ${hashPassword(password)}, ${isFirstUser})
      RETURNING id, username, is_admin
    `;
    const user = rows[0];

    // 注册成功即登录
    setSessionCookie(res, createSessionToken(user.id));
    return res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: '该用户名已被使用' });
    }
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
