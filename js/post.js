// 阅读页交互：点赞 + 评论（页面本身由 /api/render 服务端渲染）

const slug = decodeURIComponent(location.pathname.split('/').pop() || '');

const likeBtn = document.getElementById('like-btn');
const likeCount = document.getElementById('like-count');
const commentForm = document.getElementById('comment-form');
const commentList = document.getElementById('comment-list');

let me = null; // 当前登录用户，用于判断是否显示评论删除按钮

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('zh-CN');
}

// 点赞：localStorage 防连点（服务端不做 IP 去重的简化实现）
const likedKey = `liked:${slug}`;
if (likeBtn) {
  if (localStorage.getItem(likedKey)) likeBtn.disabled = true;
  likeBtn.addEventListener('click', async () => {
    if (localStorage.getItem(likedKey)) return;
    likeBtn.disabled = true;
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) throw new Error('failed');
      const { likes } = await res.json();
      likeCount.textContent = likes;
      localStorage.setItem(likedKey, '1');
    } catch {
      likeBtn.disabled = false;
    }
  });
}

async function loadComments() {
  const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`);
  const comments = await res.json();
  commentList.innerHTML = comments.length
    ? comments
        .map(
          (c) => `
      <div class="comment">
        <p class="comment-meta">
          <strong>${escapeHtml(c.name)}</strong> <time>${fmtDate(c.created_at)}</time>
          ${me?.is_admin ? `<button class="comment-del" data-id="${c.id}">删除</button>` : ''}
        </p>
        <p class="comment-body">${escapeHtml(c.body)}</p>
      </div>`
        )
        .join('')
    : '<p class="muted">还没有评论，来抢沙发～</p>';
}

// 管理员删除评论
commentList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.comment-del');
  if (!btn) return;
  if (!confirm('确定删除这条评论？')) return;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/comments?id=${btn.dataset.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      alert(error || '删除失败');
      btn.disabled = false;
    } else {
      loadComments();
    }
  } catch {
    btn.disabled = false;
  }
});

if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(commentForm));
    const btn = commentForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, slug }),
      });
      if (res.status === 401) {
        location.href = '/login'; // 会话过期，重新登录
      } else if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        alert(error || '评论失败，请稍后再试');
      } else {
        commentForm.reset();
        loadComments();
      }
    } finally {
      btn.disabled = false;
    }
  });
}

loadComments().catch(() => {
  commentList.innerHTML = '<p class="muted">评论加载失败。</p>';
});

// 先拿到当前用户身份，再刷新一次评论列表以显示管理员的删除按钮
fetch('/api/me')
  .then((r) => r.json())
  .then(({ user }) => {
    if (user?.is_admin) {
      me = user;
      loadComments();
    }
  })
  .catch(() => {});
