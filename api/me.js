import { db, ensureSchema } from './_db.js';
import { currentUser } from './_auth.js';

/**
 * GET    /api/me          → 当前登录用户信息（未登录返回 { user: null }，不报 401）
 * GET    /api/me?users=1  → 管理员：全部注册用户列表（含文章/评论计数）
 * DELETE /api/me?id=N      → 管理员：删除用户，并级联删除其文章、评论、点赞、访问记录
 */
export default async function handler(req, res) {
  const sql = db();
  await ensureSchema();

  // 当前登录用户信息（公开：未登录也算一种状态，返回 null）
  if (req.method === 'GET' && String(req.query.users || '') !== '1') {
    const user = await currentUser(req);
    return res.status(200).json({
      user: user ? { id: user.id, username: user.username, is_admin: user.is_admin } : null,
    });
  }

  // 管理员：全部注册用户列表（含文章/评论计数）
  if (req.method === 'GET') {
    const admin = await currentUser(req);
    if (!admin) return res.status(401).json({ error: '请先登录' });
    if (!admin.is_admin) return res.status(403).json({ error: '需要管理员权限' });

    try {
      const users = await sql`
        SELECT u.id, u.username, u.is_admin, u.created_at,
               (SELECT count(*)::int FROM posts p WHERE p.author_id = u.id) AS post_count,
               (SELECT count(*)::int FROM comments c WHERE c.user_id = u.id) AS comment_count
        FROM users u
        ORDER BY u.created_at ASC
      `;
      return res.status(200).json({ users });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服务器错误' });
    }
  }

  // 管理员：删除用户，并级联删除其文章、评论、点赞、访问记录
  if (req.method === 'DELETE') {
    const admin = await currentUser(req);
    if (!admin) return res.status(401).json({ error: '请先登录' });
    if (!admin.is_admin) return res.status(403).json({ error: '需要管理员权限' });

    const targetId = Number(req.query.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: '无效的用户 ID' });
    }
    if (targetId === admin.id) return res.status(400).json({ error: '不能删除自己' });

    try {
      const [target] = await sql`SELECT id, is_admin FROM users WHERE id = ${targetId}`;
      if (!target) return res.status(404).json({ error: '用户不存在' });
      if (target.is_admin) return res.status(400).json({ error: '不能删除管理员账户' });

      await sql.begin(async (tx) => {
        // 该用户文章下的评论和点赞（含其他人留下的）随文章一起清除
        const owned = await tx`SELECT slug FROM posts WHERE author_id = ${targetId}`;
        const slugs = owned.map((p) => p.slug);
        if (slugs.length) {
          await tx`DELETE FROM comments WHERE post_slug = ANY(${slugs})`;
          await tx`DELETE FROM likes WHERE post_slug = ANY(${slugs})`;
        }
        // 该用户在别人内容下留下的痕迹
        await tx`DELETE FROM comment_likes WHERE user_id = ${targetId}`;
        await tx`DELETE FROM likes WHERE user_id = ${targetId}`;
        await tx`DELETE FROM comments WHERE user_id = ${targetId}`;
        await tx`DELETE FROM visits WHERE user_id = ${targetId}`;
        await tx`DELETE FROM posts WHERE author_id = ${targetId}`;
        await tx`DELETE FROM users WHERE id = ${targetId}`;
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: '服务器错误' });
    }
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
