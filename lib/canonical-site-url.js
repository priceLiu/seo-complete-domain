/**
 * 将 URL 统一到站点的首选主机名（如验证站为 www 时，把裸域改为 www）。
 */

function hostFromSiteUrl(siteUrl) {
  try {
    return new URL(String(siteUrl).trim()).hostname;
  } catch {
    return '';
  }
}

/** 站点配置的首选 host（来自 sites.json 的 url，通常为 www） */
export function preferredHostFromSiteUrl(siteUrl) {
  return hostFromSiteUrl(siteUrl);
}

/**
 * @param {string[]} urls
 * @param {string} siteUrl 站点根 URL，如 https://www.example.com
 */
export function canonicalizeUrlsToSiteHost(urls, siteUrl) {
  const targetHost = preferredHostFromSiteUrl(siteUrl);
  if (!targetHost) return urls;

  const apex = targetHost.startsWith('www.') ? targetHost.slice(4) : '';
  const addWww = targetHost.startsWith('www.');

  return urls.map((raw) => {
    const line = String(raw).trim();
    if (!line) return line;
    try {
      const u = new URL(line);
      if (u.hostname === targetHost) return u.toString();
      if (addWww && apex && u.hostname === apex) {
        u.hostname = targetHost;
        return u.toString();
      }
      return line;
    } catch {
      return line;
    }
  });
}
