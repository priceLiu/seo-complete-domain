import fs from 'fs';
import path from 'path';

const DATA_DIR =
  process.env.SCHEDULE_DATA_DIR || path.join(process.cwd(), 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function lastFile(engine) {
  if (engine) return path.join(DATA_DIR, `schedule-last-${engine}.json`);
  return path.join(DATA_DIR, 'baidu-schedule-last.json');
}

export function readScheduleLastRun(engine) {
  ensureDir();
  const p = lastFile(engine);
  if (!fs.existsSync(p)) {
    if (engine) return null;
    return readScheduleLastRun('baidu');
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function writeScheduleLastRun(record, engine) {
  ensureDir();
  const eng = engine || record?.engine || 'baidu';
  fs.writeFileSync(lastFile(eng), JSON.stringify(record, null, 2), 'utf8');
  if (eng !== 'baidu') {
    fs.writeFileSync(lastFile('baidu'), JSON.stringify(record, null, 2), 'utf8');
  }
}
