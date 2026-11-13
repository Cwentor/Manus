#!/usr/bin/env node
/**
 * ============================================================================
 *  import-teacher-notes.js — 小学教资备考笔记迁移脚本（一次性工具）
 * ----------------------------------------------------------------------------
 *  来源：D:/Program/jiaozi/笔记（46 篇，约 63 万字符，无图片、无附件）
 *  去向：content/blog/knowledge/教资备考/（保留原有分层目录）
 *
 *  本脚本做的事：
 *    1. 递归读取源目录全部 .md，按源目录结构镜像写入目标目录
 *    2. 为每篇生成符合本站数据契约的 front-matter：
 *         title / date / summary / tags / read_time / slug / category
 *       - title   ← 模块前缀 + 文件名（去序号、去补注）｜ 少数入口文档走覆盖表
 *       - summary ← 首个有信息量的段落（跳过标题、表格、代码块、「来源：」类元信息）
 *       - slug    ← 手工规划，保证全局唯一且可读（形如 教资-综合素质-职业理念）
 *       - tags    ← [知识库, 教资, 模块名]
 *    3. 改写正文内部引用，使其在站点内可点：
 *       - 去掉正文首个 H1（页面标题由 front-matter 渲染，避免两个大标题叠着）
 *       - Markdown 链接 [文字](相对路径.md) → [文字](#/slug)（工作台 hash 路由）
 *       - 行内代码 `xx/xx.md` → Markdown 链接（能确定性解析到目标文件时）
 *       - 指向未迁移目录（../原始资料/）的链接 → 保留文字、去掉链接
 *       - 定点补丁：把「本地工作区」语境改成「站点」语境，校正篇数
 *    4. 迁移后逐篇校验：读回正文与「源正文经同一迁移管线」的结果逐字符一致
 *
 *  注意：目标目录由本脚本独占，每次运行先清空重建；人工润色必须写进 TEXT_PATCHES。
 *  用法：node scripts/import-teacher-notes.js [--dry]
 * ============================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const SRC = 'D:/Program/jiaozi/笔记';
const DEST = path.join(ROOT, 'content', 'blog', 'knowledge', '教资备考');
const DRY = process.argv.includes('--dry');

/** 全部文档统一标注的整理日期（源笔记 README 记载的成稿日期） */
const DOC_DATE = '2026-10-28';

/** 一级 / 二级目录 -> 标题前缀、标签、slug 前缀 */
const MODULE = {
  '00-我的手写笔记': { label: '手写笔记', tag: '手写笔记', slug: '教资-笔记' },
  '01-综合素质': { label: '综合素质', tag: '综合素质', slug: '教资-综合素质' },
  '02-教育教学知识与能力': { label: '科目二', tag: '教育教学知识与能力', slug: '教资-科二' },
  '03-面试': { label: '面试', tag: '面试', slug: '教资-面试' },
  '03-面试/教案范例': { label: '教案范例', tag: '面试', slug: '教资-教案' },
  '03-面试/试讲真题': { label: '试讲真题', tag: '面试', slug: '教资-试讲' },
  '04-法条原文': { label: '法条原文', tag: '法条原文', slug: '教资-法条' },
  '99-资料索引': { label: '资料索引', tag: '资料索引', slug: '教资-索引' },
};

/** 少数文档的标题 / slug 手工指定（入口文档、易撞名的说明文档） */
const OVERRIDE = {
  'README.md': { title: '小学教资备考知识库 · 使用指南', slug: '教资-备考指南', tag: '总览' },
  '00-知识体系总览.md': { title: '知识体系总览', slug: '教资-知识体系总览', tag: '总览' },
  '00-我的手写笔记/科目二-教育基础（手写笔记转录）.md': { title: '手写笔记 · 教育基础', slug: '教资-笔记-教育基础' },
  '00-我的手写笔记/科目二-课程·教师与学生·教育研究（教材补全）.md': { title: '手写笔记 · 课程与教师', slug: '教资-笔记-课程与教师' },
  '03-面试/教案范例/00-目录与使用说明.md': { title: '教案范例 · 使用说明', slug: '教资-教案-使用说明' },
  '03-面试/试讲真题/00-目录与使用说明.md': { title: '试讲真题 · 使用说明', slug: '教资-试讲-使用说明' },
};

/** 与 build.js slugify 保持一致 */
function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

/** 去掉 Markdown 行内的语法噪音，得到纯文本（用于派生 summary） */
function plainText(line) {
  return String(line)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 从正文派生 summary：首个有信息量的段落（跳过标题、表格、代码块、来源类元信息） */
function deriveSummary(body) {
  const lines = body.split(/\r?\n/);
  let fence = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence || !line) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^\|/.test(line) || /^<|^---+$|^\*\*\*/.test(line)) continue;
    const text = plainText(line.replace(/^>\s?/, ''));
    if (text.length < 12) continue;
    // 「来源：」「归档后位置：」属于整理过程的元信息，对读者无意义
    if (/^(来源|归档后位置|原文位置|出处)[:：]/.test(text)) continue;
    return text.length > 88 ? `${text.slice(0, 87)}…` : text;
  }
  return '';
}

/** 正文字数 -> 阅读时长（中文约 450 字/分钟） */
function readTime(body) {
  return `${Math.max(1, Math.round(body.replace(/\s/g, '').length / 450))} min`;
}

/** 文件名 -> 展示名：去序号前缀、去中文括号补注、法条去国名前缀 */
function cleanName(stem) {
  return stem
    .replace(/^\d+-/, '')
    .replace(/（[^）]*）$/, '')
    .replace(/^中华人民共和国/, '');
}

/** 递归收集源目录下的全部 .md（相对路径，统一正斜杠） */
function walkMd(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walkMd(full, base));
    else if (name.endsWith('.md')) out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 1. 规划元数据（title / slug / tags），一次性读完源文件
 * ------------------------------------------------------------------------- */
const srcFiles = walkMd(SRC);

const docs = srcFiles.map((rel) => {
  const raw = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const segs = rel.split('/');
  const fileName = segs[segs.length - 1];
  const dirSegs = segs.slice(0, -1);

  // 模块：优先匹配二级目录（03-面试/教案范例），否则取一级目录
  let mod = null;
  if (dirSegs.length >= 2) {
    const two = `${dirSegs[0]}/${dirSegs[1]}`;
    if (MODULE[two]) mod = MODULE[two];
  }
  if (!mod && dirSegs.length >= 1 && MODULE[dirSegs[0]]) mod = MODULE[dirSegs[0]];

  const override = OVERRIDE[rel] || {};
  const name = cleanName(fileName.replace(/\.md$/, ''));

  // 展示名去掉与模块标签重复的开头（如「面试流程与评分标准」-> 「流程与评分标准」）
  const trimmed = mod && name.startsWith(mod.label) ? name.slice(mod.label.length) : name;

  const title = override.title || (mod ? `${mod.label} · ${trimmed || name}` : name);
  const slug = override.slug || slugify(mod ? `${mod.slug}-${trimmed || name}` : `教资-${name}`);
  const moduleTag = override.tag || (mod ? mod.tag : '总览');

  return { rel, body: raw, title, slug, moduleTag, mod };
});

// slug 唯一性校验：重复即视为规划错误，直接失败
{
  const seen = new Map();
  for (const d of docs) {
    if (seen.has(d.slug)) {
      throw new Error(`slug 冲突：${d.slug}（${seen.get(d.slug)} 与 ${d.rel}）`);
    }
    seen.set(d.slug, d.rel);
  }
}

const slugOfRel = new Map(docs.map((d) => [d.rel, d.slug]));
const titleOfRel = new Map(docs.map((d) => [d.rel, d.title.split(' · ').pop()]));

/* ---------------------------------------------------------------------------
 * 2. 正文引用改写
 * ------------------------------------------------------------------------- */

/** 解析一个路径引用，返回目标文档的相对路径（解析失败返回 null） */
function resolveRef(ref, fromRel) {
  const clean = ref.trim().replace(/^\.\//, '');
  const fromDir = path.posix.dirname(fromRel);

  const candidates = [];
  // 常见写法：相对当前文件 / 相对笔记根目录
  candidates.push(path.posix.normalize(path.posix.join(fromDir, clean)));
  candidates.push(path.posix.normalize(clean));

  for (const c of candidates) {
    if (slugOfRel.has(c)) return c;
    // 省略「.md」后缀的写法
    if (slugOfRel.has(`${c}.md`)) return `${c}.md`;
  }

  // 省略中间目录的写法（如 02-.../05-简答题高频必背.md）：取最后一段在库内唯一匹配
  if (ref.includes('...')) {
    let tail = path.posix.basename(clean);
    if (!tail || tail === '...' || /^[\d.]+$/.test(tail)) return null;
    if (!tail.endsWith('.md')) tail += '.md';
    const hits = [...slugOfRel.keys()].filter((k) => path.posix.basename(k) === tail);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** 查询是否有同文件名但不同目录的歧义（用于判断是否该改写） */
function refLink(ref, fromRel) {
  // 去掉锚点后解析
  const target = ref.split('#')[0];
  if (!target) return null;
  const hit = resolveRef(target, fromRel);
  if (!hit) return null;
  return { slug: slugOfRel.get(hit), text: titleOfRel.get(hit) };
}

/** 改写 Markdown 链接：[文字](相对路径.md) -> [文字](#/slug) */
function rewriteLinks(body, fromRel) {
  return body.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (m, bang, text, href) => {
    if (bang) return m; // 图片不动
    if (/^(https?:|mailto:|tel:|#|\/)/.test(href)) return m;
    const link = refLink(href, fromRel);
    if (link) {
      const anchor = href.includes('#') ? `#${href.split('#')[1]}` : '';
      return `[${text || link.text}](#/${link.slug}${anchor})`;
    }
    // 指向未迁移目录（原始资料等）：保留文字、去掉失效链接；路径形态的文字落回行内代码
    if (!text) return m;
    return /[/.]/.test(text) ? `\`${text}\`` : text;
  });
}

/**
 * 改写行内代码里的文档路径：`01-综合素质/01-职业理念.md` -> [职业理念](#/slug)
 * 只处理看起来像路径的片段（含 / 或以 .md 结尾），其余原样保留。
 */
function rewriteInlinePaths(body, fromRel) {
  return body.replace(/`([^`\n]+)`/g, (m, code) => {
    const looksLikePath = code.includes('/') || code.endsWith('.md');
    if (!looksLikePath) return m;
    if (/^(https?:|\/|\.\.\/\.\.\/)/.test(code)) return m;
    const link = refLink(code.trim(), fromRel);
    if (!link) return m;
    return `[${link.text}](#/${link.slug})`;
  });
}

/**
 * 去掉正文开头的首个一级标题。
 * 站点文章页的标题由 front-matter 的 title 渲染，正文再挂一个 H1 会出现两个大标题上下叠着；
 * 源笔记的首个 H1 恰好都是篇名（「模块一 职业理念」「知识体系总览」这类），去掉不丢信息。
 */
function stripLeadingH1(body) {
  const lines = body.split(/\r?\n/);
  let seen = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    seen += 1;
    if (seen > 3) return body;          // H1 不在开头，说明是章节标题，保留
    const m = line.match(/^#\s+(.+)$/);
    if (!m) return body;
    // 连同正文首行为 H1 时紧随其后的空行一起去掉
    let cut = i + 1;
    while (cut < lines.length && !lines[cut].trim()) cut += 1;
    return lines.slice(cut).join('\n').replace(/^\s*\n/, '');
  }
  return body;
}

/* ---------------------------------------------------------------------------
 * 3. 写出文件
 * ------------------------------------------------------------------------- */
/**
 * 定点文本补丁：把源笔记里「本地工作区」语境改成「站点」语境。
 * 这几处是纯人工润色，固化在此，保证脚本重跑不会覆盖掉。
 * 每条为 [原文, 新文]；原文必须精确匹配（含标点与反引号）。
 */
const TEXT_PATCHES = {
  'README.md': [
    [
      '> **工作区结构：** `笔记/`（你只需要看这个，314 KB）｜ `原始资料/`（约 958 MB，已按类型归档，见 归档清单）',
      '> **怎么读：** 左侧文档树按「综合素质 / 教育教学知识与能力 / 面试 / 法条原文 / 资料索引」分卷，可直接跳转任意一篇；\n'
      + '> 原始素材（12 份 PDF、597 张截图、5 张散图）未随笔记上传，只保留在本地归档目录。',
    ],
    [
      '## 目录结构',
      '## 内容地图\n\n站点的文档树按下面这套结构组织，每卷开头的「导览」页就是该卷的目录。',
    ],
    [
      '**原始资料已归档**（12 份 PDF + 597 张截图 + 5 张散图 → `原始资料/` 下 7 个分类目录，文件名前加了内容说明，保留原哈希 ID 以便和笔记对照）。路径对照表见 `原始资料/00-归档清单.md`。',
      '**原始资料未上传**（12 份 PDF + 597 张截图 + 5 张散图，约 958 MB，本地按 7 类归档、文件名保留了原哈希 ID）。\n'
      + '笔记正文里标注的 PDF 页码、截图编号，都是相对这批本地归档而言的；要找原件，按文件哈希 ID 回本地目录检索。',
    ],
    ['44 篇 30 万字', '46 篇 30 万字'],
    ['```\n笔记/\n', '```\n教资备考/\n'],
  ],
  '00-知识体系总览.md': [
    ['44 篇笔记散在 6 个文件夹里', '46 篇笔记散在 6 个文件夹里'],
    ['44 篇 30 万字', '46 篇 30 万字'],
  ],
};

/** 应用定点补丁；原文对不上时告警（说明源笔记改过，需同步调整补丁） */
function applyPatches(rel, body) {
  const list = TEXT_PATCHES[rel];
  if (!list) return body;
  let out = body;
  for (const [from, to] of list) {
    if (!out.includes(from)) {
      console.warn(`⚠ 补丁未命中：${rel} → ${from.slice(0, 28)}…`);
      continue;
    }
    out = out.replace(from, () => to);
  }
  return out;
}

/** 单篇正文的完整迁移管线：去首 H1 → 改写链接 → 改写行内路径 → 应用定点补丁 */
function buildBody(d) {
  const rewritten = rewriteInlinePaths(rewriteLinks(stripLeadingH1(d.body), d.rel), d.rel);
  return applyPatches(d.rel, rewritten);
}

const report = { written: 0, links: 0, files: [] };

// 目标目录为本脚本独占产物：先清空，避免改名 / 删除源文件后留下陈旧副本
if (!DRY && fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });

for (const d of docs) {
  const rewritten = buildBody(d);
  report.links += (rewritten.match(/\]\(#\//g) || []).length;

  const data = {
    title: d.title,
    date: DOC_DATE,
    summary: deriveSummary(rewritten),
    tags: ['知识库', '教资', d.moduleTag],
    read_time: readTime(rewritten),
    slug: d.slug,
    category: 'knowledge',
  };

  const out = `---\n${yaml.dump(data, { lineWidth: -1, noRefs: true })}---\n${rewritten}`;
  const destFile = path.join(DEST, d.rel);

  if (!DRY) {
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, out, 'utf8');
  }
  report.written += 1;
  report.files.push({ rel: d.rel, title: d.title, slug: d.slug, read: data.read_time, summaryLen: data.summary.length });
}

/* ---------------------------------------------------------------------------
 * 4. 自检：读回文件，正文必须与「源正文经同一改写管线」的结果逐字符一致
 *    （捕获写入 / 编码 / front-matter 切分环节的损坏；改写规则本身由抽样人工核对）
 * ------------------------------------------------------------------------- */
let checked = 0;
if (!DRY) {
  for (const d of docs) {
    const written = fs.readFileSync(path.join(DEST, d.rel), 'utf8');
    const split = written.indexOf('\n---\n');
    if (!written.startsWith('---\n') || split === -1) {
      console.error(`✖ front-matter 结构异常：${d.rel}`);
      process.exit(1);
    }
    const actualBody = written.slice(split + 5);
    const expectedBody = buildBody(d);
    if (actualBody !== expectedBody) {
      const idx = [...actualBody].findIndex((ch, i) => ch !== expectedBody[i]);
      console.error(`✖ 正文校验失败：${d.rel}（首个差异位置 ${idx}）`);
      console.error(`  期望：${JSON.stringify(expectedBody.slice(Math.max(0, idx - 40), idx + 40))}`);
      console.error(`  实际：${JSON.stringify(actualBody.slice(Math.max(0, idx - 40), idx + 40))}`);
      process.exit(1);
    }
    checked += 1;
  }
}

/* ---------------------------------------------------------------------------
 * 5. 输出报告
 * ------------------------------------------------------------------------- */
console.log(`源目录：${SRC}`);
console.log(`目标：${path.relative(ROOT, DEST)}${DRY ? '（dry-run，未写入）' : ''}`);
console.log(`迁移文档：${report.written} 篇`);
console.log(`正文校验：${DRY ? '跳过' : `${checked} 篇全部通过`}`);
console.log(`站内链接改写：${report.links} 处`);
const removedH1 = docs.filter((d) => stripLeadingH1(d.body) !== d.body).length;
console.log(`去掉正文首 H1：${removedH1} 篇（标题改由 front-matter 渲染）`);
const totalMin = report.files.reduce((acc, f) => acc + Number.parseInt(f.read, 10), 0);
console.log(`累计阅读时长：约 ${totalMin} 分钟`);
const noSummary = report.files.filter((f) => f.summaryLen === 0);
if (noSummary.length) console.log(`⚠ 未派生到 summary：${noSummary.map((f) => f.rel).join(', ')}`);
