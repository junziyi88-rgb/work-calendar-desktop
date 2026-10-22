import type { Category, WorkItem, WorkLog } from '../shared/contracts';

export interface WorkLogFilters {
  workItemId?: string;
  itemQuery?: string;
  content?: string;
  contentQuery?: string;
  categoryId?: string;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function matchCategory(categories: Category[], itemTitle: string) {
  const haystack = normalize(itemTitle);
  const matches = categories
    .filter((category) => !category.deletedAt)
    .flatMap((category, categoryIndex) => category.keywords
      .map(normalize)
      .filter((keyword) => keyword && haystack.includes(keyword))
      .map((keyword) => ({ categoryId: category.id, length: keyword.length, createdAt: category.createdAt, categoryIndex })))
    .sort((a, b) => b.length - a.length || a.createdAt.localeCompare(b.createdAt) || a.categoryIndex - b.categoryIndex);
  return matches[0]?.categoryId ?? null;
}

export function historicalContentOptions(logs: WorkLog[]) {
  const seen = new Set<string>();
  return logs
    .filter((log) => !log.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .flatMap((log) => {
      const content = log.content.trim();
      const key = normalize(content);
      if (!key || seen.has(key)) return [];
      seen.add(key);
      return [content];
    });
}

export function filterWorkLogs(logs: WorkLog[], filters: WorkLogFilters, items: WorkItem[] = []) {
  const content = filters.content ? normalize(filters.content) : '';
  const itemQuery = filters.itemQuery ? normalize(filters.itemQuery) : '';
  const contentQuery = filters.contentQuery ? normalize(filters.contentQuery) : '';
  const itemTitles = new Map(items.map((item) => [item.id, normalize(item.title)]));
  return logs.filter((log) => {
    if (filters.workItemId && log.workItemId !== filters.workItemId) return false;
    if (itemQuery && (!log.workItemId || !itemTitles.get(log.workItemId)?.includes(itemQuery))) return false;
    if (content && normalize(log.content) !== content) return false;
    if (contentQuery && !normalize(log.content).includes(contentQuery)) return false;
    if (filters.categoryId === '__none__' && log.categoryId !== null) return false;
    if (filters.categoryId && filters.categoryId !== '__none__' && log.categoryId !== filters.categoryId) return false;
    return true;
  });
}
