import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import { auditPage } from '@/lib/audit-engine';
import { getAuditUrlList } from '@/lib/fetchUrls';
import { writeAuditStore } from '@/lib/store';

export const maxDuration = 120;

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const denied = ensureAuditAuthorized(request, body);
  if (denied) return denied;

  const maxPages = Math.min(parseInt(String(body.maxPages), 10) || 25, 80);
  const keywordHints = String(body.keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const urls = await getAuditUrlList(maxPages);
  const results = [];
  let totalScore = 0;
  for (let i = 0; i < urls.length; i += 1) {
    try {
      const audit = await auditPage(urls[i], keywordHints);
      results.push(audit);
      totalScore += audit.score;
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      results.push({
        url: urls[i],
        score: 0,
        issues: [
          {
            severity: 'high',
            message: `抓取失败：${e.message || e}`,
            recommendation: '检查 URL 是否可公网访问、是否拦截爬虫。',
          },
        ],
        details: { fetchError: true },
      });
    }
  }

  const avgScore = results.length ? Math.round((totalScore / results.length) * 10) / 10 : 0;
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

  const auditDate = new Date().toISOString().slice(0, 10);
  const payload = {
    auditDate,
    avgScore,
    auditedPages: results.length,
    topIssues,
    pages: results,
  };

  writeAuditStore(payload);

  return NextResponse.json(payload);
}
