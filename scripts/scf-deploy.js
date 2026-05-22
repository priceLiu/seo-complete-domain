#!/usr/bin/env node
/**
 * 上传 dist/scf-seo-push.zip 到腾讯云 SCF
 *
 * 环境变量（任选其一）：
 *   TENCENT_SECRET_ID + TENCENT_SECRET_KEY
 * 或已配置 ~/.tccli/default.credential（tccli configure）
 *
 * 可选：
 *   SCF_REGION=ap-guangzhou
 *   SCF_FUNCTION_NAME=seo-schedule-push
 *   SCF_NAMESPACE=default
 *
 * 用法：npm run scf:package && npm run scf:upload
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseEnvFile } = require('./env-parse');

const SECRETS = path.join(__dirname, '..', 'config', 'secrets.env');
if (fs.existsSync(SECRETS)) {
  const env = parseEnvFile(SECRETS);
  for (const k of ['TENCENT_SECRET_ID', 'TENCENT_SECRET_KEY', 'SCF_REGION', 'SCF_FUNCTION_NAME']) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }
}

const ROOT = path.join(__dirname, '..');
const ZIP = path.join(ROOT, 'dist', 'scf-seo-push.zip');
const REGION = process.env.SCF_REGION || 'ap-guangzhou';
const FUNCTION_NAME = process.env.SCF_FUNCTION_NAME || 'seo-schedule-push';
const NAMESPACE = process.env.SCF_NAMESPACE || 'default';

function ensureZip() {
  if (!fs.existsSync(ZIP)) {
    execSync('npm run scf:package', { cwd: ROOT, stdio: 'inherit' });
  }
  const stat = fs.statSync(ZIP);
  console.log(`[scf:upload] zip: ${ZIP} (${(stat.size / 1024).toFixed(1)} KB)`);
}

function uploadViaTccli() {
  const zipB64 = fs.readFileSync(ZIP).toString('base64');
  const b64Path = path.join(ROOT, 'dist', 'scf-upload.b64');
  fs.writeFileSync(b64Path, zipB64);

  const cmd = [
    'tccli scf UpdateFunctionCode',
    `--region ${REGION}`,
    `--FunctionName ${FUNCTION_NAME}`,
    '--Handler index.main',
    `--ZipFile file://${b64Path}`,
  ];
  if (NAMESPACE && NAMESPACE !== 'default') {
    cmd.push(`--Namespace ${NAMESPACE}`);
  }

  console.log(`[scf:upload] 更新函数 ${FUNCTION_NAME} @ ${REGION} …`);
  const out = execSync(cmd.join(' '), {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  fs.unlinkSync(b64Path);
  console.log(out);
  console.log('[scf:upload] 完成。请在控制台「测试」并检查「触发管理」是否有定时触发器。');
}

function main() {
  ensureZip();
  try {
    execSync('tccli --version', { stdio: 'pipe' });
  } catch {
    console.error('[scf:upload] 未安装 tccli：pip3 install tccli');
    process.exit(1);
  }
  try {
    uploadViaTccli();
  } catch (e) {
    const msg = e.stderr?.toString() || e.stdout?.toString() || e.message;
    console.error('[scf:upload] 失败：', msg);
    console.error(`
请任选一种方式：
1. 配置密钥后重试：
   export TENCENT_SECRET_ID=你的SecretId
   export TENCENT_SECRET_KEY=你的SecretKey
   tccli configure set secretId $TENCENT_SECRET_ID secretKey $TENCENT_SECRET_KEY region ${REGION}
   npm run scf:upload

2. 控制台手动上传：${ZIP}
   函数 → 函数代码 → 本地上传 zip → 执行方法 index.main
`);
    process.exit(1);
  }
}

main();
