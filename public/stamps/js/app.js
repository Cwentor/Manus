/* 开源集邮册 · Demo 渲染逻辑（原生 JS，无依赖）—— 5 列邮票墙 */
'use strict';

import { fmtNum, langAbbr, yearOf, postmarkDate, mergeZh, filterSort, padCount, isArchived } from './lib/stamps.mjs';
import {
  POSTMARK_STYLES, POSTMARK_NONE, parsePostmarks, resolvePostmark, applyPostmark, serializePostmarks,
} from './lib/postmarks.mjs';

let ITEMS = [];
let GENERATED_AT = null;
const state = { q: '', lang: '', sort: 'stars' };

/* ---------- 邮戳盖印 ---------- */
const PM_KEY = 'stamp-album-postmarks';
let postmarks = {};        // full_name → 邮戳样式 id
let pmStored = false;      // localStorage 是否有用户操作记录（无则首票默认盖经典双环）

function loadPostmarks() {
  let raw = null;
  try { raw = localStorage.getItem(PM_KEY); } catch { /* 隐私模式：退化为内存态 */ }
  ({ map: postmarks, stored: pmStored } = parsePostmarks(raw));
}
function savePostmarks() {
  pmStored = true;
  try { localStorage.setItem(PM_KEY, serializePostmarks(postmarks)); } catch { /* 配额/隐私模式忽略 */ }
}

/* 票面实际生效的章（列表下标决定是否享受首票默认章） */
function styleOf(full, isFirst) {
  return resolvePostmark(postmarks, pmStored, full, { isFirst });
}

const PM_INNER = {
  classic: (d) => `<span>GITHUB<br><i>★</i><br>COLLECTED<br>${d}</span>`,
  wavy: (d) => `<span>GITHUB<br>${d}</span><svg class="pm-waves" viewBox="0 0 60 22" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4" opacity=".62"><path d="M0 3 q7 -5 14 0 t14 0 t14 0 t14 0"/><path d="M0 11 q7 -5 14 0 t14 0 t14 0 t14 0"/><path d="M0 19 q7 -5 14 0 t14 0 t14 0 t14 0"/></g></svg>`,
  star: (d) => `<span><i>✦</i><br>OPEN<br>SOURCE<br>${d}</span>`,
  avion: (d) => `<span class="pm-plane">✈</span><span>PAR AVION<br>${d}</span>`,
};
function postmarkHTML(style, date) {
  const inner = style && PM_INNER[style];
  return inner ? `<div class="postmark pm-${style}">${inner(date)}</div>` : '';
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function loadData() {
  // 两份数据并行取，省一个串行 RTT；中文缺失不阻塞主数据
  const [main, zh] = await Promise.all([
    fetch('./data/collection.json').then(r => r.json()),
    fetch('./data/zh-descriptions.json').then(r => r.json()).catch(() => null),
  ]);
  ITEMS = zh ? mergeZh(main.items, zh) : main.items;
  GENERATED_AT = main.generatedAt;
}

function visible() {
  return filterSort(ITEMS, state);
}

/* 归档封存章：仓库已 archived（只读、不再维护）→ 票面左上角盖一枚注销章。
   与右上角的邮戳分居两侧，互不遮挡；纯文字 + 边框，任意缩放都清晰 */
const ARCHIVE_SEAL = '<div class="seal-archived" aria-hidden="true"><b>ARCHIVED</b><span>已归档 · 不再维护</span></div>';

/* 票面骨架（不含邮戳：邮戳随「首票默认章」变化，单独增量同步） */
function stampHTML(it) {
  const archived = isArchived(it);
  return `
    <div class="stamp${archived ? ' is-archived' : ''}" data-full="${esc(it.full_name)}" title="${esc(it.full_name)}"
         tabindex="0" role="button" aria-label="查看 ${esc(it.full_name)} 详情${archived ? '（该仓库已归档）' : ''}">
      <div class="art">
        <div class="s-head ff">GITHUB · OPEN SOURCE</div>
        <div class="s-vig"><img src="${esc(it.avatar_url)}" alt="${esc(it.full_name)} 头像"
             width="52" height="52" loading="lazy" decoding="async" fetchpriority="low"
             onerror="this.style.display='none'"></div>
        <div class="s-name">${esc(it.name)}</div>
        <div class="s-sub">${esc(it.description || it.full_name)}</div>
        <div class="s-foot">
          <span class="s-type">TYPE · ${esc(langAbbr(it.language))}</span>
          <span class="s-value">★ ${fmtNum(it.stars)}</span>
        </div>
      </div>
      ${archived ? ARCHIVE_SEAL : ''}
    </div>`;
}

/* 中文简介富化：转义后加粗「是什么：」「有什么用：」标签，两问分行 */
const zhRich = (s) => esc(s)
  .replace(/(是什么：|有什么用：)/g, '<b>$1</b>')
  .replace('。<b>有什么用：', '。<br><b>有什么用：');

/* ---------- 渲染：节点复用 + 只重排不重建（列表变长时的主要开销来源） ---------- */
const cellCache = new Map();     // full_name → .cell（建一次，终身复用）
const padPool = [];              // 「待收集」空位池
let VIEW = [];                   // 当前可见列表：弹层/盖印/补位共用，不再重复 filterSort
let viewKey = '';                // 视图签名：内容与顺序都没变就跳过重排
let pmDate = '';                 // 邮戳日期，只算一次
let renderRaf = 0;

/* 同一帧内的多次触发（连续输入、resize 风暴）合并成一次渲染 */
function scheduleRender() {
  if (renderRaf) return;
  renderRaf = requestAnimationFrame(() => { renderRaf = 0; render(); });
}

function cellFor(it) {
  let cell = cellCache.get(it.full_name);
  if (cell) return cell;
  cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.full = it.full_name;
  cell.innerHTML = stampHTML(it);
  cellCache.set(it.full_name, cell);
  return cell;
}

function padCell() {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.innerHTML = '<div class="stamp empty-slot"><div class="art">待收集</div></div>';
  return cell;
}

const columnCount = (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length;

/* 只同步「该有章/该取章」的差异票，其余票的 DOM 完全不碰 */
function syncPostmarks(list) {
  const want = new Map();
  for (let i = 0; i < list.length; i++) {
    const style = styleOf(list[i].full_name, i === 0);
    if (style) want.set(list[i].full_name, style);
  }
  for (const [full, cell] of cellCache) {
    const stamp = cell.firstElementChild;
    const next = want.get(full) || '';
    if ((stamp.dataset.pm || '') === next) continue;
    stamp.querySelector('.postmark')?.remove();
    if (next) {
      stamp.insertAdjacentHTML('afterbegin', postmarkHTML(next, pmDate));
      stamp.dataset.pm = next;
    } else {
      delete stamp.dataset.pm;
    }
  }
}

function render() {
  const grid = $('grid');
  const cols = columnCount(grid);          // 在任何 DOM 变更前读，避免中途强制回流
  const list = (VIEW = visible());
  if (!pmDate) pmDate = postmarkDate(GENERATED_AT);

  const key = list.length + '|' + list.map(it => it.full_name).join(',');
  if (key !== viewKey) {
    viewKey = key;
    for (const cell of cellCache.values()) cell.hidden = true;
    // 复用已有节点，只按新顺序一次性排好；不重建 HTML、不重新解析
    grid.append(...list.map((it) => {
      const cell = cellFor(it);
      cell.hidden = false;
      return cell;
    }));
    syncPostmarks(list);
  }

  // 末行用「待收集」空位补齐（空位元素池化复用）
  const need = list.length ? padCount(list.length, cols) : 0;
  while (padPool.length < need) padPool.push(padCell());
  padPool.forEach((pad, i) => { pad.hidden = i >= need; });
  if (need) grid.append(...padPool.slice(0, need));

  $('empty').hidden = list.length > 0;
}

/* ---------- 详情弹层 ---------- */
function openModal(full) {
  const it = ITEMS.find(x => x.full_name === full);
  if (!it) return;
  $('m-avatar').style.visibility = '';   // 重置上次可能残留的 onerror 隐藏
  $('m-avatar').src = it.avatar_url;
  $('m-name').textContent = it.full_name;
  // 归档仓库在弹层里也要说清楚：只读、不再接受更新，避免用户点进去才发现
  const archived = isArchived(it);
  const meta = [it.license ? it.license + ' License' : null,
    it.created_at ? '发行于 ' + it.created_at.slice(0, 10) : null].filter(Boolean).join(' · ');
  $('m-owner').innerHTML =
    (archived ? '<span class="modal-archive-tag">ARCHIVED · 已归档 · 只读</span>' : '') +
    `<span>${esc(meta || ' ')}</span>`;
  $('m-zh').innerHTML = it.zh ? zhRich(it.zh) : '（暂无中文简介——可在 zh-descriptions.json 中补充）';
  $('m-zh').style.opacity = it.zh ? 1 : 0.55;
  $('m-en').textContent = it.description || '';
  $('m-stars').textContent = fmtNum(it.stars);
  $('m-forks').textContent = fmtNum(it.forks);
  $('m-lang').textContent = it.language || '—';
  $('m-created').textContent = yearOf(it.created_at);
  $('m-topics').innerHTML = (it.topics || []).map(t => `<span class="topic">${esc(t)}</span>`).join('');
  $('m-repo').href = it.repo_url;
  $('m-ownerlink').href = it.owner_url;
  renderPmPicker(it.full_name, VIEW.findIndex(x => x.full_name === it.full_name) === 0);
  $('modal').hidden = false;
}
function closeModal() { $('modal').hidden = true; }

/* ---------- 盖印选择 ---------- */
function renderPmPicker(full, isFirst) {
  const cur = styleOf(full, isFirst) || POSTMARK_NONE;
  const btn = (id, label, hint) => `
    <button type="button" class="pm-btn${id === cur ? ' active' : ''}" data-pm="${id}"
            title="${esc(hint)}" aria-pressed="${id === cur}">${esc(label)}</button>`;
  $('pm-options').innerHTML =
    btn(POSTMARK_NONE, '无印', '取下这枚票上的邮戳') +
    POSTMARK_STYLES.map(s => btn(s.id, s.label, s.hint)).join('');
}

/* 只重绘单张票的邮戳：避免整墙重绘导致滚动跳动、焦点丢失 */
function repaintPostmark(full, animate) {
  const cell = cellCache.get(full);
  const idx = VIEW.findIndex(x => x.full_name === full);
  if (!cell || idx < 0) return;
  const stamp = cell.firstElementChild;
  stamp.querySelector('.postmark')?.remove();
  const style = styleOf(full, idx === 0);
  if (!style) { delete stamp.dataset.pm; return; }
  stamp.insertAdjacentHTML('afterbegin', postmarkHTML(style, pmDate));
  stamp.dataset.pm = style;
  const pm = stamp.querySelector('.postmark');
  if (animate && pm) {
    pm.classList.add('pm-new');
    pm.addEventListener('animationend', () => pm.classList.remove('pm-new'), { once: true });
  }
}

$('pm-options').addEventListener('click', (e) => {
  const btn = e.target.closest('.pm-btn');
  if (!btn) return;
  const fromKeyboard = e.detail === 0;          // 键盘触发的 click 没有 detail
  const full = $('m-name').textContent;
  const idx = VIEW.findIndex(x => x.full_name === full);
  if (idx < 0) return;
  postmarks = applyPostmark(postmarks, full, btn.dataset.pm);
  savePostmarks();
  repaintPostmark(full, true);
  renderPmPicker(full, idx === 0);
  if (fromKeyboard) $('pm-options').querySelector('.pm-btn.active')?.focus({ preventScroll: true });
});

/* ---------- 工具栏与事件 ---------- */
function buildToolbar() {
  const langs = [...new Set(ITEMS.map(it => it.language).filter(Boolean))].sort();
  $('lang').innerHTML = '<option value="">全部票种</option>' +
    langs.map(l => `<option value="${esc(l)}">${esc(l)}（${ITEMS.filter(it => it.language === l).length}）</option>`).join('');
  $('search').addEventListener('input', (e) => { state.q = e.target.value; scheduleRender(); });
  $('lang').addEventListener('change', (e) => { state.lang = e.target.value; scheduleRender(); });
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; scheduleRender(); });
}

/* 票墙事件委托：整墙只挂 2 个监听器（原实现每张票 2 个，215 票 = 430 个） */
$('grid').addEventListener('click', (e) => {
  const stamp = e.target.closest('.stamp[data-full]');
  if (stamp) openModal(stamp.dataset.full);
});
$('grid').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const stamp = e.target.closest('.stamp[data-full]');
  if (!stamp) return;
  e.preventDefault();
  openModal(stamp.dataset.full);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$('modal').addEventListener('click', (e) => { if (e.target.dataset.close !== undefined) closeModal(); });
// resize 只可能改变列数 → 补位数量；同一帧内多次触发合并成一次
window.addEventListener('resize', () => scheduleRender());
// 另一标签页改了邮戳 → 跟随刷新（含「清空」写入 null 的情况）
window.addEventListener('storage', (e) => {
  if (e.key !== PM_KEY && e.key !== null) return;
  loadPostmarks();
  render();                          // 同步渲染，保证 VIEW 与弹层同步
  if (!$('modal').hidden) {
    const full = $('m-name').textContent;
    renderPmPicker(full, VIEW.findIndex(x => x.full_name === full) === 0);
  }
});

loadData().then(() => {
  loadPostmarks();
  buildToolbar();
  render();
  $('count').textContent = `${ITEMS.length} 张邮票 · 收录于 ${new Date(GENERATED_AT).toLocaleDateString('zh-CN')}`;
}).catch((e) => {
  $('empty').hidden = false;
  $('empty').textContent = '数据加载失败：' + e.message;
});
