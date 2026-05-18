import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('./load-env').loadProjectEnv();

async function main() {
  const { runScheduledBaiduPush } = await import('../lib/run-scheduled-baidu-push.js');
  try {
    const r = await runScheduledBaiduPush({ trigger: 'cli' });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error((e as Error).message || e);
    process.exit(1);
  }
}

main();
