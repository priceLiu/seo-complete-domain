import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-latest.json');

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
