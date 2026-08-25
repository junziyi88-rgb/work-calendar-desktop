import type { EventInput } from '@fullcalendar/core';
import type { CalendarData } from '../../shared/contracts';

export function mapCalendarEvents(data: CalendarData): EventInput[] {
  const taskMap = new Map(data.tasks.map((task) => [task.id, task]));
  const projectMap = new Map(data.projects.map((project) => [project.id, project]));
  const planned = data.tasks.filter((task) => !task.deletedAt && task.plannedStart && task.plannedEnd).map((task): EventInput => {
    const color = task.projectId ? projectMap.get(task.projectId)?.color : undefined;
    return {
      id: `planned:${task.id}`, title: task.title, start: task.plannedStart!, end: task.plannedEnd!,
      classNames: ['calendar-event', 'planned-event'],
      borderColor: color ?? '#8c98a5', backgroundColor: color ?? '#8c98a5',
      extendedProps: { kind: 'planned', taskId: task.id, status: task.status, projectName: task.projectId ? projectMap.get(task.projectId)?.name : '未分类' }
    };
  });
  const actual = data.segments.filter((segment) => !segment.deletedAt).map((segment): EventInput => {
    const task = taskMap.get(segment.taskId);
    const color = task?.projectId ? projectMap.get(task.projectId)?.color : undefined;
    return {
      id: `actual:${segment.id}`, title: task?.title ?? '已删除任务', start: segment.start,
      end: segment.end ?? new Date().toISOString(), classNames: ['calendar-event', 'actual-event'],
      borderColor: color ?? '#65717d', backgroundColor: color ?? '#65717d',
      extendedProps: { kind: 'actual', taskId: segment.taskId, segmentId: segment.id, running: !segment.end, source: segment.source }
    };
  });
  return [...planned, ...actual];
}
