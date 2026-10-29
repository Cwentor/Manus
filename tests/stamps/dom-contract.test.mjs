/* DOM 契约测试：app.js 里 $('id') 拿到的节点，index.html 必须真的存在。
   针对「选择器写了、标记忘了加 → 模块顶层 TypeError 整站白屏」这类事故。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTMARK_STYLES } from '../../public/stamps/js/lib/postmarks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const html = read('public/stamps/index.html');
const app = read('public/stamps/js/app.js');
const css = read('public/stamps/css/styles.css');

const hasId = (id) => new RegExp(`id="${id}"`).test(html);

test('app.js 引用的 DOM id 全部存在于 index.html', () => {
  const ids = new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 10, '应能解析出 app.js 中的 id 引用');
  const missing = [...ids].filter((id) => !hasId(id));
  assert.deepEqual(missing, [], `index.html 缺少这些 id：${missing.join(', ')}`);
});

test('邮戳选择器容器与角色标记齐备', () => {
  assert.ok(hasId('pm-options'), '#pm-options 容器缺失');
  assert.match(html, /id="pm-options"[^>]*role="group"/);
  assert.match(html, /class="pm-picker"/);
  assert.match(css, /\.pm-btn/, '缺少 .pm-btn 样式');
  assert.match(css, /\.postmark\.pm-new/, '缺少盖印动画样式');
});

test('app.js 以 type=module 引入且 CSS 已链接', () => {
  assert.match(html, /<script type="module" src="\.\/js\/app\.js">/);
  assert.match(html, /href="\.\/css\/styles\.css"/);
});

test('app.js 为每种邮戳样式提供了票面标记', () => {
  const missing = POSTMARK_STYLES.filter(s => !new RegExp(`\\b${s.id}:\\s*\\(d\\)\\s*=>`).test(app))
    .map(s => s.id);
  assert.deepEqual(missing, [], `app.js 的 PM_INNER 缺少：${missing.join(', ')}`);
});

test('样式表里不再散落未登记的十六进制色值', () => {
  const rootVars = css.slice(css.indexOf(':root'), css.indexOf('}'));   // :root 内的 token 允许
  const rest = css
    .replace(rootVars, '')
    .replace(/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,8}\)/g, 'var(--x)')       // token 回退值允许
    .replace(/#000\b/g, 'var(--x)');                                     // 齿孔遮罩黑允许
  const offenders = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  assert.deepEqual(offenders, [], `请改用 var(--token)：${offenders.join(', ')}`);
});
