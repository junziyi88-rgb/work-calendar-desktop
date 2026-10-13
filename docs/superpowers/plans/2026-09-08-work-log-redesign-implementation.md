# Lightweight Work Log Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the timer-heavy work calendar with a Windows desktop work log for manual progress entries, long-running items, weekly summaries, monthly hours, and OKR copy.

**Architecture:** Keep Electron, React, TypeScript, Zustand, Zod, sql.js, and the local SQLite file. Add a versioned work-item/work-log schema and narrow IPC bridge, then replace the renderer with three focused destinations: Record, Items, and Summary. Legacy tables remain in place while their data is migrated transactionally into the new schema.

**Tech Stack:** Electron 44, React 19, TypeScript 5.9, Vite 7, Zustand 5, Zod 4, sql.js 1.13, Vitest, Testing Library, electron-builder NSIS.

## Global Constraints

- Target Windows 10 and Windows 11.
- Store all user data locally in SQLite without login or cloud sync.
- Do not include timers, planned time, project hierarchy, tags, notifications, tray behavior, or hour-grid calendar interaction.
- Save a normal work log in less than ten seconds using keyboard or mouse.
- Use exactly three primary destinations: `记录`, `事项`, and `总结`.
- Create desktop and Start Menu shortcuts named `工作记录` from the installer.
- Preserve existing user data through a transactional, backed-up migration.

---

### Task 1: Work-log domain contracts and pure functions

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/schemas.ts`
- Create: `src/domain/effort.ts`
- Create: `src/domain/periods.ts`
- Create: `src/domain/summaries.ts`
- Create: `tests/domain/effort.test.ts`
- Create: `tests/domain/summaries.test.ts`

**Interfaces:**
- Produces: `WorkItem`, `WorkLog`, `WorkLogInput`, `WorkItemInput`, `WorkLogData`, `SummaryResult`.
- Produces: `parseEffort(value: string): number | null` and `formatEffort(minutes: number): string`.
- Produces: `weekStart(date: string): string`, `periodRange(kind, anchor)`, and `buildSummary(data, kind, anchor)`.

- [ ] **Step 1: Write failing effort parsing tests**

```ts
expect(parseEffort('1.5h')).toBe(90);
expect(parseEffort('90m')).toBe(90);
expect(parseEffort('1小时30分')).toBe(90);
expect(parseEffort('')).toBeNull();
expect(() => parseEffort('25h')).toThrow('单条记录不能超过 24 小时');
```

- [ ] **Step 2: Run the effort test and confirm failure**

Run: `npx vitest run tests/domain/effort.test.ts`

Expected: FAIL because `src/domain/effort.ts` does not exist.

- [ ] **Step 3: Implement normalized effort parsing**

```ts
export function parseEffort(value: string): number | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  let minutes: number;
  const chinese = text.match(/^(?:(\d+(?:\.\d+)?)\s*小时)?\s*(?:(\d+)\s*分(?:钟)?)?$/);
  if (chinese?.[1] || chinese?.[2]) minutes = Math.round(Number(chinese[1] ?? 0) * 60 + Number(chinese[2] ?? 0));
  else if (/^\d+(?:\.\d+)?h$/.test(text)) minutes = Math.round(Number(text.slice(0, -1)) * 60);
  else if (/^\d+(?:\.\d+)?m$/.test(text)) minutes = Math.round(Number(text.slice(0, -1)));
  else if (/^\d+(?:\.\d+)?$/.test(text)) minutes = Math.round(Number(text) * 60);
  else throw new Error('请输入如 1.5h、90m 或 1小时30分');
  if (minutes > 1440) throw new Error('单条记录不能超过 24 小时');
  return minutes;
}
```

- [ ] **Step 4: Write failing summary tests**

```ts
const result = buildSummary(data, 'week', '2026-09-08');
expect(result.totalMinutes).toBe(210);
expect(result.groups[0]).toMatchObject({ itemTitle: '课程上线', minutes: 150 });
expect(result.missingEffort).toHaveLength(1);
expect(result.copyText).toContain('本周工作总结');
```

- [ ] **Step 5: Implement contracts, period boundaries, validation schemas, and summaries**

Use `periodKind: 'day' | 'week'`, store week anchors as Monday `YYYY-MM-DD`, group logs without merging them, and exclude `effortMinutes: null` from totals while retaining them in `missingEffort`.

- [ ] **Step 6: Run domain tests**

Run: `npx vitest run tests/domain/effort.test.ts tests/domain/summaries.test.ts`

Expected: both test files PASS.

- [ ] **Step 7: Commit the domain layer**

```powershell
git add src/shared src/domain/effort.ts src/domain/periods.ts src/domain/summaries.ts tests/domain/effort.test.ts tests/domain/summaries.test.ts
git commit -m "feat: add work log domain model"
```

### Task 2: SQLite schema, migration, and repositories

**Files:**
- Modify: `electron/database.ts`
- Modify: `electron/repositories.ts`
- Replace: `tests/main/repositories.test.ts`
- Create: `tests/main/migration.test.ts`

**Interfaces:**
- Consumes: domain contracts from Task 1.
- Produces: `repositories.workItems` with `list`, `get`, `save`, `complete`, `reopen`, `softDelete`, and `restore`.
- Produces: `repositories.workLogs` with `list`, `get`, `save`, `softDelete`, and `restore`.
- Produces: `repositories.workLogData()`.

- [ ] **Step 1: Write repository tests for create, edit, complete, and Undo**

```ts
const item = repositories.workItems.save({ title: '课程上线' });
const log = repositories.workLogs.save({ workItemId: item.id, content: '完成终审', effortMinutes: 90, periodKind: 'day', periodStart: '2026-09-08' });
expect(repositories.workLogData().logs[0].content).toBe('完成终审');
repositories.workLogs.softDelete(log.id);
expect(repositories.workLogData().logs).toHaveLength(0);
repositories.workLogs.restore(log.id);
expect(repositories.workLogData().logs).toHaveLength(1);
```

- [ ] **Step 2: Run repository tests and confirm failure**

Run: `npx vitest run tests/main/repositories.test.ts`

Expected: FAIL because work-log repositories do not exist.

- [ ] **Step 3: Add schema version 2**

Add `work_items` and `work_logs` tables with foreign keys, deleted timestamps, period fields, effort constraints, and indexes on `period_start`, `work_item_id`, and `updated_at`. Run changes in a transaction and set `meta.schema_version` only after success.

- [ ] **Step 4: Add deterministic legacy migration**

Insert each legacy task once into `work_items`. Convert closed legacy segments into logs with rounded duration, convert task notes into zero-effort logs, preserve completed state, and close an active legacy segment at migration time with an explicit migrated label. Guard migration with a `legacy_migrated_v2` meta key.

- [ ] **Step 5: Implement work-item and work-log repositories**

Reject blank titles/content, reject logs on completed items, update an item's latest summary when a log is saved, and retain old repositories only long enough for migration compatibility.

- [ ] **Step 6: Run persistence and migration tests**

Run: `npx vitest run tests/main/repositories.test.ts tests/main/migration.test.ts`

Expected: PASS, including rollback when a migration statement fails.

- [ ] **Step 7: Commit persistence changes**

```powershell
git add electron/database.ts electron/repositories.ts tests/main/repositories.test.ts tests/main/migration.test.ts
git commit -m "feat: persist work items and progress logs"
```

### Task 3: Narrow IPC bridge, export, and window lifecycle

**Files:**
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`
- Delete: `electron/desktop.ts`
- Modify: `src/domain/exports.ts`
- Modify: `src/shared/contracts.ts`
- Create: `tests/domain/workLogExports.test.ts`

**Interfaces:**
- Produces bridge methods: `bootstrap`, `saveWorkItem`, `completeWorkItem`, `reopenWorkItem`, `deleteWorkItem`, `restoreWorkItem`, `saveWorkLog`, `deleteWorkLog`, `restoreWorkLog`, `createBackup`, `restoreBackup`, `exportData('csv' | 'json')`, and `on('data-changed')`.

- [ ] **Step 1: Write failing CSV and JSON export tests**

```ts
expect(serializeWorkLogCsv(data)).toContain('周期,事项,工作内容,工时');
expect(serializeWorkLogCsv(data)).toContain('课程上线,完成终审,1.5');
expect(JSON.parse(serializeWorkLogJson(data)).logs).toHaveLength(1);
```

- [ ] **Step 2: Replace the IPC surface**

Validate all save calls with Zod, emit `data-changed` after mutations, return complete `WorkLogData` from bootstrap, and limit export to CSV and JSON.

- [ ] **Step 3: Remove desktop timer behavior**

Delete tray, global shortcut, notifications, power-monitor, and floating-window setup. Remove the close interception so closing the main window exits normally; keep the database flush in `before-quit`.

- [ ] **Step 4: Run IPC-adjacent type checking and export tests**

Run: `npx vitest run tests/domain/workLogExports.test.ts && npm run typecheck`

Expected: export tests PASS and both renderer/electron TypeScript projects report no errors.

- [ ] **Step 5: Commit the desktop backend**

```powershell
git add electron src/shared/contracts.ts src/domain/exports.ts tests/domain/workLogExports.test.ts
git commit -m "feat: expose lightweight work log desktop API"
```

### Task 4: Renderer store and quick-record experience

**Files:**
- Replace: `src/store/useAppStore.ts`
- Create: `src/features/records/RecordPage.tsx`
- Create: `src/features/records/QuickEntry.tsx`
- Create: `src/features/records/LogList.tsx`
- Create: `tests/features/records/QuickEntry.test.tsx`
- Create: `tests/features/records/RecordPage.test.tsx`

**Interfaces:**
- Consumes: narrow bridge from Task 3.
- Produces store actions for hydrating, saving and deleting/restoring items and logs.
- Produces `QuickEntry` with `onSave(input: WorkLogInput, newItemTitle?: string)`.

- [ ] **Step 1: Write the quick-entry interaction test**

```tsx
await user.type(screen.getByLabelText('工作内容'), '完成第三轮脚本修改');
await user.type(screen.getByLabelText('工时'), '1.5h');
await user.click(screen.getByRole('button', { name: '记录' }));
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ content: '完成第三轮脚本修改', effortMinutes: 90 }));
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run tests/features/records/QuickEntry.test.tsx`

Expected: FAIL because `QuickEntry` does not exist.

- [ ] **Step 3: Implement the new store**

Keep one `WorkLogData` object, a loading flag, and a recoverable error. Every mutation rehydrates after success. A delete action returns an Undo callback that invokes the matching restore IPC method.

- [ ] **Step 4: Implement quick entry and the date/week browser**

Default to Today, allow selecting a local date or week, show recent active items, create a new item from typed text, parse effort inline, preserve form content on failure, and reset only after confirmed save.

- [ ] **Step 5: Implement selected-period log rows and inline editing**

Show content, item, effort, and period. Support inline edits and delete-with-Undo. Mark missing effort as `待补工时` and exclude it from the displayed total.

- [ ] **Step 6: Run record-screen tests**

Run: `npx vitest run tests/features/records`

Expected: all record feature tests PASS.

- [ ] **Step 7: Commit the record flow**

```powershell
git add src/store/useAppStore.ts src/features/records tests/features/records
git commit -m "feat: add ten-second work logging flow"
```

### Task 5: Long-running work items and progress timeline

**Files:**
- Create: `src/features/items/ItemsPage.tsx`
- Create: `src/features/items/ItemDetail.tsx`
- Create: `tests/features/items/ItemsPage.test.tsx`

**Interfaces:**
- Consumes: work items, work logs, and store actions from Tasks 1 and 4.

- [ ] **Step 1: Write a failing item timeline test**

```tsx
expect(screen.getByText('桌面工作记录工具')).toBeInTheDocument();
await user.click(screen.getByText('桌面工作记录工具'));
expect(screen.getByText('重新梳理真实需求')).toBeInTheDocument();
expect(screen.getByText('累计 18.5 小时')).toBeInTheDocument();
```

- [ ] **Step 2: Implement active/completed item lists**

Show title, latest summary, total effort, first/latest activity, and a two-state active/completed filter. Do not add priority, deadline, tags, project nesting, or kanban columns.

- [ ] **Step 3: Implement the detail timeline and inline progress form**

Order newest first by period and creation time, label week-only logs with their Monday–Sunday range, reuse `QuickEntry`, and require reopening before adding progress to a completed item.

- [ ] **Step 4: Run item tests and commit**

Run: `npx vitest run tests/features/items`

Expected: PASS.

```powershell
git add src/features/items tests/features/items
git commit -m "feat: add long-running work item timelines"
```

### Task 6: Weekly and monthly summaries

**Files:**
- Create: `src/features/summary/SummaryPage.tsx`
- Create: `src/features/summary/SummaryCopy.ts`
- Create: `tests/features/summary/SummaryPage.test.tsx`

**Interfaces:**
- Consumes: `buildSummary` from Task 1 and `WorkLogData` from the store.
- Produces clipboard actions for `复制周总结` and `复制 OKR 素材`.

- [ ] **Step 1: Write a failing weekly summary test**

```tsx
expect(screen.getByText('本周共 3.5 小时')).toBeInTheDocument();
expect(screen.getByText('课程上线')).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: '复制周总结' }));
expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('完成第三轮脚本修改'));
```

- [ ] **Step 2: Implement weekly summary**

Display total effort, item groups, chronological bullets, completed items, active progressed items, and missing-effort entries. Include previous/next week controls and a Today action.

- [ ] **Step 3: Implement monthly summary and OKR copy**

Reuse the same component with a Week/Month switch. Monthly copy uses one heading per item, progress bullets, completion state, and item effort. Provide CSV export through the bridge.

- [ ] **Step 4: Run summary tests and commit**

Run: `npx vitest run tests/features/summary`

Expected: PASS.

```powershell
git add src/features/summary tests/features/summary
git commit -m "feat: add weekly and monthly work summaries"
```

### Task 7: Minimal application shell and visual redesign

**Files:**
- Replace: `src/App.tsx`
- Replace: `src/styles/app.css`
- Modify: `src/styles/tokens.css`
- Replace: `tests/smoke/App.test.tsx`
- Delete: `src/features/calendar`
- Delete: `src/features/insights`
- Delete: `src/features/projects`
- Delete: `src/features/recycle`
- Delete: `src/features/review`
- Delete: `src/features/settings`
- Delete: `src/features/timer`

**Interfaces:**
- Consumes: Record, Items, and Summary pages.

- [ ] **Step 1: Replace the shell test**

```tsx
expect(screen.getByRole('button', { name: '记录' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '事项' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '总结' })).toBeInTheDocument();
expect(screen.queryByText('计时')).not.toBeInTheDocument();
```

- [ ] **Step 2: Build the three-destination shell**

Use a compact top navigation, one content column, and an overflow menu for theme, backup, restore, JSON export, and CSV export. Preserve keyboard focus and responsive behavior down to the minimum window size.

- [ ] **Step 3: Apply the text-first visual system**

Use warm neutral surfaces, thin borders, restrained blue selection, no gradients, no heavy shadows, and no dashboard charts. Make the quick-entry field the visual focus and keep summary typography subordinate to the written work.

- [ ] **Step 4: Remove obsolete renderer modules and FullCalendar packages**

Run: `npm uninstall @fullcalendar/core @fullcalendar/daygrid @fullcalendar/interaction @fullcalendar/react @fullcalendar/timegrid`

- [ ] **Step 5: Run renderer tests, typecheck, and commit**

Run: `npm test && npm run typecheck`

Expected: all tests PASS and TypeScript reports no errors.

```powershell
git add package.json package-lock.json src tests
git commit -m "feat: redesign app as a minimal work log"
```

### Task 8: Windows identity, packaging, installation, and verification

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Reuse: `assets/icon.png`
- Create: `artifacts/work-log-release.png`

**Interfaces:**
- Produces: `release/WorkLog-Setup-1.1.0.exe`.
- Produces: desktop shortcut `%USERPROFILE%\Desktop\工作记录.lnk`.

- [ ] **Step 1: Update package identity and installer shortcuts**

Set version `1.1.0`, description to the lightweight work-log purpose, product name and shortcut name to `工作记录`, artifact name to `WorkLog-Setup-${version}.${ext}`, and retain `createDesktopShortcut: true` and `createStartMenuShortcut: true`.

- [ ] **Step 2: Update README**

Document quick manual logging, long-running item timelines, weekly summaries, monthly OKR material, local storage, backup/export, and the removal of timer behavior.

- [ ] **Step 3: Run the full release gate**

Run: `npm test`, `npm run typecheck`, `npm run build`, and `npm run dist`.

Expected: all tests PASS, typecheck/build exit 0, and `release/WorkLog-Setup-1.1.0.exe` exists.

- [ ] **Step 4: Install silently and verify the desktop shortcut**

Run the NSIS installer with `/S` through `Start-Process -WindowStyle Hidden -Wait`, then verify that `%USERPROFILE%\Desktop\工作记录.lnk` resolves to the installed `工作记录.exe`.

- [ ] **Step 5: Launch and smoke test the packaged app**

Create a work item, add a daily log with `1.5h`, add a week-level log, restart, confirm persistence, inspect weekly/monthly summaries, and capture `artifacts/work-log-release.png`.

- [ ] **Step 6: Commit release metadata**

```powershell
git add package.json package-lock.json README.md
git commit -m "chore: package work log desktop release"
```

