import type { Project, Task, TimeSegment } from '../shared/contracts';
import { intervalMinutes, splitSegmentByLocalDay } from './time';

export interface DaySummary {
  actualMinutes: number;
  plannedMinutes: number;
  completionRate: number;
  varianceMinutes: number;
  projectShares: Array<{ projectId: string | null; name: string; color: string; minutes: number; share: number }>;
  focusMinutes: number;
}

interface SummaryInput {
  date: string;
  tasks: Task[];
  segments: TimeSegment[];
  projects: Project[];
  offsetMinutes: number;
  now?: Date;
}

export function summarizeDay({ date, tasks, segments, projects, offsetMinutes, now = new Date() }: SummaryInput): DaySummary {
  const visibleTasks = tasks.filter((task) => !task.deletedAt);
  const taskMap = new Map(visibleTasks.map((task) => [task.id, task]));
  const plannedTasks = visibleTasks.filter((task) => task.plannedStart?.slice(0, 10) === date || task.plannedEnd?.slice(0, 10) === date);
  const plannedMinutes = plannedTasks.reduce((sum, task) => sum + intervalMinutes(task.plannedStart, task.plannedEnd), 0);

  const actualByTask = new Map<string, number>();
  let actualMinutes = 0;
  for (const segment of segments.filter((item) => !item.deletedAt)) {
    const minutes = splitSegmentByLocalDay(segment, offsetMinutes, now)
      .filter((part) => part.date === date)
      .reduce((sum, part) => sum + part.minutes, 0);
    if (minutes > 0) {
      actualMinutes += minutes;
      actualByTask.set(segment.taskId, (actualByTask.get(segment.taskId) ?? 0) + minutes);
    }
  }

  const buckets = new Map<string, { projectId: string | null; name: string; color: string; minutes: number }>();
  for (const [taskId, minutes] of actualByTask) {
    const task = taskMap.get(taskId);
    const project = projects.find((item) => item.id === task?.projectId);
    const key = project?.id ?? 'unassigned';
    const current = buckets.get(key) ?? { projectId: project?.id ?? null, name: project?.name ?? '未分类', color: project?.color ?? '#8c98a5', minutes: 0 };
    current.minutes += minutes;
    buckets.set(key, current);
  }

  const varianceMinutes = Array.from(actualByTask).reduce((sum, [taskId, minutes]) => {
    const task = taskMap.get(taskId);
    return sum + minutes - intervalMinutes(task?.plannedStart ?? null, task?.plannedEnd ?? null);
  }, 0);

  return {
    actualMinutes: Math.round(actualMinutes),
    plannedMinutes,
    completionRate: plannedTasks.length ? plannedTasks.filter((task) => task.status === 'completed').length / plannedTasks.length : 0,
    varianceMinutes: Math.round(varianceMinutes),
    projectShares: Array.from(buckets.values()).map((bucket) => ({ ...bucket, minutes: Math.round(bucket.minutes), share: actualMinutes ? bucket.minutes / actualMinutes : 0 })).sort((a, b) => b.minutes - a.minutes),
    focusMinutes: Math.round(Math.max(0, ...Array.from(actualByTask.values()), 0))
  };
}
