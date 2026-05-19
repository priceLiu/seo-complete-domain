'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const SiteContext = createContext(null);

const COOKIE = 'seo-active-site';

function readCookie() {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

function writeCookie(id) {
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000`;
}

export function SiteProvider({ children }) {
  const [sites, setSites] = useState([]);
  const [activeId, setActiveId] = useState('');

  const refresh = useCallback(() => {
    return fetch('/api/sites')
      .then((r) => r.json())
      .then((d) => {
        const list = d.sites || [];
        setSites(list);
        const fromCookie = readCookie();
        const pick =
          list.find((s) => s.id === fromCookie)?.id ||
          list.find((s) => s.id === d.activeSiteId)?.id ||
          list[0]?.id ||
          '';
        setActiveId(pick);
        if (pick) writeCookie(pick);
      })
      .catch(() => setSites([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveSite = useCallback((id) => {
    setActiveId(id);
    writeCookie(id);
  }, []);

  const activeSite = useMemo(
    () => sites.find((s) => s.id === activeId) || sites[0] || null,
    [sites, activeId],
  );

  const value = useMemo(
    () => ({ sites, activeSite, activeId, setActiveSite, refresh }),
    [sites, activeSite, activeId, setActiveSite, refresh],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}
