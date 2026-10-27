import { describe, expect, it } from 'vitest';
import { filterWorkLogs, historicalContentOptions, matchCategory } from '../../src/domain/categories';
import type { Category, WorkItem, WorkLog } from '../../src/shared/contracts';

const categories: Category[] = [
  { id: 'planning', name: '项目协作', color: '#E1F3FE', keywords: ['会议', '排期'], deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'writing', name: '内容制作', color: '#EDF3EC', keywords: ['脚本', '课程脚本'], deletedAt: null, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' },
  { id: 'deleted', name: '旧分类', color: '#FBF3DB', keywords: ['终审'], deletedAt: '2026-09-03T00:00:00.000Z', createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' }
];

const log = (overrides: Partial<WorkLog>): WorkLog => ({
  id: 'log-1', workItemId: 'item-1', content: '完成课程脚本', effortMinutes: 60,
  periodKind: 'day', periodStart: '2026-09-08', occurredAt: '2026-09-08T03:30:00.000Z',
  categoryId: 'writing', categoryMode: 'auto', deletedAt: null,
  createdAt: '2026-09-08T03:30:00.000Z', updatedAt: '2026-09-08T03:30:00.000Z', ...overrides
});

describe('work log categories', () => {
  it('filters all old and new work by the item category and ignores record overrides', () => {
    const item: WorkItem = { id: 'item-1', title: '已有事项', categoryId: 'writing', categoryMode: 'manual', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '', updatedAt: '' };
    const logs = [log({ id: 'old', categoryId: 'planning', categoryMode: 'manual' }), log({ id: 'new', categoryId: null })];
    expect(filterWorkLogs(logs, { categoryId: 'writing' }, [item]).map((entry) => entry.id)).toEqual(['old', 'new']);
    expect(filterWorkLogs(logs, { categoryId: 'planning' }, [item])).toEqual([]);
    expect(filterWorkLogs(logs, { categoryId: '__none__' }, [{ ...item, categoryId: null }])).toHaveLength(2);
    expect(filterWorkLogs([log({ workItemId: null })], { categoryId: 'writing' }, [item])).toEqual([]);
  });
  it('matches only item titles case-insensitively with longest keyword precedence', () => {
    expect(matchCategory(categories, '课程脚本排期')).toBe('writing');
    expect(matchCategory(categories, '周会议')).toBe('planning');
    expect(matchCategory(categories, '普通事项')).toBeNull();
    expect(Reflect.apply(matchCategory, null, [categories, '普通事项', '完成课程脚本'])).toBeNull();
  });

  it('uses category creation order when equally long keywords match', () => {
    const tied = categories.map((category) => ({ ...category, keywords: category.id === 'planning' ? ['复核'] : category.id === 'writing' ? ['校对'] : [] }));
    expect(matchCategory(tied, '复核后校对')).toBe('planning');
  });

  it('matches any continuous typed text inside a keyword while ignoring punctuation and spaces', () => {
    const classics = [{ ...categories[0], id: 'classics', keywords: ['《守株待兔》'] }];

    expect(matchCategory(classics, '株')).toBe('classics');
    expect(matchCategory(classics, '守株')).toBe('classics');
    expect(matchCategory(classics, ' 守 - 株 ')).toBe('classics');
    expect(matchCategory(classics, '株待')).toBe('classics');
    expect(matchCategory(classics, '株守')).toBeNull();
    expect(matchCategory(classics, '《》')).toBeNull();
  });

  it('derives unique historical content by most recent active use', () => {
    const logs = [
      log({ id: 'old', content: ' 完成脚本 ', updatedAt: '2026-09-01T00:00:00.000Z' }),
      log({ id: 'new', content: '完成脚本', updatedAt: '2026-09-09T00:00:00.000Z' }),
      log({ id: 'other', content: '参加评审', updatedAt: '2026-09-08T00:00:00.000Z' }),
      log({ id: 'removed', content: '已经删除', deletedAt: '2026-09-09T00:00:00.000Z' })
    ];
    expect(historicalContentOptions(logs)).toEqual(['完成脚本', '参加评审']);
  });

  it('combines item, content, and category filters', () => {
    const logs = [
      log({ id: 'wanted' }),
      log({ id: 'other-item', workItemId: 'item-2' }),
      log({ id: 'other-content', content: '参加会议' }),
      log({ id: 'legacy-override', categoryId: 'planning' })
    ];
    const item: WorkItem = { id: 'item-1', title: '课程事项', categoryId: 'writing', categoryMode: 'manual', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '', updatedAt: '' };
    expect(filterWorkLogs(logs, { workItemId: 'item-1', content: '完成课程脚本', categoryId: 'writing' }, [item]).map((entry) => entry.id)).toEqual(['wanted', 'legacy-override']);
  });

  it('searches item titles and work content with partial text', () => {
    const items: WorkItem[] = [
      { id: 'item-1', title: '秋季课程上线', categoryId: 'writing', categoryMode: 'auto', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'item-2', title: '内部协作', categoryId: 'planning', categoryMode: 'auto', status: 'active', summary: '', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }
    ];
    const logs = [
      log({ id: 'wanted', workItemId: 'item-1', content: '完成第三轮脚本修改' }),
      log({ id: 'other-item', workItemId: 'item-2', content: '完成第三轮脚本修改' }),
      log({ id: 'other-content', workItemId: 'item-1', content: '参加项目会议' })
    ];

    expect(filterWorkLogs(logs, { itemQuery: '课程', contentQuery: '脚本' }, items).map((entry) => entry.id)).toEqual(['wanted']);
  });
});
