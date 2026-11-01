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

// 点赞：是否已赞由服务端渲染时下发（data-liked），一人一文一赞
if (likeBtn) {
  if (likeBtn.dataset.liked === '1') likeBtn.disabled = true;
  likeBtn.addEventListener('click', async () => {
    if (likeBtn.disabled) return;
    likeBtn.disabled = true;
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (res.status === 401) {
        location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('failed');
      const { likes } = await res.json();
      likeCount.textContent = likes;
      likeBtn.dataset.liked = '1';
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
          <button class="comment-like" data-id="${c.id}" data-liked="${c.liked ? 1 : 0}" ${c.liked ? 'disabled' : ''}>👍 ${c.likes}</button>
          ${me?.is_admin ? `<button class="comment-del" data-id="${c.id}">删除</button>` : ''}
        </p>
        <p class="comment-body">${escapeHtml(c.body)}</p>
      </div>`
        )
        .join('')
    : '<p class="muted">还没有评论，来抢沙发～</p>';
}

// 评论点赞
commentList.addEventListener('click', async (e) => {
  const likeBtnEl = e.target.closest('.comment-like');
  if (likeBtnEl && likeBtnEl.dataset.liked !== '1') {
    likeBtnEl.disabled = true;
    try {
      const res = await fetch('/api/comment-likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(likeBtnEl.dataset.id) }),
      });
      if (res.status === 401) {
        location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('failed');
      const { likes } = await res.json();
      likeBtnEl.textContent = `👍 ${likes}`;
      likeBtnEl.dataset.liked = '1';
    } catch {
      likeBtnEl.disabled = false;
    }
    return;
  }

  const delBtn = e.target.closest('.comment-del');
  if (delBtn) {
    if (!confirm('确定删除这条评论？')) return;
    delBtn.disabled = true;
    try {
      const res = await fetch(`/api/comments?id=${delBtn.dataset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        alert(error || '删除失败');
        delBtn.disabled = false;
      } else {
        loadComments();
      }
    } catch {
      delBtn.disabled = false;
    }
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
