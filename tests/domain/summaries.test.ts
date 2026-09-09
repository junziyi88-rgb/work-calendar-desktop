import { describe, expect, it } from 'vitest';
import type { WorkLogData } from '../../src/shared/contracts';
import { buildSummary } from '../../src/domain/summaries';
import { periodRange, weekStart } from '../../src/domain/periods';

const data: WorkLogData = {
  items: [
    { id: 'item-1', title: '课程上线', status: 'active', summary: '完成终审', createdAt: '2026-09-01T00:00:00.000Z', completedAt: null, deletedAt: null, updatedAt: '2026-09-08T00:00:00.000Z' },
    { id: 'item-2', title: '桌面工具', status: 'completed', summary: '完成精简设计', createdAt: '2026-09-01T00:00:00.000Z', completedAt: '2026-09-09T00:00:00.000Z', deletedAt: null, updatedAt: '2026-09-09T00:00:00.000Z' }
  ],
  logs: [
    { id: 'log-1', workItemId: 'item-1', content: '完成第三轮脚本修改', effortMinutes: 120, periodKind: 'day', periodStart: '2026-09-08', occurredAt: '2026-09-08T01:00:00.000Z', categoryId: null, categoryMode: 'auto', createdAt: '2026-09-08T01:00:00.000Z', updatedAt: '2026-09-08T01:00:00.000Z', deletedAt: null },
    { id: 'log-2', workItemId: 'item-1', content: '交付终审', effortMinutes: 30, periodKind: 'week', periodStart: '2026-09-07', occurredAt: '2026-09-09T01:00:00.000Z', categoryId: null, categoryMode: 'auto', createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:00:00.000Z', deletedAt: null },
    { id: 'log-3', workItemId: 'item-2', content: '完成精简设计', effortMinutes: 60, periodKind: 'day', periodStart: '2026-09-09', occurredAt: '2026-09-09T02:00:00.000Z', categoryId: null, categoryMode: 'auto', createdAt: '2026-09-09T02:00:00.000Z', updatedAt: '2026-09-09T02:00:00.000Z', deletedAt: null },
    { id: 'log-4', workItemId: null, content: '临时沟通', effortMinutes: null, periodKind: 'day', periodStart: '2026-09-10', occurredAt: '2026-09-10T02:00:00.000Z', categoryId: null, categoryMode: 'auto', createdAt: '2026-09-10T02:00:00.000Z', updatedAt: '2026-09-10T02:00:00.000Z', deletedAt: null }
  ],
  categories: [],
  contentOptions: ['完成第三轮脚本修改', '交付终审', '完成精简设计', '临时沟通'],
  settings: { theme: 'system', backupRetention: 14 }
};

describe('period helpers', () => {
  it('uses Monday as the start of a week', () => {
    expect(weekStart('2026-09-10')).toBe('2026-09-07');
    expect(periodRange('week', '2026-09-10')).toEqual({ start: '2026-09-07', end: '2026-09-14' });
    expect(periodRange('month', '2026-09-10')).toEqual({ start: '2026-09-01', end: '2026-10-01' });
  });
});

describe('summary generation', () => {
  it('groups parallel work without merging progress entries', () => {
    const result = buildSummary(data, 'week', '2026-09-10');
    expect(result.totalMinutes).toBe(210);
    expect(result.groups[0]).toMatchObject({ itemTitle: '课程上线', minutes: 150 });
    expect(result.groups[0].logs).toHaveLength(2);
    expect(result.missingEffort).toHaveLength(1);
    expect(result.completedItems.map((item) => item.title)).toContain('桌面工具');
    expect(result.copyText).toContain('本周工作总结');
    expect(result.copyText).toContain('完成第三轮脚本修改');
  });

  it('builds monthly OKR material from the same records', () => {
    const result = buildSummary(data, 'month', '2026-09-10');
    expect(result.totalMinutes).toBe(210);
    expect(result.copyText).toContain('2026年9月工作总结');
    expect(result.copyText).toContain('累计投入：2.5 小时');
  });
});
