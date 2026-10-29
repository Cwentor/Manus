#!/usr/bin/env node
/**
 * parse-repos.mjs — 解析「用户提供的项目链接」生成卡册数据（不调用 GitHub API，不采集 stars 列表页）
 *
 * 用法：
 *   node tools/stamp-album/parse-repos.mjs tools/stamp-album/links.txt
 *   node tools/stamp-album/parse-repos.mjs https://github.com/facebook/react [更多链接...]
 *   node tools/stamp-album/parse-repos.mjs tools/stamp-album/links.txt https://github.com/ollama/ollama   # 可混用
 *
 * 产物：public/stamps/data/collection.json（构建时由 build.js 原样复制到 dist/stamps/data/）
 * 语言：仓库页面本身不含语言信息（新版页面懒加载），从 tools/stamp-album/repo-languages.json 的
 *       覆盖表读取（full_name → 语言），可由人工/Agent 维护；未覆盖则为 null。
 * 中文简介：构建期不写入；zh 由站点运行时从 public/stamps/data/zh-descriptions.json 合并
 *           （见 public/stamps/js/app.js）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRepo, finalizeRepo } from './lib/parse-page.mjs';

// 本脚本位于 tools/stamp-album/，上溯两级即项目根目录
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'public', 'stamps', 'data', 'collection.json');
const LANG_MAP = path.join(ROOT, 'tools', 'stamp-album', 'repo-languages.json');
const DELAY_MS = 1200;

// 收集链接：文件按行展开，其余按 URL 处理
const links = [];
for (const arg of process.argv.slice(2)) {
  if (/^https?:\/\//i.test(arg)) links.push(arg);
  else if (fs.existsSync(arg)) {
    for (const line of fs.readFileSync(arg, 'utf8').split('\n')) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      if (/^https?:\/\//i.test(s)) links.push(s);
      else console.warn(`跳过无法识别的行: ${s}`);
    }
  } else console.warn(`跳过不存在的文件: ${arg}`);
}
const uniq = [...new Set(links.map(s => s.replace(/#.*$/, '').trim()))].filter(Boolean);
if (uniq.length === 0) {
  console.error('未提供任何仓库链接。用法: node tools/stamp-album/parse-repos.mjs <links.txt | 链接...>');
  process.exit(1);
}

const langOverrides = fs.existsSync(LANG_MAP) ? JSON.parse(fs.readFileSync(LANG_MAP, 'utf8')) : {};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`待解析 ${uniq.length} 个仓库链接 …`);
  const items = [];
  for (let i = 0; i < uniq.length; i++) {
    const link = uniq[i];
    try {
      const res = await fetch(link, { headers: { 'User-Agent': 'star-cards-demo/0.1', 'Accept': 'text/html' }, redirect: 'follow' });
      if (!res.ok) { console.warn(`[${i + 1}/${uniq.length}] ${link} → HTTP ${res.status}，跳过`); continue; }
      const html = await res.text();
      const raw = extractRepo(html);
      if (!raw) { console.warn(`[${i + 1}/${uniq.length}] ${link} → 无法解析（不是仓库页？），跳过`); continue; }
      items.push(finalizeRepo(raw, langOverrides));
      console.log(`[${i + 1}/${uniq.length}] ✔ ${raw.full_name} ★${raw.stars}${raw.language ? ' · ' + raw.language : ''}`);
    } catch (e) {
      console.warn(`[${i + 1}/${uniq.length}] ${link} → 失败（${e.message}），跳过`);
    }
    if (i < uniq.length - 1) await sleep(DELAY_MS);
  }
  if (items.length === 0) { console.error('没有任何链接解析成功。'); process.exit(2); }
  const data = { generatedAt: new Date().toISOString(), source: 'user-provided repo links', total: items.length, items };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`✔ 生成 ${items.length} 张卡的数据 → ${OUT}`);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
