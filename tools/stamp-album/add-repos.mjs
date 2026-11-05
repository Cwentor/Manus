#!/usr/bin/env node
/**
 * add-repos.mjs — 增量收录：只抓取指定链接，合并进已有 collection.json（不覆盖已有条目）
 *
 * 为什么需要它：parse-repos.mjs 是全量重建，224 个仓库挨个重抓（1.2s 间隔）。
 * 一旦某个仓库改名/删除/限流，脚本会静默跳过，导致已收藏的票在册子里凭空消失。
 * 增量模式只碰新增条目，老数据原样保留。
 *
 * 用法：
 *   node tools/stamp-album/add-repos.mjs https://github.com/a/b [更多链接...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRepo, finalizeRepo } from './lib/parse-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'public', 'stamps', 'data', 'collection.json');
const LANG_MAP = path.join(ROOT, 'tools', 'stamp-album', 'repo-languages.json');
const DEPRECATED_MAP = path.join(ROOT, 'tools', 'stamp-album', 'deprecated.json');
const DELAY_MS = 1200;

const links = process.argv.slice(2).filter(a => /^https?:\/\//i.test(a));
if (links.length === 0) {
  console.error('用法: node tools/stamp-album/add-repos.mjs <链接...>');
  process.exit(1);
}

const langOverrides = fs.existsSync(LANG_MAP) ? JSON.parse(fs.readFileSync(LANG_MAP, 'utf8')) : {};
const deprecatedNotes = fs.existsSync(DEPRECATED_MAP) ? JSON.parse(fs.readFileSync(DEPRECATED_MAP, 'utf8')) : {};
const data = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: [] };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const known = new Set(data.items.map(i => i.full_name.toLowerCase()));
  let added = 0;
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    try {
      const res = await fetch(link, { headers: { 'User-Agent': 'star-cards-demo/0.1', 'Accept': 'text/html' }, redirect: 'follow' });
      if (!res.ok) { console.warn(`[${i + 1}/${links.length}] ${link} → HTTP ${res.status}，跳过`); continue; }
      const raw = extractRepo(await res.text());
      if (!raw) { console.warn(`[${i + 1}/${links.length}] ${link} → 无法解析（不是仓库页？），跳过`); continue; }
      if (known.has(raw.full_name.toLowerCase())) {
        console.log(`[${i + 1}/${links.length}] = ${raw.full_name} 已在册，跳过`);
        continue;
      }
      const item = finalizeRepo(raw, langOverrides);
      const note = deprecatedNotes[item.full_name];
      if (typeof note === 'string' && note) { item.is_deprecated = true; item.deprecated_note = note; }
      data.items.push(item);
      known.add(item.full_name.toLowerCase());
      added++;
      console.log(`[${i + 1}/${links.length}] ✔ ${raw.full_name} ★${raw.stars}${raw.language ? ' · ' + raw.language : ' · 语言未知'}`);
    } catch (e) {
      console.warn(`[${i + 1}/${links.length}] ${link} → 失败（${e.message}），跳过`);
    }
    if (i < links.length - 1) await sleep(DELAY_MS);
  }
  data.total = data.items.length;
  data.generatedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`✔ 新增 ${added} 张，册内共 ${data.total} 张 → ${OUT}`);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
