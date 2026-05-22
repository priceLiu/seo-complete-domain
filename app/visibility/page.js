import Link from 'next/link';
import BaiduPanel from './BaiduPanel';
import BaiduPushModeNotice from './BaiduPushModeNotice';
import QueueProgress from '../components/QueueProgress';

export default function VisibilityPage() {
  return (
    <main className="layout-shell">
      <h1>百度收录与推送</h1>
      <p className="muted">
        按站点每日额度分批推送，未推完的 URL 次日继续；队列内 URL 统一为站点配置的 www 主域。Bing 见{' '}
        <Link href="/bing">Bing Webmaster</Link>。
      </p>

      <BaiduPushModeNotice />

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
