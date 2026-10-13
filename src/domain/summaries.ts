import type { SummaryGroup, SummaryKind, SummaryResult, WorkLogData } from '../shared/contracts';
import { formatEffort } from './effort';
import { formatWeekRange, periodRange } from './periods';

export function buildSummary(data: WorkLogData, kind: SummaryKind, anchor: string): SummaryResult {
  const { start, end } = periodRange(kind, anchor);
  const logs = data.logs
    .filter((log) => !log.deletedAt && log.periodStart >= start && log.periodStart < end)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.createdAt.localeCompare(b.createdAt));
  const itemMap = new Map(data.items.map((item) => [item.id, item]));
  const grouped = new Map<string, SummaryGroup>();

  for (const log of logs) {
    const key = log.workItemId ?? '__one_off__';
    const existing = grouped.get(key) ?? {
      itemId: log.workItemId,
      itemTitle: log.workItemId ? itemMap.get(log.workItemId)?.title ?? '已删除事项' : '其他工作',
      minutes: 0,
      logs: []
    };
    existing.logs.push(log);
    existing.minutes += log.effortMinutes ?? 0;
    grouped.set(key, existing);
  }

  const groups = [...grouped.values()].sort((a, b) => b.minutes - a.minutes || a.itemTitle.localeCompare(b.itemTitle, 'zh-CN'));
  const totalMinutes = groups.reduce((sum, group) => sum + group.minutes, 0);
  const completedItems = data.items.filter((item) => item.status === 'completed' && item.completedAt && item.completedAt.slice(0, 10) >= start && item.completedAt.slice(0, 10) < end);
  const progressedIds = new Set(logs.flatMap((log) => log.workItemId ? [log.workItemId] : []));
  const progressedItems = data.items.filter((item) => item.status === 'active' && progressedIds.has(item.id));
  const missingEffort = logs.filter((log) => log.effortMinutes == null);

  const heading = kind === 'week'
    ? `本周工作总结（${formatWeekRange(anchor)}）`
    : `${Number(start.slice(0, 4))}年${Number(start.slice(5, 7))}月工作总结`;
  const lines = [heading, `总工时：${formatEffort(totalMinutes)}`, ''];
  for (const group of groups) {
    lines.push(`【${group.itemTitle}】`);
    for (const log of group.logs) lines.push(`- ${log.content}${log.effortMinutes == null ? '' : `（${formatEffort(log.effortMinutes)}）`}`);
    lines.push(`累计投入：${formatEffort(group.minutes)}`, '');
  }
  if (completedItems.length) lines.push(`本期完成：${completedItems.map((item) => item.title).join('、')}`);
  if (missingEffort.length) lines.push(`待补工时：${missingEffort.length} 条`);

  return { kind, start, end, totalMinutes, groups, missingEffort, completedItems, progressedItems, copyText: lines.join('\n').trim() };
}
