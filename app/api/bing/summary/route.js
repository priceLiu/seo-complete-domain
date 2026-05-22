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
  formatBingFetchError,
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
      const wrap =
        (setter, errSetter) =>
        async (fn) => {
          try {
            setter(await fn());
          } catch (e) {
            errSetter(formatBingFetchError(e));
          }
        };

      // 串行拉取，降低并发访问 ssl.bing.com 时被重置连接的概率
      await wrap((v) => {
        traffic = v;
      }, (m) => {
        trafficError = m;
      })(() => fetchBingRankAndTrafficStats(key, siteUrl));
      await wrap((v) => {
        quota = v;
      }, (m) => {
        quotaError = m;
      })(() => fetchBingUrlSubmissionQuota(key, siteUrl));
      await wrap((v) => {
        queryStats = v;
      }, (m) => {
        queryStatsError = m;
      })(() => fetchBingQueryStats(key, siteUrl));
      await wrap((v) => {
        pageStats = v;
      }, (m) => {
        pageStatsError = m;
      })(() => fetchBingPageStats(key, siteUrl));
      await wrap((v) => {
        crawlIssues = v;
      }, (m) => {
        crawlIssuesError = m;
      })(() => fetchBingCrawlIssues(key, siteUrl));

      if (crawlIssuesError) {
        try {
          crawlIssues = await fetchBingCrawlIssues(key, siteUrl);
          crawlIssuesError = null;
        } catch (e) {
          crawlIssuesError = formatBingFetchError(e);
        }
      }
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
