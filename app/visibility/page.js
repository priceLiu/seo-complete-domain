import Link from 'next/link';
import BaiduPanel from './BaiduPanel';
import QueueProgress from '../components/QueueProgress';

export default function VisibilityPage() {
  return (
    <main className="layout-shell">
      <h1>百度收录与推送</h1>
      <p className="muted">
        按站点每日额度分批推送，未推完的 URL 次日继续。Bing 见{' '}
        <Link href="/bing">Bing Webmaster</Link>。
      </p>

      <div className="card card-glow" style={{ marginBottom: 20 }}>
        <h2>推送队列</h2>
        <QueueProgress engine="baidu" />
      </div>

      <div className="card">
        <h2>百度</h2>
        <BaiduPanel />
      </div>
    </main>
  );
}
