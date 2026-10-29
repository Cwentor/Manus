/* 性能契约测试：这些写法一旦被「顺手改回去」，页面不会报错，
   只会随元素增多逐渐变卡。用断言把几条红线钉住。
   实测基准见 docs/specs 里的性能小节。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const app = read('public/stamps/js/app.js');
const css = read('public/stamps/css/styles.css');
const html = read('public/stamps/index.html');

const block = (selector) => {
  const m = css.match(new RegExp(`(?:^|\\n)\\${selector}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
};

test('邮票不使用 will-change 常驻提层（215 个合成层会吃光显存）', () => {
  const rule = block('.stamp');
  assert.ok(rule.length > 0, '未找到 .stamp 规则');
  assert.doesNotMatch(rule, /will-change/, '.stamp 上不应常驻 will-change：每张票都会成为独立合成层');
});

test('筛选隐藏走 display 切换，cell 必须有 [hidden] 规则', () => {
  assert.match(css, /\.cell\[hidden\]\s*\{[^}]*display:\s*none/,
    '缺少 .cell[hidden]{display:none}：.cell 的 display:flex 会盖掉浏览器默认的 hidden 行为');
});

test('票墙事件委托挂在容器上，不逐票绑定', () => {
  assert.match(app, /\$\('grid'\)\.addEventListener\('click'/, '缺少 #grid 的 click 委托');
  assert.match(app, /\$\('grid'\)\.addEventListener\('keydown'/, '缺少 #grid 的 keydown 委托');
  assert.doesNotMatch(app, /querySelectorAll\('#grid \.stamp\[data-full\]'\)\.forEach/,
    '不要遍历每张票绑定事件：215 张票 = 430 个监听器');
});

test('渲染不重建整墙（innerHTML 重建会丢掉节点复用与滚动位置）', () => {
  assert.doesNotMatch(app, /\bgrid\.innerHTML\s*=/, 'render() 不应再用 innerHTML 整墙重建');
  assert.match(app, /cellCache/, '应存在节点缓存');
  assert.match(app, /scheduleRender/, '连续输入/resize 应经 rAF 合并');
});

test('输入与 resize 不直接同步渲染（合并到一帧）', () => {
  assert.match(app, /\$\('search'\)\.addEventListener\('input',[\s\S]{0,120}scheduleRender\(\)/,
    '搜索输入应走 scheduleRender（rAF 合并），而非每次按键同步渲染');
  assert.match(app, /addEventListener\('resize',[\s\S]{0,60}scheduleRender/,
    'resize 应合并到一帧再渲染');
});

test('头像图片声明懒加载与异步解码', () => {
  const img = app.match(/<img[\s\S]*?>/);
  assert.ok(img, '未找到票面头像 img');
  assert.match(img[0], /loading="lazy"/, '缺少 loading="lazy"');
  assert.match(img[0], /decoding="async"/, '缺少 decoding="async"：解码会阻塞主线程');
  assert.match(img[0], /width="52"[\s\S]*height="52"/, '缺少宽高属性，首屏会抖动');
});

test('头像 CDN 已预连接', () => {
  assert.match(html, /rel="preconnect" href="https:\/\/avatars\.githubusercontent\.com"/,
    '缺少 avatars.githubusercontent.com 预连接：每张头像都会多花一次 TLS 握手');
});

test('两份数据并行加载，不是串行等待', () => {
  assert.match(app, /Promise\.all\(/, 'collection.json 与 zh-descriptions.json 应并行获取');
});
