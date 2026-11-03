/* 弃用章：判定逻辑 + 数据契约 + 渲染红线。
   与归档章的区别：archived 是 GitHub 的客观状态（只读），弃用是站长的人工结论
   （合规风险、生态迁移、作者态度），来自 tools/stamp-album/deprecated.json。
   票面上两章同在左侧、纵向叠列，所以位置必须算清楚——叠字比不盖章更糟。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeprecated } from '../../public/stamps/js/lib/stamps.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const app = read('public/stamps/js/app.js');
const css = read('public/stamps/css/styles.css');
const html = read('public/stamps/index.html');
const data = JSON.parse(read('public/stamps/data/collection.json'));
const list = JSON.parse(read('tools/stamp-album/deprecated.json'));

test('isDeprecated 只认明确为真的值，脏数据不误盖章', () => {
  assert.equal(isDeprecated({ is_deprecated: true }), true);
  assert.equal(isDeprecated({ is_deprecated: 'true' }), true);
  assert.equal(isDeprecated({ is_deprecated: 1 }), true);
  assert.equal(isDeprecated({ is_deprecated: '1' }), true);
  assert.equal(isDeprecated({ is_deprecated: false }), false);
  assert.equal(isDeprecated({ is_deprecated: 'false' }), false);
  assert.equal(isDeprecated({ is_deprecated: 'yes' }), false);
  assert.equal(isDeprecated({}), false);          // 绝大多数票没有这个字段
  assert.equal(isDeprecated(null), false);
  assert.equal(isDeprecated(undefined), false);
});

test('人工弃用清单与实际数据对齐，且弃用项仍在册', () => {
  const declared = Object.keys(list).filter((k) => !k.startsWith('_'));
  assert.ok(declared.length >= 1, '弃用清单不应为空，否则这枚章无从验证');

  const byName = new Map(data.items.map((it) => [it.full_name, it]));
  for (const name of declared) {
    const it = byName.get(name);
    assert.ok(it, `清单里的 ${name} 不在卡册数据中，清单与 collection.json 脱节`);
    assert.equal(it.is_deprecated, true, `${name} 命中清单却没打上 is_deprecated`);
    assert.equal(it.deprecated_note, list[name], `${name} 的弃用理由与清单不一致`);
  }

  // 弃用只是盖章，不改变收录状态（与归档章同一原则）
  assert.equal(data.items.length, data.total);
  assert.ok(data.items.filter(isDeprecated).length >= 1, '样本里应至少有一张弃用票');
});

test('is_deprecated 若出现必须是布尔，避免模板里出现字符串 "false" 也盖章', () => {
  const bad = data.items
    .filter((it) => 'is_deprecated' in it && typeof it.is_deprecated !== 'boolean')
    .map((it) => it.full_name);
  assert.deepEqual(bad, [], 'is_deprecated 必须是布尔值');
});

test('app.js：弃用章只在弃用分支输出，并带到无障碍标签与弹层', () => {
  assert.match(app, /const DEPRECATED_SEAL =/, '缺少弃用章标记常量');
  assert.match(app, /isDeprecated\(it\)/, 'stampHTML 未调用 isDeprecated 判定');
  assert.match(app, /deprecated \? DEPRECATED_SEAL : ''/, '弃用章应仅在弃用时插入');
  assert.match(app, /\$\{deprecated \? ' is-deprecated' : ''\}/, '弃用票缺少 is-deprecated 类');
  assert.match(app, /该仓库已弃用/, '无障碍标签未说明弃用状态');
  assert.match(app, /modal-deprecated-tag/, '弹层缺少弃用徽章');
  assert.match(app, /\$\('m-deprecated'\)/, '弹层未渲染弃用理由');
  assert.match(html, /id="m-deprecated"/, 'index.html 缺少 #m-deprecated 容器');
});

test('CSS：弃用章与归档章同侧叠列，绝不叠字', () => {
  assert.match(css, /--deprecate-ink:/, '缺少弃用章的墨色 token');
  assert.match(css, /\.stamp\.is-deprecated \.s-head\s*\{[^}]*var\(--deprecate-ink\)/,
    '弃用票题头条应改用 --deprecate-ink');
  assert.match(css, /\.seal-deprecated\s*\{/);
  assert.match(css, /\.seal-deprecated b\s*\{/, '缺少章体主文字样式');
  assert.match(css, /\.seal-deprecated span\s*\{/, '缺少副说明文字样式');

  const dep = /\.seal-deprecated\s*\{[^}]*\}/.exec(css)[0];
  const arc = /\.seal-archived\s*\{[^}]*\}/.exec(css)[0];

  assert.match(dep, /left:/, '弃用章应贴左角');
  assert.doesNotMatch(dep, /right:/, '不得靠右，右上角是邮戳的位置');
  assert.match(dep, /pointer-events:\s*none/, '印章不应拦截点击');
  assert.doesNotMatch(dep, /position:\s*fixed/, '印章应相对票面定位');
  assert.doesNotMatch(dep, /url\(/, '印章样式不应引用位图');

  // 纵向必须错开：弃用章的 top 下界要大于归档章 top 上界 + 章体高度（约 20px）
  const topRange = (block) => {
    const m = /top:\s*clamp\(\s*([\d.]+)px\s*,[^,]+,\s*([\d.]+)px\s*\)/.exec(block);
    assert.ok(m, '印章 top 应写成 clamp(min, …, max) 以便校验缩放区间');
    return { min: Number(m[1]), max: Number(m[2]) };
  };
  const depTop = topRange(dep);
  const arcTop = topRange(arc);
  assert.ok(depTop.min >= arcTop.max + 20,
    `两章会叠字：弃用章 top 最小 ${depTop.min}px，归档章最高到 ${arcTop.max}px（章高约 20px）`);
});
