import Link from 'next/link';
import BingPanel from './BingPanel';
import QueueProgress from '../components/QueueProgress';

export default function BingPage() {
  return (
    <main className="layout-shell">
      <h1>Bing Webmaster</h1>
      <p className="muted">
        URL 队列与配额、流量、搜索词均通过 Bing JSON API。密钥在{' '}
        <code>config/sites-secrets.json</code>。
      </p>

      <div className="card card-glow" style={{ marginBottom: 20 }}>
        <h2>Bing 推送队列</h2>
        <QueueProgress engine="bing" />
      </div>

      <div className="card">
        <BingPanel />
      </div>

      <p className="muted" style={{ marginTop: 16, fontSize: '0.88rem' }}>
        百度队列见 <Link href="/visibility">百度收录</Link>。定时任务见{' '}
        <code>docs/deploy-tencent.md</code>。
      </p>
    </main>
  );
}
