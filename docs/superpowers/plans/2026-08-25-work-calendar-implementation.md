# Work Calendar Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a packaged personal Windows work-calendar application for planning tasks, recording actual time, and reviewing daily and weekly work.

**Architecture:** Electron owns SQLite and Windows integrations; a context-isolated preload exposes typed operations; React renders calendar and support screens. Pure domain functions sit outside Electron so behavior can be verified quickly with Vitest.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Testing Library, FullCalendar, Zustand, Zod, better-sqlite3, electron-builder.

## Global Constraints

- Target Windows 10 and Windows 11.
- Store user data locally in SQLite and require no login.
- Keep planned intervals separate from actual work segments.
- Ship day, week, and month calendar views with week as the default.
- Exclude recurring tasks, sync, collaboration, third-party calendar connections, encryption, and AI.
- Follow test-driven development for domain, persistence, IPC, and user-visible workflows.
- Use a minimal light/dark interface with no gradients.

---

## File map

- `electron/main.ts`: application and window lifecycle only.
- `electron/database.ts`: connection, migration, transaction, and backup primitives.
- `electron/repositories.ts`: project, tag, task, segment, review, setting, and recycle-bin persistence.
- `electron/ipc.ts`: validated IPC registration.
- `electron/desktop.ts`: tray, shortcuts, notifications, power events, and floating window.
- `electron/exports.ts`: CSV, JSON, and ICS serialization and file writing.
- `electron/preload.ts`: context bridge.
- `src/shared/contracts.ts`: all serializable types and bridge signatures.
- `src/domain/*.ts`: pure time, statistics, task-state, and export logic.
- `src/store/useAppStore.ts`: renderer orchestration and optimistic state.
- `src/features/calendar/*`: calendar views, event mapping, and editing dialogs.
- `src/features/timer/*`: running timer surfaces and sleep reconciliation dialog.
- `src/features/review/*`: daily review and carry-forward flow.
- `src/features/insights/*`: summary cards and distribution visuals.
- `src/features/settings/*`: preferences, backups, and export controls.
- `src/App.tsx`: navigation shell and route composition.
- `src/styles/*`: design tokens and component styles.
- `tests/*`: tests mirroring domain, main-process, and renderer responsibilities.

### Task 1: Runnable shell and typed contracts

**Files:** Create `package.json`, TypeScript/Vite/Vitest configuration, `index.html`, `electron/main.ts`, `electron/preload.ts`, `src/main.tsx`, `src/App.tsx`, `src/shared/contracts.ts`, and `tests/smoke/App.test.tsx`.

**Interfaces:** Produce `window.workCalendar: WorkCalendarBridge`, `Task`, `TimeSegment`, `Project`, `Tag`, `DailyReview`, `AppSettings`, and `CalendarQuery`.

- [ ] Write a renderer smoke test asserting the shell exposes Calendar, Review, Insights, and Settings navigation.
- [ ] Run `npm test -- tests/smoke/App.test.tsx` and confirm it fails because the shell does not exist.
- [ ] Add the minimal React shell, Electron lifecycle, preload declaration, and build configuration.
- [ ] Run the smoke test and `npm run typecheck`; confirm both pass.
- [ ] Commit the runnable shell.

### Task 2: Domain rules for tasks, timers, and statistics

**Files:** Create `src/domain/time.ts`, `src/domain/tasks.ts`, `src/domain/statistics.ts`, `tests/domain/time.test.ts`, `tests/domain/tasks.test.ts`, and `tests/domain/statistics.test.ts`.

**Interfaces:** Produce `splitSegmentByLocalDay(segment, timezone)`, `durationMinutes(segments)`, `canStartTimer(active, allowParallel)`, `transitionTask(task, status, now)`, and `summarizeDay(input)`.

- [ ] Write failing tests for cross-midnight splitting, open-segment duration, single/parallel timer rules, valid status transitions, project shares, completion rate, and planned deviation.
- [ ] Run `npm test -- tests/domain` and verify failures are caused by missing functions.
- [ ] Implement the pure functions with explicit date and time inputs.
- [ ] Run the domain suite and typecheck; confirm all pass.
- [ ] Commit domain behavior.

### Task 3: SQLite schema and repositories

**Files:** Create `electron/database.ts`, `electron/repositories.ts`, `electron/schema.ts`, `tests/main/database.test.ts`, and `tests/main/repositories.test.ts`.

**Interfaces:** Produce `openDatabase(path)`, `migrate(db)`, `createRepositories(db)`, transactional CRUD for every model, `softDelete`, `restore`, `emptyRecycleBin`, and `queryCalendar`.

- [ ] Write failing repository tests against a temporary SQLite database for schema creation, CRUD, tag joins, active segments, soft deletion, restore, filters, and daily review upsert.
- [ ] Run the repository tests and verify missing repository failures.
- [ ] Implement schema version 1 and repository methods using parameterized queries and transactions.
- [ ] Run repository and domain suites; confirm all pass.
- [ ] Commit persistence.

### Task 4: IPC and renderer state

**Files:** Create `electron/ipc.ts`, `src/store/useAppStore.ts`, `src/shared/schemas.ts`, `tests/main/ipc.test.ts`, and `tests/store/useAppStore.test.ts`.

**Interfaces:** Expose bridge namespaces `projects`, `tags`, `tasks`, `segments`, `reviews`, `settings`, `backup`, `export`, and `desktop`; produce store actions `hydrate`, `saveTask`, `startTimer`, `pauseTimer`, `stopTimer`, `moveTask`, and `refreshCalendar`.

- [ ] Write failing tests proving malformed IPC is rejected, writes refresh affected state, and failed saves preserve draft data.
- [ ] Run IPC/store tests and verify expected failures.
- [ ] Implement Zod validation, handlers, preload calls, and Zustand orchestration.
- [ ] Run IPC/store tests and typecheck; confirm all pass.
- [ ] Commit the process boundary.

### Task 5: Calendar and task editor

**Files:** Create `src/features/calendar/CalendarPage.tsx`, `WorkCalendar.tsx`, `TaskEditor.tsx`, `QuickAdd.tsx`, `eventMapping.ts`, related CSS, and `tests/features/calendar/*.test.tsx`.

**Interfaces:** Consume store task and segment collections; produce drag-create, move, resize, view switching, date navigation, search, filters, and task editing interactions.

- [ ] Write failing UI tests for day/week/month switching, visual planned/actual distinction, drag callbacks, manual segment creation, status changes, and title validation.
- [ ] Run calendar tests and confirm expected failures.
- [ ] Implement FullCalendar mapping and accessible dialogs with planned blocks dashed and actual blocks solid.
- [ ] Run calendar tests, typecheck, and renderer build; confirm all pass.
- [ ] Commit the calendar workflow.

### Task 6: Timer, tray, shortcuts, sleep, and notifications

**Files:** Create `electron/desktop.ts`, `src/features/timer/TimerBar.tsx`, `FloatingTimer.tsx`, `SleepReconcileDialog.tsx`, and corresponding tests.

**Interfaces:** Expose desktop events `timer-changed`, `resume-with-active-segments`, `quick-add-requested`, and `show-main-window`; consume timer store actions.

- [ ] Write failing tests for timer controls, switching confirmation, privacy-safe notification text, sleep interval reconciliation, and desktop event handling.
- [ ] Run timer/desktop tests and verify missing behavior failures.
- [ ] Implement one-active-timer default, tray menu, configurable shortcut, always-on-top floating window, power resume handling, and long-timer notifications.
- [ ] Run tests and package an unpacked Windows build; confirm all pass.
- [ ] Commit desktop behavior.

### Task 7: Review, insights, projects, search, and recycle bin

**Files:** Create `src/features/review/*`, `src/features/insights/*`, `src/features/projects/*`, `src/features/search/*`, `src/features/recycle/*`, and matching tests.

**Interfaces:** Consume `summarizeDay`, repository filters, and review/store actions; produce daily review, carry-forward, project/tag management, filtered results, statistics, restore, and permanent-delete flows.

- [ ] Write failing tests for summary values, carry-forward confirmation, project archive behavior, filters, saved review text, restore, and permanent deletion confirmation.
- [ ] Run the feature tests and verify expected failures.
- [ ] Implement the pages using shared design tokens and accessible empty/error/loading states.
- [ ] Run all tests, typecheck, and renderer build; confirm all pass.
- [ ] Commit supporting workflows.

### Task 8: Backup, restore, exports, and settings

**Files:** Create `electron/backup.ts`, `electron/exports.ts`, `src/features/settings/SettingsPage.tsx`, related tests, and update IPC contracts.

**Interfaces:** Produce `createDailyBackup`, `listBackups`, `restoreBackupSafely`, `exportCsv`, `exportJson`, and `exportIcs`.

- [ ] Write failing tests for one-backup-per-day, 14-file retention, safety backup before restore, escaped CSV, complete JSON, offset-aware ICS, and partial-file cleanup.
- [ ] Run backup/export tests and confirm expected failures.
- [ ] Implement file operations and settings controls.
- [ ] Run all tests and typecheck; confirm all pass.
- [ ] Commit recovery and portability.

### Task 9: Visual polish, accessibility, and Windows packaging

**Files:** Create `src/styles/tokens.css`, `src/styles/app.css`, `assets/icon.*`, `electron-builder.yml`, `README.md`, and `tests/e2e/app.spec.ts`; update all renderer components.

**Interfaces:** Produce light/dark themes, reduced motion, visible focus, responsive window layout, installer, and smoke-test checklist.

- [ ] Write failing accessibility and end-to-end smoke checks for keyboard navigation, labels, theme switching, quick add, timer persistence after window hide/show, and export.
- [ ] Run checks and verify failures identify missing polish or flows.
- [ ] Apply final minimal visual system, packaging metadata, icons, and user documentation.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run dist`; install or launch the packaged artifact and complete the smoke checklist.
- [ ] Commit the release candidate.

## Plan self-review

Every version-1 requirement maps to Tasks 2–9. Contracts flow from Task 1 to persistence, IPC, and renderer features. The plan contains no deferred implementation placeholders; excluded features remain explicitly out of scope.

