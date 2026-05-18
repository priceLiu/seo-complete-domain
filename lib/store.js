import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-latest.json');
const SITE_AUDIT_SEO_FILE = path.join(DATA_DIR, 'site-audit-seo-latest.json');

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readAuditStore() {
  ensureDataDir();
  if (!fs.existsSync(AUDIT_FILE)) return null;
  try {
    const raw = fs.readFileSync(AUDIT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeAuditStore(obj) {
  ensureDataDir();
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

export function readSiteAuditSeoStore() {
  ensureDataDir();
  if (!fs.existsSync(SITE_AUDIT_SEO_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SITE_AUDIT_SEO_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function writeSiteAuditSeoStore(obj) {
  ensureDataDir();
  fs.writeFileSync(SITE_AUDIT_SEO_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
