import { NextResponse } from 'next/server';
import { readAuditStore } from '@/lib/store';

export async function GET() {
  const data = readAuditStore();
  if (!data) {
    return NextResponse.json({ empty: true, message: '尚未执行审计，请在「页面审计」中运行。' });
  }
  return NextResponse.json(data);
}
