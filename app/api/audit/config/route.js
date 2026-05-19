import { NextResponse } from 'next/server';
import { getCloudAuditLimits, isCloudHosted } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';

export function GET() {
  const secret = (process.env.AUDIT_RUN_SECRET || '').trim();
  return NextResponse.json({
    requiresSecret: Boolean(secret),
    cloudHosted: isCloudHosted(),
    cloudLimits: getCloudAuditLimits(),
  });
}
