import Link from 'next/link';
import { getSiteUrl } from '@/lib/site';

export default function HomePage() {
  const site = getSiteUrl();
  return (
    <main className="layout-shell">
      <h1>SEO 监控总览</h1>
      <p className="muted">
        当前目标站：<strong>{site}</strong> · 通过 `.env.local` 中的{' '}
        <code>NEXT_PUBLIC_SITE_URL</code> 修改。
      </p>

      <div className="grid-3" style={{ marginTop: 24 }}>
        <Link href="/audit" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <h2>页面审计</h2>
          <p className="muted" style={{ margin: 0 }}>
            基于 sitemap 爬取页面，规则打分并输出修复建议（本地/API 运行，无需云函数）。
          </p>
        </Link>
        <Link
          href="/visibility"
          className="card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <h2>百度收录</h2>
          <p className="muted" style={{ margin: 0 }}>
            主动推送、Sitemap 抓取与每日定时推送（百度站长平台）。
          </p>
        </Link>
        <Link href="/bing" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <h2>Bing Webmaster</h2>
          <p className="muted" style={{ margin: 0 }}>
            URL / Sitemap 提交、流量趋势、搜索词、页面表现与抓取问题。
          </p>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>版本与迭代</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          每次发版请更新 <code>docs/releases/</code> 下的发布说明，并遵循{' '}
          <code>.cursor/rules/release-iteration.mdc</code>。
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="https://github.com/search?q=seo+audit+lighthouse&type=repositories">开源参考</Link>
          ：可逐步接入 Lighthouse / 外部爬虫（如 site-audit-seo）作为增强。
        </p>
      </div>
    </main>
  );
}
