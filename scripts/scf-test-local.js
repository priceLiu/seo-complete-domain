#!/usr/bin/env node
/**
 * 本地模拟 SCF 一次执行（与云端 index.main 相同逻辑）
 * 用法：npm run scf:test
 */
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PKG = path.join(ROOT, 'dist', 'scf-seo-push');

if (!require('fs').existsSync(PKG)) {
  execSync('npm run scf:package', { cwd: ROOT, stdio: 'inherit' });
}

process.chdir(PKG);
process.env.PUSH_QUEUE_DIR = process.env.PUSH_QUEUE_DIR || '/tmp/scf-test-queue';
process.env.SCHEDULE_DATA_DIR = process.env.SCHEDULE_DATA_DIR || '/tmp/scf-test-schedule';

const event = {
  Type: 'Timer',
  TriggerName: 'seo-push-daily-local-test',
  Message: 'local test',
};

execSync(
  `node --input-type=module -e "import { main } from './index.js'; const r = await main(${JSON.stringify(event)}); console.log('\\n--- response ---\\n', r.body);"`,
  { cwd: PKG, stdio: 'inherit', env: process.env },
);
