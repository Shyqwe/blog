// 头像下拉菜单：点击切换、点击别处收起、退出登录

const menu = document.getElementById('user-menu');
if (menu) {
  menu.querySelector('.user-chip').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  document.addEventListener('click', () => menu.classList.remove('open'));

  const logout = document.getElementById('logout-link');
  logout.addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth', { method: 'DELETE' });
    location.href = '/login';
  });
}
