export type NotificationKind = 'long' | 'upcoming' | 'overdue';

export function notificationCopy(kind: NotificationKind, taskTitle: string, privateMode: boolean) {
  if (privateMode) {
    if (kind === 'long') return { title: '计时提醒', body: '当前任务已经持续较长时间，记得确认计时状态。' };
    if (kind === 'upcoming') return { title: '计划即将开始', body: '一项计划任务即将开始。' };
    return { title: '计划已逾期', body: '一项计划任务已超过结束时间。' };
  }
  if (kind === 'long') return { title: '计时提醒', body: `“${taskTitle}”已经持续较长时间，记得确认计时状态。` };
  if (kind === 'upcoming') return { title: '计划即将开始', body: `“${taskTitle}”将在几分钟内开始。` };
  return { title: '计划已逾期', body: `“${taskTitle}”已超过计划结束时间。` };
}
