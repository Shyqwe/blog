// 3D 互动特效：光标追踪倾斜 + 聚光灯（纯视觉层，零依赖，零接口）
// 命中元素自动加 data-tilt；DOM 重新渲染（评论刷新等）后自动补绑

(function () {
  // 触屏设备 / 系统开启减弱动效时，整个引擎不启用
  const fine = window.matchMedia('(pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;

  // 倾斜强度：rotateY 最大 ±14°，rotateX 最大 ±10°
  const MAX_Y = 14;
  const MAX_X = 10;

  const SELECTOR = '.post-list li, .my-item, .comment, .auth-box, .user-chip';

  function bind(el) {
    if (el.__tiltBound) return;
    el.__tiltBound = true;
    el.setAttribute('data-tilt', ''); // CSS 的 [data-tilt] 3D 变换靠这个属性生效

    let raf = null;
    el.addEventListener('mousemove', (e) => {
      if (raf) return; // 一帧最多重算一次
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = el.getBoundingClientRect();
        const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
        const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
        el.style.setProperty('--ry', ((px - 0.5) * MAX_Y).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - py) * MAX_X).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
    });

    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    });
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(bind);
  }

  scan();
  // 评论/列表被前端脚本重新渲染后，给新节点补上特效
  new MutationObserver(() => scan()).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
