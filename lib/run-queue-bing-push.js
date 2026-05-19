import {
  fetchBingUserSites,
  pickMatchingSite,
  submitBingFeed,
  submitBingUrlBatch,
} from './bing-webmaster.js';
import { runQueueEnginePush, getQueueEngineStatus } from './queue-runner.js';
import { applySiteEnv } from './sites.js';

const BING_API_CHUNK = 500;

async function resolveBingSiteUrl(site) {
  const key = site.secrets.bingKey;
  if (!key) throw new Error(`站点 ${site.name} 未配置 Bing API Key`);
  const apiSites = await fetchBingUserSites(key);
  const matched = pickMatchingSite(apiSites, site.url);
  if (!matched?.Url) {
    throw new Error(`Bing 未找到与 ${site.url} 匹配的站点，请先在 Webmaster 添加并验证`);
  }
  if (!matched.IsVerified) {
    throw new Error(`Bing 站点尚未验证：${matched.Url}`);
  }
  return matched.Url;
}

/**
 * Bing URL 批量提交队列（与百度共用 push-queue 模型）。
 */
export async function runQueueBingPush(site, overrides = {}) {
  applySiteEnv(site);
  let bingSiteUrl = '';

  return runQueueEnginePush(site, 'bing', {
    sitemapUrl: overrides.sitemapUrl,
    dailyLimit: overrides.dailyLimit ?? site.push.bingDailyLimit,
    trigger: overrides.trigger || 'queue',
    forceSync: overrides.forceSync,
    maxUrls: overrides.maxUrls || 5000,
    checkCredentials: () =>
      site.secrets.bingKey ? null : `站点 ${site.name} 未配置 bingWebmasterApiKey`,
    onCycleStart: async ({ sitemapUrl }) => {
      if (overrides.submitFeedOnCycle === false) return;
      try {
        bingSiteUrl = bingSiteUrl || (await resolveBingSiteUrl(site));
        await submitBingFeed(site.secrets.bingKey, bingSiteUrl, sitemapUrl);
      } catch {
        /* 非致命：新一轮仍继续推 URL */
      }
    },
    runBatch: async ({ batch, sitemapUrl }) => {
      const key = site.secrets.bingKey;
      bingSiteUrl = bingSiteUrl || (await resolveBingSiteUrl(site));
      let submitted = 0;
      for (let i = 0; i < batch.length; i += BING_API_CHUNK) {
        const chunk = batch.slice(i, i + BING_API_CHUNK);
        await submitBingUrlBatch(key, bingSiteUrl, chunk);
        submitted += chunk.length;
      }
      return {
        results: batch.map((url) => ({ url, ok: true })),
        meta: { submitted, siteUrl: bingSiteUrl },
      };
    },
  });
}

export function getQueueBingStatus(site) {
  return getQueueEngineStatus(site, 'bing', {
    dailyLimit: site.push.bingDailyLimit,
    credentialsConfigured: Boolean(site.secrets.bingKey),
  });
}
