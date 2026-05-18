const BING_JSON_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';
const BING_BATCH_MAX = 500;

function hostKey(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * 在 GetUserSites 结果中匹配与目标站同域名的站点（优先已验证）。
 */
export function pickMatchingSite(apiSites, targetRoot) {
  const th = hostKey(targetRoot);
  if (!th || !Array.isArray(apiSites)) return null;
  let fallback = null;
  for (const s of apiSites) {
    if (!s?.Url) continue;
    if (hostKey(s.Url) !== th) continue;
    if (s.IsVerified) return s;
    if (!fallback) fallback = s;
  }
  return fallback;
}

function parseBingDate(d) {
  if (d == null) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const str = String(d);
  const m = /\/Date\((\d+)\)/.exec(str);
  if (m) return new Date(parseInt(m[1], 10)).toISOString().slice(0, 10);
  return null;
}

export function normalizeTrafficSeries(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const rows = arr
    .map((row) => ({
      date: parseBingDate(row.Date),
      clicks: Number(row.Clicks) || 0,
      impressions: Number(row.Impressions) || 0,
    }))
    .filter((x) => x.date);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

function normalizeQueryRows(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((row) => ({
      query: row.Query || row.query || '',
      clicks: Number(row.Clicks) || 0,
      impressions: Number(row.Impressions) || 0,
    }))
    .filter((r) => r.query)
    .slice(0, 20);
}

function normalizePageRows(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((row) => ({
      url: row.Url || row.Page || '',
      clicks: Number(row.Clicks) || 0,
      impressions: Number(row.Impressions) || 0,
    }))
    .filter((r) => r.url)
    .slice(0, 20);
}

function normalizeCrawlIssues(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.slice(0, 50).map((row) => ({
    url: row.Url || row.url || '',
    issue: row.Issue || row.Message || row.issue || JSON.stringify(row).slice(0, 120),
    severity: row.Severity || row.severity || '',
  }));
}

async function parseBingResponse(res) {
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Bing API 返回非 JSON（HTTP ${res.status}）：${text.slice(0, 160)}`);
  }
  if (!res.ok) {
    const msg = json?.Message || json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (json?.ErrorCode != null) {
    throw new Error(json.Message || `Bing ErrorCode ${json.ErrorCode}`);
  }
  const d = json?.d;
  if (typeof d === 'string' && d.toLowerCase().includes('error')) {
    throw new Error(d);
  }
  return d;
}

async function bingJsonGet(method, apiKey, extraParams = {}) {
  const u = new URL(`${BING_JSON_BASE}/${method}`);
  u.searchParams.set('apikey', apiKey);
  for (const [k, v] of Object.entries(extraParams)) {
    if (v != null && v !== '') u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return parseBingResponse(res);
}

async function bingJsonPost(method, apiKey, body) {
  const u = new URL(`${BING_JSON_BASE}/${method}`);
  u.searchParams.set('apikey', apiKey);
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return parseBingResponse(res);
}

export async function fetchBingUserSites(apiKey) {
  const d = await bingJsonGet('GetUserSites', apiKey);
  return Array.isArray(d) ? d : [];
}

export async function fetchBingRankAndTrafficStats(apiKey, siteUrl) {
  const d = await bingJsonGet('GetRankAndTrafficStats', apiKey, { siteUrl });
  return normalizeTrafficSeries(d);
}

export async function fetchBingUrlSubmissionQuota(apiKey, siteUrl) {
  const d = await bingJsonGet('GetUrlSubmissionQuota', apiKey, { siteUrl });
  return {
    dailyQuota: Number(d?.DailyQuota) || 0,
    monthlyQuota: Number(d?.MonthlyQuota) || 0,
  };
}

export async function fetchBingQueryStats(apiKey, siteUrl) {
  const d = await bingJsonGet('GetQueryStats', apiKey, { siteUrl });
  return normalizeQueryRows(d);
}

export async function fetchBingPageStats(apiKey, siteUrl) {
  const d = await bingJsonGet('GetPageStats', apiKey, { siteUrl });
  return normalizePageRows(d);
}

export async function fetchBingCrawlIssues(apiKey, siteUrl) {
  const d = await bingJsonGet('GetCrawlIssues', apiKey, { siteUrl });
  return normalizeCrawlIssues(d);
}

/**
 * 批量提交 URL（最多 500 条/次）。
 */
export async function submitBingUrlBatch(apiKey, siteUrl, urlList) {
  const list = urlList
    .map((u) => String(u).trim())
    .filter(Boolean)
    .slice(0, BING_BATCH_MAX);
  if (!list.length) throw new Error('没有可提交的 URL');
  await bingJsonPost('SubmitUrlBatch', apiKey, { siteUrl, urlList: list });
  return { submitted: list.length, siteUrl };
}

/** 提交 Sitemap / RSS Feed */
export async function submitBingFeed(apiKey, siteUrl, feedUrl) {
  const feed = String(feedUrl).trim();
  if (!feed) throw new Error('请提供 feedUrl');
  await bingJsonPost('SubmitFeed', apiKey, { siteUrl, feedUrl: feed });
  return { siteUrl, feedUrl: feed };
}

/** 本工具已接通的 Bing Webmaster JSON API 能力说明 */
export const BING_API_CAPABILITIES = [
  {
    id: 'submit_batch',
    name: 'URL 批量提交',
    method: 'SubmitUrlBatch',
    type: 'write',
    note: '最多 500 条/次，受日/月配额限制',
  },
  {
    id: 'submit_feed',
    name: 'Sitemap / Feed 提交',
    method: 'SubmitFeed',
    type: 'write',
    note: '参数 siteUrl + feedUrl',
  },
  {
    id: 'quota',
    name: '提交配额',
    method: 'GetUrlSubmissionQuota',
    type: 'read',
    note: 'DailyQuota / MonthlyQuota',
  },
  {
    id: 'traffic',
    name: '站点流量趋势',
    method: 'GetRankAndTrafficStats',
    type: 'read',
    note: '展示量、点击（按日）',
  },
  {
    id: 'queries',
    name: '热门搜索词',
    method: 'GetQueryStats',
    type: 'read',
    note: '查询词点击/展示',
  },
  {
    id: 'pages',
    name: '热门页面',
    method: 'GetPageStats',
    type: 'read',
    note: '页面级点击/展示（数据可能按周更新）',
  },
  {
    id: 'crawl_issues',
    name: '抓取问题',
    method: 'GetCrawlIssues',
    type: 'read',
    note: '收录/抓取异常线索，非精确「已收录条数」',
  },
];
