import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import {
  baiduPingSitemap,
  baiduPushFromSitemap,
  getBaiduPushCredentials,
} from '@/lib/baidu-push';
import { fetchUrlsFromSitemapUrl, getDefaultSitemapUrl } from '@/lib/fetchUrls';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** 预览 sitemap 内 URL 数量 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sitemapUrl = (searchParams.get('sitemapUrl') || getDefaultSitemapUrl()).trim();
  const maxPages = Math.min(parseInt(searchParams.get('maxPages') || '500', 10) || 500, 2000);

  try {
    const urls = await fetchUrlsFromSitemapUrl(sitemapUrl, maxPages);
    return NextResponse.json({
      sitemapUrl,
      count: urls.length,
      preview: urls.slice(0, 12),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || String(e), sitemapUrl },
      { status: 502 },
    );
  }
}

/** Sitemap 方式：抓取并推送，可选 ping 登记 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const denied = ensureAuditAuthorized(request, body);
  if (denied) return denied;

  const { site, token } = getBaiduPushCredentials();
  if (!token) {
    return NextResponse.json(
      { error: '未配置 BAIDU_PUSH_API_URL 或 BAIDU_PUSH_TOKEN' },
      { status: 503 },
    );
  }

  const sitemapUrl = (body.sitemapUrl || getDefaultSitemapUrl()).trim();
  const maxPages = Math.min(parseInt(String(body.maxPages), 10) || 500, 2000);
  const type = body.type === 'daily' ? 'daily' : 'normal';
  const doPing = body.ping !== false;

  try {
    const push = await baiduPushFromSitemap({
      site,
      token,
      sitemapUrl,
      maxPages,
      type,
    });

    let ping = null;
    let pingError = null;
    if (doPing) {
      try {
        ping = await baiduPingSitemap({
          site: push.pushSite || site,
          token,
          sitemapUrl,
        });
      } catch (e) {
        pingError = e.message || String(e);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: 'sitemap',
      site: push.pushSite || site,
      type,
      push,
      ping,
      pingError,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message || String(e) },
      { status: 502 },
    );
  }
}
