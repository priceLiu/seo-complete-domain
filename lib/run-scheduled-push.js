import { getScheduleConfig } from './schedule-config.js';
import { applyActiveSiteEnv, applySiteEnv, getActiveSite, getSiteById, listSites } from './sites.js';
import {
  getQueuePushStatus,
  runQueuePush,
  runScheduledPushAllSites,
  PUSH_ENGINES,
} from './push-engines.js';
import { readScheduleLastRun } from './schedule-store.js';

export { runScheduledPushAllSites, PUSH_ENGINES };

export async function runScheduledPush(overrides = {}) {
  const site = overrides.siteId ? getSiteById(overrides.siteId) : getActiveSite();
  if (!site) throw new Error('未配置站点，请编辑 config/sites.json');
  const engine = overrides.engine || 'baidu';
  return runQueuePush(site, engine, {
    sitemapUrl: overrides.sitemapUrl,
    dailyLimit: overrides.dailyLimit,
    type: overrides.type,
    ping: overrides.ping,
    trigger: overrides.trigger || 'manual',
    forceSync: overrides.forceSync,
    maxUrls: overrides.maxPages,
  });
}

export function getScheduleStatus(siteId) {
  const site = siteId ? getSiteById(siteId) : getActiveSite();
  if (site) applySiteEnv(site);
  else applyActiveSiteEnv();
  const cfg = getScheduleConfig();
  const queues = {};
  for (const engine of PUSH_ENGINES) {
    try {
      queues[engine] = site ? getQueuePushStatus(site, engine) : null;
    } catch {
      queues[engine] = null;
    }
  }
  const baidu = queues.baidu;
  return {
    ...cfg,
    sitemapUrl: site?.sitemapUrl || cfg.sitemapUrl,
    dailyLimit: site?.push?.baiduDailyLimit ?? 100,
    bingDailyLimit: site?.push?.bingDailyLimit ?? 100,
    site: site ? { id: site.id, name: site.name, url: site.url } : null,
    sites: listSites(),
    credentialsConfigured: baidu?.credentialsConfigured,
    queue: baidu?.queue,
    queues,
    lastRun: readScheduleLastRun(),
    lastRuns: {
      baidu: readScheduleLastRun('baidu'),
      bing: readScheduleLastRun('bing'),
    },
    mode: 'queue',
  };
}
