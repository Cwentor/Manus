/* ==========================================================================
   app.js — 展厅客户端交互（原生 ES6+，零依赖）

   模块：
     1) 主题切换（localStorage 持久化 + 系统偏好兜底）
     2) 阅读抽屉（点击卡片 -> 从内容池 <template> 即时注入，0 延迟秒开）
     3) 图片灯箱（点击放大预览）
     4) 动态筛选（产品状态 / 博客标签）
     5) 产品卡片 3D 悬浮微光（tilt + 光斑跟随）
     6) 滚动显现（IntersectionObserver）
     7) 统一 ESC 键监听
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 小工具                                                             */
  /* ------------------------------------------------------------------ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const body = document.body;
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  /* ================================================================== */
  /* 0. 入场开屏（纯 CSS 时间轴播放；会话内仅首次，重复访问跳过）         */
  /* ================================================================== */
  const splash = $('#splash');
  if (splash) {
    const skip = sessionStorage.getItem('showcase-booted') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (skip) {
      root.classList.add('splash-skip');
      splash.remove();
    } else {
      sessionStorage.setItem('showcase-booted', '1');
      setTimeout(() => splash.remove(), 2600); // CSS 退场动画结束后清理节点
    }
  }

  /* ================================================================== */
  /* 1. 主题切换                                                        */
  /* ================================================================== */
  const THEME_KEY = 'showcase-theme';

  function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    root.dataset.theme = stored || (prefersDark.matches ? 'dark' : 'light');
    $('.theme-toggle')?.addEventListener('click', () => {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
    // 系统主题变化时同步（用户未手动选择过才跟随）
    prefersDark.addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_KEY)) root.dataset.theme = e.matches ? 'dark' : 'light';
    });
  }

  /* ================================================================== */
  /* 1.5 动态星空（暗色主题专属：闪烁 + 视差漂移 + 偶发流星）             */
  /* ================================================================== */
  const starCanvas = $('#starfield');
  if (starCanvas) {
    const ctx = starCanvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TAU = Math.PI * 2;
    let stars = [];
    let meteors = [];
    let rafId = null;
    let nextMeteorAt = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      starCanvas.width = Math.round(window.innerWidth * dpr);
      starCanvas.height = Math.round(window.innerHeight * dpr);
      const count = Math.round((window.innerWidth * window.innerHeight) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * starCanvas.width,
        y: Math.random() * starCanvas.height,
        r: (0.4 + Math.random() * 1.3) * dpr,
        depth: 0.25 + Math.random() * 0.75, // 越大越近，视差越明显
        phase: Math.random() * TAU,
        speed: 0.4 + Math.random() * 1.2,
        accent: Math.random() < 0.28, // 少数星星带主题色
      }));
    }

    function spawnMeteor(now) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = starCanvas.width;
      meteors.push({
        x: (0.15 + Math.random() * 0.7) * w,
        y: -20 * dpr,
        vx: (1.6 + Math.random() * 1.6) * dpr * (Math.random() < 0.5 ? -1 : 1),
        vy: (4.2 + Math.random() * 2.6) * dpr,
        life: 0,
        ttl: 60 + Math.random() * 30, // 帧数
      });
      nextMeteorAt = now + 5000 + Math.random() * 9000;
    }

    function draw(now) {
      const { width: w, height: h } = starCanvas;
      ctx.clearRect(0, 0, w, h);
      const t = now / 1000;

      for (const s of stars) {
        const tw = reduceMotion ? 0.75 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.75 + 0.45 * tw), 0, TAU);
        ctx.fillStyle = s.accent
          ? `rgba(196, 181, 253, ${(0.28 + 0.6 * tw) * s.depth})`
          : `rgba(228, 228, 245, ${(0.22 + 0.6 * tw) * s.depth})`;
        ctx.fill();
        // 缓慢下沉 + 轻微横向游移（视差：越近越快）
        if (!reduceMotion) {
          s.y += s.depth * 0.06 * s.r;
          s.x += Math.sin(t * 0.22 + s.phase) * 0.05 * s.depth;
          if (s.y > h + 4) { s.y = -4; s.x = Math.random() * w; }
        }
      }

      // 流星：拖尾渐隐
      if (!reduceMotion && now > nextMeteorAt) spawnMeteor(now);
      meteors = meteors.filter((m) => m.life < m.ttl);
      for (const m of meteors) {
        m.life += 1;
        m.x += m.vx;
        m.y += m.vy;
        const fade = 1 - m.life / m.ttl;
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
        grad.addColorStop(0, `rgba(213, 203, 255, ${0.85 * fade})`);
        grad.addColorStop(1, 'rgba(213, 203, 255, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
        ctx.stroke();
      }

      rafId = requestAnimationFrame(draw);
    }

    function start() {
      if (rafId != null) return;
      resize();
      if (reduceMotion) {
        draw(performance.now()); // 仅绘制静态星空
        cancelAnimationFrame(rafId);
        rafId = null;
        return;
      }
      nextMeteorAt = performance.now() + 3000 + Math.random() * 5000;
      rafId = requestAnimationFrame(draw);
    }

    function stop() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    // 依主题启停；系统主题跟随变化时同样生效（initTheme 会改 data-theme）
    const syncTheme = () => (root.dataset.theme === 'dark' ? start() : stop());
    syncTheme();
    new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', () => {
      if (root.dataset.theme === 'dark') resize();
    });
  }

  /* ================================================================== */
  /* 2. 阅读抽屉（内容来自构建期嵌入的内容池）                           */
  /* ================================================================== */
  const drawer = $('#drawer');
  const drawerOverlay = $('#drawer-overlay');
  const drawerBody = $('#drawer-body');
  const drawerTitle = $('#drawer-title');
  let lastFocused = null;

  /** 从内容池取出某篇文章的完整 HTML（<template> 克隆） */
  function getArticleContent(slug) {
    const tpl = document.getElementById(`article-${slug}`);
    if (!tpl) return null;
    const fragment = tpl.content.cloneNode(true);
    return fragment.querySelector('.article');
  }

  function openDrawer(slug) {
    const article = getArticleContent(slug);
    if (!article) return;
    lastFocused = document.activeElement;

    drawerTitle.textContent = article.dataset.title || '';
    drawerBody.replaceChildren(article);
    drawerBody.scrollTop = 0;

    body.classList.add('drawer-open', 'scroll-locked');
    drawer.setAttribute('aria-hidden', 'false');
    drawerOverlay.setAttribute('aria-hidden', 'false');
    $('.drawer-close', drawer)?.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!body.classList.contains('drawer-open')) return;
    body.classList.remove('drawer-open', 'scroll-locked');
    drawer.setAttribute('aria-hidden', 'true');
    drawerOverlay.setAttribute('aria-hidden', 'true');
    lastFocused?.focus?.({ preventScroll: true });
  }

  /* ---- 打开入口：产品「了解详情」 / 博客卡片 ---- */
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-article]');
    if (opener) {
      e.preventDefault();
      openDrawer(opener.dataset.openArticle);
      return;
    }
    const blogCard = e.target.closest('.blog-card');
    if (blogCard) openDrawer(blogCard.dataset.slug);
  });

  /* ---- 键盘可达性：博客卡片 / 工作台文档行可回车打开 ---- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('.blog-card, .doc-row')) {
      const opener = e.target.closest('[data-open-article]');
      if (opener) openDrawer(opener.dataset.openArticle);
      else e.target.click();
    }
  });

  $('.drawer-close')?.addEventListener('click', closeDrawer);
  drawerOverlay?.addEventListener('click', closeDrawer);

  /* ================================================================== */
  /* 3. 滚动进度条 + 导航滚动态                                          */
  /* ================================================================== */
  const progress = $('#scroll-progress');
  const navbar = $('.navbar');

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    navbar?.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  let scrollTicking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        onScroll();
        scrollTicking = false;
      });
    },
    { passive: true }
  );
  onScroll();

  /* ================================================================== */
  /* 3.5 Hero 打字机（尊重 prefers-reduced-motion）                      */
  /* ================================================================== */
  const typeEl = $('#hero-typewriter');
  if (typeEl) {
    const fullText = typeEl.textContent.trim();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && fullText) {
      typeEl.textContent = '';
      typeEl.classList.add('is-typing');
      let i = 0;
      const tick = () => {
        typeEl.textContent = fullText.slice(0, ++i);
        if (i < fullText.length) {
          setTimeout(tick, 55 + Math.random() * 70);
        } else {
          typeEl.classList.remove('is-typing');
        }
      };
      setTimeout(tick, 450);
    }
  }

  /* ================================================================== */
  /* 3.6 Hero 统计数字滚动                                               */
  /* ================================================================== */
  $$('.stat-num[data-count]').forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target;
      return;
    }
    const started = performance.now();
    const dur = 1100;
    // setTimeout 驱动（rAF 在后台标签页会被暂停，导致数字停在 0）
    const step = () => {
      const t = Math.min((performance.now() - started) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))); // easeOutCubic
      if (t < 1) setTimeout(step, 33);
    };
    step();
    setTimeout(() => { el.textContent = target; }, dur + 120); // 兜底终值
  });

  /* ================================================================== */
  /* 4. 动态筛选（产品状态 / 博客标签 / 工作台分类）                      */
  /* ================================================================== */

  /* 工作台文档的过滤状态：分类 chips 与查找框叠加生效 */
  const docFilter = {
    category: 'all',
    query: '',
    apply() {
      const rows = $$('.doc-row');
      let visible = 0;
      rows.forEach((row) => {
        const byCat = this.category === 'all' || row.dataset.kind === this.category;
        const byText = !this.query || row.textContent.toLowerCase().includes(this.query);
        const show = byCat && byText;
        row.classList.toggle('is-hidden', !show);
        if (show) visible += 1;
      });
      $('#doc-empty')?.classList.toggle('is-hidden', visible > 0);
    },
  };

  $$('.filter-bar').forEach((bar) => {
    const target = bar.dataset.target; // 'products' | 'blog' | 'docs'
    const cardSel = target === 'products' ? '.product-card' : target === 'docs' ? '.doc-row' : '.blog-card';

    bar.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;

      $$('.filter-chip', bar).forEach((c) => c.classList.toggle('is-active', c === chip));
      const filter = chip.dataset.filter;

      if (target === 'docs') {
        docFilter.category = filter;
        docFilter.apply();
        return;
      }

      $$(cardSel).forEach((card) => {
        let match = filter === 'all';
        if (target === 'products') {
          match = match || card.dataset.status === filter;
        } else {
          match = match || (card.dataset.tags || '').split(' ').includes(filter);
        }
        card.classList.toggle('is-hidden', !match);
      });
    });
  });

  /* ================================================================== */
  /* 4.5 工作台查找（Ctrl+K 聚焦，与分类筛选叠加）                       */
  /* ================================================================== */
  const searchBox = $('#doc-search');
  if (searchBox) {
    const input = $('.doc-search-input', searchBox);
    const clearBtn = $('.doc-search-clear', searchBox);

    const syncQuery = () => {
      docFilter.query = input.value.trim().toLowerCase();
      searchBox.classList.toggle('has-text', !!docFilter.query);
      docFilter.apply();
    };

    input.addEventListener('input', syncQuery);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        syncQuery();
        input.blur();
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncQuery();
      input.focus();
    });

    // Ctrl+K / Cmd+K 聚焦查找框
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /* ================================================================== */
  /* 5. 产品卡片 3D 悬浮（tilt + 微光跟随）                              */
  /* ================================================================== */
  $$('.product-card.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
      const rx = ((y / rect.height) - 0.5) * -7;
      const ry = ((x / rect.width) - 0.5) * 7;
      card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      card.style.setProperty('--ty', '-4px');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--ty', '0px');
    });
  });

  /* ================================================================== */
  /* 6. 滚动显现（进入视口渐入 + 同容器内逐个错峰）                       */
  /* ================================================================== */
  const revealEls = $$('.product-card, .blog-card, .doc-row');
  const pendingReveal = new Set(revealEls);

  /** IO 兜底：隐藏标签页/特殊环境下 IO 回调可能不触发，滚动时手动补检 */
  function revealInViewport() {
    const vh = window.innerHeight;
    pendingReveal.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.94 && rect.bottom > 0) {
        el.classList.add('is-visible');
        pendingReveal.delete(el);
      }
    });
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          pendingReveal.delete(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
  );
  revealEls.forEach((el) => {
    el.classList.add('reveal');
    // 同一容器内的卡片按次序错峰入场（上限 8 档，避免长列表等待过久）
    const siblings = el.parentElement
      ? $$('.reveal', el.parentElement)
      : [];
    const idx = siblings.indexOf(el);
    if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 8) * 70}ms`;
    io.observe(el);
  });

  // 兜底：直接在 scroll 事件里补检（rAF 在后台标签页会被暂停，
  // IntersectionObserver 回调同样可能不触发；卡片量少，直接遍历开销可忽略）
  window.addEventListener('scroll', revealInViewport, { passive: true });
  revealInViewport();

  /* ================================================================== */
  /* 6.5 博客卡片光斑跟随（与产品卡同款，增强悬浮质感）                    */
  /* ================================================================== */
  $$('.blog-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  /* ================================================================== */
  /* 7. 统一 ESC 键监听                                                  */
  /* ================================================================== */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeDrawer();
  });

  /* ================================================================== */
  /* 启动                                                               */
  /* ================================================================== */
  initTheme();
  console.info(`[my-showcase] ℹ 交互模块就绪 · ${revealEls.length} 张卡片 · 抽屉/筛选/动效已绑定`);
})();