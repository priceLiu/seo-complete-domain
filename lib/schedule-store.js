import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LAST_FILE = path.join(DATA_DIR, 'baidu-schedule-last.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readScheduleLastRun() {
  ensureDir();
  if (!fs.existsSync(LAST_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(LAST_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function writeScheduleLastRun(record) {
  ensureDir();
  fs.writeFileSync(LAST_FILE, JSON.stringify(record, null, 2), 'utf8');
}
