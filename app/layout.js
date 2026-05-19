import './globals.css';
import AppShell from './components/AppShell';

export const metadata = {
  title: 'SEO 监控',
  description: '多站点 SEO 审计、收录推送与队列定时任务',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
