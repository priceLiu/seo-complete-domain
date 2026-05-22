'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useSite } from '../components/SiteProvider';

const ACCENT = '#2264e6';
const OK = '#2e7d32';
const MUTED = '#5f6670';

const inputStyle = {
  width: '100%',
  padding: 8,
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  marginBottom: 8,
};

function apiState(error, count, write = false) {
  if (write) return { label: '可操作', kind: 'ok' };
  if (error) {
    const retryable = /网络不稳定|ECONNRESET|fetch failed|重试/i.test(error);
    return { label: retryable ? '拉取失败（可重试）' : '拉取失败', kind: 'err' };
  }
  if (count > 0) return { label: `已返回 ${count} 条`, kind: 'ok' };
  return { label: '已接通，暂无数据', kind: 'empty' };
}

function StatusBadge({ state }) {
  const cls =
    state.kind === 'ok'
      ? 'badge badge-ok'
      : state.kind === 'err'
        ? 'badge badge-warn'
        : 'badge';
  return <span className={cls}>{state.label}</span>;
}

export default function BingPanel() {
  const { activeId } = useSite();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [submitMode, setSubmitMode] = useState('urls');
  const [urlsText, setUrlsText] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [sitemapMax, setSitemapMax] = useState(5000);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitErr, setSubmitErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    return fetch('/api/bing/summary')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        setData(j);
        setFeedUrl((prev) => {
          if (prev) return prev;
          return j.targetSite ? `${String(j.targetSite).replace(/\/$/, '')}/sitemap.xml` : '';
        });
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.configured) return;
    fetch('/api/baidu/config')
      .then((r) => r.json())
      .then((c) => {
        const u = c.scheduleSitemapUrl || c.defaultSitemapUrl;
        if (u) setFeedUrl(u);
      })
      .catch(() => {});
  }, [data?.configured]);

  const chartOption = useMemo(() => {
    const rows = data?.traffic;
    if (!Array.isArray(rows) || !rows.length) return null;
    const slice = rows.length > 60 ? rows.slice(-60) : rows;
    return {
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: MUTED }, bottom: 0 },
      xAxis: {
        type: 'category',
        data: slice.map((r) => r.date),
        axisLabel: { rotate: 30, fontSize: 10, color: MUTED },
      },
      yAxis: {
        type: 'value',
        name: '次数',
        nameTextStyle: { color: MUTED },
        axisLabel: { color: MUTED },
        splitLine: { lineStyle: { color: '#e2e4e8' } },
      },
      series: [
        {
          name: '展示',
          type: 'line',
          smooth: true,
          data: slice.map((r) => r.impressions),
          itemStyle: { color: ACCENT },
          lineStyle: { color: ACCENT },
          symbol: 'circle',
          symbolSize: 4,
        },
        {
          name: '点击',
          type: 'line',
          smooth: true,
          data: slice.map((r) => r.clicks),
          itemStyle: { color: OK },
          lineStyle: { color: OK },
          symbol: 'circle',
          symbolSize: 4,
        },
      ],
    };
  }, [data]);

  const doSubmit = async () => {
    setSubmitErr('');
    setSubmitResult(null);
    setSubmitLoading(true);
    try {
      if (submitMode === 'sitemap') {
        if (!activeId) throw new Error('请先选择站点');
        const sitemapUrl = feedUrl.trim();
        if (!sitemapUrl) throw new Error('请填写 Sitemap URL');

        const syncRes = await fetch('/api/push/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId: activeId,
            engine: 'bing',
            action: 'sync',
            sitemapUrl,
            maxUrls: Math.min(Math.max(1, sitemapMax), 5000),
          }),
        });
        const syncJson = await syncRes.json();
        if (!syncRes.ok) throw new Error(syncJson.error || `同步失败 HTTP ${syncRes.status}`);

        const runRes = await fetch('/api/push/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId: activeId, engine: 'bing', action: 'run' }),
        });
        const runJson = await runRes.json();
        if (!runRes.ok) throw new Error(runJson.error || `推送失败 HTTP ${runRes.status}`);

        const rec = runJson.record || {};
        const q = rec.queue || syncJson.queue;
        setSubmitResult({
          mode: 'queue',
          submitted: rec.batchSize ?? 0,
          message: rec.message,
          queue: q,
        });
        window.dispatchEvent(new CustomEvent('seo-queue-refresh', { detail: { engine: 'bing' } }));
      } else {
        const payload =
          submitMode === 'feed'
            ? { mode: 'feed', feedUrl: feedUrl.trim() }
            : {
                mode: 'urls',
                urls: urlsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
              };

        const res = await fetch('/api/bing/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        setSubmitResult(j);
      }
      load();
    } catch (e) {
      setSubmitErr(e.message || String(e));
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        正在连接 Bing Webmaster API…
      </p>
    );
  }

  if (err) {
    return <p className="issue-high" style={{ margin: 0 }}>{err}</p>;
  }

  if (!data?.configured) {
    return (
      <>
        <p className="muted" style={{ marginTop: 0 }}>
          在 <a href="https://www.bing.com/webmasters/">Bing Webmaster Tools</a>{' '}
          验证站点后，于「设置 → API 访问」创建 API Key，写入{' '}
          <code>BING_WEBMASTER_API_KEY</code> 并重启应用。
        </p>
        <span className="badge badge-warn">未配置密钥</span>
      </>
    );
  }

  if (data.error) {
    return (
      <>
        <p className="issue-high" style={{ marginTop: 0 }}>{data.error}</p>
        <p className="muted" style={{ marginBottom: 0 }}>
          请确认 API Key 有效，且账号下已添加该站点。
        </p>
      </>
    );
  }

  const capabilityRows = [
    {
      id: 'submit_batch',
      name: 'URL 批量提交',
      method: 'SubmitUrlBatch',
      type: 'write',
      state: apiState(null, 0, true),
      anchor: 'bing-submit',
    },
    {
      id: 'submit_feed',
      name: 'Sitemap / Feed 提交',
      method: 'SubmitFeed',
      type: 'write',
      state: apiState(null, 0, true),
      anchor: 'bing-submit',
    },
    {
      id: 'quota',
      name: '提交配额',
      method: 'GetUrlSubmissionQuota',
      type: 'read',
      state: apiState(data.quotaError, data.quota ? 1 : 0),
      anchor: 'bing-quota',
    },
    {
      id: 'traffic',
      name: '站点流量趋势',
      method: 'GetRankAndTrafficStats',
      type: 'read',
      state: apiState(data.trafficError, data.traffic?.length || 0),
      anchor: 'bing-traffic',
    },
    {
      id: 'queries',
      name: '热门搜索词',
      method: 'GetQueryStats',
      type: 'read',
      state: apiState(data.queryStatsError, data.queryStats?.length || 0),
      anchor: 'bing-queries',
    },
    {
      id: 'pages',
      name: '热门页面',
      method: 'GetPageStats',
      type: 'read',
      state: apiState(data.pageStatsError, data.pageStats?.length || 0),
      anchor: 'bing-pages',
    },
    {
      id: 'crawl_issues',
      name: '抓取问题',
      method: 'GetCrawlIssues',
      type: 'read',
      state: apiState(data.crawlIssuesError, data.crawlIssues?.length || 0),
      anchor: 'bing-crawl',
    },
  ];

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        目标站 <code>{data.targetSite}</code>
        {data.matchedSite ? (
          <>
            {' '}
            → Bing：<code>{data.matchedSite.url}</code>
            {data.matchedSite.verified ? (
              <span className="badge badge-ok" style={{ marginLeft: 8 }}>
                已接通
              </span>
            ) : (
              <span className="badge badge-warn" style={{ marginLeft: 8 }}>
                未验证
              </span>
            )}
          </>
        ) : (
          <span className="badge badge-warn" style={{ marginLeft: 8 }}>
            未匹配到同域站点
          </span>
        )}
      </p>

      <p className="muted" style={{ fontSize: '0.88rem' }}>{data.indexNote}</p>

      <h3 style={{ fontSize: '0.95rem', margin: '16px 0 10px' }}>API 接通状态</h3>
      <div className="bing-cap-grid">
        {capabilityRows.map((c) => (
          <a
            key={c.id}
            href={`#${c.anchor}`}
            className="bing-cap-card"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="bing-cap-card-head">
              <strong>{c.name}</strong>
              <StatusBadge state={c.state} />
            </div>
            <code style={{ fontSize: '0.8rem' }}>{c.method}</code>
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {c.type === 'write' ? '主动提交' : '查询'}
            </span>
          </a>
        ))}
      </div>

      <section id="bing-submit" className="bing-api-section">
        <h3>主动提交 · SubmitUrlBatch / SubmitFeed</h3>
        {!data.matchedSite?.verified ? (
          <p className="muted">请先在 Bing Webmaster 完成站点验证后再提交。</p>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  checked={submitMode === 'urls'}
                  onChange={() => setSubmitMode('urls')}
                />{' '}
                URL 列表（SubmitUrlBatch）
              </label>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  checked={submitMode === 'sitemap'}
                  onChange={() => setSubmitMode('sitemap')}
                />{' '}
                Sitemap 队列推送（续点，推荐）
              </label>
              <label>
                <input
                  type="radio"
                  checked={submitMode === 'feed'}
                  onChange={() => setSubmitMode('feed')}
                />{' '}
                仅 SubmitFeed
              </label>
            </div>

            {(submitMode === 'sitemap' || submitMode === 'feed') && (
              <>
                <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                  Sitemap / Feed URL
                </label>
                <input
                  type="url"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  style={inputStyle}
                />
              </>
            )}

            {submitMode === 'sitemap' && (
              <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.88rem' }}>
                先同步 Sitemap 进队列，再按 <code>config/sites.json</code> 的{' '}
                <code>bingDailyLimit</code> 推送<strong>今日一批</strong>；已推送 URL 会标记完成，次日自动续推未完成的，整轮结束后下一轮。与上方「Bing
                推送队列」相同逻辑。
              </p>
            )}
            {submitMode === 'sitemap' && (
              <>
                <label className="muted" style={{ display: 'block', margin: '8px 0 6px' }}>
                  同步进队列时最多导入 URL 数（≤5000）
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={sitemapMax}
                  onChange={(e) => setSitemapMax(Number(e.target.value))}
                  style={{ ...inputStyle, width: 120 }}
                />
              </>
            )}

            {submitMode === 'urls' && (
              <>
                <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                  每行一个 URL
                </label>
                <textarea
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  rows={5}
                  placeholder="https://www.ai-code8.com/page-1"
                  style={{ ...inputStyle, fontFamily: 'inherit' }}
                />
              </>
            )}

            <button type="button" className="btn" disabled={submitLoading} onClick={doSubmit}>
              {submitLoading
                ? '提交中…'
                : submitMode === 'sitemap'
                  ? '同步并推送今日一批'
                  : '提交到 Bing'}
            </button>
            {submitErr ? <p className="issue-high">{submitErr}</p> : null}
            {submitResult ? (
              <p style={{ color: 'var(--color-ok)', marginTop: 8 }}>
                成功：
                {submitResult.mode === 'feed'
                  ? `已登记 Feed ${submitResult.feedUrl}`
                  : submitResult.mode === 'queue'
                    ? `本次推送 ${submitResult.submitted ?? 0} 条${
                        submitResult.queue
                          ? ` · 队列 ${submitResult.queue.done}/${submitResult.queue.total} 已完成 · 待推 ${submitResult.queue.pending}`
                          : ''
                      }${submitResult.message ? ` · ${submitResult.message}` : ''}`
                    : `已提交 ${submitResult.submitted} 条 URL（一次性，不续点）`}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section id="bing-quota" className="bing-api-section">
        <h3>
          提交配额 · GetUrlSubmissionQuota{' '}
          <StatusBadge state={apiState(data.quotaError, data.quota ? 1 : 0)} />
        </h3>
        {data.quotaError ? (
          <p className="issue-high">{data.quotaError}</p>
        ) : data.quota ? (
          <p>
            每日可提交 <strong>{data.quota.dailyQuota}</strong> 条 · 每月{' '}
            <strong>{data.quota.monthlyQuota}</strong> 条
          </p>
        ) : (
          <p className="muted">未返回配额数据。</p>
        )}
      </section>

      <section id="bing-traffic" className="bing-api-section">
        <h3>
          站点流量趋势 · GetRankAndTrafficStats{' '}
          <StatusBadge state={apiState(data.trafficError, data.traffic?.length || 0)} />
        </h3>
        {data.trafficError ? (
          <p className="issue-high">{data.trafficError}</p>
        ) : chartOption ? (
          <ReactECharts option={chartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
        ) : (
          <p className="muted">暂无按日展示/点击数据（新站或未产生搜索流量时常见）。</p>
        )}
      </section>

      <section id="bing-queries" className="bing-api-section">
        <h3>
          热门搜索词 · GetQueryStats{' '}
          <StatusBadge state={apiState(data.queryStatsError, data.queryStats?.length || 0)} />
        </h3>
        <DataTable
          error={data.queryStatsError}
          rows={data.queryStats}
          col1="query"
          col1Label="查询词"
        />
      </section>

      <section id="bing-pages" className="bing-api-section">
        <h3>
          热门页面 · GetPageStats{' '}
          <StatusBadge state={apiState(data.pageStatsError, data.pageStats?.length || 0)} />
        </h3>
        <DataTable
          error={data.pageStatsError}
          rows={data.pageStats}
          col1="url"
          col1Label="页面 URL"
        />
      </section>

      <section id="bing-crawl" className="bing-api-section">
        <h3>
          抓取问题 · GetCrawlIssues{' '}
          <StatusBadge state={apiState(data.crawlIssuesError, data.crawlIssues?.length || 0)} />
        </h3>
        <DataTable
          error={data.crawlIssuesError}
          rows={data.crawlIssues}
          col1="url"
          col1Label="URL"
          col2="issue"
          col2Label="问题"
          hideMetrics
          emptyHint="接口已接通，当前无抓取问题记录（表示 Bing 未报告异常 URL，属于正常情况）。"
        />
      </section>

      {data.sites?.length > 0 ? (
        <details style={{ marginTop: 16 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>
            账号站点列表 · GetUserSites
          </summary>
          <table className="table-simple" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>URL</th>
                <th>验证</th>
              </tr>
            </thead>
            <tbody>
              {data.sites.map((s, i) => (
                <tr key={i}>
                  <td style={{ wordBreak: 'break-all' }}>{s.url}</td>
                  <td>{s.verified ? '是' : '否'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      <button type="button" className="btn btn-secondary" onClick={load} style={{ marginTop: 12 }}>
        刷新全部数据
      </button>
    </>
  );
}

function DataTable({ error, rows, col1, col1Label, col2, col2Label, hideMetrics, emptyHint }) {
  if (error) {
    return <p className="issue-high">拉取失败：{error}</p>;
  }
  if (!rows?.length) {
    return (
      <p className="muted">
        {emptyHint ||
          '接口已接通，当前无记录（数据可能按周更新或站点尚无搜索表现）。'}
      </p>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table-simple">
        <thead>
          <tr>
            <th>{col1Label}</th>
            {col2 ? <th>{col2Label}</th> : null}
            {!hideMetrics ? (
              <>
                <th>展示</th>
                <th>点击</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ wordBreak: 'break-all' }}>{r[col1]}</td>
              {col2 ? <td>{r[col2]}</td> : null}
              {!hideMetrics ? (
                <>
                  <td>{r.impressions ?? '—'}</td>
                  <td>{r.clicks ?? '—'}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
