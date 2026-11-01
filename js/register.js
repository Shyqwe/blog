// 注册页：账号 + 用户名 + 密码，成功后自动登录并跳转首页

const form = document.getElementById('register-form');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = form.querySelector('.error');
  err.textContent = '';

  if (form.password.value !== form.password2.value) {
    err.textContent = '两次输入的密码不一致';
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: form.account.value,
        username: form.username.value,
        password: form.password.value,
      }),
    });
    if (res.ok) {
      location.href = '/';
    } else {
      const data = await res.json().catch(() => ({}));
      err.textContent = data.error || '注册失败，请稍后再试';
    }
  } catch {
    err.textContent = '网络异常，请稍后再试';
  } finally {
    btn.disabled = false;
  }
});

// 已登录用户不需要停留在注册页
fetch('/api/me')
  .then((r) => r.json())
  .then(({ user }) => {
    if (user) location.href = '/';
  })
  .catch(() => {});
