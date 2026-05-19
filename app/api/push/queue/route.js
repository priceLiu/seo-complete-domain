import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import { getSiteById, getActiveSite } from '@/lib/sites';
import { syncQueueFromSitemap } from '@/lib/push-queue';
import { getQueuePushStatus, runQueuePush, PUSH_ENGINES } from '@/lib/push-engines';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const site = getSiteById(searchParams.get('siteId')) || getActiveSite();
  if (!site) return NextResponse.json({ error: '未配置站点' }, { status: 400 });

  const engine = searchParams.get('engine') || 'baidu';
  if (!PUSH_ENGINES.includes(engine)) {
    return NextResponse.json({ error: `未知引擎，支持: ${PUSH_ENGINES.join(', ')}` }, { status: 400 });
  }

  return NextResponse.json(getQueuePushStatus(site, engine));
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

  const site = getSiteById(body.siteId) || getActiveSite();
  if (!site) return NextResponse.json({ error: '未配置站点' }, { status: 400 });

  const engine = body.engine || 'baidu';
  if (!PUSH_ENGINES.includes(engine)) {
    return NextResponse.json({ error: `未知引擎` }, { status: 400 });
  }

  const action = body.action || 'run';

  try {
    if (action === 'sync') {
      const summary = await syncQueueFromSitemap({
        siteId: site.id,
        engine,
        sitemapUrl: body.sitemapUrl || site.sitemapUrl,
        maxUrls: body.maxUrls || 5000,
      });
      return NextResponse.json({ ok: true, action: 'sync', engine, queue: summary });
    }

    if (action === 'run-all') {
      const { runQueuePushAllEngines } = await import('@/lib/push-engines');
      const results = await runQueuePushAllEngines(site, {
        trigger: body.trigger || 'api',
        forceSync: body.forceSync === true,
      });
      return NextResponse.json({ ok: true, action: 'run-all', results });
    }

    const record = await runQueuePush(site, engine, {
      trigger: body.trigger || 'api',
      forceSync: body.forceSync === true,
      dailyLimit: body.dailyLimit,
    });
    return NextResponse.json({ ok: true, action: 'run', engine, record });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 502 });
  }
}
