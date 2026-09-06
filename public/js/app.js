/* ==========================================================================
   app.js — 展厅客户端交互（原生 ES6+，零依赖）

   模块：
     1) 主题切换（localStorage 持久化 + 系统偏好兜底）
     2) 阅读抽屉（点击卡片 -> 从内容池 <template> 即时注入，0 延迟秒开）
     3) 图片灯箱（点击放大预览）
     4) 动态筛选（产品状态 / 博客标签；工作台查找为 Zensical 风格结果面板）
     5) 产品卡片 3D 悬浮微光（tilt + 光斑跟随）
     6) 滚动显现（IntersectionObserver）
     7) 统一 ESC 键监听
     —— 以下迁移自 Cat-Drink 博客（Zensical）的 UI/UX，按本站风格适配 ——
     8) 时段问候语条          9) GitHub 贡献热力图
     10) Hero 交互网格 Canvas 11) 代码块复制按钮
     12) 点击爱心漂浮         13) 标签页切换彩蛋
     14) 页脚一言（hitokoto）
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
    decorateCode(drawerBody); // 抽屉正文里的代码块补复制按钮

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
  /* 3.5 Hero 打字机（博客迁移：多句循环 = 打完停顿 → 回删 → 下一句）      */
  /*     短语来自构建期注入的 data-phrases；仅一句时保持单次打字           */
  /* ================================================================== */
  const typeEl = $('#hero-typewriter');
  if (typeEl) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let phrases = [];
    try {
      const raw = JSON.parse(typeEl.dataset.phrases || '[]');
      if (Array.isArray(raw)) phrases = raw.map(String).filter(Boolean);
    } catch { /* 数据损坏则退回单句 */ }
    if (!phrases.length) phrases = [typeEl.textContent.trim()];
    phrases = [...new Set(phrases)];

    if (!reduceMotion && phrases[0]) {
      typeEl.textContent = '';
      typeEl.classList.add('is-typing');
      let phraseIdx = 0;
      let charIdx = 0;
      let deleting = false;

      const loop = () => {
        const current = phrases[phraseIdx];
        charIdx += deleting ? -1 : 1;
        typeEl.textContent = current.slice(0, charIdx);

        if (!deleting && charIdx === current.length) {
          if (phrases.length === 1) {
            typeEl.classList.remove('is-typing'); // 单句：打完即止（原行为）
            return;
          }
          deleting = true;
          setTimeout(loop, 2200); // 完整句停留
        } else if (deleting && charIdx === 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
          setTimeout(loop, 500); // 删完换句
        } else {
          setTimeout(loop, deleting ? 42 : 55 + Math.random() * 70);
        }
      };
      setTimeout(loop, 450);
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

  /* 工作台文档的分类筛选（搜索面板激活时列表明板二选一，见模块 4.5） */
  const docFilter = {
    category: 'all',
    apply() {
      const rows = $$('.doc-row');
      let visible = 0;
      rows.forEach((row) => {
        const show = this.category === 'all' || row.dataset.kind === this.category;
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
  /* 4.5 工作台查找（Zensical 风格结果面板：计数 + 面包屑 + 高亮摘要）     */
  /*     索引来自构建期嵌入的 JSON；多词 AND 匹配；↑↓ 选择、回车打开      */
  /* ================================================================== */
  const searchEntries = (() => {
    try {
      const raw = JSON.parse($('#doc-search-index')?.textContent || '[]');
      return Array.isArray(raw) ? raw.filter((e) => e?.slug && typeof e.text === 'string') : [];
    } catch {
      return []; // 索引损坏则始终空态
    }
  })();

  const searchBox = $('#doc-search');
  if (searchBox) {
    const input = $('.doc-search-input', searchBox);
    const clearBtn = $('.doc-search-clear', searchBox);
    const searchPanel = $('#search-results');
    const filterBar = $('.filter-bar[data-target="docs"]');
    const docList = $('.doc-list');
    const emptyTip = $('#doc-empty');

    const escapeHtml = (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
    const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    /** 在已转义的文本片段里高亮所有关键词（先转义再匹配，保证标签安全） */
    const highlight = (escaped, terms) => {
      let out = escaped;
      for (const t of terms) {
        out = out.replace(new RegExp(escapeReg(escapeHtml(t)), 'gi'), (m) => `<mark>${m}</mark>`);
      }
      return out;
    };

    /** 围绕首个命中位置截取正文摘要窗口，并高亮窗口内全部命中 */
    const makeExcerpt = (text, terms) => {
      const lower = text.toLowerCase();
      let first = -1;
      for (const t of terms) {
        const i = lower.indexOf(t);
        if (i >= 0 && (first < 0 || i < first)) first = i;
      }
      const PAD_BEFORE = 60;
      const WINDOW = 180;
      const start = Math.max(0, (first < 0 ? 0 : first) - PAD_BEFORE);
      const end = Math.min(text.length, start + WINDOW);
      const head = start > 0 ? '…' : '';
      const tail = end < text.length ? '…' : '';
      return head + highlight(escapeHtml(text.slice(start, end)), terms) + tail;
    };

    /** 退出搜索态：隐藏面板，恢复列表 / 筛选条 / 空态 */
    const exitSearchMode = () => {
      if (searchPanel) searchPanel.hidden = true;
      filterBar?.classList.remove('is-hidden');
      docList?.classList.remove('is-hidden');
      emptyTip?.classList.add('is-hidden');
      docFilter.apply();
    };

    /** 进入搜索态：隐藏列表，渲染结果面板 */
    const enterSearchMode = (terms) => {
      filterBar?.classList.add('is-hidden');
      docList?.classList.add('is-hidden');
      emptyTip?.classList.add('is-hidden');
      if (!searchPanel) return;

      const results = searchEntries.filter((entry) => {
        const hay = `${entry.title} ${entry.desc} ${entry.text}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });

      const items = results
        .map((entry, i) => {
          const crumb = [entry.kind, entry.date].filter(Boolean).join(' · ');
          return (
            `<a class="search-result${i === 0 ? ' is-active' : ''}" href="/articles/${encodeURIComponent(entry.slug)}.html">` +
            `<p class="search-result-crumb">${escapeHtml(crumb)}</p>` +
            `<h3 class="search-result-title">${highlight(escapeHtml(entry.title), terms)}</h3>` +
            `<p class="search-result-excerpt">${makeExcerpt(entry.text, terms)}</p>` +
            `</a>`
          );
        })
        .join('');

      searchPanel.innerHTML =
        `<p class="search-results-head">${results.length} 个结果</p>` +
        (items || `<p class="search-empty">没有匹配的文档 —— 换个关键词试试。</p>`);
      searchPanel.hidden = false;
    };

    const syncSearch = () => {
      const raw = input.value.trim();
      searchBox.classList.toggle('has-text', !!raw);
      const terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) exitSearchMode();
      else enterSearchMode(terms);
    };

    input.addEventListener('input', syncSearch);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        syncSearch();
        input.blur();
        return;
      }
      if (!searchPanel || searchPanel.hidden) return;
      const items = $$('.search-result', searchPanel);
      if (!items.length) return;
      let idx = items.findIndex((el) => el.classList.contains('is-active'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        idx = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('is-active', i === idx));
        items[idx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (items[Math.max(idx, 0)] || items[0])?.click();
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncSearch();
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
  /* 8. 时段问候语条（博客迁移：按钟点切换问候与 emoji）                  */
  /* ================================================================== */
  const greetingEl = $('#hero-greeting');
  if (greetingEl) {
    const GREETINGS = [
      [0, 5, '夜深了，注意休息', '🌙'],
      [5, 7, '早安，新的一天开始啦', '🌅'],
      [7, 9, '早上好，开始美好的一天', '☀️'],
      [9, 11, '上午好，保持专注', '✨'],
      [11, 13, '中午好，该休息一下了', '🍲'],
      [13, 15, '午后时光，继续加油', '☕'],
      [15, 18, '下午好，别忘了喝水', '🌤️'],
      [18, 20, '傍晚好，放松一下吧', '🌆'],
      [20, 22, '晚上好，享受宁静时光', '🌃'],
      [22, 24, '夜深了，早点休息哦', '🌠'],
    ];
    const hour = new Date().getHours();
    const [, , text, emoji] = GREETINGS.find(([s, e]) => hour >= s && hour < e) || GREETINGS[0];
    const emojiEl = document.createElement('span');
    emojiEl.className = 'greeting-emoji';
    emojiEl.textContent = emoji;
    greetingEl.replaceChildren(emojiEl, document.createTextNode(text));
  }

  /* ================================================================== */
  /* 9. GitHub 贡献热力图（博客迁移：jogruber API + SVG 热力格 + tooltip） */
  /* ================================================================== */
  const heatmapSection = $('[data-github-section]');
  if (heatmapSection) {
    const heatmapCard = $('.heatmap-card', heatmapSection);
    const username = (heatmapCard?.dataset.username || '').trim();
    const heatmapSvg = $('[data-heatmap-svg]', heatmapSection);
    const heatmapCount = $('[data-heatmap-count]', heatmapSection);
    const heatmapEmpty = $('[data-heatmap-empty]', heatmapSection);
    const heatmapTip = $('[data-heatmap-tooltip]', heatmapSection);
    const heatmapTipText = $('[data-heatmap-tooltip-text]', heatmapSection);

    if (!username) {
      heatmapSection.hidden = true; // 未配置 github_username 时整块不渲染
    } else {
      const NS = 'http://www.w3.org/2000/svg';
      const CELL = 11;
      const GAP = 3;
      const ROWS = 7;
      const LABEL_OFFSET = 28;
      const HEADER_OFFSET = 16;
      const LEVELS = ['lvl-0', 'lvl-1', 'lvl-2', 'lvl-3', 'lvl-4'];
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

      const fmtDay = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      };

      const makeText = (attrs) => {
        const el = document.createElementNS(NS, 'text');
        el.setAttribute('class', 'heatmap-label');
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
      };

      const hideTip = () => heatmapTip?.classList.remove('is-visible');

      const showTip = (day, cellEl) => {
        if (!heatmapTip) return;
        heatmapTipText.textContent = day.count > 0
          ? `${fmtDay(day.date)}：${day.count} 次贡献`
          : `${fmtDay(day.date)}：无贡献`;
        heatmapTip.classList.add('is-visible');

        const cellRect = cellEl.getBoundingClientRect();
        const tipRect = heatmapTip.getBoundingClientRect();
        const margin = 8;
        const gap = 8;
        let x = cellRect.left + cellRect.width / 2 - tipRect.width / 2;
        x = Math.max(margin, Math.min(x, window.innerWidth - tipRect.width - margin));
        let y = cellRect.top - tipRect.height - gap;
        let above = true;
        if (y < margin) {
          y = cellRect.bottom + gap;
          above = false;
        }
        heatmapTip.style.left = `${x}px`;
        heatmapTip.style.top = `${y}px`;
        heatmapTip.classList.toggle('is-above', above);
        heatmapTip.classList.toggle('is-below', !above);
        heatmapTip.style.setProperty('--arrow-x', `${Math.round(cellRect.left + cellRect.width / 2 - x)}px`);
      };

      fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data) => {
          const contribs = Array.isArray(data?.contributions) ? data.contributions : [];
          if (!contribs.length) throw new Error('empty');

          heatmapCount.textContent = data.total?.lastYear ?? '--';
          const weeks = Math.ceil(contribs.length / ROWS);
          heatmapSvg.setAttribute(
            'viewBox',
            `0 0 ${LABEL_OFFSET + weeks * (CELL + GAP)} ${HEADER_OFFSET + ROWS * (CELL + GAP)}`
          );

          // 顶部月份标签（月份变化处标注一次）
          let lastMonth = -1;
          for (let w = 0; w < weeks; w++) {
            const item = contribs[w * ROWS];
            if (!item) break;
            const month = new Date(item.date).getMonth();
            if (month !== lastMonth) {
              heatmapSvg.appendChild(makeText({
                x: LABEL_OFFSET + w * (CELL + GAP),
                y: 10,
              })).textContent = MONTHS[month];
              lastMonth = month;
            }
          }

          // 左侧星期标签
          WEEKDAYS.forEach((d, i) => {
            if (!d) return;
            heatmapSvg.appendChild(makeText({
              x: 0,
              y: HEADER_OFFSET + i * (CELL + GAP) + CELL - 1,
            })).textContent = d;
          });

          // 热力格
          contribs.forEach((day, idx) => {
            const col = Math.floor(idx / ROWS);
            const row = idx % ROWS;
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', LABEL_OFFSET + col * (CELL + GAP));
            rect.setAttribute('y', HEADER_OFFSET + row * (CELL + GAP));
            rect.setAttribute('width', CELL);
            rect.setAttribute('height', CELL);
            rect.setAttribute('rx', 2.5);
            rect.setAttribute('ry', 2.5);
            rect.setAttribute('class', `heatmap-cell ${LEVELS[Math.min(day.level, 4)]}`);
            rect.addEventListener('mouseenter', () => showTip(day, rect));
            rect.addEventListener('mouseleave', hideTip);
            heatmapSvg.appendChild(rect);
          });
        })
        .catch(() => {
          // 接口不可达：隐藏 SVG 显示空态文案
          heatmapSvg.classList.add('is-hidden');
          heatmapEmpty?.classList.remove('is-hidden');
        });

      // 滚动时收起 tooltip，避免残影悬空
      window.addEventListener('scroll', hideTip, { passive: true });
    }
  }

  /* ================================================================== */
  /* 10. Hero 交互网格（博客迁移：Canvas 网格顶点随鼠标距离被推开）        */
  /* ================================================================== */
  const gridCanvas = $('#hero-grid');
  if (gridCanvas && gridCanvas.parentElement) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (reduceMotion || coarsePointer) {
      gridCanvas.remove(); // 移动端 / 减动效：不启用交互网格
    } else {
      const hero = gridCanvas.parentElement;
      const gtx = gridCanvas.getContext('2d');
      const GRID = 50;        // 网格间距（px）
      const RADIUS = 150;     // 鼠标影响半径
      const DISPLACE = 8;     // 最大位移
      let mouseX = -9999;
      let mouseY = -9999;
      let rafPending = false;
      let dpr = 1;

      const strokeFor = () =>
        root.dataset.theme === 'dark' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(15, 23, 42, 0.1)';

      const drawGrid = () => {
        rafPending = false;
        const w = gridCanvas.width / dpr;
        const h = gridCanvas.height / dpr;
        gtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        gtx.clearRect(0, 0, w, h);
        gtx.strokeStyle = strokeFor();
        gtx.lineWidth = 1;

        // 垂直线：顶点被鼠标沿水平方向推开
        for (let x = 0; x <= w; x += GRID) {
          gtx.beginPath();
          for (let y = 0; y <= h; y += 5) {
            const dx = x - mouseX;
            const dy = y - mouseY;
            const dist = Math.hypot(dx, dy);
            const offset = dist < RADIUS ? (dx / (dist || 1)) * (1 - dist / RADIUS) * DISPLACE : 0;
            if (y === 0) gtx.moveTo(x + offset, y);
            else gtx.lineTo(x + offset, y);
          }
          gtx.stroke();
        }

        // 水平线：顶点被鼠标沿垂直方向推开
        for (let y = 0; y <= h; y += GRID) {
          gtx.beginPath();
          for (let x = 0; x <= w; x += 5) {
            const dx = x - mouseX;
            const dy = y - mouseY;
            const dist = Math.hypot(dx, dy);
            const offset = dist < RADIUS ? (dy / (dist || 1)) * (1 - dist / RADIUS) * DISPLACE : 0;
            if (x === 0) gtx.moveTo(x, y + offset);
            else gtx.lineTo(x, y + offset);
          }
          gtx.stroke();
        }
      };

      const scheduleDraw = () => {
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(drawGrid);
        }
      };

      const resizeGrid = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = hero.getBoundingClientRect();
        gridCanvas.width = Math.max(1, Math.round(rect.width * dpr));
        gridCanvas.height = Math.max(1, Math.round(rect.height * dpr));
        scheduleDraw();
      };

      document.addEventListener('mousemove', (e) => {
        const rect = gridCanvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        if (mouseY > -RADIUS && mouseY < rect.height + RADIUS) scheduleDraw();
      });
      window.addEventListener('resize', resizeGrid);
      // 主题切换时同步网格线颜色
      new MutationObserver(scheduleDraw).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
      resizeGrid();
    }
  }

  /* ================================================================== */
  /* 11. 代码块复制按钮（博客 content.code.copy 迁移：注入 + 状态反馈）   */
  /* ================================================================== */
  const ICON_COPY = '<svg class="ic-copy" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const ICON_CHECK = '<svg class="ic-check" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  function decorateCode(scope = document) {
    $$('pre.shiki', scope).forEach((pre) => {
      if (pre.querySelector('.code-copy')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.setAttribute('aria-label', '复制代码');
      btn.title = '复制代码';
      btn.innerHTML = ICON_COPY + ICON_CHECK;
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        const text = code ? code.innerText : pre.innerText;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // 剪贴板 API 不可用（非安全上下文等）时退回 execCommand
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 1600);
      });
      pre.appendChild(btn);
    });
  }

  decorateCode(document); // 文章整页 / 内容池中已渲染的代码块

  /* ================================================================== */
  /* 12. 点击爱心漂浮（博客迁移：点击处生成随机主题色爱心，上浮消散）      */
  /* ================================================================== */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const HEART_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    const HEART_COLORS = ['#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#4ade80'];

    document.addEventListener('click', (e) => {
      const heart = document.createElement('span');
      heart.className = 'click-heart';
      heart.style.left = `${e.clientX}px`;
      heart.style.top = `${e.clientY}px`;
      heart.style.color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
      heart.innerHTML = HEART_SVG;
      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 1000);
    });
  }

  /* ================================================================== */
  /* 13. 标签页切换彩蛋（博客迁移：离开页面"崩溃"，回来"恢复"）           */
  /* ================================================================== */
  const originTitle = document.title;
  let titleTimer = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.title = '╭(°A°`)╮ 页面崩溃啦 ~';
      clearTimeout(titleTimer);
    } else {
      document.title = '(ฅ>ω<*ฅ) 噫又好啦 ~' + originTitle;
      titleTimer = setTimeout(() => {
        document.title = originTitle;
      }, 2000);
    }
  });

  /* ================================================================== */
  /* 14. 页脚一言（博客迁移：hitokoto 接口，失败保持隐藏）                */
  /* ================================================================== */
  $$('[data-hitokoto]').forEach(async (el) => {
    try {
      const res = await fetch('https://v1.hitokoto.cn/?c=i&c=k&max_length=36');
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!data?.hitokoto) return;
      const quote = document.createElement('span');
      quote.textContent = `「${data.hitokoto}」`;
      const parts = [quote];
      if (data.from) {
        const source = document.createElement('span');
        source.className = 'hitokoto-source';
        source.textContent = `—— ${data.from}`;
        parts.push(source);
      }
      el.replaceChildren(...parts);
      el.hidden = false;
    } catch {
      /* 接口不可达：一言保持隐藏 */
    }
  });

  /* ================================================================== */
  /* 启动                                                               */
  /* ================================================================== */
  initTheme();
  console.info(`[my-showcase] ℹ 交互模块就绪 · ${revealEls.length} 张卡片 · 抽屉/筛选/动效已绑定`);
})();