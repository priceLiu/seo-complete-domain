import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'SEO 监控',
  description: '站点 SEO 审计与收录概览',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="nav">
          <span className="nav-brand">SEO Monitor</span>
          <Link href="/">总览</Link>
          <Link href="/audit">页面审计</Link>
          <Link href="/visibility">百度收录</Link>
          <Link href="/bing">Bing</Link>
        </header>
        {children}
      </body>
    </html>
  );
}
