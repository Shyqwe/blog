// 侧边栏：折叠/展开（桌面收起为纯内容区，手机端为抽屉）
const toggle = document.getElementById('sidebar-toggle');
const backdrop = document.getElementById('sidebar-backdrop');
const html = document.documentElement;

if (toggle) {
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

  toggle.addEventListener('click', () => {
    if (isMobile()) {
      // 手机：开关抽屉
      html.classList.toggle('sb-open');
    } else {
      // 桌面：折叠/展开，状态记住
      html.classList.toggle('sb-collapsed');
      try {
        localStorage.setItem('sidebar', html.classList.contains('sb-collapsed') ? 'collapsed' : 'open');
      } catch {}
    }
  });

  // 手机：点遮罩关抽屉
  backdrop.addEventListener('click', () => html.classList.remove('sb-open'));
}

// 头像下拉菜单：点击切换、点击别处收起、设置二级面板、深色模式、退出登录

const menu = document.getElementById('user-menu');
if (menu) {
  // 主菜单 ↔ 设置面板切换
  document.getElementById('settings-link').addEventListener('click', () => {
    menu.classList.add('settings-open');
  });
  document.getElementById('settings-back').addEventListener('click', () => {
    menu.classList.remove('settings-open');
  });

  // 点头像开合，点别处收起（菜单内部的点击不收起，否则设置面板打不开）
  menu.querySelector('.user-chip').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    if (!menu.classList.contains('open')) menu.classList.remove('settings-open');
  });
  document.addEventListener('click', (e) => {
    if (menu.contains(e.target)) return;
    menu.classList.remove('open');
    menu.classList.remove('settings-open');
  });

  // 深色模式：偏好存 localStorage，切换立即生效
  const themeSwitch = document.getElementById('theme-switch');
  themeSwitch.checked = document.documentElement.getAttribute('data-theme') === 'dark';
  themeSwitch.addEventListener('change', () => {
    if (themeSwitch.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      try {
        localStorage.setItem('theme', 'dark');
      } catch {}
    } else {
      document.documentElement.removeAttribute('data-theme');
      try {
        localStorage.setItem('theme', 'light');
      } catch {}
    }
  });

  // 退出登录
  document.getElementById('logout-link').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth', { method: 'DELETE' });
    location.href = '/login';
  });
}
