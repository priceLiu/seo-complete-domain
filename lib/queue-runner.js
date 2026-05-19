import { applySiteEnv } from './sites.js';
import {
  getQueueStatus,
  markBatchResult,
  pickNextBatch,
  startNextCycle,
  syncQueueFromSitemap,
} from './push-queue.js';
import { writeScheduleLastRun } from './schedule-store.js';

/**
 * 通用队列推送：同步 sitemap → 按日额度取批 → 执行 runBatch → 写回队列。
 * @param {object} site
 * @param {string} engine baidu | bing
 * @param {object} options
 * @param {() => string|null} options.checkCredentials 返回错误文案或 null
 * @param {(ctx: { batch: string[], sitemapUrl: string, site: object }) => Promise<{ results: {url,ok,error?}[], meta?: object }>} options.runBatch
 */
export async function runQueueEnginePush(site, engine, options = {}) {
  applySiteEnv(site);
  const credErr = options.checkCredentials?.();
  if (credErr) throw new Error(credErr);

  const sitemapUrl = (options.sitemapUrl || site.sitemapUrl).trim();
  const dailyLimit = options.dailyLimit ?? 100;
  const trigger = options.trigger || 'queue';
  const forceSync = options.forceSync === true;
  const maxUrls = options.maxUrls || 5000;

  let { summary } = getQueueStatus(site.id, engine);
  if (!summary?.total || forceSync) {
    summary = await syncQueueFromSitemap({
      siteId: site.id,
      engine,
      sitemapUrl,
      maxUrls,
    });
  }

  if (summary.completedCycle) {
    summary = await startNextCycle({
      siteId: site.id,
      engine,
      sitemapUrl,
      maxUrls,
    });
    if (options.onCycleStart) {
      await options.onCycleStart({ site, sitemapUrl, summary });
    }
  }

  const { batch, dailyRemaining } = pickNextBatch(site.id, engine, dailyLimit);
  const startedAt = new Date().toISOString();

  if (!batch.length) {
    const record = {
      startedAt,
      finishedAt: new Date().toISOString(),
      trigger,
      engine,
      siteId: site.id,
      mode: 'queue',
      sitemapUrl,
      ok: true,
      message:
        dailyRemaining === 0
          ? '今日配额已用完，明日将继续推送剩余 URL'
          : '无待推送 URL',
      queue: summary,
    };
    writeScheduleLastRun(record, engine);
    return record;
  }

  let push = null;
  let extra = null;
  let error = null;

  try {
    const out = await options.runBatch({ batch, sitemapUrl, site });
    const results = out.results || batch.map((url) => ({ url, ok: true }));
    summary = markBatchResult(site.id, engine, results);
    push = out.meta || null;
    extra = out.extra || null;
  } catch (e) {
    error = e.message || String(e);
    const results = batch.map((url) => ({ url, ok: false, error }));
    summary = markBatchResult(site.id, engine, results);
  }

  const record = {
    startedAt,
    finishedAt: new Date().toISOString(),
    trigger,
    engine,
    siteId: site.id,
    mode: 'queue',
    sitemapUrl,
    dailyLimit,
    batchSize: batch.length,
    ok: !error,
    error,
    push,
    extra,
    queue: summary,
  };
  writeScheduleLastRun(record, engine);
  if (error) throw new Error(error);
  return record;
}

export function getQueueEngineStatus(site, engine, { dailyLimit, credentialsConfigured }) {
  applySiteEnv(site);
  const { summary } = getQueueStatus(site.id, engine);
  return {
    engine,
    siteId: site.id,
    siteName: site.name,
    sitemapUrl: site.sitemapUrl,
    dailyLimit,
    credentialsConfigured,
    queue: summary,
  };
}
