/**
 * 腾讯云 SCF 入口（CommonJS，供 require 加载）
 * 执行方法：index.main 或 index.main_handler
 * lib/ 为 ESM，见 lib/package.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
process.chdir(ROOT);

if (!process.env.PUSH_QUEUE_DIR) {
  process.env.PUSH_QUEUE_DIR = fs.existsSync('/mnt/queue') ? '/mnt/queue' : '/tmp/push-queue';
}
if (!process.env.SCHEDULE_DATA_DIR) {
  process.env.SCHEDULE_DATA_DIR = '/tmp/schedule-data';
}

try {
  require(path.join(ROOT, 'scripts', 'load-env.js')).loadProjectEnv();
} catch {
  /* 仅 SCF 环境变量时可忽略 */
}

async function runPushJob(event) {
  const started = new Date().toISOString();
  const triggerName =
    event?.TriggerName || event?.triggerName || event?.trigger_name || null;
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'scf-seo-push start',
      started,
      trigger: 'scf',
      timerName: triggerName,
      pushQueueDir: process.env.PUSH_QUEUE_DIR,
      scheduleDataDir: process.env.SCHEDULE_DATA_DIR,
    }),
  );
  try {
    const { runScheduledPushAllSites } = await import('./lib/run-scheduled-push.js');
    const results = await runScheduledPushAllSites({ trigger: 'scf' });
    const failed = results.filter((r) => !r.ok);
    const body = {
      ok: failed.length === 0,
      started,
      finished: new Date().toISOString(),
      pushQueueDir: process.env.PUSH_QUEUE_DIR,
      scheduleDataDir: process.env.SCHEDULE_DATA_DIR,
      timerName: triggerName,
      results,
    };
    console.log(
      JSON.stringify({
        level: failed.length ? 'warn' : 'info',
        msg: 'scf-seo-push done',
        ...body,
      }),
    );
    return {
      statusCode: failed.length ? 207 : 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

async function main_handler(event) {
  return runPushJob(event);
}

exports.main_handler = main_handler;
exports.main = main_handler;
