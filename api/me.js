import { currentUser } from './_auth.js';

/** 当前登录用户信息；未登录返回 { user: null } */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const user = await currentUser(req);
  return res.status(200).json({
    user: user
      ? { id: user.id, account: user.account, username: user.username, is_admin: user.is_admin }
      : null,
  });
}
