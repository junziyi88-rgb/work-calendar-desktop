import type { TimeSegment } from '../shared/contracts';

export interface DaySegmentPart {
  date: string;
  start: string;
  end: string;
  minutes: number;
}

const MINUTE_MS = 60_000;

function localDateAt(timestampMs: number, offsetMinutes: number) {
  return new Date(timestampMs + offsetMinutes * MINUTE_MS).toISOString().slice(0, 10);
}

function nextLocalMidnight(timestampMs: number, offsetMinutes: number) {
  const shifted = new Date(timestampMs + offsetMinutes * MINUTE_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - offsetMinutes * MINUTE_MS;
}

export function splitSegmentByLocalDay(segment: TimeSegment, offsetMinutes: number, now = new Date()): DaySegmentPart[] {
  const startMs = new Date(segment.start).getTime();
  const endMs = new Date(segment.end ?? now.toISOString()).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

  const parts: DaySegmentPart[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const boundary = Math.min(endMs, nextLocalMidnight(cursor, offsetMinutes));
    parts.push({
      date: localDateAt(cursor, offsetMinutes),
      start: new Date(cursor).toISOString(),
      end: new Date(boundary).toISOString(),
      minutes: (boundary - cursor) / MINUTE_MS
    });
    cursor = boundary;
  }
  return parts;
}

export function durationMinutes(segments: TimeSegment[], now = new Date()) {
  return Math.round(segments.reduce((total, segment) => {
    if (segment.deletedAt) return total;
    const start = new Date(segment.start).getTime();
    const end = new Date(segment.end ?? now.toISOString()).getTime();
    return total + Math.max(0, end - start) / MINUTE_MS;
  }, 0));
}

export function intervalMinutes(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / MINUTE_MS));
}
