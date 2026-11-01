// 登录页：提交后跳回首页；已登录则直接跳走

const form = document.getElementById('login-form');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = form.querySelector('.error');
  err.textContent = '';
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: form.account.value,
        password: form.password.value,
      }),
    });
    if (res.ok) {
      location.href = '/';
    } else {
      const data = await res.json().catch(() => ({}));
      err.textContent = data.error || '登录失败，请稍后再试';
    }
  } catch {
    err.textContent = '网络异常，请稍后再试';
  } finally {
    btn.disabled = false;
  }
});

// 已登录用户不需要停留在登录页
fetch('/api/me')
  .then((r) => r.json())
  .then(({ user }) => {
    if (user) location.href = '/';
  })
  .catch(() => {});
