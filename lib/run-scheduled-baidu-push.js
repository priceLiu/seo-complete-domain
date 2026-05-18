import {
  baiduPingSitemap,
  baiduPushFromSitemap,
  getBaiduPushCredentials,
  resolveBaiduSiteForSitemap,
} from './baidu-push.js';
import { getScheduleConfig } from './schedule-config.js';
import { readScheduleLastRun, writeScheduleLastRun } from './schedule-store.js';

/**
 * 执行一次定时/手动的 Sitemap → 百度推送。
 * @param {{ sitemapUrl?: string, maxPages?: number, type?: string, ping?: boolean, trigger?: string }} overrides
 */
export async function runScheduledBaiduPush(overrides = {}) {
  const cfg = getScheduleConfig();
  const { site, token } = getBaiduPushCredentials();
  if (!token) {
    throw new Error('未配置 BAIDU_PUSH_API_URL 或 BAIDU_PUSH_TOKEN');
  }

  const sitemapUrl = (overrides.sitemapUrl || cfg.sitemapUrl).trim();
  const maxPages = overrides.maxPages ?? cfg.maxPages;
  const type = overrides.type || cfg.pushType;
  const doPing = overrides.ping ?? cfg.ping;
  const trigger = overrides.trigger || 'manual';

  const pushSite = resolveBaiduSiteForSitemap(sitemapUrl, site);

  const startedAt = new Date().toISOString();
  let push = null;
  let ping = null;
  let pingError = null;
  let error = null;

  try {
    push = await baiduPushFromSitemap({
      site,
      token,
      sitemapUrl,
      maxPages,
      type,
    });
    if (doPing) {
      try {
        ping = await baiduPingSitemap({ site: pushSite, token, sitemapUrl });
      } catch (e) {
        pingError = e.message || String(e);
      }
    }
  } catch (e) {
    error = e.message || String(e);
  }

  const record = {
    startedAt,
    finishedAt: new Date().toISOString(),
    trigger,
    sitemapUrl,
    pushSite,
    maxPages,
    type,
    ok: !error,
    error,
    push,
    ping,
    pingError,
  };
  writeScheduleLastRun(record);
  if (error) throw new Error(error);
  return record;
}

export function getScheduleStatus() {
  const cfg = getScheduleConfig();
  const { token } = getBaiduPushCredentials();
  return {
    ...cfg,
    credentialsConfigured: Boolean(token),
    lastRun: readScheduleLastRun(),
  };
}
