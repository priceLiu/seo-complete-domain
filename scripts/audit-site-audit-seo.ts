/**
 * 整站 site-audit-seo 爬虫 + Lighthouse 字段。
 * 例：npm run audit:site-audit-seo
 */
import { createRequire } from 'node:module';
import { getSiteUrl } from '../lib/site.js';
import { runSiteAuditSeo } from '../lib/site-audit-seo-runner.js';
import { writeSiteAuditSeoStore } from '../lib/store.js';

const require = createRequire(import.meta.url);
require('./load-env').loadProjectEnv();

const maxPages = Math.min(
  parseInt(process.env.AUDIT_SITE_AUDIT_MAX_PAGES || '25', 10) || 25,
  100,
);

async function main() {
  const siteUrl = getSiteUrl();
  console.log('[site-audit-seo]', siteUrl, 'max', maxPages);
  const crawled = await runSiteAuditSeo(siteUrl, {
    maxPages,
    withLighthouse: true,
  });
  const payload = {
    auditDate: new Date().toISOString().slice(0, 10),
    siteUrl,
    jsonPath: crawled.jsonPath,
    rowCount: crawled.rowCount,
    auditedPages: crawled.pages.length,
    pages: crawled.pages,
  };
  writeSiteAuditSeoStore(payload);
  console.log('saved', crawled.jsonPath, 'pages', crawled.pages.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
