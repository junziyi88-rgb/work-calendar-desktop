import { describe, expect, it } from 'vitest';
import { mapCalendarEvents } from '../../../src/features/calendar/eventMapping';
import type { CalendarData } from '../../../src/shared/contracts';

const data: CalendarData = {
  projects: [{ id: 'p1', name: '产品', color: '#3a6fe8', archivedAt: null, createdAt: '', updatedAt: '' }], tags: [],
  tasks: [{ id: 't1', title: '规划首页', projectId: 'p1', notes: '', status: 'in_progress', plannedStart: '2026-08-25T01:00:00.000Z', plannedEnd: '2026-08-25T03:00:00.000Z', completedAt: null, deletedAt: null, createdAt: '', updatedAt: '', tagIds: [] }],
  segments: [{ id: 's1', taskId: 't1', start: '2026-08-25T01:15:00.000Z', end: '2026-08-25T02:00:00.000Z', source: 'timer', note: '', deletedAt: null, createdAt: '', updatedAt: '' }]
};

describe('calendar event mapping', () => {
  it('keeps planned outlines separate from actual solid segments', () => {
    const events = mapCalendarEvents(data);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ id: 'planned:t1', classNames: ['calendar-event', 'planned-event'], extendedProps: { kind: 'planned', taskId: 't1' } });
    expect(events[1]).toMatchObject({ id: 'actual:s1', classNames: ['calendar-event', 'actual-event'], extendedProps: { kind: 'actual', taskId: 't1', segmentId: 's1' } });
  });
});
