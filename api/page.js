import home from './_pages/home.js';
import archive from './_pages/archive.js';
import about from './_pages/about.js';
import my from './_pages/my.js';

/** 页面调度器：vercel.json 用 ?p= 指定页面，四个页面共用一个函数（Hobby 上限 12 个函数） */
export default function handler(req, res) {
  const p = String(req.query.p || 'home');
  if (p === 'archive') return archive(req, res);
  if (p === 'about') return about(req, res);
  if (p === 'my') return my(req, res);
  return home(req, res);
}
