const fs = require('fs');

/** @param {string} content */
function parseEnvContent(content) {
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).trim();
    }
    vars[key] = val;
  }
  return vars;
}

/** @param {string} filePath */
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return parseEnvContent(fs.readFileSync(filePath, 'utf8'));
}

const PLACEHOLDER = /替换为|your_token|xxxx|YOUR_|CHANGEME/i;

/** @param {Record<string, string>} vars */
function filterRealSecrets(vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) {
    if (!v || PLACEHOLDER.test(v)) continue;
    if (k === 'BAIDU_PUSH_API_URL' && !/token=.+/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}

const SECRET_KEYS = [
  'BAIDU_PUSH_API_URL',
  'BAIDU_PUSH_TOKEN',
  'BAIDU_PUSH_SITE',
  'BAIDU_TOKEN',
  'BAIDU_SITE_URL',
  'BING_WEBMASTER_API_KEY',
  'AUDIT_RUN_SECRET',
];

const SCHEDULE_KEYS = [
  'BAIDU_DEFAULT_SITEMAP_URL',
  'BAIDU_SCHEDULE_ENABLED',
  'BAIDU_SCHEDULE_TIME',
  'BAIDU_SCHEDULE_CRON',
  'BAIDU_SCHEDULE_SITEMAP_URL',
  'BAIDU_SCHEDULE_MAX_PAGES',
  'BAIDU_SCHEDULE_PUSH_TYPE',
  'BAIDU_SCHEDULE_PING',
  'BAIDU_SCHEDULE_TIMEZONE',
];

/** 百度 site 参数须为纯域名 */
function baiduSiteHost(site) {
  const s = String(site || '').trim();
  if (!s) return '';
  try {
    if (/^https?:\/\//i.test(s)) return new URL(s).hostname;
  } catch {
    /* fall through */
  }
  return s.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
}

/** @param {Record<string, string>} vars */
function normalizeBaiduVars(vars) {
  const out = { ...vars };
  if (out.BAIDU_TOKEN && !out.BAIDU_PUSH_TOKEN) out.BAIDU_PUSH_TOKEN = out.BAIDU_TOKEN;
  if (out.BAIDU_SITE_URL && !out.BAIDU_PUSH_SITE) out.BAIDU_PUSH_SITE = out.BAIDU_SITE_URL;

  const token = out.BAIDU_PUSH_TOKEN || out.BAIDU_TOKEN || '';
  const siteHost = baiduSiteHost(
    out.BAIDU_PUSH_SITE || out.BAIDU_SITE_URL || out.NEXT_PUBLIC_SITE_URL || '',
  );
  if (siteHost) {
    out.BAIDU_PUSH_SITE = siteHost;
    if (out.BAIDU_SITE_URL) out.BAIDU_SITE_URL = siteHost;
  }
  if (!out.BAIDU_PUSH_API_URL && token && siteHost) {
    out.BAIDU_PUSH_API_URL = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(siteHost)}&token=${encodeURIComponent(token)}`;
  }
  return out;
}

/**
 * @param {string} targetPath
 * @param {Record<string, string>} vars
 */
function mergeIntoEnvFile(targetPath, vars) {
  const keys = Object.keys(vars);
  if (!keys.length) return false;

  let lines = [];
  if (fs.existsSync(targetPath)) {
    lines = fs.readFileSync(targetPath, 'utf8').split(/\r?\n/);
  }

  const remaining = new Set(keys);
  const out = [];

  for (const line of lines) {
    const t = line.trim();
    if (t && !t.startsWith('#') && t.includes('=')) {
      const key = t.slice(0, t.indexOf('=')).trim();
      if (vars[key] !== undefined) {
        out.push(`${key}=${vars[key]}`);
        remaining.delete(key);
        continue;
      }
    }
    out.push(line);
  }

  if (remaining.size) {
    if (out.length && out[out.length - 1] !== '') out.push('');
    out.push('# --- 由 scripts/sync-env.js 从 config/secrets.env 同步 ---');
    for (const key of keys) {
      if (remaining.has(key)) out.push(`${key}=${vars[key]}`);
    }
  }

  fs.writeFileSync(targetPath, `${out.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  return true;
}

module.exports = {
  parseEnvFile,
  parseEnvContent,
  normalizeBaiduVars,
  mergeIntoEnvFile,
  filterRealSecrets,
  SECRET_KEYS,
  SCHEDULE_KEYS,
};
