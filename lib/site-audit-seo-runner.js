import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'data', 'site-audit-seo');

function hostFromUrl(siteUrl) {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./i, '');
  } catch {
    return 'site';
  }
}

function findNewestJson(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0] ? path.join(dir, files[0].name) : null;
}

function rowToPage(row) {
  const seoLh = row.lighthouse_scores_seo ?? row['lighthouse_scores_seo'];
  const seoScore =
    seoLh != null && !Number.isNaN(Number(seoLh))
      ? Math.round(Number(seoLh) <= 1 ? Number(seoLh) * 100 : Number(seoLh))
      : null;

  let score = seoScore ?? 70;
  const issues = [];
  if (row.h1_count === 0 || row.h1_count === '0') {
    issues.push({
      severity: 'high',
      message: '缺少 H1（site-audit-seo）',
      recommendation: '每页保留一个 H1。',
    });
    score = Math.min(score, 60);
  }
  if (row.images_without_alt > 0) {
    issues.push({
      severity: 'med',
      message: `${row.images_without_alt} 张图无 alt`,
      recommendation: '补充图片 alt 文本。',
    });
    score -= 5;
  }

  return {
    url: row.url,
    score: Math.max(0, Math.min(100, Math.round(score))),
    issues,
    details: {
      source: 'site-audit-seo',
      title: row.title,
      description: row.description,
      h1: row.h1,
      h1_count: row.h1_count,
      status: row.status,
      depth: row.depth,
      lighthouse_scores_performance: row.lighthouse_scores_performance,
      lighthouse_scores_seo: row.lighthouse_scores_seo,
      lighthouse_scores_accessibility: row.lighthouse_scores_accessibility,
    },
    engines: ['site-audit-seo'],
    lighthouse:
      seoScore != null
        ? {
            performance: pct(row.lighthouse_scores_performance),
            seo: seoScore,
            accessibility: pct(row.lighthouse_scores_accessibility),
            bestPractices: pct(row.lighthouse_scores_best_practices),
          }
        : undefined,
  };
}

function pct(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.round(n <= 1 ? n * 100 : n);
}

/**
 * 调用 site-audit-seo CLI（经 npx，首次会下载依赖）。
 * @param {string} siteUrl
 * @param {{ maxPages?: number, preset?: string, withLighthouse?: boolean }} opts
 */
export function runSiteAuditSeo(siteUrl, opts = {}) {
  const maxPages = Math.min(Math.max(opts.maxPages || 20, 1), 100);
  const preset = opts.preset || 'seo-minimal';
  const withLighthouse = opts.withLighthouse !== false;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const before = findNewestJson(OUT_DIR);
  const beforeMtime = before ? fs.statSync(before).mtimeMs : 0;

  const args = [
    'site-audit-seo@6',
    '-u',
    siteUrl,
    '-m',
    String(maxPages),
    '--preset',
    preset,
    '--out-dir',
    OUT_DIR,
    '--no-remove-json',
    '--json',
    '--delay',
    '200',
  ];
  if (withLighthouse) args.push('--lighthouse');

  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {
      cwd: process.cwd(),
      env: { ...process.env, CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (e) => {
      reject(
        new Error(
          `无法启动 site-audit-seo：${e.message}。请确认已安装 Node，或在本机执行 npx site-audit-seo@6 --help`,
        ),
      );
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `site-audit-seo 退出码 ${code}${stderr ? `：${stderr.slice(-400)}` : ''}`,
          ),
        );
        return;
      }
      try {
        const jsonPath = findNewestJson(OUT_DIR);
        if (!jsonPath || fs.statSync(jsonPath).mtimeMs <= beforeMtime) {
          reject(new Error('未找到 site-audit-seo 输出的 JSON 文件'));
          return;
        }
        const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const rows = Array.isArray(raw) ? raw : raw.pages || raw.data || [];
        const pages = rows.filter((r) => r?.url).map(rowToPage);
        resolve({
          jsonPath,
          host: hostFromUrl(siteUrl),
          pages,
          rowCount: rows.length,
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export { OUT_DIR as SITE_AUDIT_SEO_OUT_DIR };
