import { describe, expect, it } from 'vitest';
import { formatEffort, parseEffort } from '../../src/domain/effort';

describe('manual effort', () => {
  it('parses the formats people naturally type', () => {
    expect(parseEffort('1.5h')).toBe(90);
    expect(parseEffort('90m')).toBe(90);
    expect(parseEffort('1小时30分')).toBe(90);
    expect(parseEffort('2')).toBe(120);
    expect(parseEffort('')).toBeNull();
  });

  it('rejects invalid or excessive effort', () => {
    expect(() => parseEffort('later')).toThrow('请输入');
    expect(() => parseEffort('25h')).toThrow('24 小时');
    expect(() => parseEffort('-1')).toThrow('请输入');
  });

  it('formats minutes as compact hours', () => {
    expect(formatEffort(90)).toBe('1.5 小时');
    expect(formatEffort(30)).toBe('0.5 小时');
    expect(formatEffort(0)).toBe('0 小时');
  });
});
