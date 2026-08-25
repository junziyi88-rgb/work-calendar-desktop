// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDatabase, type AppDatabase } from '../../electron/database';
import { createRepositories, type Repositories } from '../../electron/repositories';

describe('SQLite repositories', () => {
  let database: AppDatabase;
  let repositories: Repositories;

  beforeEach(async () => {
    database = await createMemoryDatabase();
    repositories = createRepositories(database, () => '2026-08-25T04:00:00.000Z');
  });

  afterEach(() => database.close());

  it('persists projects, tagged tasks, and time segments', () => {
    const project = repositories.projects.save({ name: '产品设计', color: '#3a6fe8' });
    const tag = repositories.tags.save({ name: '专注', color: '#7557c9' });
    const task = repositories.tasks.save({
      title: '梳理工作流', projectId: project.id, tagIds: [tag.id],
      plannedStart: '2026-08-25T01:00:00.000Z', plannedEnd: '2026-08-25T03:00:00.000Z'
    });
    const segment = repositories.segments.save({ taskId: task.id, start: '2026-08-25T01:05:00.000Z', end: null, source: 'timer' });

    const calendar = repositories.calendar.query({ start: '2026-08-25T00:00:00.000Z', end: '2026-08-26T00:00:00.000Z' });
    expect(calendar.tasks[0]).toMatchObject({ id: task.id, tagIds: [tag.id] });
    expect(calendar.segments[0]).toMatchObject({ id: segment.id, taskId: task.id, end: null });
    expect(calendar.projects[0].name).toBe('产品设计');
  });

  it('filters calendar text and restores soft-deleted tasks', () => {
    const task = repositories.tasks.save({ title: '撰写周报', notes: '整理课程进度', plannedStart: '2026-08-25T01:00:00.000Z', plannedEnd: '2026-08-25T02:00:00.000Z' });
    repositories.tasks.save({ title: '参加会议', plannedStart: '2026-08-25T03:00:00.000Z', plannedEnd: '2026-08-25T04:00:00.000Z' });

    expect(repositories.calendar.query({ start: '2026-08-25T00:00:00.000Z', end: '2026-08-26T00:00:00.000Z', search: '课程' }).tasks).toHaveLength(1);

    repositories.recycle.softDelete('task', task.id);
    expect(repositories.recycle.list()).toEqual([expect.objectContaining({ id: task.id, kind: 'task', title: '撰写周报' })]);
    expect(repositories.calendar.query({ start: '2026-08-25T00:00:00.000Z', end: '2026-08-26T00:00:00.000Z' }).tasks.map((item) => item.id)).not.toContain(task.id);

    repositories.recycle.restore('task', task.id);
    expect(repositories.tasks.get(task.id)?.deletedAt).toBeNull();
  });

  it('upserts daily reviews and settings', () => {
    const review = repositories.reviews.save({ date: '2026-08-25', accomplishments: '完成界面', blockers: '', tomorrowFocus: '测试', targetMinutes: 420 });
    const settings = repositories.settings.save({ theme: 'dark', allowParallelTimers: true });

    expect(repositories.reviews.get('2026-08-25')).toEqual(review);
    expect(settings.theme).toBe('dark');
    expect(settings.backupRetention).toBe(14);
  });
});
