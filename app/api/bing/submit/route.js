import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import {
  fetchBingUserSites,
  pickMatchingSite,
  submitBingFeed,
  submitBingUrlBatch,
} from '@/lib/bing-webmaster';
import { fetchUrlsFromSitemapUrl, getDefaultSitemapUrl } from '@/lib/fetchUrls';
import { getSiteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const denied = ensureAuditAuthorized(request, body);
  if (denied) return denied;

  const key = (process.env.BING_WEBMASTER_API_KEY || '').trim();
  if (!key) {
    return NextResponse.json(
      { error: '未配置 BING_WEBMASTER_API_KEY' },
      { status: 503 },
    );
  }

  const sitesRaw = await fetchBingUserSites(key);
  const matched = pickMatchingSite(sitesRaw, getSiteUrl());
  const siteUrl = (body.siteUrl || matched?.Url || '').trim();
  if (!siteUrl) {
    return NextResponse.json(
      { error: '未在 Bing Webmaster 中找到已验证站点，请先在平台添加并验证' },
      { status: 400 },
    );
  }
  if (!matched?.IsVerified) {
    return NextResponse.json(
      { error: `站点尚未验证：${siteUrl}` },
      { status: 400 },
    );
  }

  try {
    if (body.feedUrl || body.mode === 'feed') {
      const feedUrl = (body.feedUrl || getDefaultSitemapUrl()).trim();
      const result = await submitBingFeed(key, siteUrl, feedUrl);
      return NextResponse.json({ ok: true, mode: 'feed', ...result });
    }

    let urls = [];
    if (body.mode === 'sitemap' || body.sitemapUrl) {
      const sitemapUrl = (body.sitemapUrl || getDefaultSitemapUrl()).trim();
      const maxPages = Math.min(parseInt(String(body.maxPages), 10) || 500, 500);
      urls = await fetchUrlsFromSitemapUrl(sitemapUrl, maxPages);
      if (!urls.length) {
        return NextResponse.json(
          { error: `Sitemap 未解析到 URL：${sitemapUrl}` },
          { status: 400 },
        );
      }
    } else {
      const raw = body.urls;
      if (Array.isArray(raw)) urls = raw;
      else if (typeof raw === 'string') {
        urls = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      }
    }

    const result = await submitBingUrlBatch(key, siteUrl, urls);
    return NextResponse.json({ ok: true, mode: 'urls', ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message || String(e) },
      { status: 502 },
    );
  }
}
