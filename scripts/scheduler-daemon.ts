/**
 * 多站点 × 多引擎队列推送守护进程（百度 + Bing）。
 */
import { createRequire } from 'node:module';
import cron from 'node-cron';

const require = createRequire(import.meta.url);
require('./load-env').loadProjectEnv();

async function main() {
  const { listSites } = await import('../lib/sites.js');
  const { runScheduledPushAllSites } = await import('../lib/run-scheduled-push.js');
  const { getScheduleConfig, isScheduleEnabled } = await import('../lib/schedule-config.js');

  if (!isScheduleEnabled()) {
    console.log('[schedule] BAIDU_SCHEDULE_ENABLED 未开启，退出');
    process.exit(0);
  }

  const cfg = getScheduleConfig();
  const sites = listSites();
  console.log(
    `[schedule] 守护：每天 ${cfg.time}（${cfg.cronExpr}）· ${sites.length} 站 · 引擎 baidu+bing`,
  );
  console.log('[schedule] 手动：npm run schedule:run');

  cron.schedule(
    cfg.cronExpr,
    async () => {
      console.log('[schedule] 定时开始', new Date().toISOString());
      const results = await runScheduledPushAllSites({ trigger: 'cron' });
      for (const r of results) {
        if (r.ok) {
          console.log(
            `[schedule] ${r.siteId}/${r.engine} 本批 ${r.record?.batchSize ?? 0} · ${r.record?.queue?.percent ?? 0}%`,
          );
        } else {
          console.error(`[schedule] ${r.siteId}/${r.engine} 失败:`, r.error);
        }
      }
    },
    { timezone: cfg.timezone },
  );
}

main().catch((e) => {
  console.error('[schedule] 启动失败:', (e as Error).message || e);
  process.exit(1);
});
