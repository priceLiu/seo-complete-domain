import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

function hashSecret(s) {
  return createHash('sha256').update(s, 'utf8').digest();
}

/**
 * 若设置了 AUDIT_RUN_SECRET，则校验 Bearer 或 body.secret。
 * @returns {NextResponse|null} 校验失败时返回响应，通过返回 null。
 */
export function ensureAuditAuthorized(request, body) {
  const expected = (process.env.AUDIT_RUN_SECRET || '').trim();
  if (!expected) return null;

  const bearer = request.headers.get('authorization') || '';
  let token = '';
  const m = /^Bearer\s+(\S+)/i.exec(bearer);
  if (m) token = m[1].trim();
  if (!token && body && typeof body.secret === 'string') token = body.secret.trim();

  if (!token) {
    return NextResponse.json(
      {
        error: '需要审计密钥：请在请求体传入 secret，或使用 Authorization: Bearer <密钥>',
      },
      { status: 401 },
    );
  }

  try {
    const a = hashSecret(token);
    const b = hashSecret(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: '审计密钥无效' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: '审计密钥无效' }, { status: 403 });
  }

  return null;
}
