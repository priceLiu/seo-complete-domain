#!/usr/bin/env node
/**
 * 从 config/secrets.env、.env.local 生成 config/sites-secrets.json
 */
const fs = require('fs');
const path = require('path');
const { parseEnvFile } = require('./env-parse');

const ROOT = path.join(__dirname, '..');
const sitesPath = path.join(ROOT, 'config', 'sites.json');
const outPath = path.join(ROOT, 'config', 'sites-secrets.json');

const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
const siteId = sites.activeSiteId || sites.sites?.[0]?.id;
if (!siteId) {
  console.error('sites.json 中无站点');
  process.exit(1);
}

const env = {
  ...parseEnvFile(path.join(ROOT, 'config', 'secrets.env')),
  ...parseEnvFile(path.join(ROOT, '.env.local')),
};

let baiduPushApiUrl = env.BAIDU_PUSH_API_URL || '';
const baiduToken = env.BAIDU_PUSH_TOKEN || env.BAIDU_TOKEN || '';
const baiduSite = (env.BAIDU_PUSH_SITE || env.BAIDU_SITE_URL || '').replace(/^https?:\/\//, '').split('/')[0];
if (!baiduPushApiUrl && baiduToken && baiduSite) {
  baiduPushApiUrl = `http://data.zz.baidu.com/urls?site=${baiduSite}&token=${baiduToken}`;
}

const entry = {
  baiduPushApiUrl,
  baiduToken,
  bingWebmasterApiKey: env.BING_WEBMASTER_API_KEY || '',
};

let existing = {};
if (fs.existsSync(outPath)) {
  try {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  } catch {
    existing = {};
  }
}

existing[siteId] = { ...existing[siteId], ...entry };
fs.writeFileSync(outPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

const ok =
  (entry.baiduPushApiUrl || entry.baiduToken) && entry.bingWebmasterApiKey;
if (!ok) {
  console.warn('[migrate] 部分密钥仍为空，请检查 config/secrets.env 或 .env.local');
} else {
  console.log(`[migrate] 已写入 ${outPath} -> ${siteId}`);
}
