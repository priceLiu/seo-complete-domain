import {
  baiduPingSitemap,
  baiduSubmitUrlsBatched,
  getBaiduPushCredentials,
  resolveBaiduSiteForSitemap,
} from './baidu-push.js';
import { runQueueEnginePush, getQueueEngineStatus } from './queue-runner.js';

export async function runQueueBaiduPush(site, overrides = {}) {
  const sitemapUrl = (overrides.sitemapUrl || site.sitemapUrl).trim();
  const type = overrides.type || site.schedule.pushType;
  const doPing = overrides.ping ?? site.schedule.ping;

  return runQueueEnginePush(site, 'baidu', {
    sitemapUrl,
    dailyLimit: overrides.dailyLimit ?? site.push.baiduDailyLimit,
    trigger: overrides.trigger || 'queue',
    forceSync: overrides.forceSync,
    maxUrls: overrides.maxUrls || 5000,
    checkCredentials: () => {
      const { token } = getBaiduPushCredentials();
      return token ? null : `站点 ${site.name} 未配置百度推送凭据`;
    },
    runBatch: async ({ batch }) => {
      const { site: pushSite, token } = getBaiduPushCredentials();
      const resolvedSite = resolveBaiduSiteForSitemap(sitemapUrl, pushSite);
      const push = await baiduSubmitUrlsBatched({
        site: resolvedSite,
        token,
        urls: batch,
        type,
      });
      const pushedSet = new Set(push.pushedUrls || []);
      const quotaMsg =
        push.quotaExhausted || push.skippedCount > 0
          ? '今日百度剩余配额不足，未推送的 URL 保持待推状态'
          : null;
      let ping = null;
      let pingError = null;
      if (doPing) {
        try {
          ping = await baiduPingSitemap({ site: resolvedSite, token, sitemapUrl });
        } catch (e) {
          pingError = e.message || String(e);
        }
      }
      return {
        results: batch.map((url) => ({
          url,
          ok: pushedSet.has(url),
          error: pushedSet.has(url) ? undefined : quotaMsg || '推送未执行',
        })),
        meta: { push, pushSite: resolvedSite },
        extra: { ping, pingError },
      };
    },
  });
}

export function getQueueBaiduStatus(site) {
  const { token } = getBaiduPushCredentials();
  return getQueueEngineStatus(site, 'baidu', {
    dailyLimit: site.push.baiduDailyLimit,
    credentialsConfigured: Boolean(token),
  });
}
