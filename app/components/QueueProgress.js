'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSite } from './SiteProvider';

const LABELS = {
  baidu: '百度',
  bing: 'Bing',
};

export default function QueueProgress({ engine = 'baidu' }) {
  const { activeId } = useSite();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const label = LABELS[engine] || engine;

  const load = useCallback(() => {
    if (!activeId) return;
    fetch(`/api/push/queue?siteId=${encodeURIComponent(activeId)}&engine=${engine}`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(e.message || String(e)));
  }, [activeId, engine]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = (action) => {
    setLoading(true);
    setErr('');
    fetch('/api/push/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: activeId, engine, action }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then(() => load())
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  const q = data?.queue;
  if (!q) return <p className="muted">{label} 队列加载中…</p>;

  if (data.credentialsConfigured === false) {
    return (
      <p className="muted">
        {label} 未配置凭据，请在 <code>config/sites-secrets.json</code> 填写。
      </p>
    );
  }

  return (
    <div className={`queue-panel queue-panel-${engine}`}>
      <div className="queue-stats">
        <div className="queue-stat">
          <span className="queue-stat-val">{q.percent}%</span>
          <span className="muted">总进度</span>
        </div>
        <div className="queue-stat">
          <span className="queue-stat-val">第 {q.cycle} 轮</span>
          <span className="muted">循环</span>
        </div>
        <div className="queue-stat">
          <span className="queue-stat-val">{q.pending}</span>
          <span className="muted">待推送</span>
        </div>
        <div className="queue-stat">
          <span className="queue-stat-val">
            {q.done}/{q.total}
          </span>
          <span className="muted">已完成</span>
        </div>
        <div className="queue-stat">
          <span className="queue-stat-val">
            {q.daily?.successCount ?? 0}/{data?.dailyLimit ?? '—'}
          </span>
          <span className="muted">今日已推</span>
        </div>
      </div>
      <div className="progress-bar" aria-hidden>
        <div className={`progress-fill progress-fill-${engine}`} style={{ width: `${q.percent}%` }} />
      </div>
      <p className="muted" style={{ fontSize: '0.88rem', margin: '10px 0' }}>
        {label}：每天按额度推一批，次日续传；整轮完成后自动下一轮。
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading}
          onClick={() => runAction('sync')}
        >
          同步 Sitemap
        </button>
        <button type="button" className="btn" disabled={loading} onClick={() => runAction('run')}>
          {loading ? '推送中…' : '推送今日一批'}
        </button>
      </div>
      {err ? <p className="issue-high">{err}</p> : null}
    </div>
  );
}
