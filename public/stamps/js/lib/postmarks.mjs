/* 邮戳样式与盖印状态（纯逻辑，浏览器 + node 共用）
   map 形如 { 'owner/repo': 'classic' }，键不存在 = 该票无印 */
export const POSTMARK_NONE = 'none';
export const DEFAULT_POSTMARK = 'classic';   // 首次进站时第一张票的默认章

export const POSTMARK_STYLES = [
  { id: 'classic', label: '经典双环', hint: '双圆环 · 收藏钢印' },
  { id: 'wavy', label: '波浪销票', hint: '三道销票波纹，压在票面上' },
  { id: 'star', label: '纪念星章', hint: '粗双线环 · 纪念戳' },
  { id: 'avion', label: '航空邮路', hint: 'PAR AVION 航线戳' },
];
export const POSTMARK_IDS = POSTMARK_STYLES.map(s => s.id);
export const isPostmarkId = (id) => POSTMARK_IDS.includes(id);

/* 读档：raw 为 null → 从未盖过印（stored=false，保留首票默认章）；
   损坏/非法内容 → 当作用户操作过（stored=true），避免脏数据把默认章又盖回来 */
export function parsePostmarks(raw) {
  if (raw === null || raw === undefined) return { map: {}, stored: false };
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return { map: {}, stored: true }; }
  }
  const map = {};
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, val] of Object.entries(data)) if (key && isPostmarkId(val)) map[key] = val;
  }
  return { map, stored: true };
}

/* 取票面实际生效的章：显式记录 > 首票默认 > 无印（null） */
export function resolvePostmark(map, stored, fullName, { isFirst = false } = {}) {
  const own = map && Object.prototype.hasOwnProperty.call(map, fullName) ? map[fullName] : undefined;
  if (isPostmarkId(own)) return own;
  return (!stored && isFirst) ? DEFAULT_POSTMARK : null;
}

/* 盖印/取印：返回新 map，不改入参；'none' 或非法值 = 取下邮戳 */
export function applyPostmark(map, fullName, id) {
  const next = { ...(map || {}) };
  if (!fullName) return next;
  if (!isPostmarkId(id)) { delete next[fullName]; return next; }
  next[fullName] = id;
  return next;
}

/* 存档：键排序 + 丢弃非法值，保证同样的状态写出同样的字符串 */
export function serializePostmarks(map) {
  const keys = Object.keys(map || {}).sort();
  const out = {};
  for (const key of keys) if (isPostmarkId(map[key])) out[key] = map[key];
  return JSON.stringify(out);
}

export const postmarkCount = (map) =>
  Object.keys(map || {}).filter(key => isPostmarkId(map[key])).length;
