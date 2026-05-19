'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSite } from '../components/SiteProvider';

export default function BaiduSchedulePanel({ requiresSecret, auditSecret }) {
  const { activeId } = useSite();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const q = activeId ? `?siteId=${encodeURIComponent(activeId)}` : '';
    fetch(`/api/baidu/schedule${q}`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    load();
  }, [load, activeId]);

  const runNow = () => {
    if (requiresSecret && !auditSecret?.trim()) {
      setErr('请先填写审计密钥。');
      return;
    }
    setErr('');
    setLoading(true);
    const secret = auditSecret?.trim() || '';
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    fetch('/api/baidu/schedule', {
      method: 'POST',
      headers,
      body: JSON.stringify({ siteId: activeId, ...(secret ? { secret } : {}) }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then(() => load())
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  if (!status) return null;

  const last = status.lastRun;
  const q = status.queue;

  return (
    <div className="card card-inset">
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px' }}>定时队列推送</h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
        站点与每日额度见 <code>config/sites.json</code>；全局开关 <code>BAIDU_SCHEDULE_ENABLED</code>。
        本地守护：<code>npm run schedule:daemon</code>；腾讯云请用{' '}
        <code>docs/deploy-tencent.md</code> 云函数定时触发（构建部署不会自动启动守护进程）。
      </p>
      <ul className="muted" style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: '0.9rem' }}>
        <li>
          状态：
          {status.enabled ? (
            <span className="badge badge-ok" style={{ marginLeft: 6 }}>
              已启用
            </span>
          ) : (
            <span className="badge badge-warn" style={{ marginLeft: 6 }}>
              未启用
            </span>
          )}
        </li>
        <li>
          每天 <strong>{status.time}</strong>（{status.timezone}）· 今日额度{' '}
          <strong>{status.dailyLimit}</strong> 条/站
        </li>
        <li>
          Sitemap：<code style={{ wordBreak: 'break-all' }}>{status.sitemapUrl}</code>
        </li>
        {q ? (
          <li>
            队列：第 {q.cycle} 轮 · {q.done}/{q.total} 已完成 · 待推 {q.pending} · 今日 {q.daily?.successCount ?? 0}/
            {status.dailyLimit}
          </li>
        ) : null}
      </ul>
      {q ? (
        <div className="progress-bar" style={{ marginBottom: 12 }}>
          <div className="progress-fill" style={{ width: `${q.percent}%` }} />
        </div>
      ) : null}
      {last ? (
        <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.88rem' }}>
          上次：{last.finishedAt || last.startedAt} ·{' '}
          {last.ok ? (
            <>
              本批 <strong>{last.batchSize ?? '—'}</strong> 条
              {last.message ? ` · ${last.message}` : ''}
            </>
          ) : (
            <span className="issue-high">失败：{last.error}</span>
          )}
        </p>
      ) : (
        <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.88rem' }}>
          尚未执行过定时任务。
        </p>
      )}
      <button type="button" className="btn btn-secondary" onClick={runNow} disabled={loading}>
        {loading ? '执行中…' : '推送今日一批'}
      </button>
      {err ? (
        <p className="issue-high" style={{ marginTop: 10, marginBottom: 0 }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
