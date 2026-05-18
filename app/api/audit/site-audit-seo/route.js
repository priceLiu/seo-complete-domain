import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import { runSiteAuditSeo } from '@/lib/site-audit-seo-runner';
import { getSiteUrl } from '@/lib/site';
import { readSiteAuditSeoStore, writeSiteAuditSeoStore } from '@/lib/store';

export const maxDuration = 300;

export async function GET() {
  const data = readSiteAuditSeoStore();
  if (!data) {
    return NextResponse.json({ empty: true, message: '暂无 site-audit-seo 结果' });
  }
  return NextResponse.json(data);
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

  const siteUrl = (body.siteUrl || getSiteUrl()).trim();
  const maxPages = Math.min(parseInt(String(body.maxPages), 10) || 25, 100);

  try {
    const crawled = await runSiteAuditSeo(siteUrl, {
      maxPages,
      withLighthouse: body.withLighthouse !== false,
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
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message || String(e) },
      { status: 502 },
    );
  }
}
