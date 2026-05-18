'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';

function scoreClass(s) {
  if (s >= 80) return 'badge-ok';
  if (s >= 60) return 'badge-warn';
  return 'badge-bad';
}

export default function AuditPage() {
  const [maxPages, setMaxPages] = useState(20);
  const [keywords, setKeywords] = useState('');
  const [auditSecret, setAuditSecret] = useState('');
  const [requiresSecret, setRequiresSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);

  const loadLatest = () => {
    fetch('/api/audit/latest')
      .then((r) => r.json())
      .then((d) => {
        if (!d.empty) setData(d);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadLatest();
  }, []);

  useEffect(() => {
    fetch('/api/audit/config')
      .then((r) => r.json())
      .then((d) => setRequiresSecret(Boolean(d.requiresSecret)))
      .catch(() => {});
  }, []);

  const run = () => {
    if (requiresSecret && !auditSecret.trim()) {
      setErr('请输入审计密钥（与服务端 AUDIT_RUN_SECRET 一致）。');
      return;
    }
    setErr('');
    setLoading(true);
    const secret = auditSecret.trim();
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    fetch('/api/audit/run', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        maxPages,
        keywords,
        ...(secret ? { secret } : {}),
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  const chartOption = useMemo(() => {
    if (!data?.pages?.length) return null;
    const sorted = [...data.pages].sort((a, b) => a.score - b.score).slice(0, 18);
    return {
      grid: { left: 48, right: 24, top: 24, bottom: 80 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: sorted.map((p) => {
          try {
            return new URL(p.url).pathname || p.url;
          } catch {
            return p.url.slice(-28);
          }
        }),
        axisLabel: { rotate: 38, fontSize: 10 },
      },
      yAxis: { type: 'value', min: 0, max: 100, name: '得分' },
      series: [
        {
          type: 'bar',
          data: sorted.map((p) => p.score),
          itemStyle: {
            color: (params) => {
              const v = params.value;
              if (v >= 80) return '#2e7d32';
              if (v >= 60) return '#ed6c02';
              return '#c62828';
            },
          },
        },
      ],
    };
  }, [data]);

  return (
    <main className="layout-shell">
      <h1>页面 SEO 审计</h1>
      <p className="muted">
        从目标站 <code>sitemap.xml</code> 取链接并逐页检查；结果写入本地 <code>data/audit-latest.json</code>。
      </p>

      <div className="card">
        <h2>运行参数</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <label>
            <div className="muted">最大页面数</div>
            <input
              type="number"
              min={1}
              max={80}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              style={{ padding: 8, width: 100, borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          </label>
          <label style={{ flex: '1 1 220px' }}>
            <div className="muted">关键词提示（逗号分隔，可选）</div>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="品牌词,核心词"
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          </label>
          {requiresSecret ? (
            <label style={{ flex: '1 1 200px' }}>
              <div className="muted">审计密钥（服务端已启用保护）</div>
              <input
                type="password"
                autoComplete="off"
                value={auditSecret}
                onChange={(e) => setAuditSecret(e.target.value)}
                placeholder="AUDIT_RUN_SECRET"
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}
              />
            </label>
          ) : null}
          <button type="button" className="btn" onClick={run} disabled={loading}>
            {loading ? '审计中…' : '开始审计'}
          </button>
        </div>
        {err ? (
          <p className="issue-high" style={{ marginTop: 12, marginBottom: 0 }}>
            {err}
          </p>
        ) : null}
      </div>

      {data && !data.empty && (
        <>
          <div className="card">
            <h2>
              汇总{' '}
              <span className={`badge ${scoreClass(data.avgScore)}`}>{data.auditDate}</span>
            </h2>
            <p style={{ marginTop: 0 }}>
              平均得分：<strong>{data.avgScore}</strong> · 已审计页面：
              <strong>{data.auditedPages}</strong>
            </p>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>常见问题 TOP</h3>
            <ul className="muted" style={{ marginTop: 0 }}>
              {data.topIssues?.map((t, i) => (
                <li key={i}>
                  {t.message} <span className="badge badge-warn">{t.count} 次</span>
                </li>
              ))}
            </ul>
          </div>

          {chartOption ? (
            <div className="card">
              <h2>低分页面（至多 18 条）</h2>
              <ReactECharts option={chartOption} style={{ height: 360 }} opts={{ renderer: 'svg' }} />
            </div>
          ) : null}

          <div className="card">
            <h2>明细</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-simple">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>得分</th>
                    <th>首要问题</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages
                    .slice()
                    .sort((a, b) => a.score - b.score)
                    .map((p, i) => (
                      <tr key={i}>
                        <td style={{ maxWidth: 360, wordBreak: 'break-all' }}>
                          <a href={p.url} target="_blank" rel="noreferrer">
                            {p.url}
                          </a>
                        </td>
                        <td>
                          <span className={`badge ${scoreClass(p.score)}`}>{p.score}</span>
                        </td>
                        <td className="muted">
                          {p.issues[0]?.message || '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
