import { fetchUrlsFromSitemapUrl } from './fetchUrls.js';
import { getSiteUrl } from './site.js';

export function trimEnv(v) {
  if (v == null) return '';
  let s = String(v).trim();
  // .env 里常见误加引号
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * 百度 `site=` 须为纯域名（如 `www.example.com`），不能带 `https://`。
 */
export function normalizeBaiduPushSite(siteOrUrl) {
  const raw = trimEnv(siteOrUrl);
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).hostname;
  } catch {
    /* fall through */
  }
  return raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
}

/**
 * 将 apex 域名 URL 对齐到带 www 的推送站点（sitemap 常为 ai-code8.com，站长平台为 www.ai-code8.com）。
 */
export function canonicalizeUrlsForBaiduPush(urls, pushSite) {
  const targetHost = normalizeBaiduPushSite(pushSite);
  if (!targetHost) return urls;
  const apex = targetHost.startsWith('www.') ? targetHost.slice(4) : '';
  return urls.map((raw) => {
    const line = String(raw).trim();
    if (!line) return line;
    try {
      const u = new URL(line);
      if (u.hostname === targetHost) return u.toString();
      if (apex && u.hostname === apex) {
        u.hostname = targetHost;
        return u.toString();
      }
      return line;
    } catch {
      return line;
    }
  });
}

function pushSiteFromParts() {
  const explicit =
    trimEnv(process.env.BAIDU_PUSH_SITE) || trimEnv(process.env.BAIDU_SITE_URL);
  if (explicit) return explicit;
  return getSiteUrl();
}

/**
 * 读取推送凭据。优先使用 `BAIDU_PUSH_API_URL`（资源平台复制的整段接口地址，已含 site、token）。
 * 否则使用 `BAIDU_PUSH_TOKEN`（或别名 `BAIDU_TOKEN`）+ `BAIDU_PUSH_SITE` / `NEXT_PUBLIC_SITE_URL`。
 * @returns {{ site: string, token: string, source: 'api_url' | 'parts' | 'none' }}
 */
export function getBaiduPushCredentials() {
  const rawFull = trimEnv(process.env.BAIDU_PUSH_API_URL)
    .replace(/&amp;/gi, '&');
  if (rawFull) {
    try {
      const u = new URL(rawFull);
      const site = trimEnv(u.searchParams.get('site'));
      const token = trimEnv(u.searchParams.get('token'));
      if (site && token) {
        return { site: normalizeBaiduPushSite(site), token, source: 'api_url' };
      }
    } catch {
      /* 格式错误时回退到分项配置 */
    }
  }
  const token = trimEnv(
    process.env.BAIDU_PUSH_TOKEN || process.env.BAIDU_TOKEN,
  );
  const site = normalizeBaiduPushSite(pushSiteFromParts());
  return { site, token, source: token ? 'parts' : 'none' };
}

/**
 * 用于展示的推送 site（与接口中 `site=` 一致）。
 */
export function getBaiduPushSite() {
  return getBaiduPushCredentials().site;
}

/** 从 sitemap 地址推导百度 `site=`（纯域名） */
export function siteFromSitemapUrl(sitemapUrl) {
  try {
    return new URL(String(sitemapUrl).trim()).hostname;
  } catch {
    return '';
  }
}

/**
 * Sitemap 批量推送时的 `site=`：
 * BAIDU_SCHEDULE_PUSH_SITE / BAIDU_SITEMAP_PUSH_SITE > sitemap 同域 > 凭据 site。
 * 不使用 BAIDU_PUSH_SITE（该变量用于「手动 URL 列表」模式）。
 */
export function resolveBaiduSiteForSitemap(sitemapUrl, credentialSite) {
  const override =
    trimEnv(process.env.BAIDU_SCHEDULE_PUSH_SITE) ||
    trimEnv(process.env.BAIDU_SITEMAP_PUSH_SITE);
  if (override) return normalizeBaiduPushSite(override);
  return (
    siteFromSitemapUrl(sitemapUrl) ||
    normalizeBaiduPushSite(credentialSite)
  );
}

/**
 * 百度搜索资源平台 - 主动推送（普通收录 / 快速收录 API）
 * @see https://ziyuan.baidu.com/linksubmit/index
 * @param {{ site: string, token: string, urls: string[], type?: 'normal' | 'daily' }} opts
 */
export async function baiduSubmitUrls({ site, token, urls, type = 'normal' }) {
  const pushSite = normalizeBaiduPushSite(site);
  const list = canonicalizeUrlsForBaiduPush(
    urls.map((u) => String(u).trim()).filter(Boolean),
    pushSite,
  ).slice(0, 2000);
  if (!list.length) throw new Error('没有可推送的 URL');
  if (!token) throw new Error('未配置 BAIDU_PUSH_API_URL 或 BAIDU_PUSH_TOKEN');
  if (!pushSite) {
    throw new Error('未配置推送 site（须为纯域名，如 www.example.com）');
  }

  const endpoint = new URL('http://data.zz.baidu.com/urls');
  endpoint.searchParams.set('site', pushSite);
  endpoint.searchParams.set('token', token);
  if (type === 'daily') endpoint.searchParams.set('type', 'daily');

  const res = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'User-Agent': (process.env.AUDIT_USER_AGENT || 'SEO-Monitor/1.0').trim(),
    },
    body: list.join('\n'),
    cache: 'no-store',
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`百度接口返回非 JSON（HTTP ${res.status}）：${text.slice(0, 220)}`);
  }

  if (!res.ok) {
    throw baiduApiError(json, pushSite, res.status);
  }

  if (json.error != null && json.error !== 0) {
    throw baiduApiError(json, pushSite, res.status);
  }

  if (Array.isArray(json.not_same_site) && json.not_same_site.length) {
    throw new Error(
      `部分 URL 与站点 ${pushSite} 不一致（如 sitemap 为裸域而站长平台为 www）。已尝试自动补 www；仍失败请检查 URL 列表。`,
    );
  }

  return json;
}

function baiduApiError(json, pushSite, status) {
  const msg =
    json.message ||
    json.error_msg ||
    (typeof json.error === 'string' ? json.error : null) ||
    `HTTP ${status}`;
  let text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  if (text === 'site init fail') {
    text = `site init fail：请确认 site 为纯域名（当前 ${pushSite || '未设置'}），且与百度站长平台验证站点、token 一致`;
  }
  if (text === 'over quota') {
    text =
      'over quota：本次提交条数超过百度今日剩余配额（remain）。请减少单次条数、改用收录可见性队列按日推送，或次日再试';
  }
  return new Error(text);
}

function isOverQuotaError(err) {
  const msg = err?.message || String(err);
  return /over quota|配额已用完|配额/.test(msg);
}

const BAIDU_BATCH_SIZE = 2000;

/**
 * 分批主动推送（百度单次最多 2000 条）。
 * 根据接口返回的 `remain` 控制后续批次；遇 over quota 时自动缩小批次。
 */
export async function baiduSubmitUrlsBatched({ site, token, urls, type = 'normal' }) {
  const list = urls
    .map((u) => String(u).trim())
    .filter(Boolean);
  if (!list.length) throw new Error('Sitemap 中未解析到可推送的 URL');

  const batchResults = [];
  const pushedUrls = [];
  let totalSuccess = 0;
  let offset = 0;
  let quotaRemain = null;
  let quotaExhausted = false;

  while (offset < list.length) {
    const chunkSize = Math.min(
      quotaRemain != null ? quotaRemain : BAIDU_BATCH_SIZE,
      BAIDU_BATCH_SIZE,
      list.length - offset,
    );
    if (chunkSize <= 0) {
      quotaExhausted = true;
      break;
    }

    let chunk = list.slice(offset, offset + chunkSize);
    let result;

    const submitChunk = async (urlsChunk) =>
      baiduSubmitUrls({ site, token, urls: urlsChunk, type });

    try {
      result = await submitChunk(chunk);
    } catch (e) {
      if (!isOverQuotaError(e) || chunk.length <= 1) {
        if (isOverQuotaError(e)) quotaExhausted = true;
        else throw e;
        break;
      }
      while (chunk.length > 1) {
        chunk = chunk.slice(0, Math.max(1, Math.floor(chunk.length / 2)));
        try {
          result = await submitChunk(chunk);
          break;
        } catch (e2) {
          if (!isOverQuotaError(e2)) throw e2;
        }
      }
      if (!result) {
        quotaExhausted = true;
        break;
      }
    }

    batchResults.push({ batch: batchResults.length + 1, count: chunk.length, result });
    if (typeof result.success === 'number') totalSuccess += result.success;
    pushedUrls.push(...chunk);
    offset += chunk.length;

    if (typeof result.remain === 'number') {
      quotaRemain = result.remain;
      if (quotaRemain <= 0) {
        quotaExhausted = offset < list.length;
        break;
      }
    }
  }

  return {
    batchCount: batchResults.length,
    urlCount: list.length,
    pushedCount: pushedUrls.length,
    skippedCount: list.length - pushedUrls.length,
    totalSuccess,
    pushedUrls,
    quotaExhausted,
    lastRemain: quotaRemain,
    batches: batchResults,
    last: batchResults[batchResults.length - 1]?.result,
  };
}

/**
 * 从 sitemap 抓取 URL 并推送到百度。
 */
export async function baiduPushFromSitemap({
  site,
  token,
  sitemapUrl,
  maxPages = 500,
  type = 'normal',
}) {
  const pushSite = resolveBaiduSiteForSitemap(sitemapUrl, site);
  const rawUrls = await fetchUrlsFromSitemapUrl(sitemapUrl, maxPages);
  if (!rawUrls.length) {
    throw new Error(`无法从 Sitemap 解析 URL：${sitemapUrl}`);
  }
  const urls = canonicalizeUrlsForBaiduPush(rawUrls, pushSite);
  const push = await baiduSubmitUrlsBatched({ site: pushSite, token, urls, type });
  return { sitemapUrl, pushSite, ...push };
}

/**
 * 向百度登记 Sitemap 地址（ping，辅助抓取；与 URL 主动推送互补）。
 */
export async function baiduPingSitemap({ site, token, sitemapUrl }) {
  const pushSite = normalizeBaiduPushSite(site);
  const attempts = [
    () => {
      const u = new URL('http://ping.baidu.com/sitemap');
      u.searchParams.set('site', pushSite);
      u.searchParams.set('resource_name', sitemapUrl);
      u.searchParams.set('access_token', token);
      return u.toString();
    },
    () => {
      const u = new URL('http://ping.baidu.com/ping');
      u.searchParams.set('sitemap', sitemapUrl);
      return u.toString();
    },
  ];

  const ua = (process.env.AUDIT_USER_AGENT || 'SEO-Monitor/1.0').trim();
  let lastErr = null;
  for (const buildUrl of attempts) {
    try {
      const res = await fetch(buildUrl(), {
        method: 'GET',
        headers: { 'User-Agent': ua },
        cache: 'no-store',
      });
      const text = await res.text();
      if (res.ok) {
        return { ok: true, status: res.status, body: text.slice(0, 500) };
      }
      lastErr = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Sitemap ping 失败');
}
