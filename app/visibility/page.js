import Link from 'next/link';
import BaiduPanel from './BaiduPanel';
import { getSiteUrl } from '@/lib/site';

export default function VisibilityPage() {
  const site = getSiteUrl();
  return (
    <main className="layout-shell">
      <h1>百度收录与推送</h1>
      <p className="muted">
        目标站：<strong>{site}</strong> · 主动推送、Sitemap 抓取与定时任务。Bing 相关功能已独立至{' '}
        <Link href="/bing">Bing Webmaster</Link> 页面。
      </p>

      <div className="card">
        <h2>百度</h2>
        <BaiduPanel />
      </div>

      <div className="card">
        <h2>说明</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          本项目已移除 CloudBase 云函数依赖；百度定时任务使用{' '}
          <code>npm run schedule:daemon</code> 或页面内「立即执行」。
        </p>
      </div>
    </main>
  );
}
