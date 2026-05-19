import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('./load-env').loadProjectEnv();

async function main() {
  const { runScheduledPushAllSites } = await import('../lib/run-scheduled-push.js');
  try {
    const results = await runScheduledPushAllSites({ trigger: 'cli' });
    console.log(JSON.stringify(results, null, 2));
    const failed = results.filter((r) => !r.ok);
    if (failed.length) process.exit(1);
  } catch (e) {
    console.error((e as Error).message || e);
    process.exit(1);
  }
}

main();
