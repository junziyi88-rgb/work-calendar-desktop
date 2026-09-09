# Manual Category Learning and Resizable Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace category selectors with learnable free-text classification and replace page-module resizing with persistent resizing on editable text fields.

**Architecture:** Keep database schema v3 and resolve typed category names inside the repository so category creation, keyword learning, and log saving share one authoritative path. Add a reusable `ResizableField` wrapper that persists only UI dimensions in local storage, then apply it to text-entry controls while removing all `ResizablePanel` usage.

**Tech Stack:** Electron, React 19, TypeScript, Zustand, sql.js/SQLite, Zod, Vitest, Testing Library, CSS native resize.

## Global Constraints

- Preserve every existing item, log, category, association, timestamp, and effort value.
- Keep database schema version 3 and the existing app id `com.local.workcalendar`.
- Learn the full trimmed work content as a precise keyword after a manual category save.
- Compare category names and learned keywords case-insensitively and without surrounding whitespace.
- Only editable text controls resize; date, time, select controls, buttons, calendars, lists, and page modules do not.
- Persist field dimensions in renderer local storage, never in the business database.

---

### Task 1: Repository support for typed categories and learning

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/shared/schemas.ts`
- Modify: `electron/repositories.ts`
- Modify: `tests/main/repositories.test.ts`

**Interfaces:**
- Consumes: existing `CategoryInput`, `categories.save`, and `matchCategory`.
- Produces: `WorkLogInput.categoryName?: string | null`; repository work-log save resolves/creates the category and appends the full content keyword for manual mode.

- [ ] **Step 1: Write the failing repository test**

Add a test that saves a manual log with `categoryName: '内容制作'`, asserts a category was created with keyword `完成课程脚本`, then saves an automatic log with the same content and asserts it receives the created category id and `categoryMode: 'auto'`. Add a second assertion that a case/whitespace-equivalent name reuses the category instead of creating another one.

- [ ] **Step 2: Run the repository test and verify RED**

Run: `npm test -- tests/main/repositories.test.ts --reporter=verbose`

Expected: FAIL because `categoryName` is not accepted or resolved.

- [ ] **Step 3: Extend the contract and validation**

Add to `WorkLogInput`:

```ts
categoryName?: string | null;
```

Add to `workLogInputSchema`:

```ts
categoryName: z.string().trim().max(80).nullable().optional()
```

- [ ] **Step 4: Resolve and learn categories in the repository**

Before persisting a manual work log, normalize `input.categoryName`. If blank, save `category_id = NULL`. Otherwise find an undeleted case-insensitive name; create it with the next muted palette color if absent; append the trimmed `content` to its keyword list if not already present. Preserve all existing keywords and use the resolved id for the work log. Automatic mode continues calling `matchCategory` after any learned rule exists.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- tests/main/repositories.test.ts tests/domain/categories.test.ts --reporter=verbose`

Expected: all selected tests pass.

Commit: `git commit -m "feat: learn categories from manual work logs"`

### Task 2: Free-text category entry

**Files:**
- Modify: `src/features/records/QuickEntry.tsx`
- Modify: `src/features/records/LogList.tsx`
- Modify: `tests/features/records/QuickEntry.test.tsx`
- Modify: `tests/features/records/LogList.test.tsx`

**Interfaces:**
- Consumes: `WorkLogInput.categoryName`, existing categories, and `matchCategory`.
- Produces: free-text category controls with existing-name completion, automatic suggestion display, manual clearing, and correct mode submission.

- [ ] **Step 1: Write failing component tests**

Assert that `分类` and `编辑分类` are textboxes, typing a new category submits `{ categoryName: '内容制作', categoryMode: 'manual' }`, leaving an untouched auto-filled category submits `categoryMode: 'auto'`, and clearing a touched field submits `{ categoryName: null, categoryMode: 'manual' }`.

- [ ] **Step 2: Run the component tests and verify RED**

Run: `npm test -- tests/features/records/QuickEntry.test.tsx tests/features/records/LogList.test.tsx --reporter=verbose`

Expected: FAIL because both controls are selects using encoded ids.

- [ ] **Step 3: Implement typed category state**

Use `categoryText` plus a boolean/manual-mode state. While untouched, mirror `matchCategory(...).name` into the textbox as content or item changes. On user input, switch to manual mode and preserve exactly what they type. Submit `categoryName` only for manual mode; submit automatic mode without a category name so the repository recalculates authoritatively.

Render an associated datalist:

```tsx
<input aria-label="分类" list={categoryListId} value={visibleCategoryText} onChange={handleCategoryChange} placeholder="输入分类，或等待自动匹配" />
<datalist id={categoryListId}>{categories.map((category) => <option key={category.id} value={category.name} />)}</datalist>
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- tests/features/records/QuickEntry.test.tsx tests/features/records/LogList.test.tsx --reporter=verbose`

Expected: all selected tests pass.

Commit: `git commit -m "feat: replace category selectors with learned text entry"`

### Task 3: Resize only editable text fields

**Files:**
- Delete: `src/components/ResizablePanel.tsx`
- Delete: `tests/components/ResizablePanel.test.tsx`
- Create: `src/components/ResizableField.tsx`
- Create: `tests/components/ResizableField.test.tsx`
- Modify: `src/features/records/QuickEntry.tsx`
- Modify: `src/features/records/LogList.tsx`
- Modify: `src/features/items/ItemsPage.tsx`
- Modify: `src/features/categories/CategoryManager.tsx`
- Modify: `src/features/records/RecordPage.tsx`
- Modify: `src/features/summary/SummaryPage.tsx`
- Modify: `src/styles/app.css`
- Modify: `tests/features/records/RecordPage.test.tsx`
- Modify: `tests/features/summary/SummaryPage.test.tsx`

**Interfaces:**
- Consumes: native `ResizeObserver`, local storage, and text input elements.
- Produces: `ResizableField({ id, label, children, minWidth?, minHeight? })` and no page-level resize controls.

- [ ] **Step 1: Write failing field-resize tests**

Assert the wrapper restores and persists dimensions under `work-log:field:<id>`, has the title `拖动右下角调整输入区域大小`, and that record/summary pages no longer render any `恢复…默认大小` module buttons.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/components/ResizableField.test.tsx tests/features/records/RecordPage.test.tsx tests/features/summary/SummaryPage.test.tsx --reporter=verbose`

Expected: FAIL because `ResizableField` does not exist and modules still expose reset controls.

- [ ] **Step 3: Implement and integrate `ResizableField`**

Create a wrapper using `resize: both`, `overflow: hidden`, `ResizeObserver`, and local storage. Apply it only to free-text controls in quick entry, log editing, new-item entry, and category management. Remove every `ResizablePanel` import/wrapper and its CSS. Keep the control at `width: 100%; height: 100%` inside the wrapper and clamp it to its form grid cell.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- tests/components/ResizableField.test.tsx tests/features/records/RecordPage.test.tsx tests/features/summary/SummaryPage.test.tsx tests/features/items/ItemsPage.test.tsx tests/features/categories/CategoryManager.test.tsx --reporter=verbose`

Expected: all selected tests pass.

Commit: `git commit -m "fix: resize editable fields instead of page modules"`

### Task 4: Release and preserve installed data

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Verify: `release/WorkLog-Setup-1.2.1.exe`

**Interfaces:**
- Produces: an in-place Windows 1.2.1 installer and verified live schema-v3 data.

- [ ] **Step 1: Run pre-release verification**

Run: `npm test -- --reporter=dot`, `npm run typecheck`, and `npm run build`.

Expected: 0 failures and exit code 0 for every command.

- [ ] **Step 2: Snapshot the latest live database**

Stop only processes whose executable path exactly matches `C:\Users\Administrator\AppData\Local\Programs\work-calendar-desktop\工作记录.exe`, copy the current SQLite file to a timestamped `pre-v1.2.1-*.sqlite`, and verify source/backup SHA-256 equality. Record item/log counts and a deterministic checksum over all pre-v3 business fields.

- [ ] **Step 3: Build and install version 1.2.1**

Set version `1.2.1`, run `npm run dist`, silently install `release/WorkLog-Setup-1.2.1.exe`, and launch the installed executable.

- [ ] **Step 4: Verify installed data and shortcut**

Assert schema version remains 3, counts and old-field checksum match the stopped pre-install snapshot, every log has `occurred_at`, installed file version is 1.2.1, and the desktop shortcut still targets the installed executable.

- [ ] **Step 5: Run final verification and commit**

Run: `npm test -- --reporter=dot`, `npm run typecheck`, `npm run build`, `git diff --check`, and `git status --short`.

Expected: all checks pass and the worktree is clean after `git commit -m "chore: release version 1.2.1"`.
