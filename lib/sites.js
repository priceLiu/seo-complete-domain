import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SITES_FILE =
  process.env.SITES_JSON_PATH || path.join(ROOT, 'config', 'sites.json');
const SECRETS_FILE =
  process.env.SITES_SECRETS_PATH || path.join(ROOT, 'config', 'sites-secrets.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readSitesManifestRaw() {
  if (process.env.SITES_JSON) {
    try {
      return JSON.parse(process.env.SITES_JSON);
    } catch {
      return { sites: [], activeSiteId: '' };
    }
  }
  return readJson(SITES_FILE, { sites: [], activeSiteId: '' });
}

function readSecretsRaw() {
  if (process.env.SITES_SECRETS_JSON) {
    try {
      return JSON.parse(process.env.SITES_SECRETS_JSON);
    } catch {
      return {};
    }
  }
  return readJson(SECRETS_FILE, {});
}

function trimEnv(v) {
  return String(v || '').trim();
}

/** @returns {{ activeSiteId: string, sites: object[] }} */
export function loadSitesManifest() {
  const raw = readSitesManifestRaw();
  const sites = Array.isArray(raw.sites) ? raw.sites : [];
  let activeSiteId =
    trimEnv(process.env.ACTIVE_SITE_ID) ||
    trimEnv(raw.activeSiteId) ||
    sites[0]?.id ||
    '';
  if (activeSiteId && !sites.find((s) => s.id === activeSiteId)) {
    activeSiteId = sites[0]?.id || '';
  }
  return { activeSiteId, sites };
}

export function listSites() {
  const { sites } = loadSitesManifest();
  const secrets = readSecretsRaw();
  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    sitemapUrl: s.sitemapUrl,
    schedule: s.schedule || {},
    push: s.push || {},
    hasBaidu: Boolean(
      secrets[s.id]?.baiduPushApiUrl ||
        secrets[s.id]?.baiduToken ||
        trimEnv(process.env.BAIDU_PUSH_API_URL),
    ),
    hasBing: Boolean(
      secrets[s.id]?.bingWebmasterApiKey || trimEnv(process.env.BING_WEBMASTER_API_KEY),
    ),
  }));
}

export function getSiteById(siteId) {
  const id = trimEnv(siteId);
  const { sites } = loadSitesManifest();
  const base = sites.find((s) => s.id === id);
  if (!base) return null;
  const secrets = readSecretsRaw()[id] || {};
  return mergeSiteWithSecrets(base, secrets);
}

export function getActiveSite() {
  const { activeSiteId } = loadSitesManifest();
  return getSiteById(activeSiteId);
}

function mergeSiteWithSecrets(base, secrets) {
  const baiduPushApiUrl =
    trimEnv(secrets.baiduPushApiUrl) || trimEnv(process.env.BAIDU_PUSH_API_URL);
  const baiduToken =
    trimEnv(secrets.baiduToken || secrets.baiduPushToken) ||
    trimEnv(process.env.BAIDU_PUSH_TOKEN || process.env.BAIDU_TOKEN);
  const bingKey =
    trimEnv(secrets.bingWebmasterApiKey) || trimEnv(process.env.BING_WEBMASTER_API_KEY);

  const push = {
    baiduDailyLimit: parseInt(
      String(base.push?.baiduDailyLimit || process.env.BAIDU_DAILY_PUSH_LIMIT || '100'),
      10,
    ) || 100,
    bingDailyLimit: parseInt(
      String(base.push?.bingDailyLimit || process.env.BING_DAILY_PUSH_LIMIT || '100'),
      10,
    ) || 100,
    baiduBatchSize: Math.min(
      parseInt(String(base.push?.baiduBatchSize || '2000'), 10) || 2000,
      2000,
    ),
  };

  const schedule = {
    baiduEnabled:
      base.schedule?.baiduEnabled !== false &&
      trimEnv(process.env.BAIDU_SCHEDULE_ENABLED).toLowerCase() !== 'false',
    time: trimEnv(base.schedule?.time || process.env.BAIDU_SCHEDULE_TIME || '03:00'),
    timezone: trimEnv(
      base.schedule?.timezone || process.env.BAIDU_SCHEDULE_TIMEZONE || 'Asia/Shanghai',
    ),
    pushType:
      trimEnv(base.schedule?.pushType || process.env.BAIDU_SCHEDULE_PUSH_TYPE) === 'daily'
        ? 'daily'
        : 'normal',
    ping: (base.schedule?.ping ?? process.env.BAIDU_SCHEDULE_PING ?? 'true') !== 'false',
    bingEnabled: base.schedule?.bingEnabled !== false,
  };

  return {
    ...base,
    push,
    schedule,
    secrets: { baiduPushApiUrl, baiduToken, bingKey },
  };
}

/** 将站点凭据写入 process.env，供现有 baidu-push / bing 模块复用 */
export function applySiteEnv(site) {
  if (!site) return;
  if (site.secrets.baiduPushApiUrl) {
    process.env.BAIDU_PUSH_API_URL = site.secrets.baiduPushApiUrl;
  }
  if (site.secrets.baiduToken) {
    process.env.BAIDU_PUSH_TOKEN = site.secrets.baiduToken;
    process.env.BAIDU_TOKEN = site.secrets.baiduToken;
  }
  if (site.sitemapUrl) {
    process.env.BAIDU_SCHEDULE_SITEMAP_URL = site.sitemapUrl;
    process.env.BAIDU_DEFAULT_SITEMAP_URL = site.sitemapUrl;
  }
  if (site.secrets.bingKey) {
    process.env.BING_WEBMASTER_API_KEY = site.secrets.bingKey;
  }
  process.env.ACTIVE_SITE_ID = site.id;
}

export function applyActiveSiteEnv() {
  applySiteEnv(getActiveSite());
}
