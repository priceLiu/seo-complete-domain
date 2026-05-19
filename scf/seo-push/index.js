/**
 * 腾讯云 SCF（Node 18+，package.json type=module）
 * 执行方法：index.main 或 index.main_handler（二选一）
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

process.chdir(ROOT);

if (!process.env.PUSH_QUEUE_DIR) {
  process.env.PUSH_QUEUE_DIR = fs.existsSync('/mnt/queue') ? '/mnt/queue' : '/tmp/push-queue';
}
if (!process.env.SCHEDULE_DATA_DIR) {
  process.env.SCHEDULE_DATA_DIR = '/tmp/schedule-data';
}

const require = createRequire(import.meta.url);
try {
  require(path.join(ROOT, 'scripts', 'load-env.js')).loadProjectEnv();
} catch {
  /* 仅 SCF 环境变量时可忽略 */
}

async function runPushJob() {
  const started = new Date().toISOString();
  try {
    const { runScheduledPushAllSites } = await import('./lib/run-scheduled-push.js');
    const results = await runScheduledPushAllSites({ trigger: 'scf' });
    const failed = results.filter((r) => !r.ok);
    return {
      statusCode: failed.length ? 207 : 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: failed.length === 0,
        started,
        finished: new Date().toISOString(),
        pushQueueDir: process.env.PUSH_QUEUE_DIR,
        results,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: e.message || String(e),
        started,
      }),
    };
  }
}

/** 控制台默认「执行方法」多为 index.main */
export async function main() {
  return runPushJob();
}

export async function main_handler() {
  return runPushJob();
}
