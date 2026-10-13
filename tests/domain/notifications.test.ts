import { describe, expect, it } from 'vitest';
import { notificationCopy } from '../../src/domain/notifications';

describe('notification privacy', () => {
  it('hides task titles when private notifications are enabled', () => {
    expect(notificationCopy('long', '机密项目', true)).toEqual({ title: '计时提醒', body: '当前任务已经持续较长时间，记得确认计时状态。' });
    expect(notificationCopy('upcoming', '团队周会', false).body).toContain('团队周会');
  });
});
