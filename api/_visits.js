import { db } from './_db.js';

/** 记录一次页面访问；失败只打日志，不影响页面正常返回 */
export async function logVisit(req, user) {
  try {
    let target = req.url || '/';
    const m = target.match(/^https?:\/\/[^/]+(\/.*)$/);
    if (m) target = m[1];
    const sql = db();
    await sql`
      INSERT INTO visits (user_id, username, path)
      VALUES (${user.id}, ${user.username}, ${target})
    `;
  } catch (err) {
    console.error('[visits] 记录访问失败:', err.message);
  }
}
