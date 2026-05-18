import Link from 'next/link';
import BingPanel from './BingPanel';
import { getSiteUrl } from '@/lib/site';

export default function BingPage() {
  const site = getSiteUrl();
  return (
    <main className="layout-shell">
      <h1>Bing Webmaster</h1>
      <p className="muted">
        目标站：<strong>{site}</strong> · 提交配额、流量、搜索词与抓取问题均通过{' '}
        <a
          href="https://learn.microsoft.com/en-us/bingwebmaster/getting-started"
          target="_blank"
          rel="noreferrer"
        >
          Bing Webmaster JSON API
        </a>{' '}
        拉取；密钥仅保存在服务端 <code>BING_WEBMASTER_API_KEY</code>。
      </p>

      <div className="card">
        <BingPanel />
      </div>

      <p className="muted" style={{ marginTop: 16, fontSize: '0.88rem' }}>
        百度主动推送与定时 Sitemap 请前往{' '}
        <Link href="/visibility">收录与索引（百度）</Link>。
      </p>
    </main>
  );
}
