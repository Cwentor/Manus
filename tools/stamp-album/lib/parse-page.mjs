const toNum = (v) => Number(String(v).replace(/,/g, '')) || 0;

// HTML 实体解码：数值实体（&#x..; 十六进制 / &#..; 十进制）→ 命名实体 → 最后 &amp;（避免二次解码）
const decodeOnce = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');

// GitHub 对 og:description 存在双重转义（&amp;amp;），循环解码至稳定为止
const decodeEntities = (s) => {
  let out = s, prev;
  for (let i = 0; i < 3 && out !== prev; i++) { prev = out; out = decodeOnce(out); }
  return out;
};

export function extractRepo(html) {
  const nwo = (html.match(/octolytics-dimension-repository_nwo" content="([^"]+)"/) || [])[1];
  if (!nwo) return null;
  let desc = (html.match(/property="og:description" content="([^"]*)"/) || [])[1] || '';
  desc = decodeEntities(desc)
    .trim()
    .replace(/^:[a-z0-9_+-]{2,32}:\s*/i, '')   // 开头的 emoji 短码（:books: / :link: 这类，票面不渲染，留着只占字数）
    .replace(/\s*Contribute to .*? development by creating an account on GitHub\.?\s*/i, '')
    .replace(/\s*-\s*[\w.-]+\/[\w.-]+\s*$/, '')   // 「- owner/repo」尾巴（GitHub 样板句的另一形态）
    .trim();
  const num = (key) => { const m = html.match(new RegExp(`"${key}":(\\d+)`)); return m ? toNum(m[1]) : 0; };
  const str = (key) => { const m = html.match(new RegExp(`"${key}":"([^"]+)"`)); return m ? m[1] : null; };
  const topicsM = html.match(/"topics":\[([^\]]*)\]/);
  const topics = topicsM ? [...topicsM[1].matchAll(/"name":"([^"]+)"/g)].map(m => m[1]).slice(0, 8) : [];
  const licenseM = html.match(/"license":\{[^}]*"spdxId":"([^"]+)"/);
  const langM = html.match(/itemprop="programmingLanguage">([^<]+)</);
  return {
    full_name: nwo, description: desc,
    stars: num('stargazerCount'), forks: num('forksCount'),
    topics, created_at: str('createdAt'),
    license: licenseM && licenseM[1] !== 'NOASSERTION' ? licenseM[1] : null,
    language: langM ? langM[1].trim() : null, is_archived: /"isArchived":true/.test(html),
  };
}

export function finalizeRepo(raw, langOverrides = {}) {
  const [owner, ...repoParts] = raw.full_name.split('/');
  return {
    ...raw,
    language: raw.language ?? langOverrides[raw.full_name] ?? null,
    owner, name: repoParts.join('/'),
    repo_url: `https://github.com/${raw.full_name}`,
    owner_url: `https://github.com/${owner}`,
    avatar_url: `https://github.com/${owner}.png?size=120`,
  };
}
