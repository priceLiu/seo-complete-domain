/**
 * 对 sitemap 前 N 页运行 Lighthouse（CLI）。
 * 例：npm run audit:lighthouse
 */
import { createRequire } from 'node:module';
import { getAuditUrlList } from '../lib/fetchUrls.js';
import { mergeLighthouseIntoAudit, runLighthouseAudit } from '../lib/lighthouse-runner.js';
import { auditPage } from '../lib/audit-engine.js';
import { writeAuditStore } from '../lib/store.js';

const require = createRequire(import.meta.url);
require('./load-env').loadProjectEnv();

const maxPages = Math.min(
  parseInt(process.env.AUDIT_LIGHTHOUSE_MAX_PAGES || '3', 10) || 3,
  10,
);

async function main() {
  const urls = await getAuditUrlList(maxPages);
  const pages = [];
  for (const url of urls) {
    console.log('[lighthouse]', url);
    let row = await auditPage(url);
    try {
      const lh = await runLighthouseAudit(url);
      row = mergeLighthouseIntoAudit(row, lh);
    } catch (e) {
      console.error('  fail:', (e as Error).message);
    }
    pages.push(row);
  }
  const avg =
    pages.reduce((s, p) => s + p.score, 0) / (pages.length || 1);
  const payload = {
    auditDate: new Date().toISOString().slice(0, 10),
    avgScore: Math.round(avg * 10) / 10,
    auditedPages: pages.length,
    engines: ['rules', 'lighthouse'],
    pages,
    topIssues: [],
  };
  writeAuditStore(payload);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
