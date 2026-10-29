export const fmtNum = (n) => Number.isFinite(Number(n)) && n !== null && n !== ''
  ? Number(n).toLocaleString('en-US') : '0';

export const langAbbr = (lang) => !lang ? '—'
  : lang.replace('TypeScript', 'TS').replace('JavaScript', 'JS');

export const yearOf = (iso) => {
  const m = /^\s*(\d{4})/.exec(String(iso ?? ''));
  return m ? m[1] : '—';
};

export const postmarkDate = (iso) => {
  const d = new Date(iso ?? '');
  return isNaN(d) ? '' :
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/* 归档判定：GitHub API 给的是布尔，但抓取链路里也可能落成字符串；
   只在明确为「是」时才认，缺字段/脏数据一律按未归档处理，避免误盖封存章 */
export const isArchived = (it) => {
  const v = it && it.is_archived;
  return v === true || v === 1 || v === 'true' || v === '1';
};

export function mergeZh(items, zhMap) {
  if (!zhMap || typeof zhMap !== 'object') return items.map(i => ({ ...i }));
  return items.map(it => {
    const zh = zhMap[it.full_name];
    return (typeof zh === 'string' && zh) ? { ...it, zh } : { ...it };
  });
}

export function filterSort(items, { q = '', lang = '', sort = '' } = {}) {
  const needle = q.trim().toLowerCase();
  let list = items.filter(it =>
    (!lang || it.language === lang) &&
    (!needle || `${it.full_name} ${it.description || ''} ${it.zh || ''}`.toLowerCase().includes(needle)));
  if (sort === 'stars') list = [...list].sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0));
  if (sort === 'name') list = [...list].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
  if (sort === 'created') list = [...list].sort((a, b) =>
    String(a.created_at || '9999').localeCompare(String(b.created_at || '9999')));
  return list;
}

export const padCount = (len, cols) => (cols > 0 && len > 0) ? (cols - (len % cols)) % cols : 0;
