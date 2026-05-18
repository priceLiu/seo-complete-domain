import { NextResponse } from 'next/server';
import { ensureAuditAuthorized } from '@/lib/auth-audit';
import { baiduSubmitUrls, getBaiduPushCredentials } from '@/lib/baidu-push';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const denied = ensureAuditAuthorized(request, body);
  if (denied) return denied;

  const { site, token } = getBaiduPushCredentials();
  if (!token) {
    return NextResponse.json(
      { error: '未配置 BAIDU_PUSH_API_URL 或 BAIDU_PUSH_TOKEN' },
      { status: 503 },
    );
  }
  const rawUrls = Array.isArray(body.urls) ? body.urls : [];
  const type = body.type === 'daily' ? 'daily' : 'normal';

  const urls = [];
  for (const u of rawUrls) {
    const s = String(u || '').trim();
    if (!s) continue;
    try {
      const parsed = new URL(s);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    } catch {
      continue;
    }
    urls.push(s);
  }

  if (!urls.length) {
    return NextResponse.json(
      { error: '请提供至少 1 条合法绝对 URL（http/https）' },
      { status: 400 },
    );
  }

  try {
    const result = await baiduSubmitUrls({ site, token, urls, type });
    return NextResponse.json({ ok: true, site, type, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message || String(e) },
      { status: 502 },
    );
  }
}
