'use client';

import { useCallback, useEffect, useState } from 'react';
import { describeScheduleLastRun } from '@/lib/format-run-record';
import { useSite } from '../components/SiteProvider';

export default function BaiduSchedulePanel({ requiresSecret, auditSecret }) {
  const { activeId } = useSite();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  /** 本次点击「推送今日一批」的即时结果（与 lastRun 历史记录分开） */
  const [justRan, setJustRan] = useState(null);

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
    setJustRan(null);
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
      .then((j) => {
        setJustRan(j.record || null);
        load();
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  if (!status) return null;

  const last = status.lastRuns?.baidu || status.lastRun;
  const lastDesc = describeScheduleLastRun(last);
  const q = status.queue;
  const todayFull =
    q && status.dailyLimit && (q.daily?.successCount ?? 0) >= status.dailyLimit;

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
      <div
        style={{
          margin: '0 0 12px',
          padding: 10,
          borderRadius: 8,
          background: 'var(--color-surface-2, rgba(0,0,0,0.03))',
          fontSize: '0.88rem',
        }}
      >
        <div className="muted" style={{ marginBottom: 4 }}>
          {lastDesc.title}
          {lastDesc.isStale ? (
            <span className="badge badge-warn" style={{ marginLeft: 8 }}>
              较早记录
            </span>
          ) : null}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {lastDesc.detail}
        </p>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>
          说明：此处为<strong>队列/定时任务</strong>写入磁盘的上一次结果，与下方「手动 URL / Sitemap
          推送」的返回<strong>不是同一次操作</strong>。若显示失败但下方刚推送成功，以本次手动结果为准。
        </p>
      </div>
      {todayFull ? (
        <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.88rem' }}>
          本应用记录的今日额度已用满（{q.daily?.successCount}/{status.dailyLimit}
          ），百度 API 可能返回 <code>remain: 0</code> 或不再接受新 URL。
        </p>
      ) : null}
      {justRan ? (
        <div
          className="card"
          style={{ marginBottom: 12, padding: 12, border: '1px solid var(--color-border)' }}
        >
          <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>本次「推送今日一批」结果</h4>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            {justRan.ok ? (
              <>
                成功 · 本批 <strong>{justRan.batchSize ?? 0}</strong> 条
                {justRan.message ? ` · ${justRan.message}` : ''}
                {justRan.push?.lastRemain != null ? (
                  <>
                    {' '}
                    · 百度剩余 <strong>{justRan.push.lastRemain}</strong>
                  </>
                ) : null}
              </>
            ) : (
              <span className="issue-high">失败：{justRan.error}</span>
            )}
          </p>
        </div>
      ) : null}
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
