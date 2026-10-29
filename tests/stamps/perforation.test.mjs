/* 齿孔边缘契约测试：邮票齿孔是纯 CSS 遮罩，改错参数不会报错、只会「悄悄变糊/变平」，
   所以把几何不变量固化成断言。
   不变量：① 四边都用 --perf-tooth 作节距；② 安全边 > 咬入深度；③ 间距 > 孔径（否则齿连成波浪）；
          ④ 参数同单位且随票宽缩放；⑤ 阴影层不进遮罩。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(join(root, 'public/stamps/css/styles.css'), 'utf8');

/* 取某个选择器的第一条规则（从选择器到它自己的右花括号） */
function rule(selector) {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, `样式表里找不到 ${selector}`);
  return css.slice(i, css.indexOf('}', i) + 1);
}
const base = rule('.stamp {');
const paper = rule('.stamp::before');
const shadow = rule('.stamp::after');
const art = rule('.art {');

function token(name) {
  const m = base.match(new RegExp(`--${name}:\\s*(-?[\\d.]+)([a-z%]+)`));
  assert.ok(m, `.stamp 上缺少 --${name}`);
  return { value: parseFloat(m[1]), unit: m[2] };
}

test('齿孔参数齐备，且单位一致（保证随票宽等比缩放）', () => {
  const units = ['perf-tooth', 'perf-hole', 'perf-corner', 'perf-inset'].map((n) => token(n).unit);
  assert.deepEqual([...new Set(units)], ['cqw'], `参数单位应统一为 cqw，实际：${units.join(' / ')}`);
  assert.ok(token('perf-tooth').value > 0 && token('perf-hole').value > 0);
});

test('间距必须大于齿孔直径，否则齿孔连成一条波浪边', () => {
  const tooth = token('perf-tooth').value;
  const hole = token('perf-hole').value;
  assert.ok(tooth > hole, `--perf-tooth(${tooth}) 必须 > --perf-hole(${hole})`);
  assert.ok(hole / tooth > 0.3, '孔径/间距太小会让齿孔几乎看不见');
  assert.ok(hole / tooth < 0.9, '孔径/间距太大会让齿孔互相吃穿、失去齿形');
});

test('安全边必须大于咬入深度，齿孔不会咬到票面图案', () => {
  const bite = token('perf-hole').value / 2;      // 半圆咬入深度 = 半径
  const inset = token('perf-inset').value;
  assert.ok(inset > bite + 0.4, `--perf-inset(${inset}) 须大于咬入深度 ${bite} 并留余量`);
});

test('票纸由四边矢量遮罩取交集打孔，不用位图', () => {
  const layers = paper.match(/radial-gradient/g) || [];
  assert.equal(layers.length, 8, '加前缀与标准写法各应 4 层（上下左右）');
  assert.match(paper, /mask-composite:\s*intersect/);
  assert.match(paper, /-webkit-mask-composite:\s*source-in/);
  assert.doesNotMatch(paper, /url\(/, '齿孔不得依赖位图，缩放会糊');
  assert.match(paper, /border-radius:\s*var\(--perf-corner\)/, '圆角参数未生效');
  assert.doesNotMatch(paper, /box-shadow/, '阴影不能画在遮罩层上，否则被齿孔咬掉');
});

test('上下边横向平铺、左右边纵向平铺，节距都取自 --perf-tooth', () => {
  assert.equal((paper.match(/\/ var\(--perf-tooth\) 100% repeat-x/g) || []).length, 4,
    '上/下边应各有一层（加前缀共 4 条）按齿距横向平铺');
  assert.equal((paper.match(/\/ 100% var\(--perf-tooth\) repeat-y/g) || []).length, 4,
    '左/右边应各有一层（加前缀共 4 条）按齿距纵向平铺');
});

test('票面图案内缩到安全边，阴影独立成层', () => {
  assert.match(art, /inset:\s*var\(--perf-inset\)/, '票面底纹未按安全边内缩，会被齿孔咬到');
  assert.match(shadow, /box-shadow/);
  assert.doesNotMatch(shadow, /mask/, '阴影层不能参与遮罩');
  assert.match(shadow, /border-radius:\s*var\(--perf-corner\)/, '阴影圆角应与票纸一致');
});

test('不支持容器查询单位的浏览器退化为固定像素', () => {
  assert.match(css, /@supports not \(container-type: inline-size\)/);
  const fallback = css.slice(css.indexOf('@supports not (container-type'));
  assert.match(fallback, /--perf-tooth:\s*[\d.]+px/);
  assert.match(fallback, /--perf-inset:\s*[\d.]+px/);
});
