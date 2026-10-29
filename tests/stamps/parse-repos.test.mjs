import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractRepo, finalizeRepo } from '../../tools/stamp-album/lib/parse-page.mjs';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../tools/stamp-album/fixtures/repo-page.html'), 'utf8');

test('extractRepo 解析 payload 字段并清洗描述', () => {
  const r = extractRepo(html);
  assert.equal(r.full_name, 'denoland/deno');
  assert.equal(r.description, "Convert files & images offline.");   // 双重转义解码 + 「- owner/repo」尾巴剥离
  const r2 = extractRepo('<meta property="og:description" content="Some tool. Contribute to a/b development by creating an account on GitHub."><meta name="octolytics-dimension-repository_nwo" content="a/b">');
  assert.equal(r2.description, "Some tool.");                        // 「Contribute to...」样板句照常剥离
  assert.equal(r.stars, 101000);
  assert.equal(r.forks, 22300);
  assert.deepEqual(r.topics, ['typescript', 'runtime']);
  assert.equal(r.created_at, '2018-05-13T00:00:00.000Z');
  assert.equal(r.license, 'MIT');
  assert.equal(r.is_archived, false);
  assert.equal(r.language, null);                     // 语言来自覆盖表
});

test('extractRepo 非仓库页返回 null', () => {
  assert.equal(extractRepo('<html><body>404</body></html>'), null);
});

test('extractRepo 剥离描述开头的 emoji 短码（票面不渲染 :books: 这类）', () => {
  const mk = (d) => extractRepo(`<meta property="og:description" content="${d}"><meta name="octolytics-dimension-repository_nwo" content="a/b">`);
  assert.equal(mk(':books: List of awesome university courses!').description, 'List of awesome university courses!');
  assert.equal(mk(':link: Some useful websites.').description, 'Some useful websites.');
  assert.equal(mk(':house_with_garden: Open source home automation.').description, 'Open source home automation.');
  // 不误伤：正文里的冒号、非短码词、正常开头都保持不变
  assert.equal(mk('Convert files: offline.').description, 'Convert files: offline.');
  assert.equal(mk('Note: something about a tool.').description, 'Note: something about a tool.');
  assert.equal(mk(': 半角冒号开头').description, ': 半角冒号开头');
});

test('finalizeRepo 组装展示字段与降级', () => {
  const raw = extractRepo(html);
  const item = finalizeRepo(raw, { 'denoland/deno': 'Rust' });
  assert.equal(item.owner, 'denoland');
  assert.equal(item.name, 'deno');
  assert.equal(item.language, 'Rust');
  assert.ok(!('zh' in item));          // 构建期不写入 zh，运行时由 public/stamps/js/app.js 合并
  assert.equal(item.avatar_url, 'https://github.com/denoland.png?size=120');
  const miss = finalizeRepo(raw, {});
  assert.equal(miss.language, null);   // 覆盖表缺键 → 静默降级
  assert.ok(!('zh' in miss));
});
