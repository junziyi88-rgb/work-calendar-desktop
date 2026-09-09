# Work Log Time, Content, and Category Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Windows work log with editable timestamps and links, reusable historical content, calendar-based summary selection, and deterministic keyword categories without losing existing data.

**Architecture:** Extend the shared contracts and SQLite schema to version 3, keeping migration transactional and backward compatible. Put deterministic category matching and content-option derivation in pure domain functions, expose category mutations through the existing Electron bridge, and keep the React surface within the existing three-page navigation.

**Tech Stack:** Electron 44, React 19, TypeScript 5.9, Zustand, Zod, sql.js, Vitest, Testing Library, Vite, electron-builder/NSIS.

## Global Constraints

- Preserve every existing work item and work log field value during migration.
- Keep `com.local.workcalendar` and `%APPDATA%/work-calendar-desktop` unchanged.
- Create and hash-verify a timestamped database backup before any upgrade installation.
- Use local system date and time for new records; both remain manually editable.
- Keep exactly three primary pages: 记录, 事项, 总结.
- Classification is offline, deterministic, keyword-based, and manually overridable.
- Keep the existing warm monochrome, flat, minimal visual language.

---

### Task 1: Schema v3 and shared contracts

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/schemas.ts`
- Modify: `electron/database.ts`
- Modify: `tests/main/migration.test.ts`

**Interfaces:**
- Produces: `Category`, `CategoryInput`, `CategoryMode`, enriched `WorkLog`, enriched `WorkLogInput`, `WorkLogData.categories`, `WorkLogData.contentOptions`.
- Produces: schema version 3 with `categories` and additive `work_logs` columns.

- [ ] **Step 1: Write failing migration tests**

Add tests which construct a version-2 database, open the v3 schema, and assert that all original values remain while `occurredAt` is backfilled from `createdAt`; also assert a fresh database contains the new columns and category table.

- [ ] **Step 2: Run the migration tests and verify RED**

Run: `npm test -- tests/main/migration.test.ts`
Expected: FAIL because `occurredAt`, `categoryId`, and schema version 3 do not exist.

- [ ] **Step 3: Add contracts, validation, and a transactional additive migration**

Add the new types and schemas. In `openDatabase`/`createMemoryDatabase`, create current tables, inspect `PRAGMA table_info(work_logs)`, add missing columns inside `BEGIN`/`COMMIT`, backfill `occurred_at = created_at`, and write `schema_version=3`; roll back on any error.

- [ ] **Step 4: Run migration tests and verify GREEN**

Run: `npm test -- tests/main/migration.test.ts`
Expected: all migration tests pass.

### Task 2: Classification and reusable-content domain logic

**Files:**
- Create: `src/domain/categories.ts`
- Create: `tests/domain/categories.test.ts`
- Modify: `src/domain/summaries.ts`
- Modify: `tests/domain/summaries.test.ts`

**Interfaces:**
- Produces: `matchCategory(categories, itemTitle, content): string | null`.
- Produces: `historicalContentOptions(logs): string[]` ordered by most recent usage.
- Produces: `filterWorkLogs(logs, filters)` shared by record and summary views.

- [ ] **Step 1: Write failing pure-domain tests**

Cover case-insensitive matching across item title and content, longest-keyword precedence, stable category ordering on ties, deleted-category exclusion, sticky manual mode inputs, content de-duplication, and item/content/category filtering.

- [ ] **Step 2: Run domain tests and verify RED**

Run: `npm test -- tests/domain/categories.test.ts`
Expected: FAIL because the category domain module does not exist.

- [ ] **Step 3: Implement the minimal pure functions**

Normalize with `trim().toLocaleLowerCase()`, rank matches by keyword length then category creation order, derive content from non-deleted logs sorted by `updatedAt` descending, and apply optional filter values conjunctively.

- [ ] **Step 4: Run domain tests and verify GREEN**

Run: `npm test -- tests/domain/categories.test.ts tests/domain/summaries.test.ts`
Expected: all selected tests pass.

### Task 3: Repository, IPC, and category reclassification

**Files:**
- Modify: `electron/repositories.ts`
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `src/store/useAppStore.ts`
- Modify: `tests/main/repositories.test.ts`

**Interfaces:**
- Produces: `repositories.categories.list/save/softDelete`.
- Produces: bridge methods `saveCategory(input)` and `deleteCategory(id)`.
- `workLogs.save` accepts an explicit manual category or automatically calls `matchCategory`.

- [ ] **Step 1: Write failing repository tests**

Assert timestamps are persisted, the linked item and content can both change, automatic matches are stored, manual overrides survive edits, keyword changes reclassify only auto records, and bootstrap returns content options.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm test -- tests/main/repositories.test.ts`
Expected: FAIL on missing category repository and enriched log fields.

- [ ] **Step 3: Implement repository and bridge behavior**

Map the new columns, preserve an existing completed item link during edits, validate any newly selected completed item, implement category CRUD and auto-only reclassification in transactions, expose bridge calls, and refresh Zustand after every mutation.

- [ ] **Step 4: Run repository tests and verify GREEN**

Run: `npm test -- tests/main/repositories.test.ts tests/main/migration.test.ts`
Expected: all selected tests pass.

### Task 4: New-record timestamp and historical content suggestions

**Files:**
- Modify: `src/features/records/QuickEntry.tsx`
- Modify: `src/features/records/RecordPage.tsx`
- Modify: `tests/features/records/QuickEntry.test.tsx`

**Interfaces:**
- Consumes: `WorkLogData.contentOptions`, categories, `matchCategory`.
- Produces: `WorkLogInput.occurredAt` from editable local date/time controls.

- [ ] **Step 1: Write failing component tests**

Use fake time to assert the current local date/time defaults, manual date/time edits reach `onSave`, prior content appears as suggestions, and the auto-category suggestion can be manually changed.

- [ ] **Step 2: Run QuickEntry tests and verify RED**

Run: `npm test -- tests/features/records/QuickEntry.test.tsx`
Expected: FAIL because time, category, and content suggestions are absent.

- [ ] **Step 3: Implement the compact entry controls**

Add an editable time input beside the date input, a datalist for historical content, a compact category select showing the rule suggestion, and reset date/time to the current system clock after a successful save.

- [ ] **Step 4: Run QuickEntry tests and verify GREEN**

Run: `npm test -- tests/features/records/QuickEntry.test.tsx`
Expected: all QuickEntry tests pass.

### Task 5: Full record editing and filters

**Files:**
- Modify: `src/features/records/LogList.tsx`
- Modify: `src/features/records/RecordPage.tsx`
- Modify: `src/styles/app.css`
- Create: `tests/features/records/LogList.test.tsx`
- Modify: `tests/features/records/QuickEntry.test.tsx`

**Interfaces:**
- Consumes: items, categories, content options, `filterWorkLogs`.
- Produces: edits for work item, content, effort, period kind/date, occurred time, and category mode.

- [ ] **Step 1: Write failing edit and filter tests**

Assert the editor preloads every field, saving changes both linked item and content, completed existing links remain available, and record filters combine item/content/category.

- [ ] **Step 2: Run record component tests and verify RED**

Run: `npm test -- tests/features/records/LogList.test.tsx`
Expected: FAIL because the full editor and filters are absent.

- [ ] **Step 3: Implement the full inline editor and compact filter row**

Use native selects, date/time inputs and the existing flat border system; show category as a small muted tag and keep row actions keyboard accessible.

- [ ] **Step 4: Run record component tests and verify GREEN**

Run: `npm test -- tests/features/records/LogList.test.tsx tests/features/records/QuickEntry.test.tsx`
Expected: all selected tests pass.

### Task 6: Summary calendar and explicit period labels

**Files:**
- Create: `src/features/summary/PeriodCalendar.tsx`
- Modify: `src/features/summary/SummaryPage.tsx`
- Modify: `src/domain/periods.ts`
- Modify: `src/styles/app.css`
- Modify: `tests/features/summary/SummaryPage.test.tsx`
- Modify: `tests/domain/time.test.ts`

**Interfaces:**
- Produces: `weekNumber(anchor)`, `formatSummaryPeriod(kind, anchor)`.
- Produces: a month grid that sets a summary anchor by clicked day and highlights the selected week/month.

- [ ] **Step 1: Write failing period and summary tests**

Assert ISO week numbering around year boundaries, exact Chinese week/month headings, date selection, “回到本周/本月” labels, and filtered summary results.

- [ ] **Step 2: Run period and summary tests and verify RED**

Run: `npm test -- tests/features/summary/SummaryPage.test.tsx tests/domain/time.test.ts`
Expected: FAIL on missing calendar and explicit period text.

- [ ] **Step 3: Implement period helpers, calendar, and summary filters**

Render a Monday-first six-row month grid with native buttons, select the clicked date, visually mark the active seven-day week, and pass filtered data into `buildSummary`.

- [ ] **Step 4: Run period and summary tests and verify GREEN**

Run: `npm test -- tests/features/summary/SummaryPage.test.tsx tests/domain/time.test.ts tests/domain/summaries.test.ts`
Expected: all selected tests pass.

### Task 7: Lightweight category manager

**Files:**
- Create: `src/features/categories/CategoryManager.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`
- Create: `tests/features/categories/CategoryManager.test.tsx`
- Modify: `tests/smoke/App.test.tsx`

**Interfaces:**
- Consumes: `data.categories`, `saveCategory`, `deleteCategory`.
- Produces: modal/side panel fields for name, muted color, and comma-separated keywords.

- [ ] **Step 1: Write failing category-manager tests**

Assert opening from “更多操作”, creating and editing rules, trimming/de-duplicating keywords, and soft deletion with an explicit in-panel confirmation.

- [ ] **Step 2: Run category UI tests and verify RED**

Run: `npm test -- tests/features/categories/CategoryManager.test.tsx tests/smoke/App.test.tsx`
Expected: FAIL because category management is not exposed.

- [ ] **Step 3: Implement the minimal manager**

Add one “管理分类” menu action and an accessible compact dialog; use four muted preset colors and no new navigation entry.

- [ ] **Step 4: Run category UI tests and verify GREEN**

Run: `npm test -- tests/features/categories/CategoryManager.test.tsx tests/smoke/App.test.tsx`
Expected: all selected tests pass.

### Task 8: Resizable and persistent module layout

**Files:**
- Create: `src/components/ResizablePanel.tsx`
- Create: `tests/components/ResizablePanel.test.tsx`
- Modify: `src/features/records/RecordPage.tsx`
- Modify: `src/features/items/ItemsPage.tsx`
- Modify: `src/features/summary/SummaryPage.tsx`
- Modify: `src/features/categories/CategoryManager.tsx`
- Modify: `src/styles/app.css`

- [x] **Step 1: Write failing persistence and page-integration tests**

Assert restored dimensions, resize persistence, per-module reset controls, and integration on records and summaries.

- [x] **Step 2: Implement a reusable resizable wrapper**

Use native desktop resizing, local storage per module, minimum sizes, overflow access, and a low-visibility reset control.

- [x] **Step 3: Apply it to every major content module**

Cover record entry/list, item creation/list/detail, summary calendar/filters/content/stats, and category management without changing the main navigation.

- [x] **Step 4: Run focused tests**

Run: `npm test -- tests/components/ResizablePanel.test.tsx tests/features/records/RecordPage.test.tsx tests/features/summary/SummaryPage.test.tsx`
Expected: all selected tests pass.

### Task 9: Release, installation, and data-preservation verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Verify: `release/WorkLog-Setup-1.2.0.exe`

**Interfaces:**
- Produces: in-place Windows installer version 1.2.0 using the same app id and shortcut name.

- [ ] **Step 1: Run the complete pre-release verification**

Run: `npm test -- --reporter=dot && npm run typecheck && npm run build`
Expected: 0 failing tests, typecheck exit 0, build exit 0.

- [ ] **Step 2: Upgrade version and build the installer**

Set package version to `1.2.0` without changing `build.appId`, then run `npm run dist`.
Expected: `release/WorkLog-Setup-1.2.0.exe` exists.

- [ ] **Step 3: Snapshot live data counts and install in place**

Read item/log counts and a deterministic content/effort checksum from the live database, stop only the running Work Log process, launch the NSIS installer silently, then reopen the application.

- [ ] **Step 4: Verify migrated live data and desktop shortcut**

Assert the post-upgrade database has schema version 3, the same item/log counts and content/effort checksum, a non-null `occurred_at` for every existing log, and `C:\Users\Administrator\Desktop\工作记录.lnk` still targets the installed executable.

- [ ] **Step 5: Run fresh final verification and commit**

Run: `npm test -- --reporter=dot && npm run typecheck && npm run build && git status --short`
Expected: all tests/typechecks/builds pass and only intended files are present before the release commit.
