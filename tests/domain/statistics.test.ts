import { describe, expect, it } from 'vitest';
import { summarizeDay } from '../../src/domain/statistics';
import type { Project, Task, TimeSegment } from '../../src/shared/contracts';

const project: Project = { id: 'p1', name: '课程研发', color: '#3a6fe8', archivedAt: null, createdAt: '', updatedAt: '' };
const tasks: Task[] = [
  { id: 't1', title: '课件', projectId: 'p1', notes: '', status: 'completed', plannedStart: '2026-08-25T01:00:00Z', plannedEnd: '2026-08-25T03:00:00Z', completedAt: '', deletedAt: null, createdAt: '', updatedAt: '', tagIds: [] },
  { id: 't2', title: '沟通', projectId: null, notes: '', status: 'todo', plannedStart: '2026-08-25T05:00:00Z', plannedEnd: '2026-08-25T06:00:00Z', completedAt: null, deletedAt: null, createdAt: '', updatedAt: '', tagIds: [] }
];
const segments: TimeSegment[] = [
  { id: 's1', taskId: 't1', start: '2026-08-25T01:00:00Z', end: '2026-08-25T04:00:00Z', source: 'timer', note: '', deletedAt: null, createdAt: '', updatedAt: '' }
];

describe('day summary', () => {
  it('calculates completion, actual time, variance, and project shares', () => {
    const summary = summarizeDay({ date: '2026-08-25', tasks, segments, projects: [project], offsetMinutes: 0 });

    expect(summary.actualMinutes).toBe(180);
    expect(summary.plannedMinutes).toBe(180);
    expect(summary.completionRate).toBe(0.5);
    expect(summary.varianceMinutes).toBe(60);
    expect(summary.projectShares).toEqual([{ projectId: 'p1', name: '课程研发', color: '#3a6fe8', minutes: 180, share: 1 }]);
  });
});
