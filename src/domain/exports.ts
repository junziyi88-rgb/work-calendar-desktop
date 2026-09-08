import type { CalendarData, Task, WorkLogData } from '../shared/contracts';
import { durationMinutes } from './time';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",“”\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(data: CalendarData) {
  const taskMap = new Map(data.tasks.map((task) => [task.id, task]));
  const projectMap = new Map(data.projects.map((project) => [project.id, project]));
  const tagMap = new Map(data.tags.map((tag) => [tag.id, tag]));
  const header = ['日期', '任务', '项目', '开始', '结束', '耗时分钟', '来源', '状态', '标签', '备注'];
  const lines = data.segments.filter((segment) => !segment.deletedAt).map((segment) => {
    const task = taskMap.get(segment.taskId);
    const project = task?.projectId ? projectMap.get(task.projectId) : null;
    return [
      segment.start.slice(0, 10), task?.title ?? '已删除任务', project?.name ?? '未分类', segment.start,
      segment.end ?? '', durationMinutes([segment]), segment.source === 'timer' ? '自动计时' : '手动记录',
      task?.status ?? '', task?.tagIds.map((id) => tagMap.get(id)?.name).filter(Boolean).join(' / ') ?? '', segment.note || task?.notes || ''
    ].map(csvCell).join(',');
  });
  return `\ufeff${header.join(',')}\r\n${lines.join('\r\n')}`;
}

function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
}

export function serializeIcs(tasks: Task[]) {
  const events = tasks.filter((task) => !task.deletedAt && task.plannedStart && task.plannedEnd).map((task) => [
    'BEGIN:VEVENT',
    `UID:${task.id}@work-calendar.local`,
    `DTSTAMP:${icsDate(task.updatedAt || new Date().toISOString())}`,
    `DTSTART:${icsDate(task.plannedStart!)}`,
    `DTEND:${icsDate(task.plannedEnd!)}`,
    `SUMMARY:${icsText(task.title)}`,
    task.notes ? `DESCRIPTION:${icsText(task.notes)}` : null,
    'END:VEVENT'
  ].filter(Boolean).join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Work Calendar//Local Desktop//ZH-CN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}

export function serializeJson(data: CalendarData, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data, ...extra }, null, 2);
}

export function serializeWorkLogCsv(data: WorkLogData) {
  const itemMap = new Map(data.items.map((item) => [item.id, item.title]));
  const header = ['周期', '事项', '工作内容', '工时', '记录精度'];
  const lines = data.logs.filter((log) => !log.deletedAt).map((log) => [
    log.periodStart,
    log.workItemId ? itemMap.get(log.workItemId) ?? '已删除事项' : '其他工作',
    log.content,
    log.effortMinutes == null ? '' : Math.round((log.effortMinutes / 60) * 100) / 100,
    log.periodKind === 'week' ? '周' : '日'
  ].map(csvCell).join(','));
  return `\ufeff${header.join(',')}\r\n${lines.join('\r\n')}`;
}

export function serializeWorkLogJson(data: WorkLogData) {
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), ...data }, null, 2);
}
