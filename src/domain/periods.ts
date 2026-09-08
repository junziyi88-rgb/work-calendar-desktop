import type { SummaryKind } from '../shared/contracts';

function parseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function utcKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return utcKey(date);
}

export function weekStart(value: string) {
  const date = parseDate(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return utcKey(date);
}

export function periodRange(kind: SummaryKind, anchor: string) {
  if (kind === 'week') {
    const start = weekStart(anchor);
    return { start, end: addDays(start, 7) };
  }
  const date = parseDate(anchor);
  const start = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end: utcKey(next) };
}

export function formatWeekRange(anchor: string) {
  const start = weekStart(anchor);
  const end = addDays(start, 6);
  const short = (value: string) => `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`;
  return `${short(start)}—${short(end)}`;
}
