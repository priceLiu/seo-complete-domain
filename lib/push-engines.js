import { getSiteById, listSites } from './sites.js';
import { runQueueBaiduPush, getQueueBaiduStatus } from './run-queue-baidu-push.js';
import { runQueueBingPush, getQueueBingStatus } from './run-queue-bing-push.js';

export const PUSH_ENGINES = ['baidu', 'bing'];

const RUNNERS = {
  baidu: { run: runQueueBaiduPush, status: getQueueBaiduStatus },
  bing: { run: runQueueBingPush, status: getQueueBingStatus },
};

export function isEngineEnabled(site, engine) {
  if (engine === 'baidu') {
    return (
      site.schedule?.baiduEnabled !== false &&
      Boolean(site.secrets?.baiduToken || site.secrets?.baiduPushApiUrl)
    );
  }
  if (engine === 'bing') {
    return site.schedule?.bingEnabled !== false && Boolean(site.secrets?.bingKey);
  }
  return false;
}

export function runQueuePush(site, engine, overrides = {}) {
  const runner = RUNNERS[engine];
  if (!runner) throw new Error(`未知引擎: ${engine}`);
  return runner.run(site, overrides);
}

export function getQueuePushStatus(site, engine) {
  const runner = RUNNERS[engine];
  if (!runner) throw new Error(`未知引擎: ${engine}`);
  return runner.status(site);
}

/** 对单站点执行所有已启用引擎的一批推送 */
export async function runQueuePushAllEngines(site, overrides = {}) {
  const engines = overrides.engines || PUSH_ENGINES;
  const results = [];
  for (const engine of engines) {
    if (!isEngineEnabled(site, engine)) continue;
    try {
      const record = await runQueuePush(site, engine, {
        ...overrides,
        trigger: overrides.trigger || 'cron',
      });
      results.push({ engine, siteId: site.id, ok: true, record });
    } catch (e) {
      results.push({
        engine,
        siteId: site.id,
        ok: false,
        error: e.message || String(e),
      });
    }
  }
  return results;
}

/** 所有站点 × 所有引擎 */
export async function runScheduledPushAllSites(overrides = {}) {
  const engines = overrides.engines || PUSH_ENGINES;
  const out = [];
  for (const meta of listSites()) {
    const site = getSiteById(meta.id);
    if (!site) continue;
    const siteResults = await runQueuePushAllEngines(site, { ...overrides, engines });
    out.push(...siteResults);
  }
  return out;
}
