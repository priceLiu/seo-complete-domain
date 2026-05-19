'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SiteProvider } from './SiteProvider';
import SiteSwitcher from './SiteSwitcher';

const links = [
  { href: '/', label: '总览' },
  { href: '/audit', label: '审计' },
  { href: '/visibility', label: '百度' },
  { href: '/bing', label: 'Bing' },
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  return (
    <SiteProvider>
      <div className="app-bg">
        <header className="nav nav-glass">
          <span className="nav-brand">
            <span className="nav-logo" aria-hidden />
            SEO Monitor
          </span>
          <nav className="nav-links">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={pathname === l.href ? 'active' : undefined}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <SiteSwitcher />
        </header>
        {children}
      </div>
    </SiteProvider>
  );
}
