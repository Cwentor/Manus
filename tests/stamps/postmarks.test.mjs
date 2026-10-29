import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POSTMARK_STYLES, POSTMARK_IDS, POSTMARK_NONE, DEFAULT_POSTMARK, isPostmarkId,
  parsePostmarks, resolvePostmark, applyPostmark, serializePostmarks, postmarkCount,
} from '../../public/stamps/js/lib/postmarks.mjs';

test('样式集合：4 种章 + 唯一 id', () => {
  assert.equal(POSTMARK_STYLES.length, 4);
  assert.equal(new Set(POSTMARK_IDS).size, POSTMARK_IDS.length);
  assert.equal(isPostmarkId(DEFAULT_POSTMARK), true);
  assert.equal(isPostmarkId(POSTMARK_NONE), false);   // 「无印」不是可存样式
  for (const s of POSTMARK_STYLES) assert.ok(s.label && s.hint);
});

test('parsePostmarks：从未盖印 / 正常存档 / 损坏内容', () => {
  assert.deepEqual(parsePostmarks(null), { map: {}, stored: false });
  assert.deepEqual(parsePostmarks(undefined), { map: {}, stored: false });

  assert.deepEqual(parsePostmarks('{"a/b":"wavy"}'), { map: { 'a/b': 'wavy' }, stored: true });
  assert.deepEqual(parsePostmarks({ 'a/b': 'star' }), { map: { 'a/b': 'star' }, stored: true });

  // 损坏 JSON / 非对象：视为已操作过，别再盖默认章
  assert.deepEqual(parsePostmarks('{oops'), { map: {}, stored: true });
  assert.deepEqual(parsePostmarks('[]'), { map: {}, stored: true });
  assert.deepEqual(parsePostmarks('"x"'), { map: {}, stored: true });

  // 非法样式名、空键丢弃
  assert.deepEqual(parsePostmarks('{"a/b":"nope","":"classic","c/d":1}'), { map: {}, stored: true });
});

test('resolvePostmark：显式记录 > 首票默认 > 无印', () => {
  const map = { 'a/b': 'avion' };
  assert.equal(resolvePostmark(map, true, 'a/b'), 'avion');
  assert.equal(resolvePostmark(map, true, 'c/d'), null);
  // 从未操作过：仅第一张票默认盖经典双环
  assert.equal(resolvePostmark({}, false, 'x/y', { isFirst: true }), DEFAULT_POSTMARK);
  assert.equal(resolvePostmark({}, false, 'x/y', { isFirst: false }), null);
  // 操作过（哪怕是「无印」）就不再补默认章
  assert.equal(resolvePostmark({}, true, 'x/y', { isFirst: true }), null);
  // 脏值不生效
  assert.equal(resolvePostmark({ 'a/b': 'bogus' }, true, 'a/b'), null);
});

test('applyPostmark：盖印 / 取印 / 不改原对象', () => {
  const before = { 'a/b': 'classic' };
  const next = applyPostmark(before, 'c/d', 'wavy');
  assert.deepEqual(next, { 'a/b': 'classic', 'c/d': 'wavy' });
  assert.deepEqual(before, { 'a/b': 'classic' });     // 入参不变

  assert.deepEqual(applyPostmark(before, 'a/b', POSTMARK_NONE), {});        // 无印 = 删键
  assert.deepEqual(applyPostmark(before, 'a/b', 'bogus'), {});
  assert.deepEqual(applyPostmark(before, '', 'star'), { 'a/b': 'classic' }); // 无票名不改
  assert.deepEqual(applyPostmark({}, 'a/b', 'star'), { 'a/b': 'star' });
});

test('serializePostmarks：键排序、丢非法、可回读', () => {
  const s = serializePostmarks({ 'z/z': 'star', 'a/a': 'wavy', 'bad/bad': 'nope' });
  assert.equal(s, '{"a/a":"wavy","z/z":"star"}');
  assert.equal(serializePostmarks({}), '{}');
  assert.equal(serializePostmarks(null), '{}');
  const round = parsePostmarks(s).map;
  assert.deepEqual(round, { 'a/a': 'wavy', 'z/z': 'star' });
});

test('postmarkCount 统计已盖印章数', () => {
  assert.equal(postmarkCount({ 'a/b': 'classic', 'c/d': 'none', 'e/f': 'bogus' }), 1);
  assert.equal(postmarkCount({}), 0);
  assert.equal(postmarkCount(null), 0);
});
