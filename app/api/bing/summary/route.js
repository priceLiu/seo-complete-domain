import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/site';
import {
  BING_API_CAPABILITIES,
  fetchBingCrawlIssues,
  fetchBingPageStats,
  fetchBingQueryStats,
  fetchBingRankAndTrafficStats,
  fetchBingUrlSubmissionQuota,
  fetchBingUserSites,
  pickMatchingSite,
} from '@/lib/bing-webmaster';

export const dynamic = 'force-dynamic';

export async function GET() {
  const key = (process.env.BING_WEBMASTER_API_KEY || '').trim();
  if (!key) {
    return NextResponse.json({
      configured: false,
      message: '未配置 BING_WEBMASTER_API_KEY，详见 .env.example',
      capabilities: BING_API_CAPABILITIES,
    });
  }

  const targetSite = getSiteUrl();

  try {
    const sitesRaw = await fetchBingUserSites(key);
    const sites = sitesRaw.map((s) => ({
      url: s.Url,
      verified: Boolean(s.IsVerified),
    }));

    const matched = pickMatchingSite(sitesRaw, targetSite);
    const siteUrl = matched?.Url || null;

    let traffic = [];
    let trafficError = null;
    let quota = null;
    let quotaError = null;
    let queryStats = [];
    let queryStatsError = null;
    let pageStats = [];
    let pageStatsError = null;
    let crawlIssues = [];
    let crawlIssuesError = null;

    if (siteUrl) {
      const tasks = [
        fetchBingRankAndTrafficStats(key, siteUrl)
          .then((d) => {
            traffic = d;
          })
          .catch((e) => {
            trafficError = e.message || String(e);
          }),
        fetchBingUrlSubmissionQuota(key, siteUrl)
          .then((d) => {
            quota = d;
          })
          .catch((e) => {
            quotaError = e.message || String(e);
          }),
        fetchBingQueryStats(key, siteUrl)
          .then((d) => {
            queryStats = d;
          })
          .catch((e) => {
            queryStatsError = e.message || String(e);
          }),
        fetchBingPageStats(key, siteUrl)
          .then((d) => {
            pageStats = d;
          })
          .catch((e) => {
            pageStatsError = e.message || String(e);
          }),
        fetchBingCrawlIssues(key, siteUrl)
          .then((d) => {
            crawlIssues = d;
          })
          .catch((e) => {
            crawlIssuesError = e.message || String(e);
          }),
      ];
      await Promise.all(tasks);
    }

    return NextResponse.json({
      configured: true,
      connected: Boolean(siteUrl && matched?.IsVerified),
      targetSite,
      sites,
      matchedSite: matched
        ? { url: matched.Url, verified: Boolean(matched.IsVerified) }
        : null,
      quota,
      quotaError,
      traffic,
      trafficError,
      queryStats,
      queryStatsError,
      pageStats,
      pageStatsError,
      crawlIssues,
      crawlIssuesError,
      capabilities: BING_API_CAPABILITIES,
      indexNote:
        'Bing Webmaster API 不提供类似百度的「已收录 URL 总数」接口；可通过流量、热门页面、抓取问题间接观察收录与表现。大批量提交建议配合 IndexNow。',
    });
  } catch (e) {
    return NextResponse.json(
      {
        configured: true,
        error: e.message || String(e),
        capabilities: BING_API_CAPABILITIES,
      },
      { status: 502 },
    );
  }
}
