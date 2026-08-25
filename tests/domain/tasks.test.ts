import { describe, expect, it } from 'vitest';
import { canStartTimer, transitionTask } from '../../src/domain/tasks';
import type { Task, TimeSegment } from '../../src/shared/contracts';

const baseTask: Task = {
  id: 't1', title: '整理项目资料', projectId: null, notes: '', status: 'todo',
  plannedStart: null, plannedEnd: null, completedAt: null, deletedAt: null,
  createdAt: '2026-08-25T01:00:00.000Z', updatedAt: '2026-08-25T01:00:00.000Z', tagIds: []
};

const active: TimeSegment = {
  id: 's1', taskId: 't1', start: '2026-08-25T01:00:00.000Z', end: null,
  source: 'timer', note: '', deletedAt: null, createdAt: '2026-08-25T01:00:00.000Z', updatedAt: '2026-08-25T01:00:00.000Z'
};

describe('task rules', () => {
  it('requires switching when another timer is active', () => {
    expect(canStartTimer([active], 't2', false)).toEqual({ allowed: false, conflictingTaskId: 't1' });
    expect(canStartTimer([active], 't2', true)).toEqual({ allowed: true });
    expect(canStartTimer([active], 't1', false)).toEqual({ allowed: true });
  });

  it('records completion and clears it when reopened', () => {
    const completed = transitionTask(baseTask, 'completed', '2026-08-25T03:00:00.000Z');
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe('2026-08-25T03:00:00.000Z');

    const reopened = transitionTask(completed, 'in_progress', '2026-08-25T04:00:00.000Z');
    expect(reopened.completedAt).toBeNull();
    expect(reopened.updatedAt).toBe('2026-08-25T04:00:00.000Z');
  });
});
