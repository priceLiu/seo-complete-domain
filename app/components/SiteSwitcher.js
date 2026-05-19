'use client';

import { useSite } from './SiteProvider';

export default function SiteSwitcher() {
  const { sites, activeId, setActiveSite } = useSite();
  if (!sites.length) return null;

  return (
    <label className="site-switcher">
      <span className="site-switcher-label">站点</span>
      <select
        className="site-switcher-select"
        value={activeId}
        onChange={(e) => setActiveSite(e.target.value)}
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
