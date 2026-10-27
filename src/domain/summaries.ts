import type { SummaryGroup, SummaryKind, SummaryResult, WorkLogData } from '../shared/contracts';
import { formatWeekRange, periodRange } from './periods';
import { inheritItemCategories } from './categories';

export function buildSummary(data: WorkLogData, kind: SummaryKind, anchor: string): SummaryResult {
  const { start, end } = periodRange(kind, anchor);
  const logs = inheritItemCategories(data.logs, data.items)
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
    grouped.set(key, existing);
  }

  const groups = [...grouped.values()].sort((a, b) => a.itemTitle.localeCompare(b.itemTitle, 'zh-CN'));
  const totalMinutes = 0;
  const completedItems = data.items.filter((item) => item.status === 'completed' && item.completedAt && item.completedAt.slice(0, 10) >= start && item.completedAt.slice(0, 10) < end);
  const progressedIds = new Set(logs.flatMap((log) => log.workItemId ? [log.workItemId] : []));
  const progressedItems = data.items.filter((item) => item.status === 'active' && progressedIds.has(item.id));
  const missingEffort: typeof logs = [];

  const heading = kind === 'week'
    ? `本周工作总结（${formatWeekRange(anchor)}）`
    : `${Number(start.slice(0, 4))}年${Number(start.slice(5, 7))}月工作总结`;
  const lines = [heading, ''];
  for (const group of groups) {
    lines.push(`【${group.itemTitle}】`);
    for (const log of group.logs) lines.push(`- ${log.content}`);
    lines.push('');
  }
  if (completedItems.length) lines.push(`本期完成：${completedItems.map((item) => item.title).join('、')}`);

  return { kind, start, end, totalMinutes, groups, missingEffort, completedItems, progressedItems, copyText: lines.join('\n').trim() };
}
