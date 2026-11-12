/* ==========================================================================
   effects.js — 主页两段交互（原生 ES6+，零依赖）

     1. 鼠标轨迹画廊：光标扫过章节区，作品图追着光标生成，2.5 秒后消散
     2. 照片卡堆：抓起一张甩出去，按松手速度滑行、回正；双击全部归位

   图源只有一份：卡堆里的五张 <img>，轨迹画廊直接读它们的 src，
   不在 JS 里再维护一份图片清单。
   ========================================================================== */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  /** 图片池：卡堆元素的 src（构建后是站点内的作品封面） */
  const POOL = Array.from(document.querySelectorAll('.fx-disk__card'))
    .map((img) => img.getAttribute('src'))
    .filter(Boolean);

  /* ================================================================== */
  /* 1. 鼠标轨迹画廊                                                     */
  /* ================================================================== */
  (function mouseTrail() {
    const stage = document.getElementById('trailStage');
    const layer = document.getElementById('trailCards');
    if (!stage || !layer || !POOL.length || reduceMotion) return;

    const LIFETIME = 2500; // 卡片存活时长（ms）
    const MIN_GAP = 70;    // 生成节流
    const MIN_DIST = 40;   // 位移阈值
    const MAX_CARDS = 30;  // 同屏上限，防止连划掉帧
    const ROTATE = 12;     // 随机旋转幅度（deg）

    let cardW = 200;
    let last = { x: 0, y: 0, t: 0 };
    const alive = [];
    let touched = false;

    const rnd = (a, b) => a + Math.random() * (b - a);

    function measure() {
      cardW = Math.round(Math.min(320, Math.max(140, window.innerWidth * 0.22)));
    }
    measure();
    window.addEventListener('resize', measure);

    /* 最近出现过的三张不重复，避免短时间内同一张刷屏 */
    const recent = [];
    function pick() {
      const rest = POOL.filter((src) => !recent.includes(src));
      const list = rest.length ? rest : POOL;
      const src = list[(Math.random() * list.length) | 0];
      recent.push(src);
      if (recent.length > 3) recent.shift();
      return src;
    }

    function retire(rec, instant) {
      if (!rec || rec.out) return;
      rec.out = true;
      const i = alive.indexOf(rec);
      if (i > -1) alive.splice(i, 1);

      if (instant) {
        rec.el.remove();
        return;
      }
      rec.el.classList.add('is-out');
      rec.el.addEventListener('animationend', () => rec.el.remove(), { once: true });
      setTimeout(() => rec.el.remove(), 700); // 兜底
    }

    function mount(x, y, transient, src) {
      const el = document.createElement('img');
      el.className = 'fx-trail-card';
      el.src = src || pick();
      el.alt = '';
      el.draggable = false;
      el.style.setProperty('--w', cardW + 'px');
      el.style.setProperty('--r', rnd(-ROTATE, ROTATE).toFixed(2) + 'deg');
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      layer.appendChild(el);

      const rec = { el, out: false };
      alive.push(rec);
      while (alive.length > MAX_CARDS) retire(alive[0], true);

      if (transient) setTimeout(() => retire(rec, false), LIFETIME);
      return rec;
    }

    /* 入场先铺几张静态卡，避免一进来这块是空的 */
    function seed() {
      const r = stage.getBoundingClientRect();
      const spots = [
        [0.24, 0.3], [0.48, 0.2], [0.74, 0.32],
        [0.32, 0.7], [0.64, 0.74],
      ];
      const half = cardW / 2 + 8; // 卡片中心的安全距离，别被舞台裁掉半张
      spots.forEach(([px, py], i) => {
        const x = Math.min(Math.max(r.width * px, half), r.width - half);
        mount(x, r.height * py, false, POOL[i % POOL.length]);
      });
    }
    seed();

    /* 鼠标接管：静态卡淡出，之后完全跟随光标 */
    stage.addEventListener('pointerenter', () => {
      if (touched) return;
      touched = true;
      alive.slice().forEach((c) => retire(c, false));
    });

    function spawnAt(clientX, clientY) {
      const r = stage.getBoundingClientRect();
      const x = clientX - r.left;
      const y = clientY - r.top;
      const now = performance.now();

      if (now - last.t < MIN_GAP) return;
      if (Math.hypot(x - last.x, y - last.y) < MIN_DIST) return;
      last = { x, y, t: now };
      mount(x, y, true);
    }

    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return; // 触屏交给 touchmove
      spawnAt(e.clientX, e.clientY);
    });

    stage.addEventListener(
      'touchmove',
      (e) => {
        const t = e.touches[0];
        if (t) spawnAt(t.clientX, t.clientY);
      },
      { passive: true }
    );
  })();

  /* ================================================================== */
  /* 2. 照片卡堆 — 抓起来，甩出去                                         */
  /* ================================================================== */
  (function diskDrag() {
    const stack = document.querySelector('.fx-disk__stack');
    if (!stack) return;

    const cards = Array.from(stack.querySelectorAll('.fx-disk__card'));
    if (!cards.length) return;

    const FRICTION = 0.91; // 每帧衰减系数：滑行距离约等于 v/(1-f)
    const TILT = 0.28;     // 横向速度转倾斜的系数
    const TILT_MAX = 7;    // 最大倾斜角（deg）
    const MAX_SLIDE = 380; // 单次滑行上限，别一把甩出视野

    let topZ = 40;
    let drag = null;
    let justDragged = false;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function paint(d) {
      d.card.style.setProperty('--dx', d.dx.toFixed(2) + 'px');
      d.card.style.setProperty('--dy', d.dy.toFixed(2) + 'px');
      const tilt = d.dragging ? clamp(d.vx * TILT, -TILT_MAX, TILT_MAX) : 0;
      d.card.style.setProperty('--rr', tilt.toFixed(2) + 'deg');
    }

    /* 松手：按速度算出总滑行距离，交给一次 CSS 缓动跑完。
       不用 rAF 循环 —— 标签页切后台时 rAF 会被挂起，卡片会永远卡在拖拽态。 */
    function releaseCard(d) {
      const card = d.card;
      const dist = Math.hypot(d.vx, d.vy);
      card.classList.remove('is-dragging');

      if (dist < 1.2) {
        card.style.setProperty('--rr', '0deg');
        card.style.removeProperty('transition');
        return;
      }

      const k = Math.min(dist / (1 - FRICTION), MAX_SLIDE) / dist;
      card.style.transition = 'transform .62s cubic-bezier(.16,.84,.28,1), box-shadow .35s ease';
      card.style.setProperty('--rr', '0deg');
      card.style.setProperty('--dx', (d.dx + d.vx * k).toFixed(2) + 'px');
      card.style.setProperty('--dy', (d.dy + d.vy * k).toFixed(2) + 'px');

      const done = (ev) => {
        if (ev.propertyName === 'transform') clear();
      };
      const clear = () => {
        card.removeEventListener('transitionend', done);
        card.style.removeProperty('transition');
      };
      card.addEventListener('transitionend', done);
      setTimeout(clear, 800);
    }

    stack.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.fx-disk__card');
      if (!card || e.button > 0) return;

      /* 上一张还在滑行就地停住 */
      if (drag && drag.card !== card) {
        drag.card.classList.remove('is-dragging');
        drag.card.style.removeProperty('transition');
      }

      e.preventDefault();

      drag = {
        card,
        dx: parseFloat(card.style.getPropertyValue('--dx')) || 0,
        dy: parseFloat(card.style.getPropertyValue('--dy')) || 0,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        vx: 0,
        vy: 0,
        moved: 0,
        dragging: true,
      };
      justDragged = false;

      card.style.removeProperty('transition');
      card.classList.add('is-dragging');
      card.style.zIndex = ++topZ;
      try {
        card.setPointerCapture(e.pointerId);
      } catch (_) { /* 指针已释放，忽略 */ }
      paint(drag);
    });

    stack.addEventListener('pointermove', (e) => {
      if (!drag || !drag.dragging) return;

      const now = performance.now();
      const dt = Math.max(now - drag.lastT, 8);
      const mx = e.clientX - drag.lastX;
      const my = e.clientY - drag.lastY;

      /* 瞬时速度换算成「每 16.7ms 的像素」后指数平滑，抑制抖动 */
      drag.vx = drag.vx * 0.62 + (mx / dt) * 16.7 * 0.38;
      drag.vy = drag.vy * 0.62 + (my / dt) * 16.7 * 0.38;

      drag.dx += mx;
      drag.dy += my;
      drag.moved += Math.abs(mx) + Math.abs(my);

      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastT = now;

      paint(drag);
    });

    function release(e) {
      if (!drag || !drag.dragging) return;
      drag.dragging = false;

      try {
        if (drag.card.hasPointerCapture?.(e.pointerId)) {
          drag.card.releasePointerCapture(e.pointerId);
        }
      } catch (_) { /* 忽略 */ }

      justDragged = drag.moved > 5;
      releaseCard(drag);
    }

    stack.addEventListener('pointerup', release);
    stack.addEventListener('pointercancel', release);

    /* 刚拖过就别触发点击（pointerdown 上的 preventDefault 拦不住图片的原生拖拽行为） */
    stack.addEventListener(
      'click',
      (e) => {
        if (justDragged) {
          e.preventDefault();
          e.stopPropagation();
          justDragged = false;
        }
      },
      true
    );

    stack.addEventListener('dragstart', (e) => e.preventDefault());

    /* 双击任意处：全部归位，防止甩出视野找不回来 */
    stack.addEventListener('dblclick', () => {
      cards.forEach((card) => {
        card.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
        card.style.setProperty('--dx', '0px');
        card.style.setProperty('--dy', '0px');
        card.style.setProperty('--rr', '0deg');
        setTimeout(() => card.style.removeProperty('transition'), 600);
      });
    });

    /* 拖拽时别让页面跟着滚（触摸端） */
    stack.addEventListener(
      'touchmove',
      (e) => {
        if (drag && drag.dragging) e.preventDefault();
      },
      { passive: false }
    );

    if (coarsePointer) {
      cards.forEach((c) => {
        c.style.cursor = 'grab';
      });
    }
  })();
})();
