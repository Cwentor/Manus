import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtNum, langAbbr, yearOf, postmarkDate, mergeZh, filterSort, padCount } from '../../public/stamps/js/lib/stamps.mjs';

test('fmtNum 千分位与非数字', () => {
  assert.equal(fmtNum(251761), '251,761');
  assert.equal(fmtNum(0), '0');
  assert.equal(fmtNum(undefined), '0');
});

test('langAbbr 缩写与缺失', () => {
  assert.equal(langAbbr('TypeScript'), 'TS');
  assert.equal(langAbbr('JavaScript'), 'JS');
  assert.equal(langAbbr('Rust'), 'Rust');
  assert.equal(langAbbr(null), '—');
  assert.equal(langAbbr(''), '—');
});

test('yearOf / postmarkDate 解析与容错', () => {
  assert.equal(yearOf('2018-05-13T00:00:00.000Z'), '2018');
  assert.equal(yearOf(null), '—');
  assert.equal(postmarkDate('2026-10-25T08:00:00.000Z'), '2026.10.25');
  assert.equal(postmarkDate('not-a-date'), '');
  assert.equal(postmarkDate(null), '');
});

test('mergeZh 合并、跳过 _ 键、不修改原数组', () => {
  const items = [{ full_name: 'a/b' }, { full_name: 'c/d', zh: '旧' }];
  const zh = { _comment: 'x', 'a/b': '中文', 'c/d': '' };
  const out = mergeZh(items, zh);
  assert.equal(out[0].zh, '中文');
  assert.equal(out[1].zh, '旧');           // 空串不覆盖
  assert.equal('zh' in items[0], false);   // 不改原数组
  assert.equal(mergeZh(items, null)[0].zh, undefined);
});

test('filterSort 过滤与排序', () => {
  const items = [
    { full_name: 'a/react', description: 'ui lib', stars: 251, created_at: '2013-05-24', language: 'JS' },
    { full_name: 'b/deno', description: 'runtime', stars: 101, created_at: '2018-05-13', language: 'Rust', zh: '运行时' },
    { full_name: 'c/x', stars: 300, language: 'JS' },
  ];
  assert.deepEqual(filterSort(items, { q: '运行时' }).map(i => i.full_name), ['b/deno']);
  assert.deepEqual(filterSort(items, { q: '（' }).length, 0);       // 特殊字符按字面匹配
  assert.deepEqual(filterSort(items, { lang: 'JS' }).map(i => i.full_name), ['a/react', 'c/x']);
  assert.deepEqual(filterSort(items, { sort: 'stars' }).map(i => i.stars), [300, 251, 101]);
  assert.deepEqual(filterSort(items, { sort: 'name' }).map(i => i.full_name), ['a/react', 'b/deno', 'c/x']);
  assert.deepEqual(filterSort(items, { sort: 'created' })[0].full_name, 'a/react'); // 缺 created_at 排后
  assert.equal(filterSort(items, { q: 'zzz' }).length, 0);
});

test('padCount 补位', () => {
  assert.equal(padCount(16, 6), 2);
  assert.equal(padCount(18, 6), 0);
  assert.equal(padCount(0, 6), 0);
});
