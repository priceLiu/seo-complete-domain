import { NextResponse } from 'next/server';
import { listSites, getSiteById, loadSitesManifest } from '@/lib/sites';
import { getQueuePushStatus } from '@/lib/push-engines';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const sites = listSites();

  if (siteId) {
    const site = getSiteById(siteId);
    if (!site) {
      return NextResponse.json({ error: '站点不存在' }, { status: 404 });
    }
    const engines = ['baidu', 'bing'].reduce((acc, eng) => {
      try {
        acc[eng] = getQueuePushStatus(site, eng);
      } catch {
        acc[eng] = null;
      }
      return acc;
    }, {});
    return NextResponse.json({
      site: { id: site.id, name: site.name, url: site.url, sitemapUrl: site.sitemapUrl },
      engines,
    });
  }

  const { activeSiteId } = loadSitesManifest();
  return NextResponse.json({ sites, activeSiteId });
}
