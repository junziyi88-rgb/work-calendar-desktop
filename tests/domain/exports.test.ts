import { describe, expect, it } from 'vitest';
import { serializeCsv, serializeIcs } from '../../src/domain/exports';
import type { CalendarData } from '../../src/shared/contracts';

const data: CalendarData = {
  projects: [{ id: 'p1', name: '课程,研发', color: '#345', archivedAt: null, createdAt: '', updatedAt: '' }],
  tags: [],
  tasks: [{ id: 't1', title: '撰写“脚本”', projectId: 'p1', notes: '第一版', status: 'todo', plannedStart: '2026-08-25T01:00:00.000Z', plannedEnd: '2026-08-25T02:00:00.000Z', completedAt: null, deletedAt: null, createdAt: '', updatedAt: '', tagIds: [] }],
  segments: [{ id: 's1', taskId: 't1', start: '2026-08-25T01:10:00.000Z', end: '2026-08-25T01:40:00.000Z', source: 'manual', note: '', deletedAt: null, createdAt: '', updatedAt: '' }]
};

describe('exports', () => {
  it('escapes CSV content and includes a BOM for Excel', () => {
    const csv = serializeCsv(data);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"课程,研发"');
    expect(csv).toContain('"撰写“脚本”"');
    expect(csv).toContain(',30,');
  });

  it('exports planned tasks as valid calendar events', () => {
    const ics = serializeIcs(data.tasks);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20260825T010000Z');
    expect(ics).toContain('SUMMARY:撰写“脚本”');
    expect(ics).toContain('END:VCALENDAR');
  });
});
