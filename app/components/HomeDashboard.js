'use client';

import Link from 'next/link';
import { useSite } from './SiteProvider';
import QueueProgress from './QueueProgress';

export default function HomeDashboard() {
  const { activeSite, sites } = useSite();

  return (
    <main className="layout-shell">
      <section className="hero">
        <p className="hero-kicker">Multi-site SEO</p>
        <h1>监控总览</h1>
        <p className="muted hero-lead">
          {activeSite ? (
            <>
              当前站点 <strong>{activeSite.name}</strong> ·{' '}
              <a href={activeSite.url} target="_blank" rel="noreferrer">
                {activeSite.url}
              </a>
            </>
          ) : (
            '请在 config/sites.json 配置站点'
          )}
          {sites.length > 1 ? ` · 共 ${sites.length} 个站点` : null}
        </p>
      </section>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card card-glow">
          <h2>百度推送队列</h2>
          <QueueProgress engine="baidu" />
        </div>
        <div className="card card-glow">
          <h2>Bing 推送队列</h2>
          <QueueProgress engine="bing" />
        </div>
      </div>

      <div className="grid-3">
        <Link href="/audit" className="card card-link">
          <span className="card-icon">🔍</span>
          <h2>页面审计</h2>
          <p className="muted">规则审计 + Lighthouse / site-audit-seo</p>
        </Link>
        <Link href="/visibility" className="card card-link">
          <span className="card-icon">📡</span>
          <h2>百度收录</h2>
          <p className="muted">主动推送、Sitemap 与每日队列</p>
        </Link>
        <Link href="/bing" className="card card-link">
          <span className="card-icon">🌐</span>
          <h2>Bing Webmaster</h2>
          <p className="muted">URL 队列、流量与抓取问题</p>
        </Link>
      </div>
    </main>
  );
}
