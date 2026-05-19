import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import { runScheduledPush, getScheduleStatus } from '@/lib/run-scheduled-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(getScheduleStatus(searchParams.get('siteId')));
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

  try {
    const record = await runScheduledPush({
      siteId: body.siteId,
      engine: body.engine || 'baidu',
      trigger: 'api',
      sitemapUrl: body.sitemapUrl,
      dailyLimit: body.dailyLimit,
      type: body.type,
      ping: body.ping,
      forceSync: body.forceSync,
    });
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message || String(e) },
      { status: 502 },
    );
  }
}
