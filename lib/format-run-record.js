/** 将 schedule / 队列执行记录格式化为界面文案 */

const TRIGGER_LABEL = {
  api: '页面手动触发',
  manual: '手动执行',
  schedule: '定时任务',
  queue: '队列',
  daemon: '守护进程',
};

export function formatTrigger(trigger) {
  if (!trigger) return '未知来源';
  return TRIGGER_LABEL[trigger] || trigger;
}

export function formatRunTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function formatAge(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

/**
 * @param {object|null} record schedule-last json
 * @returns {{ title: string, detail: string, isStale: boolean }}
 */
export function describeScheduleLastRun(record) {
  if (!record) {
    return {
      title: '尚无队列/定时执行记录',
      detail: '点击下方「推送今日一批」或运行 schedule:daemon 后，会在此显示最近一次结果。',
      isStale: false,
    };
  }

  const when = record.finishedAt || record.startedAt;
  const age = formatAge(when);
  const time = formatRunTime(when);
  const trigger = formatTrigger(record.trigger);
  const isStale = age.includes('天前') || (when && Date.now() - new Date(when).getTime() > 86400000);

  if (record.ok) {
    const batch = record.batchSize ?? '—';
    const msg = record.message ? ` · ${record.message}` : '';
    return {
      title: `上次队列执行（历史记录）`,
      detail: `${time}（${age || '时间未知'}）· 来源：${trigger} · 成功 · 本批 ${batch} 条${msg}`,
      isStale,
    };
  }

  return {
    title: `上次队列执行（历史记录）`,
    detail: `${time}（${age || '时间未知'}）· 来源：${trigger} · 失败：${record.error || '未知错误'}`,
    isStale,
  };
}
