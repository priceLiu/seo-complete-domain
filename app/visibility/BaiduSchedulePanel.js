'use client';

import { useCallback, useEffect, useState } from 'react';

export default function BaiduSchedulePanel({ requiresSecret, auditSecret }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    fetch('/api/baidu/schedule')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      body: JSON.stringify(secret ? { secret } : {}),
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

  return (
    <div
      className="card"
      style={{ marginBottom: 16, padding: '16px 18px', background: 'var(--color-bg)' }}
    >
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px' }}>定时 Sitemap 推送</h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
        配置见 <code>.env.local</code> 中 <code>BAIDU_SCHEDULE_*</code>。另开终端运行{' '}
        <code>npm run schedule:daemon</code> 即按下列计划自动执行；或用系统 cron 执行{' '}
        <code>npm run schedule:run</code>。
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
          每天 <strong>{status.time}</strong>（cron: <code>{status.cronExpr}</code>，{status.timezone}
          ）
        </li>
        <li>
          Sitemap：<code style={{ wordBreak: 'break-all' }}>{status.sitemapUrl}</code>
        </li>
        <li>
          单次最多 <strong>{status.maxPages}</strong> 条 URL
        </li>
      </ul>
      {last ? (
        <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.88rem' }}>
          上次执行：{last.finishedAt || last.startedAt} ·{' '}
          {last.ok ? (
            <>
              成功，约 <strong>{last.push?.totalSuccess ?? '—'}</strong> 条
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
        {loading ? '执行中…' : '立即执行一次'}
      </button>
      {err ? (
        <p className="issue-high" style={{ marginTop: 10, marginBottom: 0 }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
