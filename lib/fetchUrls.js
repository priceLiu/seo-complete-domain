import axios from 'axios';
import * as cheerio from 'cheerio';
import { getSiteUrl } from './site.js';

const UA = process.env.AUDIT_USER_AGENT || 'SEO-Monitor/1.0 (+https://github.com)';

function trimEnv(v) {
  if (v == null) return '';
  return String(v).trim();
}

/** 默认站点地图地址（百度推送优先用 BAIDU_SCHEDULE_SITEMAP_URL） */
export function getDefaultSitemapUrl() {
  const scheduled = trimEnv(process.env.BAIDU_SCHEDULE_SITEMAP_URL);
  if (scheduled) return scheduled;
  const explicit = trimEnv(process.env.BAIDU_DEFAULT_SITEMAP_URL);
  if (explicit) return explicit;
  return `${getSiteUrl().replace(/\/$/, '')}/sitemap.xml`;
}

function isNestedSitemapUrl(loc) {
  return /\.xml($|[?#])/i.test(loc);
}

/**
 * 从指定 sitemap（含 sitemap 索引一层子文件）抓取页面 URL。
 * @param {string} sitemapUrl
 * @param {number} maxPages 上限，百度单次推送最多 2000
 */
export async function fetchUrlsFromSitemapUrl(sitemapUrl, maxPages) {
  const cap = Math.min(Math.max(parseInt(String(maxPages), 10) || 500, 1), 2000);
  const pageUrls = [];
  const visited = new Set();

  async function loadOne(url) {
    if (visited.has(url) || pageUrls.length >= cap) return;
    visited.add(url);
    const res = await axios.get(url, {
      timeout: 20000,
      headers: { 'User-Agent': UA },
      validateStatus: () => true,
    });
    if (res.status >= 400 || !res.data) return;

    const $ = cheerio.load(res.data, { xmlMode: true });
    const nested = [];
    $('loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (!loc) return;
      if (isNestedSitemapUrl(loc)) nested.push(loc);
      else if (!pageUrls.includes(loc)) pageUrls.push(loc);
    });

    for (const child of nested) {
      if (pageUrls.length >= cap) break;
      await loadOne(child);
    }
  }

  try {
    await loadOne(sitemapUrl);
  } catch {
    return [];
  }

  return pageUrls.slice(0, cap);
}

export async function fetchUrlsFromSitemap(baseUrl, maxPages) {
  const sitemapUrl = `${String(baseUrl).replace(/\/$/, '')}/sitemap.xml`;
  const urls = await fetchUrlsFromSitemapUrl(sitemapUrl, maxPages);
  if (urls.length) return urls;
  return [baseUrl.replace(/\/$/, '') || getSiteUrl()];
}

export async function getAuditUrlList(maxPages) {
  const base = getSiteUrl();
  return fetchUrlsFromSitemap(base, maxPages);
}
