import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import { runScheduledBaiduPush, getScheduleStatus } from '@/lib/run-scheduled-baidu-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json(getScheduleStatus());
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
    const record = await runScheduledBaiduPush({
      trigger: 'api',
      sitemapUrl: body.sitemapUrl,
      maxPages: body.maxPages,
      type: body.type,
      ping: body.ping,
    });
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message || String(e) },
      { status: 502 },
    );
  }
}
