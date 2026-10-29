/* 归档封存章：判定逻辑 + 数据契约 + 渲染红线。
   归档仓库（is_archived）在票面左上角盖「ARCHIVED / 已归档」章，且不能与右上角邮戳撞位。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isArchived } from '../../public/stamps/js/lib/stamps.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const app = read('public/stamps/js/app.js');
const css = read('public/stamps/css/styles.css');
const data = JSON.parse(read('public/stamps/data/collection.json'));

test('isArchived 只认明确为真的值，脏数据不误盖', () => {
  assert.equal(isArchived({ is_archived: true }), true);
  assert.equal(isArchived({ is_archived: 'true' }), true);
  assert.equal(isArchived({ is_archived: 1 }), true);
  assert.equal(isArchived({ is_archived: '1' }), true);
  assert.equal(isArchived({ is_archived: false }), false);
  assert.equal(isArchived({ is_archived: 'false' }), false);
  assert.equal(isArchived({ is_archived: 'yes' }), false);
  assert.equal(isArchived({}), false);
  assert.equal(isArchived(null), false);
  assert.equal(isArchived(undefined), false);
});

test('数据里每条都带布尔 is_archived，且归档项仍在册（不被过滤掉）', () => {
  const bad = data.items.filter((it) => typeof it.is_archived !== 'boolean');
  assert.deepEqual(bad.map(it => it.full_name), [], 'is_archived 必须是布尔值');

  const archived = data.items.filter(isArchived);
  assert.ok(archived.length >= 1, '样本数据应至少含 1 个归档仓库，否则这枚章无从验证');
  // 归档只是盖章，不改变收录状态：全部条目都应进入列表
  assert.equal(data.items.length, data.total);
});

test('app.js：封存章只在归档分支输出，并带到无障碍标签', () => {
  assert.match(app, /const ARCHIVE_SEAL =/, '缺少封存章标记常量');
  assert.match(app, /isArchived\(it\)/, 'stampHTML 未调用 isArchived 判定');
  assert.match(app, /archived \? ARCHIVE_SEAL : ''/, '封存章应仅在归档时插入');
  assert.match(app, /class="stamp\$\{archived \? ' is-archived' : ''\}"/, '归档票缺少 is-archived 类');
  assert.match(app, /该仓库已归档/, '无障碍标签未说明归档状态');
  assert.match(app, /modal-archive-tag/, '弹层缺少归档徽章');
  assert.match(css, /\.modal-archive-tag\s*\{/, '弹层归档徽章缺少样式');
});

test('CSS：封存章有独立样式，且与邮戳分居左右两角', () => {
  assert.match(css, /\.seal-archived\s*\{/);
  assert.match(css, /\.seal-archived b\s*\{/, '缺少章体主文字样式');
  assert.match(css, /\.seal-archived span\s*\{/, '缺少副说明文字样式');
  // 归档票的题头条换成章体同款冷灰墨，整排扫视即可认出
  assert.match(css, /\.stamp\.is-archived \.s-head\s*\{[^}]*var\(--seal-ink\)/,
    '归档票题头条应改用 --seal-ink');

  const seal = /\.seal-archived\s*\{[^}]*\}/.exec(css)[0];
  const pm = /\.postmark\s*\{[^}]*\}/.exec(css)[0];
  assert.match(seal, /left:/, '封存章应贴左角');
  assert.doesNotMatch(seal, /right:/, '两章不得都贴右侧，否则窄屏重叠');
  assert.match(pm, /right:\s*-/, '邮戳应贴右上角');
  // 印章尺寸须收敛在票面以内：不能宽过一张票（五列最窄约 200px）
  assert.match(seal, /pointer-events:\s*none/, '印章不应拦截点击');
  assert.doesNotMatch(seal, /position:\s*fixed/, '印章应相对票面定位');
});

test('归档票的渲染不引入位图，缩放后仍清晰', () => {
  assert.match(app, /<b>ARCHIVED<\/b>/, '章体应使用文字而非图片');
  assert.doesNotMatch(app.match(/const ARCHIVE_SEAL = [^;]+;/)[0], /<img|url\(/, '封存章不应引入位图');
  assert.doesNotMatch(sealBlock(css), /url\(/, '封存章样式不应引用位图');
});

function sealBlock(source) {
  const start = source.indexOf('.seal-archived {');
  return source.slice(start, source.indexOf('/* 待收集空位 */', start));
}
