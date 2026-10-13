# Item Category and Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make category inheritance item-based, restrict automatic matching and learning to item names, and let users rename items from both record editing and item details.

**Architecture:** Persist `categoryId` and `categoryMode` on each work item while retaining the same fields on work logs for stable filtering and per-log overrides. Repository transactions own matching, keyword learning, and propagation; React components submit intent through existing store and IPC boundaries.

**Tech Stack:** React 19, TypeScript 5.9, Zustand, Electron, sql.js/SQLite, Vitest, Testing Library.

## Global Constraints

- Automatic category matching reads only the item title; log content must never participate.
- A log with `categoryMode: 'manual'` must not change when its item or category rules change.
- Existing items, logs, categories, effort, dates, content, and links must survive migration.
- An item title is stored once and all linked log views resolve it through `workItemId`.
- Do not add a new dependency.

---

### Task 1: Item category types, matcher, and schema migration

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/domain/categories.ts`
- Modify: `electron/database.ts`
- Test: `tests/domain/categories.test.ts`
- Test: `tests/main/migration.test.ts`

**Interfaces:**
- Produces: `matchCategory(categories: Category[], itemTitle: string): string | null`
- Produces: `WorkItem.categoryId: string | null` and `WorkItem.categoryMode: CategoryMode`
- Produces: optional `WorkItemInput.categoryId`, `WorkItemInput.categoryName`, and `WorkItemInput.categoryMode`
- Produces: schema version `4` with `work_items.category_id` and `work_items.category_mode`

- [ ] **Step 1: Write matcher tests that reject work-content matching**

Change the category test to call the two-argument matcher and assert that only the item title is searched:

```ts
it('matches only item titles with longest keyword precedence', () => {
  expect(matchCategory(categories, '课程脚本开发')).toBe('writing');
  expect(matchCategory(categories, '周会议')).toBe('planning');
  expect(matchCategory(categories, '普通事项')).toBeNull();
});
```

- [ ] **Step 2: Run the domain test and verify the old signature/behavior fails**

Run: `npm test -- tests/domain/categories.test.ts`

Expected: FAIL because `matchCategory` still builds its haystack from an item title plus log content and existing tests still depend on content.

- [ ] **Step 3: Narrow the matcher and extend item contracts**

Implement the matcher as:

```ts
export function matchCategory(categories: Category[], itemTitle: string) {
  const haystack = normalize(itemTitle);
  // Preserve the existing longest-keyword and creation-order tie breaking.
}
```

Add these fields:

```ts
export interface WorkItem {
  categoryId: string | null;
  categoryMode: CategoryMode;
}

export interface WorkItemInput {
  categoryId?: string | null;
  categoryName?: string | null;
  categoryMode?: CategoryMode;
}
```

- [ ] **Step 4: Write a version-3-to-version-4 migration test**

Create a file-backed version-3 database fixture, reopen it, and assert:

```ts
expect(database.db.exec("SELECT value FROM meta WHERE key='schema_version'")[0].values[0][0]).toBe('4');
const itemColumns = database.db.exec('PRAGMA table_info(work_items)')[0].values.map((entry) => entry[1]);
expect(itemColumns).toEqual(expect.arrayContaining(['category_id', 'category_mode']));
expect(data.items[0]).toMatchObject({ categoryId: null, categoryMode: 'auto' });
expect(data.logs[0]).toMatchObject({ content: '完成复核稿', effortMinutes: 75 });
```

- [ ] **Step 5: Run the migration test and verify it fails**

Run: `npm test -- tests/main/migration.test.ts`

Expected: FAIL because the schema is still version 3 and `work_items` has no category columns.

- [ ] **Step 6: Implement additive schema version 4**

Add nullable `category_id` and non-null `category_mode TEXT NOT NULL DEFAULT 'auto'` columns to the table definition and guarded upgrade logic. Update the schema marker to `4`; do not rebuild or delete tables.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm test -- tests/domain/categories.test.ts tests/main/migration.test.ts`

Expected: PASS.

Commit:

```powershell
git add src/shared/contracts.ts src/domain/categories.ts electron/database.ts tests/domain/categories.test.ts tests/main/migration.test.ts
git commit -m "feat: add item category schema and title matcher"
```

---

### Task 2: Repository inheritance, learning, and propagation

**Files:**
- Modify: `electron/repositories.ts`
- Test: `tests/main/repositories.test.ts`

**Interfaces:**
- Consumes: `matchCategory(categories, itemTitle)` and item category fields from Task 1
- Produces: transactional `workItems.save(input: WorkItemInput): WorkItem`
- Produces: `workLogs.save(input: WorkLogInput)` inheritance from the linked item
- Produces: automatic log propagation that leaves manual logs unchanged

- [ ] **Step 1: Replace repository category tests with item-based expectations**

Add focused cases that assert:

```ts
const category = repositories.categories.save({ name: '内容制作', color: '#EDF3EC', keywords: ['脚本'] });
const item = repositories.workItems.save({ title: '课程脚本开发' });
expect(item).toMatchObject({ categoryId: category.id, categoryMode: 'auto' });
expect(repositories.workLogs.save({ workItemId: item.id, content: '修改第三版', periodKind: 'day', periodStart: '2026-09-08' }))
  .toMatchObject({ categoryId: category.id, categoryMode: 'auto' });
expect(repositories.workLogs.save({ content: '完成脚本修改', periodKind: 'day', periodStart: '2026-09-08' }).categoryId).toBeNull();
```

Add another case where a manual log stays unchanged after the item is recategorized, while an automatic log follows the item.

- [ ] **Step 2: Run repository tests and verify failure**

Run: `npm test -- tests/main/repositories.test.ts`

Expected: FAIL because item rows do not map category fields and logs still match their content.

- [ ] **Step 3: Map item category columns and replace content learning**

Extend `WorkItemRow` and `mapWorkItem`. Replace `resolveTypedCategory(categoryName, content)` with an item-title learner:

```ts
const resolveTypedCategory = (categoryName: string | null | undefined, itemTitle: string) => {
  // Reuse/create by normalized name and add the complete non-empty itemTitle as a keyword.
};
```

No work-log save path may add `content` to `keywords`.

- [ ] **Step 4: Make item save transactional**

Within one transaction, resolve item category intent, insert/update the item, and synchronize only automatic logs:

```sql
UPDATE work_logs
SET category_id=?, category_mode='auto', updated_at=?
WHERE work_item_id=? AND category_mode!='manual'
```

For automatic item mode, compute from the title. For manual item mode, resolve the typed category name or preserve explicit `null` for unclassified.

- [ ] **Step 5: Make log save inherit the linked item**

For `categoryMode !== 'manual'`, set the category to `workItems.get(workItemId)?.categoryId ?? null`. For a manual log, resolve an existing/new category by name without learning work content. An unlinked automatic log remains unclassified.

- [ ] **Step 6: Reclassify item and automatic logs after category rule changes**

Change category save/delete recalculation to:

```ts
for (const item of workItems.list()) {
  if (item.categoryMode !== 'auto') continue;
  const categoryId = matchCategory(available, item.title);
  // Update the item and its non-manual logs in the same transaction.
}
```

- [ ] **Step 7: Run repository and migration tests and commit**

Run: `npm test -- tests/main/repositories.test.ts tests/main/migration.test.ts`

Expected: PASS.

Commit:

```powershell
git add electron/repositories.ts tests/main/repositories.test.ts
git commit -m "feat: inherit categories from work items"
```

---

### Task 3: Rename or relink items from record editing

**Files:**
- Modify: `src/store/useAppStore.ts`
- Modify: `src/features/records/RecordPage.tsx`
- Modify: `src/features/records/LogList.tsx`
- Test: `tests/features/records/LogList.test.tsx`
- Test: `tests/smoke/App.test.tsx`

**Interfaces:**
- Consumes: `saveItem(input: WorkItemInput)` and `saveLog(input: WorkLogInput, newItemTitle?: string)`
- Produces: `LogList.onSaveItem(input: WorkItemInput)`
- Produces: editable draft fields `itemText` and `originalWorkItemId`

- [ ] **Step 1: Write component tests for rename, relink, and create**

Test these three branches:

```ts
// Rename: original linked title changed to a new unmatched value.
expect(onSaveItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-old', title: '交付归档事项' }));
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workItemId: 'item-old' }));

// Relink: text exactly matches another existing item.
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workItemId: 'item-new' }));

// Create from an unlinked record: pass the unmatched title to the existing save-log flow.
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workItemId: null }), '新事项');
```

- [ ] **Step 2: Run the record component test and verify failure**

Run: `npm test -- tests/features/records/LogList.test.tsx`

Expected: FAIL because the editor uses a `<select>` and has no item-save callback.

- [ ] **Step 3: Replace the item selector with an editable datalist input**

The record edit draft stores `itemText`. Existing active items plus the record's current completed item are datalist candidates. The save decision is:

```ts
const exact = availableItems.find((item) => normalize(item.title) === normalize(draft.itemText));
if (exact) workItemId = exact.id;
else if (log.workItemId && draft.itemText.trim()) {
  await onSaveItem({ id: log.workItemId, title: draft.itemText.trim() });
  workItemId = log.workItemId;
} else {
  workItemId = null;
  newItemTitle = draft.itemText.trim() || undefined;
}
await onSave({ ...logInput, workItemId }, newItemTitle);
```

Keep the edit panel open and show an inline error when either save rejects.

- [ ] **Step 4: Thread `saveItem` through App and RecordPage**

Add `onSaveItem` to `RecordPage` and `LogList` props and pass the existing Zustand action from `App.tsx`. Do not add a second store action.

- [ ] **Step 5: Run record and smoke tests and commit**

Run: `npm test -- tests/features/records/LogList.test.tsx tests/smoke/App.test.tsx`

Expected: PASS.

Commit:

```powershell
git add src/App.tsx src/store/useAppStore.ts src/features/records/RecordPage.tsx src/features/records/LogList.tsx tests/features/records/LogList.test.tsx tests/smoke/App.test.tsx
git commit -m "feat: edit item names from work logs"
```

---

### Task 4: Item detail editor for title and default category

**Files:**
- Modify: `src/features/items/ItemsPage.tsx`
- Modify: `src/styles/app.css`
- Test: `tests/features/items/ItemsPage.test.tsx`

**Interfaces:**
- Consumes: `WorkItem.categoryId`, `WorkItem.categoryMode`, `matchCategory`, and `onSaveItem`
- Produces: item detail edit form with title and category text inputs

- [ ] **Step 1: Write item-page editing tests**

Open an item, click `编辑事项`, change `事项名称` and `事项分类`, save, and assert:

```ts
expect(onSaveItem).toHaveBeenCalledWith({
  id: 'item-1',
  title: '桌面工作记录应用',
  summary: '重新梳理真实需求',
  categoryName: '产品开发',
  categoryMode: 'manual'
});
```

Add a second case that leaves the category untouched and expects `categoryMode: 'auto'` with the recomputed suggestion.

- [ ] **Step 2: Run item tests and verify failure**

Run: `npm test -- tests/features/items/ItemsPage.test.tsx`

Expected: FAIL because no item edit action or category field exists.

- [ ] **Step 3: Add the item detail edit state and form**

Use local state for `title`, `categoryText`, `categoryIsManual`, `saving`, and `error`. The category display value is the saved manual category name or `matchCategory(categories, title)` suggestion. Submit:

```ts
await onSaveItem({
  id: selected.id,
  title: title.trim(),
  summary: selected.summary,
  categoryName: categoryIsManual ? categoryText.trim() || null : undefined,
  categoryMode: categoryIsManual ? 'manual' : 'auto'
});
```

- [ ] **Step 4: Style the editor using existing controls**

Add only scoped rules for `.item-edit-form`, `.item-edit-grid`, and `.item-edit-actions`. Reuse `.quiet-button`, `.record-button`, and `ResizableField`; preserve the current responsive breakpoint behavior.

- [ ] **Step 5: Update category-manager explanatory copy**

Change “系统会同时识别关联事项和工作内容” to “系统只根据事项名称匹配关键词；工作内容不会参与分类。” Change the empty-state copy to describe item-name keywords.

- [ ] **Step 6: Run item and category component tests and commit**

Run: `npm test -- tests/features/items/ItemsPage.test.tsx tests/features/categories/CategoryManager.test.tsx`

Expected: PASS.

Commit:

```powershell
git add src/features/items/ItemsPage.tsx src/features/categories/CategoryManager.tsx src/styles/app.css tests/features/items/ItemsPage.test.tsx tests/features/categories/CategoryManager.test.tsx
git commit -m "feat: edit item title and default category"
```

---

### Task 5: Full regression and release verification

**Files:**
- Modify only files required to fix failures caused by Tasks 1-4

**Interfaces:**
- Consumes: all behavior delivered by Tasks 1-4
- Produces: a green repository ready for packaging

- [ ] **Step 1: Run the complete automated test suite**

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 2: Run both TypeScript checks**

Run: `npm run typecheck`

Expected: exit code 0 with no diagnostics.

- [ ] **Step 3: Build the production renderer and Electron process**

Run: `npm run build`

Expected: Vite build and Electron TypeScript compilation both finish with exit code 0.

- [ ] **Step 4: Inspect the final diff for migration safety and accidental content matching**

Run:

```powershell
git diff --check
rg -n "matchCategory\(" src electron tests
rg -n "resolveTypedCategory|keywords" electron/repositories.ts
```

Expected: no whitespace errors; all matcher calls pass only categories plus item title; keyword learning receives an item title, never log content.

- [ ] **Step 5: Commit any verification fixes**

If verification required tracked fixes, commit only those files:

```powershell
git add -u -- src electron tests
git commit -m "fix: complete item category integration"
```

If no fixes were needed, do not create an empty commit.
