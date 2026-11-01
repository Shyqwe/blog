import postgres from 'postgres';

let _sql = null;

/** 懒加载数据库连接，缺少环境变量时给出可读错误 */
export function db() {
  if (!_sql) {
    if (!process.env.POSTGRES_URL) {
      throw new Error('缺少环境变量 POSTGRES_URL，请在 Vercel 项目中创建 Postgres 数据库');
    }
    _sql = postgres(process.env.POSTGRES_URL, {
      max: 1, // Serverless 实例内保持单连接，避免耗尽连接数
      connect_timeout: 10,
    });
  }
  return _sql;
}

let schemaReady = null;

/** 首次调用时自动建表/补列，之后复用同一个 Promise，无需手动迁移 */
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id            serial PRIMARY KEY,
          username      text UNIQUE NOT NULL,
          password_hash text NOT NULL,
          is_admin      boolean NOT NULL DEFAULT false,
          created_at    timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS posts (
          id          serial PRIMARY KEY,
          slug        text UNIQUE NOT NULL,
          title       text NOT NULL,
          content     text NOT NULL,
          tags        text[] NOT NULL DEFAULT '{}',
          published   boolean NOT NULL DEFAULT true,
          views       integer NOT NULL DEFAULT 0,
          likes       integer NOT NULL DEFAULT 0,
          created_at  timestamptz NOT NULL DEFAULT now(),
          updated_at  timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS comments (
          id         serial PRIMARY KEY,
          post_slug  text NOT NULL,
          name       text NOT NULL DEFAULT '匿名',
          body       text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      // 老库迁移：文章作者、评论用户；账号字段已并入用户名
      await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_id integer`;
      await sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_id integer`;
      await sql`ALTER TABLE users DROP COLUMN IF EXISTS account`;
      await sql`CREATE INDEX IF NOT EXISTS comments_post_slug_idx ON comments (post_slug)`;
    })().catch((err) => {
      schemaReady = null; // 失败后允许下次请求重试
      throw err;
    });
  }
  return schemaReady;
}
