import { describe, expect, it } from 'vitest';
import type { WorkLogData } from '../../src/shared/contracts';
import { serializeWorkLogCsv, serializeWorkLogJson } from '../../src/domain/exports';

const data: WorkLogData = {
  items: [{ id: 'item-1', title: '课程上线', status: 'active', summary: '完成终审', completedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  logs: [{ id: 'log-1', workItemId: 'item-1', content: '完成终审', effortMinutes: 90, periodKind: 'day', periodStart: '2026-09-08', deletedAt: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }],
  settings: { theme: 'system', backupRetention: 14 }
};

describe('work log exports', () => {
  it('exports readable Chinese CSV', () => {
    const csv = serializeWorkLogCsv(data);
    expect(csv).toContain('周期,事项,工作内容,工时');
    expect(csv).toContain('2026-09-08,课程上线,完成终审,1.5');
  });

  it('exports complete JSON', () => {
    expect(JSON.parse(serializeWorkLogJson(data))).toMatchObject({ logs: [{ content: '完成终审' }], items: [{ title: '课程上线' }] });
  });
});
