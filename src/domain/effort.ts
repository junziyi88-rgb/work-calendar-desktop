export function parseEffort(value: string): number | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;

  let minutes: number;
  const chinese = text.match(/^(?:(\d+(?:\.\d+)?)\s*小时)?\s*(?:(\d+(?:\.\d+)?)\s*分(?:钟)?)?$/);
  if (chinese && (chinese[1] || chinese[2])) {
    minutes = Math.round(Number(chinese[1] ?? 0) * 60 + Number(chinese[2] ?? 0));
  } else if (/^\d+(?:\.\d+)?h$/.test(text)) {
    minutes = Math.round(Number(text.slice(0, -1)) * 60);
  } else if (/^\d+(?:\.\d+)?m$/.test(text)) {
    minutes = Math.round(Number(text.slice(0, -1)));
  } else if (/^\d+(?:\.\d+)?$/.test(text)) {
    minutes = Math.round(Number(text) * 60);
  } else {
    throw new Error('请输入如 1.5h、90m 或 1小时30分');
  }

  if (minutes < 0 || minutes > 1440) throw new Error('单条记录不能超过 24 小时');
  return minutes;
}

export function formatEffort(minutes: number) {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${Number.isInteger(hours) ? hours.toFixed(0) : hours} 小时`;
}
