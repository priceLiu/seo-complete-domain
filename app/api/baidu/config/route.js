import { NextResponse } from 'next/server';
import {
  getBaiduPushCredentials,
  resolveBaiduSiteForSitemap,
  trimEnv,
} from '@/lib/baidu-push';
import { getDefaultSitemapUrl } from '@/lib/fetchUrls';
import { getScheduleConfig } from '@/lib/schedule-config';

export const dynamic = 'force-dynamic';

export function GET() {
  const rawUrl = trimEnv(process.env.BAIDU_PUSH_API_URL).replace(/&amp;/gi, '&');
  let apiUrlInvalid = false;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      const s = trimEnv(u.searchParams.get('site'));
      const t = trimEnv(u.searchParams.get('token'));
      if (!s || !t) apiUrlInvalid = true;
    } catch {
      apiUrlInvalid = true;
    }
  }

  const { site, token, source } = getBaiduPushCredentials();
  const schedule = getScheduleConfig();
  const defaultSitemapUrl = schedule.sitemapUrl || getDefaultSitemapUrl();
  const sitemapPushSite = resolveBaiduSiteForSitemap(defaultSitemapUrl, site);
  return NextResponse.json({
    configured: Boolean(token),
    /** 凭据 / BAIDU_PUSH_API_URL 中的 site */
    credentialPushSite: site,
    /** Sitemap / 定时推送实际使用的 site（纯域名） */
    sitemapPushSite,
    pushSite: sitemapPushSite || site,
    defaultSitemapUrl,
    scheduleSitemapUrl: schedule.sitemapUrl,
    configSource: source,
    hints: {
      /** 行首带 # 或未设置时均为 false */
      envApiUrlLinePresent: Boolean(rawUrl),
      envTokenLinePresent: Boolean(
        trimEnv(process.env.BAIDU_PUSH_TOKEN || process.env.BAIDU_TOKEN),
      ),
      /** 有 BAIDU_PUSH_API_URL 但解析不出 site+token（缺参数、URL 截断、&amp; 未修复等已尽量兼容） */
      apiUrlInvalid,
    },
  });
}
