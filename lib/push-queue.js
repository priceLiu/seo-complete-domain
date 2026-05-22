import fs from 'fs';
import path from 'path';
import { canonicalizeUrlsToSiteHost } from './canonical-site-url.js';
import { fetchUrlsFromSitemapUrl } from './fetchUrls.js';

const QUEUE_DIR =
  process.env.PUSH_QUEUE_DIR || path.join(process.cwd(), 'data', 'push-queue');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function queuePath(siteId, engine) {
  return path.join(QUEUE_DIR, `${siteId}-${engine}.json`);
}

function ensureDir() {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

function readQueue(siteId, engine) {
  ensureDir();
  const p = queuePath(siteId, engine);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeQueue(state) {
  ensureDir();
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(queuePath(state.siteId, state.engine), JSON.stringify(state, null, 2), 'utf8');
}

/**
 * 从 sitemap 同步 URL 列表；保留已推送记录，新增 URL 为 pending。
 */
export async function syncQueueFromSitemap({
  siteId,
  engine,
  sitemapUrl,
  maxUrls = 5000,
  /** 站点根 URL（如 https://www.example.com），用于队列内 URL 统一 www */
  canonicalSiteUrl,
}) {
  let urls = await fetchUrlsFromSitemapUrl(sitemapUrl, maxUrls);
  if (canonicalSiteUrl) {
    urls = canonicalizeUrlsToSiteHost(urls, canonicalSiteUrl);
  }

  const existing = readQueue(siteId, engine);
  const doneMap = new Map();
  if (existing?.items) {
    for (const it of existing.items) {
      if (it.status !== 'done') continue;
      const key = canonicalSiteUrl
        ? canonicalizeUrlsToSiteHost([it.url], canonicalSiteUrl)[0]
        : it.url;
      doneMap.set(key, { ...it, url: key, status: 'done' });
    }
  }

  const items = urls.map((url) => {
    const prev = doneMap.get(url);
    if (prev) return { ...prev, status: 'done' };
    return { url, status: 'pending' };
  });

  const today = todayKey();
  let daily = existing?.daily;
  if (!daily || daily.date !== today) {
    daily = { date: today, successCount: 0 };
  }

  const state = {
    siteId,
    engine,
    sitemapUrl,
    cycle: existing?.cycle || 1,
    items,
    daily,
  };
  writeQueue(state);
  return summarizeQueue(state);
}

function resetDailyIfNeeded(state) {
  const today = todayKey();
  if (!state.daily || state.daily.date !== today) {
    state.daily = { date: today, successCount: 0 };
  }
  return state;
}

export function summarizeQueue(state) {
  if (!state) {
    return {
      total: 0,
      pending: 0,
      done: 0,
      failed: 0,
      cycle: 0,
      daily: { date: todayKey(), successCount: 0, limit: 0 },
      percent: 0,
    };
  }
  const pending = state.items.filter((i) => i.status === 'pending').length;
  const done = state.items.filter((i) => i.status === 'done').length;
  const failed = state.items.filter((i) => i.status === 'failed').length;
  const total = state.items.length;
  return {
    total,
    pending,
    done,
    failed,
    cycle: state.cycle,
    daily: state.daily,
    percent: total ? Math.round((done / total) * 1000) / 10 : 0,
    completedCycle: total > 0 && pending === 0,
  };
}

export function getQueueStatus(siteId, engine) {
  const state = readQueue(siteId, engine);
  return { state, summary: summarizeQueue(state) };
}

/**
 * 取下一批待推送 URL（受每日上限约束）。
 */
export function pickNextBatch(siteId, engine, dailyLimit) {
  let state = readQueue(siteId, engine);
  if (!state?.items?.length) return { state: null, batch: [], dailyRemaining: dailyLimit };

  state = resetDailyIfNeeded(state);
  const remaining = Math.max(0, dailyLimit - (state.daily.successCount || 0));
  if (remaining === 0) {
    writeQueue(state);
    return { state, batch: [], dailyRemaining: 0 };
  }

  const batch = [];
  for (const item of state.items) {
    if (item.status !== 'pending') continue;
    batch.push(item.url);
    if (batch.length >= remaining) break;
  }
  return { state, batch, dailyRemaining: remaining };
}

export function markBatchResult(siteId, engine, results) {
  const state = readQueue(siteId, engine);
  if (!state) return null;
  resetDailyIfNeeded(state);
  const byUrl = new Map(state.items.map((i) => [i.url, i]));

  for (const r of results) {
    const item = byUrl.get(r.url);
    if (!item) continue;
    if (r.ok) {
      item.status = 'done';
      item.pushedAt = new Date().toISOString();
      state.daily.successCount = (state.daily.successCount || 0) + 1;
    } else {
      item.status = 'failed';
      item.error = r.error || 'push failed';
      item.lastAttempt = new Date().toISOString();
    }
  }
  writeQueue(state);
  return summarizeQueue(state);
}

/** 全部推送完成后开始新一轮（重新抓取 sitemap，全部 URL 置为 pending） */
export async function startNextCycle({ siteId, engine, sitemapUrl, maxUrls, canonicalSiteUrl }) {
  await syncQueueFromSitemap({ siteId, engine, sitemapUrl, maxUrls, canonicalSiteUrl });
  const state = readQueue(siteId, engine);
  if (!state) return summarizeQueue(null);
  state.cycle = (state.cycle || 1) + 1;
  state.items = state.items.map((i) => ({ url: i.url, status: 'pending' }));
  state.daily = { date: todayKey(), successCount: 0 };
  writeQueue(state);
  return summarizeQueue(state);
}
