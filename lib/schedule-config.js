import { getDefaultSitemapUrl } from './fetchUrls.js';

/**
 * 将 `HH:mm` 转为 node-cron 表达式（每天）。
 * @param {string} time 如 `03:00`
 */
export function timeToDailyCron(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!m) return '0 3 * * *';
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${minute} ${hour} * * *`;
}

export function isScheduleEnabled() {
  const v = (process.env.BAIDU_SCHEDULE_ENABLED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function getScheduleConfig() {
  const enabled = isScheduleEnabled();
  const time = (process.env.BAIDU_SCHEDULE_TIME || '03:00').trim();
  const cronExpr = (process.env.BAIDU_SCHEDULE_CRON || '').trim() || timeToDailyCron(time);
  const sitemapUrl =
    (process.env.BAIDU_SCHEDULE_SITEMAP_URL || '').trim() ||
    getDefaultSitemapUrl();
  const maxPages = Math.min(
    Math.max(parseInt(process.env.BAIDU_SCHEDULE_MAX_PAGES || '2000', 10) || 2000, 1),
    2000,
  );
  const pushType =
    (process.env.BAIDU_SCHEDULE_PUSH_TYPE || 'normal').trim() === 'daily'
      ? 'daily'
      : 'normal';

  return {
    enabled,
    time,
    cronExpr,
    sitemapUrl,
    maxPages,
    pushType,
    ping: (process.env.BAIDU_SCHEDULE_PING || 'true').toLowerCase() !== 'false',
    timezone: (process.env.BAIDU_SCHEDULE_TIMEZONE || 'Asia/Shanghai').trim(),
  };
}
