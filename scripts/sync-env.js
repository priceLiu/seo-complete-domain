#!/usr/bin/env node
/**
 * 将 config/secrets.env（及 config/app.env 里已取消注释的密钥行）合并进根目录 .env.local。
 */
const fs = require('fs');
const path = require('path');
const {
  parseEnvFile,
  normalizeBaiduVars,
  mergeIntoEnvFile,
  filterRealSecrets,
  SECRET_KEYS,
  SCHEDULE_KEYS,
} = require('./env-parse');

const root = path.join(__dirname, '..');
const target = path.join(root, '.env.local');
const secretsPath = path.join(root, 'config', 'secrets.env');
const appPath = path.join(root, 'config', 'app.env');

if (!fs.existsSync(target)) {
  const app = path.join(root, 'config', 'app.env');
  if (fs.existsSync(app)) fs.copyFileSync(app, target);
}

const fromApp = parseEnvFile(appPath);
const fromSecrets = parseEnvFile(secretsPath);
const merged = normalizeBaiduVars({ ...fromApp, ...fromSecrets });

const pick = {};
for (const key of SECRET_KEYS) {
  if (merged[key]) pick[key] = merged[key];
}
if (merged.BAIDU_PUSH_API_URL) pick.BAIDU_PUSH_API_URL = merged.BAIDU_PUSH_API_URL;

let toMerge = filterRealSecrets(pick);

for (const key of SCHEDULE_KEYS) {
  if (merged[key]) toMerge[key] = merged[key];
}

if (!Object.keys(toMerge).length) {
  console.log(
    '[sync-env] 未找到有效密钥。请在 config/secrets.env 填写（可复制 secrets.env.example），然后重新运行 npm run env:sync',
  );
  process.exit(0);
}

mergeIntoEnvFile(target, toMerge);
console.log('[sync-env] 已写入 .env.local：', Object.keys(toMerge).join(', '));
console.log('[sync-env] 请重启 npm run dev 使环境变量生效');
