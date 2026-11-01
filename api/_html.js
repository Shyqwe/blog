/** HTML 转义，服务端拼接页面时统一使用 */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function fmtDate(d) {
  return new Date(d).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}
