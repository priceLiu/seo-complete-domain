function trimEnv(v) {
  return String(v || '').trim();
}

function siteRootFromSitemapUrl(sitemapUrl) {
  try {
    const u = new URL(trimEnv(sitemapUrl));
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

/** 监控/展示用站点根 URL（与百度 Sitemap 配置保持一致） */
export function getSiteUrl() {
  const fromEnv =
    trimEnv(process.env.MONITOR_SITE_URL) ||
    trimEnv(process.env.NEXT_PUBLIC_SITE_URL);
  const fromSitemap =
    siteRootFromSitemapUrl(process.env.BAIDU_SCHEDULE_SITEMAP_URL) ||
    siteRootFromSitemapUrl(process.env.BAIDU_DEFAULT_SITEMAP_URL);
  const u = fromEnv || fromSitemap || 'https://www.ai-code8.com';
  return u.replace(/\/$/, '');
}
