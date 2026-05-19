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
  const [lighthouseMax, setLighthouseMax] = useState(3);
  const [siteAuditMax, setSiteAuditMax] = useState(25);
  const [engineRules, setEngineRules] = useState(true);
  const [engineLighthouse, setEngineLighthouse] = useState(false);
  const [engineSiteAudit, setEngineSiteAudit] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [auditSecret, setAuditSecret] = useState('');
  const [requiresSecret, setRequiresSecret] = useState(false);
  const [cloudHosted, setCloudHosted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);
  const [siteAuditData, setSiteAuditData] = useState(null);

  const loadLatest = () => {
    fetch('/api/audit/latest')
      .then((r) => r.json())
      .then((d) => {
        if (!d.empty) setData(d);
      })
      .catch(() => {});
    fetch('/api/audit/site-audit-seo')
      .then((r) => r.json())
      .then((d) => {
        if (!d.empty) setSiteAuditData(d);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadLatest();
  }, []);

  useEffect(() => {
    fetch('/api/audit/config')
      .then((r) => r.json())
      .then((d) => {
        setRequiresSecret(Boolean(d.requiresSecret));
        if (d.cloudHosted) {
          setCloudHosted(true);
          setEngineLighthouse(false);
          setEngineSiteAudit(false);
          setMaxPages((n) => Math.min(n, d.cloudLimits?.maxRulesPages || 10));
        }
      })
      .catch(() => {});
  }, []);

  const run = () => {
    if (!engineRules && !engineLighthouse && !engineSiteAudit) {
      setErr('请至少选择一种审计引擎。');
      return;
    }
    if (requiresSecret && !auditSecret.trim()) {
      setErr('请输入审计密钥（与服务端 AUDIT_RUN_SECRET 一致）。');
      return;
    }
    setErr('');
    setLoading(true);
    const secret = auditSecret.trim();
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    const engines = [];
    if (engineRules) engines.push('rules');
    if (engineLighthouse) engines.push('lighthouse');
    if (engineSiteAudit) engines.push('site-audit-seo');

    fetch('/api/audit/run', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        maxPages,
        lighthouseMaxPages: lighthouseMax,
        siteAuditMaxPages: siteAuditMax,
        keywords,
        engines,
        ...(secret ? { secret } : {}),
      }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        setData(j);
        if (j.siteAuditSeo) loadLatest();
      })
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
        支持三种引擎：<strong>规则审计</strong>（内置）、<strong>Lighthouse</strong>（本机
        Chrome）、<strong>site-audit-seo</strong>（整站爬虫 + 可选 Lighthouse 字段）。结果写入{' '}
        <code>data/</code>。
      </p>

      {cloudHosted ? (
        <div className="card card-inset" style={{ marginBottom: 16, borderColor: 'var(--color-warn)' }}>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>
            <strong>云托管模式</strong>：网关约 60 秒超时，仅支持<strong>规则审计</strong>（建议 ≤10
            页）。Lighthouse / site-audit-seo 请在本机执行{' '}
            <code>npm run audit:lighthouse</code>、<code>npm run audit:site-audit-seo</code>。
          </p>
        </div>
      ) : null}

      <div className="card">
        <h2>审计引擎</h2>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={engineRules}
              onChange={(e) => setEngineRules(e.target.checked)}
            />{' '}
            规则审计（title / meta / H1 / alt，默认）
          </label>
          <label style={{ display: 'block', marginBottom: 8, opacity: cloudHosted ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={engineLighthouse}
              disabled={cloudHosted}
              onChange={(e) => setEngineLighthouse(e.target.checked)}
            />{' '}
            Lighthouse（前 {lighthouseMax} 页，较慢，需本机 Chrome）
          </label>
          <label style={{ display: 'block', opacity: cloudHosted ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={engineSiteAudit}
              disabled={cloudHosted}
              onChange={(e) => setEngineSiteAudit(e.target.checked)}
            />{' '}
            site-audit-seo 整站爬虫（最多 {siteAuditMax} 页，含 Lighthouse 字段，首次会下载 CLI）
          </label>
        </div>

        <h2 style={{ fontSize: '0.95rem' }}>运行参数</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <label>
            <div className="muted">规则/Lighthouse 页数</div>
            <input
              type="number"
              min={1}
              max={cloudHosted ? 10 : 80}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              style={{ padding: 8, width: 100, borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          </label>
          <label>
            <div className="muted">Lighthouse 页数</div>
            <input
              type="number"
              min={1}
              max={10}
              value={lighthouseMax}
              onChange={(e) => setLighthouseMax(Number(e.target.value))}
              style={{ padding: 8, width: 80, borderRadius: 8, border: '1px solid var(--color-border)' }}
            />
          </label>
          <label>
            <div className="muted">site-audit-seo 页数</div>
            <input
              type="number"
              min={1}
              max={100}
              value={siteAuditMax}
              onChange={(e) => setSiteAuditMax(Number(e.target.value))}
              style={{ padding: 8, width: 80, borderRadius: 8, border: '1px solid var(--color-border)' }}
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
              <div className="muted">审计密钥</div>
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
        <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: '0.88rem' }}>
          终端亦可运行：<code>npm run audit:lighthouse</code>、{' '}
          <code>npm run audit:site-audit-seo</code>
        </p>
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
              平均得分：<strong>{data.avgScore}</strong> · 已审计：
              <strong>{data.auditedPages}</strong>
              {data.engines?.length ? (
                <span className="muted"> · 引擎：{data.engines.join(', ')}</span>
              ) : null}
            </p>
            {data.topIssues?.length ? (
              <>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>常见问题 TOP</h3>
                <ul className="muted" style={{ marginTop: 0 }}>
                  {data.topIssues.map((t, i) => (
                    <li key={i}>
                      {t.message} <span className="badge badge-warn">{t.count} 次</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          {chartOption ? (
            <div className="card">
              <h2>低分页面（至多 18 条）</h2>
              <ReactECharts option={chartOption} style={{ height: 360 }} opts={{ renderer: 'svg' }} />
            </div>
          ) : null}

          <PageTable title="审计明细" pages={data.pages} />
        </>
      )}

      {siteAuditData && !siteAuditData.empty ? (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>
            site-audit-seo 爬虫结果{' '}
            <span className="badge badge-ok">{siteAuditData.auditDate}</span>
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            共 <strong>{siteAuditData.auditedPages}</strong> 页
            {siteAuditData.jsonPath ? (
              <>
                {' '}
                · 原始 JSON：<code>{siteAuditData.jsonPath}</code>
              </>
            ) : null}
          </p>
          <PageTable title="页面列表" pages={siteAuditData.pages} showLh />
        </div>
      ) : null}
    </main>
  );
}

function PageTable({ title, pages, showLh }) {
  if (!pages?.length) return null;
  return (
    <>
      <h3 style={{ fontSize: '0.95rem' }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="table-simple">
          <thead>
            <tr>
              <th>URL</th>
              <th>得分</th>
              {showLh ? <th>LH SEO</th> : <th>引擎</th>}
              <th>首要问题</th>
            </tr>
          </thead>
          <tbody>
            {pages
              .slice()
              .sort((a, b) => a.score - b.score)
              .map((p, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: 320, wordBreak: 'break-all' }}>
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.url}
                    </a>
                  </td>
                  <td>
                    <span className={`badge ${scoreClass(p.score)}`}>{p.score}</span>
                  </td>
                  <td className="muted">
                    {showLh
                      ? p.lighthouse?.seo ?? p.details?.lighthouse_scores_seo ?? '—'
                      : (p.engines || []).join(', ') || 'rules'}
                  </td>
                  <td className="muted">{p.issues?.[0]?.message || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
