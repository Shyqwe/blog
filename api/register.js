import { db, ensureSchema } from './_db.js';
import { hashPassword, createSessionToken, setSessionCookie } from './_auth.js';

// 账号仅限字母/数字/下划线/短横线，用于登录
const ACCOUNT_RE = /^[a-zA-Z0-9_-]{3,30}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sql = db();
  await ensureSchema();

  try {
    const account = String(req.body?.account || '').trim();
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!ACCOUNT_RE.test(account)) {
      return res.status(400).json({ error: '账号需为 3-30 位字母、数字、下划线或短横线' });
    }
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
      INSERT INTO users (account, username, password_hash, is_admin)
      VALUES (${account}, ${username}, ${hashPassword(password)}, ${isFirstUser})
      RETURNING id, account, username, is_admin
    `;
    const user = rows[0];

    // 注册成功即登录
    setSessionCookie(res, createSessionToken(user.id));
    return res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') {
      // 唯一索引冲突：区分账号和用户名，给出准确提示
      const dupAccount = await sql`SELECT 1 FROM users WHERE account = ${req.body?.account || ''}`;
      return res
        .status(409)
        .json({ error: dupAccount.length ? '该账号已被注册' : '该用户名已被使用' });
    }
    console.error(err);
    return res.status(500).json({ error: '服务器错误' });
  }
}
