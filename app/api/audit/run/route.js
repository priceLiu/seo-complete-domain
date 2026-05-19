import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import { auditPage } from '@/lib/audit-engine';
import { getAuditUrlList } from '@/lib/fetchUrls';
import { getSiteUrl } from '@/lib/site';
import { writeAuditStore, writeSiteAuditSeoStore } from '@/lib/store';
import { getCloudAuditLimits, isCloudHosted } from '@/lib/runtime-env';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function parseEngines(body) {
  const raw = body.engines;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim());
  const engines = ['rules'];
  if (body.lighthouse) engines.push('lighthouse');
  if (body.siteAuditSeo) engines.push('site-audit-seo');
  return engines;
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const denied = ensureAuditAuthorized(request, body);
  if (denied) return denied;

  const engines = parseEngines(body);
  const useRules = engines.includes('rules');
  const useLighthouse = engines.includes('lighthouse');
  const useSiteAuditSeo = engines.includes('site-audit-seo');
  const cloud = getCloudAuditLimits();

  if (cloud) {
    if (useSiteAuditSeo) {
      return NextResponse.json(
        {
          error:
            '云托管不支持 site-audit-seo（需 npx 下载与长时间爬取，会触发 504）。请仅勾选「规则审计」或在本机执行 npm run audit:site-audit-seo。',
        },
        { status: 503 },
      );
    }
    if (useLighthouse) {
      return NextResponse.json(
        {
          error:
            '云托管无 Chrome，无法运行 Lighthouse。请仅勾选「规则审计」，或在本机执行 npm run audit:lighthouse。',
        },
        { status: 503 },
      );
    }
  }

  let maxPages = Math.min(parseInt(String(body.maxPages), 10) || 25, 80);
  if (cloud?.maxRulesPages) {
    maxPages = Math.min(maxPages, cloud.maxRulesPages);
  }
  const lhMax = Math.min(
    parseInt(
      String(body.lighthouseMaxPages || process.env.AUDIT_LIGHTHOUSE_MAX_PAGES || '3'),
      10,
    ) || 3,
    10,
  );
  const siteAuditMax = Math.min(
    parseInt(String(body.siteAuditMaxPages || '25'), 10) || 25,
    100,
  );

  const keywordHints = String(body.keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const siteUrl = getSiteUrl();
  let results = [];
  let siteAuditSeoMeta = null;

  if (useSiteAuditSeo) {
    try {
      const { runSiteAuditSeo } = await import('@/lib/site-audit-seo-runner');
      const crawled = await runSiteAuditSeo(siteUrl, {
        maxPages: siteAuditMax,
        withLighthouse: true,
      });
      siteAuditSeoMeta = {
        jsonPath: crawled.jsonPath,
        rowCount: crawled.rowCount,
        auditedPages: crawled.pages.length,
      };
      writeSiteAuditSeoStore({
        auditDate: new Date().toISOString().slice(0, 10),
        siteUrl,
        ...siteAuditSeoMeta,
        pages: crawled.pages,
      });
      if (!useRules && !useLighthouse) {
        results = crawled.pages;
      }
    } catch (e) {
      return NextResponse.json(
        { error: `site-audit-seo 失败：${e.message || e}` },
        { status: 502 },
      );
    }
  }

  if (useRules || useLighthouse) {
    const urls = await getAuditUrlList(maxPages);
    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      try {
        let row = useRules
          ? await auditPage(url, keywordHints)
          : { url, score: 0, issues: [], details: {}, engines: [] };
        row.engines = [...(row.engines || []), ...(useRules ? ['rules'] : [])];

        if (useLighthouse && i < lhMax) {
          try {
            const { runLighthouseAudit, mergeLighthouseIntoAudit } = await import(
              '@/lib/lighthouse-runner'
            );
            const lh = await runLighthouseAudit(url);
            row = mergeLighthouseIntoAudit(row, lh);
          } catch (e) {
            row.issues.push({
              severity: 'med',
              message: `Lighthouse 失败：${e.message || e}`,
              recommendation: '确认本机已安装 Chrome；headless 环境需 --no-sandbox。',
            });
            row.engines = [...new Set([...(row.engines || []), 'lighthouse'])];
          }
        }

        results.push(row);
        await new Promise((r) => setTimeout(r, useLighthouse ? 800 : 350));
      } catch (e) {
        results.push({
          url,
          score: 0,
          issues: [
            {
              severity: 'high',
              message: `抓取失败：${e.message || e}`,
              recommendation: '检查 URL 是否可公网访问、是否拦截爬虫。',
            },
          ],
          details: { fetchError: true },
          engines: useRules ? ['rules'] : [],
        });
      }
    }
  }

  if (!results.length) {
    return NextResponse.json(
      { error: '未产生审计结果，请至少选择一种引擎（rules / lighthouse / site-audit-seo）' },
      { status: 400 },
    );
  }

  let totalScore = 0;
  for (const r of results) totalScore += r.score;
  const avgScore = results.length
    ? Math.round((totalScore / results.length) * 10) / 10
    : 0;

  const issueCounter = {};
  for (const r of results) {
    for (const issue of r.issues) {
      issueCounter[issue.message] = (issueCounter[issue.message] || 0) + 1;
    }
  }
  const topIssues = Object.entries(issueCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([message, count]) => ({ message, count }));

  const payload = {
    auditDate: new Date().toISOString().slice(0, 10),
    avgScore,
    auditedPages: results.length,
    engines,
    topIssues,
    pages: results,
    siteAuditSeo: siteAuditSeoMeta,
  };

  writeAuditStore(payload);

  return NextResponse.json(payload);
}
