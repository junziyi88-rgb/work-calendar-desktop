import type { Task, TaskStatus, TimeSegment } from '../shared/contracts';

export function canStartTimer(activeSegments: TimeSegment[], taskId: string, allowParallel: boolean): { allowed: true } | { allowed: false; conflictingTaskId: string } {
  const active = activeSegments.find((segment) => !segment.end && !segment.deletedAt && segment.taskId !== taskId);
  if (!active || allowParallel) return { allowed: true };
  return { allowed: false, conflictingTaskId: active.taskId };
}

export function transitionTask(task: Task, status: TaskStatus, now: string): Task {
  return {
    ...task,
    status,
    completedAt: status === 'completed' ? now : null,
    updatedAt: now
  };
}

export function validateTaskInterval(task: Pick<Task, 'title' | 'plannedStart' | 'plannedEnd'>) {
  if (!task.title.trim()) return '请输入任务标题';
  if (task.plannedStart && task.plannedEnd && new Date(task.plannedEnd) <= new Date(task.plannedStart)) return '结束时间必须晚于开始时间';
  return null;
}
