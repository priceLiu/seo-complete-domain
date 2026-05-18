/**
 * 独立定时进程：与 Next 并行运行，按 BAIDU_SCHEDULE_* 执行 Sitemap 推送。
 * 例：npm run schedule:daemon
 */
import { createRequire } from 'node:module';
import cron from 'node-cron';

const require = createRequire(import.meta.url);
require('./load-env').loadProjectEnv();

async function main() {
  const { getScheduleConfig, isScheduleEnabled } = await import('../lib/schedule-config.js');
  const { runScheduledBaiduPush } = await import('../lib/run-scheduled-baidu-push.js');

  if (!isScheduleEnabled()) {
    console.log('[baidu-schedule] BAIDU_SCHEDULE_ENABLED 未开启，退出');
    process.exit(0);
  }

  const cfg = getScheduleConfig();
  if (!cron.validate(cfg.cronExpr)) {
    console.error('[baidu-schedule] 无效 cron:', cfg.cronExpr);
    process.exit(1);
  }

  console.log(
    `[baidu-schedule] 守护进程已启动：每天 ${cfg.time}（${cfg.cronExpr}，${cfg.timezone}）→ ${cfg.sitemapUrl}`,
  );
  console.log('[baidu-schedule] 手动执行一次：npm run schedule:run');

  cron.schedule(
    cfg.cronExpr,
    async () => {
      console.log('[baidu-schedule] 定时任务开始', new Date().toISOString());
      try {
        const r = await runScheduledBaiduPush({ trigger: 'cron' });
        console.log('[baidu-schedule] 完成', r.push?.urlCount, '条, success≈', r.push?.totalSuccess);
      } catch (e) {
        console.error('[baidu-schedule] 失败:', (e as Error).message || e);
      }
    },
    { timezone: cfg.timezone },
  );
}

main().catch((e) => {
  console.error('[baidu-schedule] 启动失败:', (e as Error).message || e);
  process.exit(1);
});
