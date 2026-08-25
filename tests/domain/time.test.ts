import { describe, expect, it } from 'vitest';
import { durationMinutes, splitSegmentByLocalDay } from '../../src/domain/time';
import type { TimeSegment } from '../../src/shared/contracts';

const segment = (start: string, end: string | null): TimeSegment => ({
  id: 'seg-1', taskId: 'task-1', start, end, source: 'timer', note: '', deletedAt: null,
  createdAt: start, updatedAt: start
});

describe('time calculations', () => {
  it('splits a segment at local midnight without losing duration', () => {
    const parts = splitSegmentByLocalDay(
      segment('2026-08-25T15:30:00.000Z', '2026-08-25T17:30:00.000Z'),
      480
    );

    expect(parts.map((part) => [part.date, part.minutes])).toEqual([
      ['2026-08-25', 30],
      ['2026-08-26', 90]
    ]);
  });

  it('adds closed and currently open segment durations', () => {
    const result = durationMinutes([
      segment('2026-08-25T01:00:00.000Z', '2026-08-25T01:45:00.000Z'),
      { ...segment('2026-08-25T02:00:00.000Z', null), id: 'seg-2' }
    ], new Date('2026-08-25T02:30:00.000Z'));

    expect(result).toBe(75);
  });
});
