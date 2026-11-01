import crypto from 'node:crypto';
import { db } from './_db.js';

const COOKIE_NAME = 'blog_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 会话有效期 7 天

/** 会话签名密钥：优先 SESSION_SECRET，兼容旧的 ADMIN_PASSWORD */
function secret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'blog-dev-secret';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

/** 生成「用户ID.过期时间戳.HMAC 签名」形式的会话令牌，无需数据库存会话 */
export function createSessionToken(userId) {
  const expiry = String(Date.now() + MAX_AGE_SECONDS * 1000);
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/** 校验令牌签名与有效期，返回用户 ID 或 null */
export function verifySessionToken(token) {
  if (!token) return null;
  const first = token.indexOf('.');
  const last = token.lastIndexOf('.');
  if (first < 1 || last === first) return null;
  const payload = token.slice(0, last);
  const sig = token.slice(last + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [id, expiry] = payload.split('.');
  if (Number(expiry) <= Date.now()) return null;
  const userId = Number(id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/** 从请求中解析出当前登录用户（查库，保证 is_admin/username 实时） */
export async function currentUser(req) {
  const userId = verifySessionToken(parseCookies(req.headers.cookie)[COOKIE_NAME]);
  if (!userId) return null;
  const sql = db();
  const rows = await sql`
    SELECT id, username, is_admin, created_at
    FROM users WHERE id = ${userId}
  `;
  return rows[0] || null;
}

// ---------- 密码哈希（scrypt，随机盐，绝不存明文） ----------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPasswordHash(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ---------- 会话 cookie ----------

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
