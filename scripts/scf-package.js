#!/usr/bin/env node
/**
 * 一键打包 SCF：自动同步密钥 + 默认环境变量，无需在控制台填 SITES_SECRETS_JSON
 * 用法：npm run scf:package
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'scf-seo-push');
const ZIP = path.join(ROOT, 'dist', 'scf-seo-push.zip');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('[scf:package] 同步本地密钥到 sites-secrets.json …');
execSync('node scripts/migrate-sites-secrets.js', { cwd: ROOT, stdio: 'inherit' });

const secrets = path.join(ROOT, 'config', 'sites-secrets.json');
if (!fs.existsSync(secrets)) {
  console.error('\n[scf:package] 失败：没有 config/sites-secrets.json');
  console.error('请先配置 config/secrets.env（百度/Bing 密钥），再执行 npm run scf:package');
  process.exit(1);
}

rmrf(OUT_DIR);
fs.mkdirSync(OUT_DIR, { recursive: true });

copyFile(path.join(ROOT, 'scf/seo-push/index.js'), path.join(OUT_DIR, 'index.js'));
copyDir(path.join(ROOT, 'lib'), path.join(OUT_DIR, 'lib'));
fs.writeFileSync(
  path.join(OUT_DIR, 'lib', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
  'utf8',
);
copyDir(path.join(ROOT, 'scripts'), path.join(OUT_DIR, 'scripts'));
fs.mkdirSync(path.join(OUT_DIR, 'config'), { recursive: true });
copyFile(path.join(ROOT, 'config/sites.json'), path.join(OUT_DIR, 'config/sites.json'));
copyFile(secrets, path.join(OUT_DIR, 'config', 'sites-secrets.json'));

const scfEnv = [
  'BAIDU_SCHEDULE_ENABLED=true',
  'PUSH_QUEUE_DIR=/tmp/push-queue',
  'SCHEDULE_DATA_DIR=/tmp/schedule-data',
  '# 若已挂载 COS 到 /mnt/queue，可改为：PUSH_QUEUE_DIR=/mnt/queue',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'config', 'scf.env'), scfEnv + '\n', 'utf8');

fs.mkdirSync(path.join(OUT_DIR, 'data'), { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, 'package.json'),
  JSON.stringify(
    {
      name: 'seo-schedule-push',
      private: true,
      dependencies: {
        axios: '^1.7.0',
      },
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log('[scf:package] 安装生产依赖（axios）…');
execSync('npm install --omit=dev --no-audit --no-fund', { cwd: OUT_DIR, stdio: 'inherit' });

rmrf(ZIP);
fs.mkdirSync(path.dirname(ZIP), { recursive: true });
execSync(`cd "${OUT_DIR}" && zip -r "${ZIP}" .`, { stdio: 'inherit' });

console.log(`\n[scf:package] 完成: ${ZIP}`);
console.log('[scf:package] 已含 node_modules（axios），执行方法：index.main');
console.log('[scf:package] 不必配置 SITES_SECRETS_JSON');
