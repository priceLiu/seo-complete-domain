/** 兼容旧引用；新代码请使用 run-scheduled-push.js */
export {
  runScheduledPush as runScheduledBaiduPush,
  getScheduleStatus,
} from './run-scheduled-push.js';

import { runScheduledPushAllSites } from './run-scheduled-push.js';

export async function runScheduledBaiduPushAllSites(overrides = {}) {
  return runScheduledPushAllSites({ ...overrides, engines: ['baidu'] });
}
