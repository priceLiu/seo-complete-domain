function scorePct(v) {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(Number(v) * 100);
}

function extractLighthouseSummary(lhr) {
  const c = lhr.categories || {};
  const audits = lhr.audits || {};
  return {
    performance: scorePct(c.performance?.score),
    accessibility: scorePct(c.accessibility?.score),
    bestPractices: scorePct(c['best-practices']?.score),
    seo: scorePct(c.seo?.score),
    pwa: scorePct(c.pwa?.score),
    metrics: {
      fcp: audits['first-contentful-paint']?.displayValue || null,
      lcp: audits['largest-contentful-paint']?.displayValue || null,
      tbt: audits['total-blocking-time']?.displayValue || null,
      cls: audits['cumulative-layout-shift']?.displayValue || null,
    },
  };
}

/**
 * 对单 URL 运行 Lighthouse（需本机可启动 Chrome）。
 * @param {string} pageUrl
 */
export async function runLighthouseAudit(pageUrl) {
  const chromeLauncher = await import('chrome-launcher');
  const lighthouse = (await import('lighthouse')).default;

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  });

  try {
    const result = await lighthouse(pageUrl, {
      logLevel: 'error',
      output: 'json',
      port: chrome.port,
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    });
    const summary = extractLighthouseSummary(result.lhr);
    const seoScore = summary.seo ?? 0;
    const issues = [];
    if (summary.seo != null && summary.seo < 80) {
      issues.push({
        severity: summary.seo < 50 ? 'high' : 'med',
        message: `Lighthouse SEO 得分 ${summary.seo}`,
        recommendation: '按 Lighthouse 报告修复 meta、可爬取性、结构化数据等问题。',
      });
    }
    if (summary.performance != null && summary.performance < 50) {
      issues.push({
        severity: 'med',
        message: `Lighthouse 性能得分 ${summary.performance}`,
        recommendation: '优化 LCP、阻塞脚本与图片体积。',
      });
    }
    return {
      lighthouse: summary,
      lighthouseScore: seoScore,
      issues,
    };
  } finally {
    await chrome.kill();
  }
}

export function mergeLighthouseIntoAudit(pageAudit, lh) {
  if (!lh) return pageAudit;
  const combinedIssues = [...(pageAudit.issues || []), ...(lh.issues || [])];
  const lhSeo = lh.lighthouseScore ?? 0;
  const blended = Math.round((pageAudit.score * 0.5 + lhSeo * 0.5) * 10) / 10;
  return {
    ...pageAudit,
    score: Math.max(0, Math.min(100, blended)),
    issues: combinedIssues,
    details: {
      ...pageAudit.details,
      lighthouse: lh.lighthouse,
    },
    engines: [...new Set([...(pageAudit.engines || ['rules']), 'lighthouse'])],
  };
}
