// 管理后台：登录 → 我的文章（管理员看全部）→ markdown 编辑器
// 权限规则：普通用户只能编辑/删除/上下架自己的文章，管理员可以管理全部

const loginSection = document.getElementById('login-section');
const adminSection = document.getElementById('admin-section');
const loginForm = document.getElementById('login-form');
const manageList = document.getElementById('manage-list');
const editorSection = document.getElementById('editor-section');
const editorForm = document.getElementById('editor-form');
const editorTitle = document.getElementById('editor-title');
const whoami = document.getElementById('whoami');

let me = null; // 当前登录用户
let editingSlug = null; // null = 新建文章

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('zh-CN');
}

function show(el, on = true) {
  el.hidden = !on;
}

async function jsonFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || '请求失败'), { status: res.status });
  return data;
}

// ---------- 登录 ----------

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await jsonFetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginForm.username.value,
        password: loginForm.password.value,
      }),
    });
    loginForm.querySelector('.error').textContent = '';
    init();
  } catch (err) {
    loginForm.querySelector('.error').textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth', { method: 'DELETE' });
  me = null;
  show(adminSection, false);
  show(loginSection, true);
});

// ---------- 文章列表 ----------

async function init() {
  try {
    const { user } = await jsonFetch('/api/me');
    me = user;
    if (!me) {
      show(adminSection, false);
      show(loginSection, true);
      return;
    }
    show(loginSection, false);
    show(adminSection, true);
    whoami.textContent = me.is_admin ? `（管理员 ${me.username}）` : `（${me.username}）`;

    // 管理员看全部文章，普通用户只看自己的
    const posts = await jsonFetch(me.is_admin ? '/api/posts?all=1' : '/api/posts?mine=1');
    renderList(posts);

    // 访问记录与用户管理仅管理员可见
    if (me.is_admin) {
      loadVisits();
      loadUsers();
    }
  } catch (err) {
    if (err.status === 401) {
      show(adminSection, false);
      show(loginSection, true);
    }
  }
}

function canManage(post) {
  return me.is_admin || post.author_id === me.id;
}

function renderList(posts) {
  manageList.innerHTML = posts
    .map((p) => {
      const actions = canManage(p)
        ? `<div class="row-actions">
            <button data-action="edit" data-slug="${p.slug}">编辑</button>
            <button data-action="toggle" data-slug="${p.slug}" data-published="${p.published}">${p.published ? '下架' : '发布'}</button>
            <button data-action="delete" data-slug="${p.slug}">删除</button>
          </div>`
        : '<span class="muted">他人文章</span>';
      return `
    <li>
      <div>
        <a href="/posts/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a>
        ${p.published ? '' : '<span class="draft-badge">草稿</span>'}
        ${p.author && p.author_id !== me.id ? `<span class="muted">作者：${escapeHtml(p.author)}</span>` : ''}
        <div class="muted">${p.views} 浏览 · ${p.likes} 赞 · ${fmtDate(p.created_at)}</div>
      </div>
      ${actions}
    </li>`;
    })
    .join('') || '<li class="muted">还没有文章，点「新建文章」写第一篇吧。</li>';
}

manageList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, slug } = btn.dataset;

  if (action === 'edit') {
    openEditor(slug);
    return;
  }
  if (action === 'toggle') {
    btn.disabled = true;
    try {
      await jsonFetch(`/api/posts/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: btn.dataset.published !== 'true' }),
      });
      init();
    } catch (err) {
      btn.disabled = false;
      alert(err.message);
    }
    return;
  }
  if (action === 'delete') {
    if (!confirm(`确定删除「${slug}」？其评论会一并删除。`)) return;
    try {
      await jsonFetch(`/api/posts/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      init();
    } catch (err) {
      alert(err.message);
    }
  }
});

// ---------- 访问记录（仅管理员） ----------

async function loadVisits() {
  const section = document.getElementById('visits-section');
  try {
    const v = await jsonFetch('/api/visits');
    show(section, true);
    document.getElementById('visit-stats').innerHTML =
      `<span>总访问 <strong>${v.total}</strong></span><span>今日访问 <strong>${v.today}</strong></span>`;
    document.getElementById('visit-rows').innerHTML = v.recent
      .map(
        (r) => `
      <tr>
        <td>${new Date(r.created_at).toLocaleString('zh-CN')}</td>
        <td>${escapeHtml(r.username)}</td>
        <td>${escapeHtml(r.path)}</td>
      </tr>`
      )
      .join('');
  } catch {
    show(section, false); // 静默失败，不影响文章管理
  }
}

// ---------- 用户管理（仅管理员）：列出全部注册用户，可删除 ----------

async function loadUsers() {
  const section = document.getElementById('users-section');
  try {
    const { users } = await jsonFetch('/api/me?users=1');
    show(section, true);
    document.getElementById('user-rows').innerHTML =
      users
        .map((u) => {
          const del =
            u.is_admin || u.id === me.id
              ? '<span class="muted">—</span>'
              : `<button data-user-del="${u.id}" data-username="${escapeHtml(u.username)}">删除</button>`;
          return `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}${u.is_admin ? ' <span class="draft-badge">管理员</span>' : ''}</td>
        <td>${u.post_count}</td>
        <td>${u.comment_count}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td>${del}</td>
      </tr>`;
        })
        .join('') || '<tr><td colspan="6" class="muted">还没有注册用户。</td></tr>';
  } catch {
    show(section, false); // 非管理员或接口失败时整块隐藏
  }
}

document.getElementById('user-rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-user-del]');
  if (!btn) return;
  const id = btn.dataset.userDel;
  const name = btn.dataset.username;
  if (!confirm(`确定删除用户「${name}」？\n该用户的文章、评论和点赞记录会一并删除，不可恢复。`)) return;
  btn.disabled = true;
  try {
    await jsonFetch(`/api/me?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    init(); // 用户表和文章列表都刷新（文章数可能变化）
  } catch (err) {
    btn.disabled = false;
    alert(err.message);
  }
});

// ---------- 编辑器 ----------

document.getElementById('new-post-btn').addEventListener('click', () => openEditor(null));
document.getElementById('editor-cancel').addEventListener('click', () => show(editorSection, false));

async function openEditor(slug) {
  editingSlug = slug;
  editorForm.reset();
  editorForm.querySelector('.error').textContent = '';
  editorForm.slug.disabled = Boolean(slug); // slug 不可改，评论挂在 slug 上

  if (slug) {
    try {
      const p = await jsonFetch(`/api/posts/${encodeURIComponent(slug)}`);
      editorForm.title.value = p.title;
      editorForm.slug.value = p.slug;
      editorForm.published.checked = p.published;
      editorForm.content.value = p.content;
    } catch (err) {
      alert(err.message);
      return;
    }
  } else {
    editorForm.published.checked = true;
  }

  editorTitle.textContent = slug ? '编辑文章' : '新建文章';
  show(editorSection, true);
  editorSection.scrollIntoView({ behavior: 'smooth' });
}

editorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: editorForm.title.value,
    slug: editorForm.slug.value,
    published: editorForm.published.checked,
    content: editorForm.content.value,
  };
  const saveBtn = editorForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  try {
    await jsonFetch(
      editingSlug ? `/api/posts/${encodeURIComponent(editingSlug)}` : '/api/posts',
      {
        method: editingSlug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    show(editorSection, false);
    init();
  } catch (err) {
    editorForm.querySelector('.error').textContent = err.message;
  } finally {
    saveBtn.disabled = false;
  }
});

init();
