#!/usr/bin/env node
/**
 * ============================================================================
 *  build.js — 个人主页展厅（my-showcase）核心预构建脚本
 * ----------------------------------------------------------------------------
 *  职责（单文件、零打包工具、纯 Node.js >= 18）：
 *    1. 清理 / 重建 dist/，完整复制 public/ 静态资源
 *    2. 递归读取 content/products|blog 下的 Markdown
 *    3. gray-matter 剥离 Front-matter 元数据（数据契约层）
 *    4. markdown-it + shiki（构建期语法高亮）将正文渲染为原生 HTML
 *    5. 排序：产品按 order 升序；博客 / 日记按 date 倒序
 *    6. 将卡片 HTML 片段装配进 templates/index.html 预留槽位
 *    7. 将博客与产品的完整正文以 <template> 内容池形式嵌入页面底部
 *       （点击卡片时前端 JS 即时注入 Drawer，0 延迟秒开阅读）
 *    8. 输出可直接部署的 dist/index.html
 *
 *  用法：node build.js        （或 npm run build）
 * ============================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');
const { createHighlighter } = require('shiki');

/* ---------------------------------------------------------------------------
 * 常量与路径
 * ------------------------------------------------------------------------- */
const ROOT = __dirname;

const DIR = {
  content: path.join(ROOT, 'content'),
  templates: path.join(ROOT, 'templates'),
  public: path.join(ROOT, 'public'),
  dist: path.join(ROOT, 'dist'),
};

const HIGHLIGHT_THEME = 'vitesse-dark'; // 构建期高亮主题（github-dark / vitesse-dark 二选一）

// 预加载常用语言，避免构建期反复动态加载
const PRELOAD_LANGS = [
  'javascript', 'typescript', 'tsx', 'jsx', 'json', 'html', 'css',
  'markdown', 'bash', 'shell', 'rust', 'python', 'sql', 'yaml', 'docker', 'toml',
];

/* ---------------------------------------------------------------------------
 * 小工具
 * ------------------------------------------------------------------------- */

/** 将任意字符串转成安全的 URL slug */
function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

/** HTML 转义（用于把元数据安全地注入模板属性 / 文本） */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 属性转义：换行、引号一并处理 */
function escAttr(str) {
  return escHtml(str).replace(/\n/g, '&#10;');
}

/** 模板 token 替换：{{KEY}} -> value（split/join 避免正则替换陷阱） */
function applyTokens(template, tokens) {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.split(`{{${key}}}`).join(String(value ?? ''));
  }
  return out;
}

/** 统一时间比较值：'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm' 均可用 */
function toTime(value) {
  if (value == null) return -Infinity;
  const t = Date.parse(String(value).replace(' ', 'T'));
  return Number.isNaN(t) ? -Infinity : t;
}

/** 从 Markdown 链接语法中提取 URL，如 "[https://a.com](https://a.com)" */
function extractUrl(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  const m = s.match(/^\[[^\]]*\]\(([^)]+)\)$/);
  return m ? m[1] : s;
}

/* ---------------------------------------------------------------------------
 * 图标库（内联 SVG，避免引入图标字体；元数据中只存图标名）
 * ------------------------------------------------------------------------- */
const ICONS = {
  github: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  rss: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
  demo: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
};

/* ---------------------------------------------------------------------------
 * Markdown 渲染器
 *   原则：html: false —— 内容层禁止任何原始 HTML，从根上保证「内容与 UI 分离」
 * ------------------------------------------------------------------------- */
function createMarkdownRenderer({ breaks = false } = {}) {
  const md = new MarkdownIt({
    html: false,       // 拒绝 Markdown 中的原始 HTML / 内联样式
    linkify: true,     // 裸链接自动转 <a>
    breaks,            // 朋友圈：单换行即换行
    typographer: true,
    highlight(code, lang) {
      if (!lang) return ''; // 交给 markdown-it 默认转义
      try {
        return highlighter.codeToHtml(code, { lang, theme: HIGHLIGHT_THEME });
      } catch {
        try {
          return highlighter.codeToHtml(code, { lang: 'text', theme: HIGHLIGHT_THEME });
        } catch {
          return ''; // 最终兜底：默认转义 + 朴素 <pre>
        }
      }
    },
  });

  // 外部链接一律新窗口打开（安全加固）
  const defaultLinkOpen = md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href') || '';
    if (/^https?:\/\//.test(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // 标题自动生成锚点 id（长文内可深链）
  const defaultHeadingOpen = md.renderer.rules.heading_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const inline = tokens[idx + 1];
    const text = inline ? inline.content.replace(/<[^>]*>/g, '').trim() : '';
    if (text) token.attrSet('id', slugify(text));
    return defaultHeadingOpen(tokens, idx, options, env, self);
  };

  return md;
}

/* shiki 高亮器（构建期创建一次，全局复用） */
let highlighter = null;

/* ---------------------------------------------------------------------------
 * 内容读取与解析
 * ------------------------------------------------------------------------- */

/** 读取目录下所有 .md，剥离 Front-matter，返回原始记录 */
function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    log.warn(`目录不存在，跳过：${path.relative(ROOT, dir)}`);
    return [];
  }
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const full = path.join(dir, file);
      const raw = fs.readFileSync(full, 'utf8');
      const { data, content } = matter(raw);
      return {
        slug: slugify(data.slug || file.replace(/\.md$/, '')),
        file,
        data,
        body: content,
      };
    });
}

/** 读取并校验 profile.json（个人信息配置） */
function readProfile() {
  const file = path.join(DIR.content, 'profile.json');
  if (!fs.existsSync(file)) {
    throw new Error(`缺少必需文件：${path.relative(ROOT, file)}`);
  }
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`profile.json 解析失败：${err.message}`);
  }
  const required = ['name', 'tagline'];
  for (const key of required) {
    if (!profile[key]) throw new Error(`profile.json 缺少必填字段：${key}`);
  }
  profile.socials = Array.isArray(profile.socials) ? profile.socials : [];
  return profile;
}

/* ---------------------------------------------------------------------------
 * 卡片片段渲染（数据 -> 模板 -> HTML 字符串）
 * ------------------------------------------------------------------------- */

function loadTemplate(name) {
  const file = path.join(DIR.templates, name);
  return fs.readFileSync(file, 'utf8');
}

/** 产品卡片 */
function renderProductCard(tpl, product, index) {
  const status = String(product.data.status || 'Active').toLowerCase();
  const techChips = (product.data.tech_stack || [])
    .map((t) => `<span class="chip">${escHtml(t)}</span>`)
    .join('');

  return applyTokens(tpl, {
    INDEX: index,
    SLUG: product.slug,
    TITLE: escHtml(product.data.title || 'Untitled'),
    TAGLINE: escHtml(product.data.tagline || ''),
    COVER: escAttr(product.data.cover || '/assets/products/placeholder.svg'),
    STATUS: escHtml(product.data.status || 'Active'),
    STATUS_CLASS: status.replace(/[^a-z0-9-]/g, ''),
    TECH: techChips,
    DEMO_URL: escAttr(extractUrl(product.data.demo_url)),
    REPO_URL: escAttr(extractUrl(product.data.repo_url)),
  });
}

/** 博客卡片 */
function renderBlogCard(tpl, post, index) {
  const tags = (post.data.tags || [])
    .map((t) => `<span class="tag">#${escHtml(t)}</span>`)
    .join('');
  const tagsRaw = (post.data.tags || []).map((t) => String(t).toLowerCase()).join(' ');
  const date = String(post.data.date || '');

  return applyTokens(tpl, {
    INDEX: index,
    SLUG: post.slug,
    TITLE: escHtml(post.data.title || 'Untitled'),
    SUMMARY: escHtml(post.data.summary || ''),
    DATE: escHtml(date),
    DATE_FULL: escHtml(date.replace(' ', 'T') || ''),
    READ_TIME: escHtml(post.data.read_time || '5 min'),
    TAGS: tags,
    TAGS_RAW: escAttr(tagsRaw),
  });
}

/** 朋友圈动态 */

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------- */

async function main() {
  const started = performance.now();

  /* -- 0. 日志工具（微小的彩色输出） -- */
  const c = (n, s) => `\x1b[${n}m${s}\x1b[0m`;
  const log = {
    step: (s) => console.log(c(36, '· ') + s),
    ok: (s) => console.log(c(32, '✔ ') + s),
    warn: (s) => console.log(c(33, '⚠ ') + s),
    err: (s) => console.error(c(31, '✖ ') + s),
  };

  try {
    /* -- 1. 清理并重建 dist/ -- */
    log.step('清理并重建 dist/ …');
    fs.rmSync(DIR.dist, { recursive: true, force: true });
    fs.mkdirSync(DIR.dist, { recursive: true });

    /* -- 2. 复制 public/ 静态资源 -- */
    log.step('复制 public/ 静态资源 …');
    fs.cpSync(DIR.public, DIR.dist, { recursive: true });
    log.ok('静态资源已复制');

    /* -- 3. 读取个人信息配置 -- */
    const profile = readProfile();

    /* -- 4. 读取全部 Markdown 内容 -- */
    const products = readMarkdownFiles(path.join(DIR.content, 'products'));
    const posts = readMarkdownFiles(path.join(DIR.content, 'blog'));

    /* -- 5. 初始化 shiki 高亮器 -- */
    log.step('初始化 shiki 语法高亮 …');
    highlighter = await createHighlighter({
      themes: [HIGHLIGHT_THEME],
      langs: PRELOAD_LANGS,
    });

    /* -- 6. 渲染正文（产品/博客共用一个实例） -- */
    const mdMain = createMarkdownRenderer({ breaks: false });

    for (const p of products) p.html = mdMain.render(p.body);
    for (const p of posts) p.html = mdMain.render(p.body);

    /* -- 7. 排序 -- */
    products.sort((a, b) => (Number(a.data.order) || 999) - (Number(b.data.order) || 999));
    posts.sort((a, b) => toTime(b.data.date) - toTime(a.data.date));

    /* -- 8. 渲染卡片片段 -- */
    const tplProduct = loadTemplate('product-card.html');
    const tplBlog = loadTemplate('blog-card.html');

    const productCards = products.map((p, i) => renderProductCard(tplProduct, p, i)).join('\n');
    const blogCards = posts.map((p, i) => renderBlogCard(tplBlog, p, i)).join('\n');

    /* -- 9. 动态生成筛选 chips（产品状态 / 博客标签） -- */
    const statuses = [...new Set(products.map((p) => String(p.data.status || 'Active').toLowerCase()))];
    const statusChips = ['all', ...statuses]
      .map((s) => `<button class="filter-chip${s === 'all' ? ' is-active' : ''}" data-filter="${escAttr(s)}">${s === 'all' ? '全部' : escHtml(s)}</button>`)
      .join('');

    const allTags = [...new Set(posts.flatMap((p) => p.data.tags || []))];
    const tagChips = ['all', ...allTags]
      .map((t) => `<button class="filter-chip${t === 'all' ? ' is-active' : ''}" data-filter="${escAttr(t)}">${t === 'all' ? '全部' : `#${escHtml(t)}`}</button>`)
      .join('');

    /* -- 10. 内容池：博客 + 产品的完整正文，嵌入 <template>（0 延迟秒开） -- */
    const pool = [
      ...posts.map((p) =>
        `<template id="article-${p.slug}" data-kind="blog">` +
        `<article class="article" data-title="${escAttr(p.data.title || '')}">${p.html}</article>` +
        `</template>`),
      ...products.map((p) =>
        `<template id="article-${p.slug}" data-kind="product">` +
        `<article class="article" data-title="${escAttr(p.data.title || '')}">${p.html}</article>` +
        `</template>`),
    ].join('\n');

    /* -- 11. 装配主模板 -- */
    log.step('装配 templates/index.html …');
    const indexTpl = loadTemplate('index.html');
    const socialsHtml = profile.socials
      .map((s) => {
        const icon = ICONS[s.icon] || ICONS.link;
        return `<a class="social-pill" href="${escAttr(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escAttr(s.label)}">${icon}<span>${escHtml(s.label)}</span></a>`;
      })
      .join('');

    const buildMeta =
      `Built in ${(performance.now() - started).toFixed(0)}ms · ` +
      `${products.length} 产品 · ${posts.length} 篇长文 · ` +
      new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    /* 主页 Hero 实时统计（数字滚动动效由前端 JS 驱动） */
    const heroStats = [
      `<span class="stat-item"><b class="stat-num" data-count="${products.length}">0</b><span>产品</span></span>`,
      `<span class="stat-item"><b class="stat-num" data-count="${posts.length}">0</b><span>长文</span></span>`,
      `<span class="stat-item"><b class="stat-num" data-count="${posts.length + products.length}">0</b><span>文档</span></span>`,
    ].join('');

    const html = applyTokens(indexTpl, {
      PROFILE_NAME: escHtml(profile.name),
      PROFILE_HANDLE: escHtml(profile.handle || ''),
      PROFILE_TAGLINE: escHtml(profile.tagline),
      PROFILE_AVATAR: escAttr(profile.avatar || '/assets/avatar/avatar.svg'),
      PROFILE_STATUS: escHtml(profile.status?.text || 'Building cool things'),
      PROFILE_STATUS_EMOJI: escHtml(profile.status?.emoji || '🟢'),
      PROFILE_LOCATION: escHtml(profile.location || ''),
      PROFILE_AVAILABLE: escHtml(profile.available_for || ''),
      PROFILE_SOCIALS: socialsHtml,
      HERO_STATS: heroStats,
      PRODUCTS: productCards,
      PRODUCT_FILTERS: statusChips,
      BLOG: blogCards,
      BLOG_FILTERS: tagChips,
      CONTENT_POOL: pool,
      BUILD_META: escHtml(buildMeta),
    });

    /* -- 12. 写入主页输出 -- */
    fs.writeFileSync(path.join(DIR.dist, 'index.html'), html, 'utf8');

    /* -- 13. 工作台页：全部文档归类列表（产品 / 长文 / 动态） -- */
    log.step('装配 templates/workspace.html …');

    const KIND_LABEL = { product: '产品', blog: '长文' };

    const docItems = [
      ...products.map((p) => ({
        kind: 'product',
        slug: p.slug,
        title: String(p.data.title || 'Untitled'),
        desc: String(p.data.tagline || ''),
        date: String(p.data.date || ''),
        side: String(p.data.status || 'Active'),
        href: `/articles/${p.slug}.html`,
      })),
      ...posts.map((p) => ({
        kind: 'blog',
        slug: p.slug,
        title: String(p.data.title || 'Untitled'),
        desc: String(p.data.summary || ''),
        date: String(p.data.date || ''),
        side: String(p.data.read_time || ''),
        href: `/articles/${p.slug}.html`,
      })),
    ];
    docItems.sort((a, b) => toTime(b.date) - toTime(a.date));

    const docRows = docItems
      .map((d) => {
        const inner =
          `<span class="doc-kind doc-kind-${d.kind}">${KIND_LABEL[d.kind]}</span>` +
          `<div class="doc-main">` +
          `<h3 class="doc-title">${escHtml(d.title)}</h3>` +
          (d.desc ? `<p class="doc-desc">${escHtml(d.desc)}</p>` : '') +
          `</div>` +
          `<div class="doc-side">` +
          (d.date ? `<time class="doc-date">${escHtml(d.date)}</time>` : '') +
          (d.side ? `<span class="doc-meta">${escHtml(d.side)}</span>` : '') +
          `</div>`;
        return `<a class="doc-row" data-kind="${d.kind}" href="${escAttr(d.href)}" aria-label="查看：${escAttr(d.title)}">${inner}</a>`;
      })
      .join('\n');

    const docFilters = ['all', 'product', 'blog']
      .map((k) => `<button class="filter-chip${k === 'all' ? ' is-active' : ''}" data-filter="${escAttr(k)}">${k === 'all' ? '全部' : KIND_LABEL[k]}</button>`)
      .join('');

    const workspaceStats = [
      `<span class="stat-chip">📚 文档 ${docItems.length}</span>`,
      `<span class="stat-chip">🚀 产品 ${products.length}</span>`,
      `<span class="stat-chip">✍️ 长文 ${posts.length}</span>`,
    ].join('');

    const workspaceHtml = applyTokens(loadTemplate('workspace.html'), {
      PROFILE_NAME: escHtml(profile.name),
      WORKSPACE_STATS: workspaceStats,
      DOC_FILTERS: docFilters,
      DOCS: docRows,
      BUILD_META: escHtml(buildMeta),
    });
    fs.writeFileSync(path.join(DIR.dist, 'workspace.html'), workspaceHtml, 'utf8');

    /* -- 14. 文章整页：每篇长文 / 产品输出 dist/articles/<slug>.html -- */
    log.step('生成文章整页 dist/articles/*.html …');
    const tplArticle = loadTemplate('article.html');
    fs.mkdirSync(path.join(DIR.dist, 'articles'), { recursive: true });

    const renderArticlePage = (kind, item) => {
      const metaChips = [];
      let extra = '';

      if (kind === 'blog') {
        if (item.data.date) metaChips.push(`<span class="doc-meta">${escHtml(item.data.date)}</span>`);
        if (item.data.read_time) metaChips.push(`<span class="doc-meta">${escHtml(item.data.read_time)} 阅读</span>`);
        const tags = item.data.tags || [];
        if (tags.length) {
          extra = `<div class="article-tags">${tags.map((t) => `<span class="tag">#${escHtml(t)}</span>`).join('')}</div>`;
        }
      } else {
        if (item.data.status) metaChips.push(`<span class="doc-meta">${escHtml(item.data.status)}</span>`);
        const tech = item.data.tech_stack || [];
        const links = [
          extractUrl(item.data.demo_url) && { label: '在线体验', url: extractUrl(item.data.demo_url) },
          extractUrl(item.data.repo_url) && { label: '源码仓库', url: extractUrl(item.data.repo_url) },
        ].filter(Boolean);
        const pills = tech.map((t) => `<span class="chip">${escHtml(t)}</span>`).join('') +
          links.map((l) => `<a class="chip chip-link" href="${escAttr(l.url)}" target="_blank" rel="noopener noreferrer">${l.label} ↗</a>`).join('');
        if (pills) extra = `<div class="article-tags">${pills}</div>`;
      }

      return applyTokens(tplArticle, {
        PROFILE_NAME: escHtml(profile.name),
        TITLE: escHtml(item.data.title || 'Untitled'),
        DESCRIPTION: escHtml(item.data.summary || item.data.tagline || ''),
        KIND: kind,
        KIND_LABEL: KIND_LABEL[kind],
        META_CHIPS: metaChips.join(''),
        EXTRA_HEAD: extra,
        BODY: item.html,
        BUILD_META: escHtml(buildMeta),
      });
    };

    for (const p of posts) {
      fs.writeFileSync(path.join(DIR.dist, 'articles', `${p.slug}.html`), renderArticlePage('blog', p), 'utf8');
    }
    for (const p of products) {
      fs.writeFileSync(path.join(DIR.dist, 'articles', `${p.slug}.html`), renderArticlePage('product', p), 'utf8');
    }

    const elapsed = (performance.now() - started).toFixed(1);
    log.ok(`构建完成：dist/index.html + dist/workspace.html + articles ${posts.length + products.length} 篇（${elapsed}ms）`);
    log.ok(`  产品 ${products.length} · 博客 ${posts.length} · 输出 ${((html.length + workspaceHtml.length) / 1024).toFixed(1)} KB`);
  } catch (err) {
    log.err(`构建失败：${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 4).join('\n'));
    process.exit(1);
  }
}

main();
