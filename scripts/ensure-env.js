#!/usr/bin/env node
/**
 * 若项目根目录不存在 .env.local，则从 config/app.env 复制一份，便于 clone 后 npm install 即可运行。
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.join(root, '.env.local');
const source = path.join(root, 'config', 'app.env');

if (process.env.SEO_SKIP_ENV_BOOTSTRAP === '1') {
  process.exit(0);
}

try {
  if (fs.existsSync(target)) {
    process.exit(0);
  }
  if (!fs.existsSync(source)) {
    console.warn('[ensure-env] 缺少 config/app.env，跳过');
    process.exit(0);
  }
  fs.copyFileSync(source, target);
  console.log('[ensure-env] 已从 config/app.env 创建 .env.local，可按需编辑后重启 dev');
} catch (e) {
  console.warn('[ensure-env]', e.message);
  process.exit(0);
}
