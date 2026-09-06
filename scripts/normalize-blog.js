#!/usr/bin/env node
/**
 * ============================================================================
 *  normalize-blog.js — 知识库迁移文档的 Front-matter 整理脚本（一次性迁移工具）
 * ----------------------------------------------------------------------------
 *  背景：content/blog/ 下的知识库文档来自旧博客（Zensical-CatDrink-Blog），
 *        front-matter 各不相同（authors/categories/comments、title/description、
 *        或完全没有），不符合本站数据契约（README）：
 *          title / date / summary / tags / read_time（可选 slug / category / featured）
 *
 *  本脚本做的事（只动 front-matter，正文一个字节都不改）：
 *    1. 递归读取 content/blog 下（含各级子目录）的全部 .md（根目录两篇范文本就符合契约，仅补 featured）
 *    2. 从旧 front-matter / 文件名日期前缀 / 正文首段派生规范元数据：
 *       - title   ← 旧 title｜SKILL 的 name｜正文首个 H1｜文件名（去日期前缀）
 *       - date    ← 旧 date｜文件名 YYYY-MM-DD 前缀（修正 5 位年份笔误）
 *       - summary ← 旧 description｜正文首个有效段落（截 80 字）
 *       - tags    ← [分类名, 子目录名, 旧 categories(≤2)] 去重
 *       - read_time ← 按正文字数估算（约 450 字/分钟）
 *       - slug    ← 文件名派生，重名组整组改用目录路径派生，保证全局唯一
 *       - category / featured
 *    3. 写回前备份旧 front-matter 到 scripts/normalize-blog.backup.json
 *    4. 写回后逐文件回读校验：body 与整理前完全一致，否则报错退出
 *
 *  用法：node scripts/normalize-blog.js [--dry]
 * ============================================================================
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'content', 'blog');
const BACKUP_FILE = path.join(__dirname, 'normalize-blog.backup.json');
const DRY = process.argv.includes('--dry');

/** 根目录两篇站点自建范文：仅补 featured 标记，其余保持原样 */
const ROOT_FEATURED = ['build-pipeline-tuning.md', 'content-separation.md'];

/** 一级目录 -> 工作台分类显示名（key 即一级目录名，与 build.js / 前端筛选约定一致） */
const CATEGORY_LABEL = {
  about: '关于',
  draft: '随笔',
  job: '求职',
  knowledge: '知识库',
  podcast: '播客',
  relax: '闲聊',
  skills: '技能',
  web: '资源分享',
};
const ROOT_CATEGORY = { key: 'blog', label: '长文' };

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

function walkMd(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walkMd(full, base));
    else if (name.endsWith('.md')) out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}

/** 解析 front-matter；损坏的 YAML 退化为按行提取关键字段（原始文本存入备份） */
function safeMatter(raw) {
  try {
    const parsed = matter(raw);
    return { data: parsed.data || {}, content: parsed.content, rawFrontmatter: null };
  } catch {
    // 形如未加引号的 "title: Kafka : 消息队列"、重复键等畸形 YAML
    if (!raw.startsWith('---')) return { data: {}, content: raw, rawFrontmatter: null };
    const end = raw.indexOf('\n---', 3);
    if (end === -1) return { data: {}, content: raw, rawFrontmatter: null };
    const fmText = raw.slice(3, end).replace(/^\r?\n/, '');
    const body = raw.slice(end + 4).replace(/^\r?\n/, '');
    const data = {};
    let lastKey = null;
    for (const line of fmText.split(/\r?\n/)) {
      const listItem = line.match(/^\s+-\s+(.*)$/);
      const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (listItem && lastKey) {
        const arr = Array.isArray(data[lastKey]) ? data[lastKey] : [];
        data[lastKey] = arr;
        const v = listItem[1].trim();
        if (v && !v.includes(': ')) arr.push(v); // 跳过 authors 的嵌套项，只收扁平列表
      } else if (kv) {
        lastKey = kv[1];
        const v = kv[2].replace(/\s+#\s.*$/, '').trim(); // 去掉行内注释
        if (v) data[lastKey] = v;
        else data[lastKey] = [];
      }
    }
    return { data, content: body, rawFrontmatter: fmText };
  }
}

/** 旧 date 可能被 YAML 解析成 Date / 字符串 / 缺失；统一为 'YYYY-MM-DD' 或 null（年份限定 2000-2099） */
function normalizeDate(value) {
  let str = null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    str = value.toISOString().slice(0, 10);
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    str = value.trim().slice(0, 10);
  }
  if (!str) return null;
  const year = Number(str.slice(0, 4));
  return year >= 2000 && year <= 2099 ? str : null;
}

/** 文件名日期前缀（容忍 20026 这类 5 位年份笔误），无则 null */
function dateFromFilename(relPath) {
  const stem = path.basename(relPath, '.md');
  const m = stem.match(/(?:^|\/)(\d{4,5})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = m[1].length === 5 ? `20${m[1].slice(-2)}` : m[1]; // '20026' -> '2026'
  const day = `${year}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(day)) ? null : day;
}

/** 旧 categories 兼容：数组 / 字符串 / 缺失 -> 字符串数组（不读 category，那是本脚本写出的字段） */
function oldCategories(data) {
  const raw = data.categories;
  if (Array.isArray(raw)) return raw.map((c) => String(c).trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

/** summary 是否干净（不含原始 HTML 标签） */
function isCleanSummary(s) {
  return Boolean(s) && !/^</.test(s) && !/<\/?[a-zA-Z][^>]*>/.test(s);
}

/** 去掉 Markdown 语法噪音后的纯文本（用于派生 summary / 找 H1） */
function plainText(line) {
  return String(line)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接留文字
    .replace(/:\w[-\w]*:/g, '')              // 旧站图标语法 :octicons-xxx:
    .replace(/\{[^}]*\}/g, '')               // 旧站属性列表 { .lg .middle }
    .replace(/[*_`~#>|]/g, '')
    .replace(/^[-+]\s+/, '')                 // 列表符号
    .replace(/^\d+[.、)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 从正文派生 title 与 summary（不修改正文本身） */
function deriveFromBody(body) {
  const lines = body.split(/\r?\n/);
  let h1 = null;
  let summary = null;
  let fence = false;
  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trim())) { fence = !fence; continue; }
    if (fence) continue;
    const trimmed = line.trim();
    if (/^#{1,6}\s/.test(trimmed)) {
      // 任何级别的标题都不作 summary；首个 H1 可作 title 候选
      if (h1 === null) {
        const hm = trimmed.match(/^#\s+(.+)$/);
        if (hm) h1 = plainText(hm[1]);
      }
      continue;
    }
    const t = plainText(line);
    if (!t) continue;
    // 原始 HTML 行、表格行不作 summary
    if (summary === null && t.length >= 12 && !/^</.test(trimmed) && !/^\|/.test(trimmed)
      && !/^(一、|二、|三、|四、|五、|六、|七、|八、|九、|十、)/.test(t)) {
      summary = t;
    }
    if (h1 !== null && summary !== null) break;
  }
  return { h1, summary };
}

/** 正文字数 -> 阅读时长（中文约 450 字/分钟） */
function readTime(body) {
  const chars = body.replace(/\s/g, '').length;
  return `${Math.max(1, Math.round(chars / 450))} min`;
}

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------- */

const relPaths = walkMd(BLOG_DIR);

// 一次性解析全部文件：{ relPath, dirSegs, data, body, raw }
const files = relPaths.map((relPath) => {
  const raw = fs.readFileSync(path.join(BLOG_DIR, relPath), 'utf8');
  const { data, content, rawFrontmatter } = safeMatter(raw);
  const dirSegs = relPath.split('/').slice(0, -1); // 目录段；根目录文件为 []
  return { relPath, dirSegs, data, body: content, raw, rawFrontmatter };
});

// slug 规划：同 stem（slugify 后）出现多次的，整组改用完整目录路径派生，避免先到先得
{
  const byStem = new Map();
  for (const f of files) {
    const stem = slugify(path.basename(f.relPath, '.md'));
    f.stemSlug = stem;
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(f);
  }
  const used = new Set();
  for (const f of files) {
    const group = byStem.get(f.stemSlug);
    let candidate = group.length === 1 ? f.stemSlug : slugify([...f.dirSegs, path.basename(f.relPath, '.md')].join('-'));
    if (!candidate) candidate = 'post';
    while (used.has(candidate)) candidate = `${candidate}-x`; // 理论兜底，正常不会触发
    used.add(candidate);
    f.slug = candidate;
  }
  if (used.size !== files.length) throw new Error('slug 规划失败：存在未消解的重名');
}

// 备份合并策略：若已有备份（此前真实运行产生），以其中记录的“整理前原始状态”为准，
// 避免重跑时用已整理的数据覆盖掉真正的原始 front-matter
const existingBackup = fs.existsSync(BACKUP_FILE)
  ? JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'))
  : {};
const backup = { ...existingBackup };
const usedTitles = new Map(); // 已派生标题计数：H1/文件名派生撞名时回退文件名/加序号
let changed = 0;
const noDate = [];
const derivedSummary = [];
const pendingWrites = []; // 两阶段：先全量计算并落备份，再统一写回，避免中途失败丢失备份

for (const f of files) {
  const bodyHash = crypto.createHash('sha256').update(f.body, 'utf8').digest('hex');
  const topDir = f.dirSegs[0] || null;
  const isRootPost = f.dirSegs.length === 0;
  const cat = isRootPost
    ? ROOT_CATEGORY
    : { key: topDir, label: CATEGORY_LABEL[topDir] || topDir };

  if (isRootPost && ROOT_FEATURED.includes(path.basename(f.relPath))) {
    // 站点自建范文：契约已满足，只补 featured（首页「精选长文」开关）
    if (f.data.featured !== true) {
      backup[f.relPath] = { data: f.data, bodyHash };
      f.data.featured = true;
      changed += 1;
      pendingWrites.push(f);
    }
    continue;
  }

  const derived = deriveFromBody(f.body);
  const stemName = path.basename(f.relPath, '.md');
  // 派生输入一律取“整理前原始 front-matter”（备份），保证脚本幂等：
  // 重跑时不会把自己写出的字段再当输入
  const orig = (existingBackup[f.relPath] && existingBackup[f.relPath].data) || f.data;

  // title：旧 title -> SKILL name -> 正文 H1 -> 文件名（去日期前缀）
  let title = typeof orig.title === 'string' && orig.title.trim() ? orig.title.trim() : null;
  let titleFromFallback = false;
  if (!title && typeof orig.name === 'string' && orig.name.trim()) {
    title = `Skill：${orig.name.trim()}`; // AI Skill 文件（SKILL.md 的 name 字段）
  }
  if (!title && derived.h1) {
    title = derived.h1;
    titleFromFallback = true;
  }
  if (!title) {
    title = stemName.replace(/^\d{4,5}-\d{2}-\d{2}-/, '');
    titleFromFallback = true;
  }
  // 撞名时优先回退到文件名派生标题（通常比 H1 / 序号更具区分度），仍撞名再追加序号
  if (usedTitles.has(title)) {
    const stemTitle = stemName.replace(/^\d{4,5}-\d{2}-\d{2}-/, '');
    if (stemTitle && !usedTitles.has(stemTitle)) title = stemTitle;
  }
  {
    const seen = usedTitles.get(title) || 0;
    usedTitles.set(title, seen + 1);
    if (seen > 0) title = `${title} · ${seen + 1}`;
  }

  // date：旧 date -> 文件名前缀
  let date = normalizeDate(orig.date) || dateFromFilename(f.relPath);

  // summary：旧 description / 已有干净 summary -> 正文首段（HTML 垃圾 summary 一律重新派生）
  let summary = null;
  const descSummary = typeof orig.description === 'string' && orig.description.trim()
    ? orig.description.trim()
    : null;
  const existingSummary = typeof orig.summary === 'string' ? orig.summary.trim() : '';
  if (isCleanSummary(descSummary)) summary = descSummary;
  if (!summary && isCleanSummary(existingSummary)) summary = existingSummary;
  if (!summary && derived.summary) {
    summary = derived.summary.length > 80 ? `${derived.summary.slice(0, 79)}…` : derived.summary;
    derivedSummary.push(f.relPath);
  }

  // tags：分类名 + 子目录名 + 旧 tags / categories（≤2），去重、丢弃纯数字等噪音
  const tags = [cat.label];
  const subDir = f.dirSegs.length >= 2 ? f.dirSegs[f.dirSegs.length - 1] : null;
  if (subDir && !/^\d+$/.test(subDir) && subDir !== topDir) tags.push(subDir);
  const oldTags = [
    ...(Array.isArray(orig.tags) ? orig.tags.map(String) : typeof orig.tags === 'string' && orig.tags ? [orig.tags] : []),
    ...oldCategories(orig),
  ];
  for (const t of oldTags) {
    if (tags.length >= 4) break;
    if (!tags.includes(t) && !/^\d+$/.test(t) && t !== orig.category) tags.push(t);
  }

  const newData = {
    title,
    ...(date ? { date } : {}),
    ...(summary ? { summary } : {}),
    tags,
    read_time: readTime(f.body),
    slug: f.slug,
    category: cat.key,
  };

  if (JSON.stringify(newData) !== JSON.stringify(pickComparable(f.data))) {
    // 备份只记录“整理前原始状态”：已有条目（更早真实运行的原始数据）不覆盖
    if (!backup[f.relPath]) {
      backup[f.relPath] = {
        data: f.data,
        bodyHash,
        ...(f.rawFrontmatter ? { rawFrontmatter: f.rawFrontmatter } : {}),
      };
    }
    changed += 1;
  }
  if (!date) noDate.push(f.relPath);

  f.data = newData;
  pendingWrites.push(f);
}

/** 按新 front-matter + 原 body 写回（手工拼装，正文逐字节保持原样），并回读校验 */
function writeBack(f) {
  const fm = yaml.dump(f.data, { lineWidth: -1, noRefs: true }); // 以 \n 结尾
  fs.writeFileSync(path.join(BLOG_DIR, f.relPath), `---\n${fm}---\n${f.body}`, 'utf8');
  const { content } = safeMatter(fs.readFileSync(path.join(BLOG_DIR, f.relPath), 'utf8'));
  const after = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  const before = backup[f.relPath] && backup[f.relPath].bodyHash;
  if (before && after !== before) {
    console.error(`✖ 正文校验失败：${f.relPath}`);
    process.exit(1);
  }
}

/** 与 newData 同构地抽取当前 data（用于判断是否真的有变化；收敛后重跑应为 0 改动） */
function pickComparable(data) {
  return {
    ...(typeof data.title === 'string' ? { title: data.title } : {}),
    ...(normalizeDate(data.date) ? { date: normalizeDate(data.date) } : {}),
    ...(typeof data.summary === 'string' && data.summary.trim() ? { summary: data.summary.trim() } : {}),
    ...(Array.isArray(data.tags) ? { tags: data.tags.map(String) } : {}),
    ...(typeof data.read_time === 'string' ? { read_time: data.read_time } : {}),
    ...(typeof data.slug === 'string' ? { slug: data.slug } : {}),
    ...(typeof data.category === 'string' ? { category: data.category } : {}),
  };
}

if (!DRY) {
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf8');
  for (const f of pendingWrites) {
    try {
      writeBack(f);
    } catch (err) {
      console.error(`✖ 写回失败：${f.relPath} — ${err.message}`);
      console.error('front-matter：', JSON.stringify(f.data));
      process.exit(1);
    }
  }
  console.log('正文零改动校验：全部通过');
}

console.log(`扫描 ${files.length} 个 .md（含根目录范文 ${ROOT_FEATURED.length} 篇）`);
console.log(`整理 front-matter：${changed} 个${DRY ? '（dry-run，未写入）' : '，已写入'}`);
console.log(`旧 front-matter 备份：${DRY ? '（dry-run 跳过）' : path.relative(ROOT, BACKUP_FILE)}`);
if (noDate.length) console.log(`未派生到日期（列表将按文件名排序，置底）：\n  - ${noDate.join('\n  - ')}`);
console.log(`从正文首段派生 summary：${derivedSummary.length} 个`);
