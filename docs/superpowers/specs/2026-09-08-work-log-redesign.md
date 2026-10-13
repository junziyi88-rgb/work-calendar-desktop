# Personal Work Log Desktop App Redesign

## Product goal

Redesign the existing Windows work-calendar application into a lightweight personal work log. The application is used after work is performed: the user types what was done, manually enters the effort, and optionally connects the entry to a long-running work item. It must make parallel work and multi-week progress easy to reconstruct for weekly summaries, monthly hour reporting, and OKR writing.

The product is not a timer, scheduler, attendance system, or project-management suite.

## Success criteria

- A normal work entry can be saved in less than ten seconds.
- The entry flow never asks for start time, end time, planning time, tags, or timer controls.
- One long-running work item can accumulate any number of progress entries across days and weeks.
- The user can see what changed on a work item during a selected week even when its overall timeline spans months.
- Weekly and monthly summaries are assembled from existing entries without requiring the user to rewrite them.
- Monthly totals accurately sum manually entered effort.
- The Windows installer creates a desktop shortcut and a Start Menu shortcut.

## Information architecture

The primary navigation contains exactly three destinations:

1. **记录** — quick entry, recent work items, and the selected day's entries.
2. **事项** — active and completed long-running work items with progress timelines.
3. **总结** — weekly and monthly summaries with copy and export actions.

There is no separate calendar, review, analytics, projects, recycle-bin, or settings page. A compact date picker is part of the Record screen. Backup, export, and theme actions live in a small overflow menu.

## Core concepts

### Work item

A work item is a durable thread of work, such as a course launch, a product redesign, or a monthly objective. It may remain active for days or months and may progress in parallel with other items.

Fields:

- `id`
- `title`
- `status`: `active` or `completed`
- optional `summary`: the latest concise statement of current progress
- `createdAt`, `completedAt`, and `updatedAt`

Work items have no priority, deadline, project hierarchy, tags, assignees, subtasks, or planned duration.

### Work log

A work log records one piece of completed work or one observed progress update.

Fields:

- `id`
- optional `workItemId`
- `content`: what was completed or how the work moved forward
- `effortMinutes`: manually entered duration, stored as integer minutes
- `periodKind`: `day` or `week`
- `periodStart`: the selected local date or the Monday of the selected local week
- `createdAt` and `updatedAt`

Multiple logs may belong to the same item on the same day. Logs may also remain unassigned for one-off work. A week-level log is used when the user remembers what advanced during a week but not the exact day. Week-level effort is counted once in the selected week's totals and in the calendar month containing that week's Monday.

Deleted work logs and items remain recoverable internally for 30 days, but recovery is exposed as an immediate Undo action rather than a dedicated recycle-bin page.

## Record screen

The Record screen is the default home screen. Its top section is a compact quick-entry form containing:

- a recent-item picker that also accepts a new item name;
- a single text field labeled “这次做了什么 / 推进到了哪一步”;
- a manual effort field accepting hours or minutes, such as `1.5h`, `90m`, or `1小时30分`;
- a period control that defaults to Today and can switch to another day or to a selected week;
- one Save action, with Enter as the primary keyboard shortcut.

Only progress content is required. The item is optional for one-off work. Effort may be omitted temporarily, but entries without effort are visibly marked “待补工时” and excluded from hour totals until completed.

Below the form, the screen shows the selected day or week's logs in reverse creation order, followed by a total. Each row displays the item title, content, effort, and period. Inline editing changes content, effort, item, or period without opening a large task dialog.

Recent active work items appear as compact shortcuts. Choosing one preselects it for the next log but never starts a timer.

## Date browsing

The former hour-grid calendar is removed. A compact monthly date picker supports historical browsing:

- days with logs show a small mark and total effort;
- selecting a day loads that day's entries;
- selecting a week loads daily and week-level entries for that week;
- no dragging, resizing, planned blocks, or precise time slots exist.

This calendar is a navigation aid, not a scheduling surface.

## Work Items screen

The Work Items screen defaults to active items. Each row shows:

- title;
- latest progress summary;
- accumulated effort;
- first and latest activity dates;
- active or completed state.

Opening an item shows its chronological progress timeline. Daily and week-level entries use distinct date labels but the same visual treatment. The item screen provides one inline “追加进展” form using the same fields and validation as the Record screen.

Completing an item removes it from the default active list but preserves its timeline and includes it in reports. Reopening a completed item is allowed.

## Weekly summary

The Summary screen defaults to the current week. A weekly summary is generated directly from that week's logs and contains:

- total recorded effort;
- effort grouped by work item;
- chronological progress bullets grouped by item;
- work items completed during the week;
- active items that received progress during the week;
- a visible list of logs still missing effort.

The summary provides “复制周总结”, producing clean plain text suitable for a work report. The generated wording is deterministic and editable after pasting; it does not use AI or invent conclusions.

## Monthly summary and OKR material

The same Summary screen switches between Week and Month. The monthly view contains:

- total monthly effort;
- effort grouped by work item;
- all progress bullets grouped by item and ordered by date;
- items completed in the month;
- logs missing effort.

“复制 OKR 素材” produces plain text with one section per work item, its progress bullets, completion state, and accumulated effort for the selected month. CSV export contains period, item, content, and effort columns.

## Removed product behavior

The redesign removes all of the following from the user interface and normal runtime behavior:

- automatic timers, pause, resume, and stop controls;
- parallel timer handling;
- start and end timestamps;
- planned work and planned-versus-actual comparisons;
- day and week hour grids;
- draggable or resizable calendar blocks;
- notifications for starts, overdue work, or long timers;
- sleep reconciliation;
- floating timer window;
- timer-oriented global shortcuts;
- tray timer controls and close-to-tray behavior;
- projects, tags, and multi-state task workflows;
- daily target hours;
- separate review and analytics dashboards;
- ICS export and third-party calendar integration hooks.

Closing the window exits the application unless unsaved text is present, in which case the user receives a save-or-discard prompt.

## Persistence and migration

The application remains offline-only and stores data in local SQLite. A daily backup runs silently after the first successful launch of each day. JSON backup and restore remain available from the overflow menu. The normal interface does not expose database concepts or backup retention settings.

On first launch after the redesign, existing data is migrated without destructive deletion:

- each existing task becomes a work item;
- existing task notes are preserved in the work-item timeline;
- completed tasks become completed work items;
- closed actual-time segments become work logs whose effort is derived from their duration;
- planned-only tasks become work items without fabricated work logs;
- existing projects and tags are retained in legacy tables for rollback but are not shown in the new interface;
- an active timer is closed at migration time and clearly labeled as a migrated estimate.

The migration is transactional and preceded by a safety backup. A failure leaves the old database unchanged and shows a retryable error.

## Desktop packaging

The app continues to target Windows 10 and Windows 11. The installer must:

- install the packaged Electron application;
- create a desktop shortcut named “工作记录” by default;
- create a Start Menu shortcut;
- use the application icon for the executable, installer, and shortcuts;
- preserve user data across application upgrades.

The app does not start automatically with Windows and does not remain in the system tray after closing.

## Visual direction

The interface is minimal and text-first. It uses one main content column, restrained separators, compact typography, and a warm neutral palette. Color communicates selection and grouping only; it does not encode workflow states that also require a legend.

The quick-entry form receives visual priority. Summary numbers support the written records rather than dominating the screen. Large dashboards, decorative charts, dense toolbars, modal forms, gradients, and heavy shadows are excluded.

Light and dark themes follow Windows automatically. Manual theme selection is available only in the overflow menu.

## Validation and error handling

- Blank progress content cannot be saved.
- Effort input is normalized to integer minutes and must be non-negative and no greater than 24 hours per log.
- A completed item may receive another log only after an explicit reopen action.
- Save failures preserve all entered text and show an inline retry action.
- Summary and export calculations use the same tested aggregation functions.
- Undo restores the exact deleted record and its original associations.

## Testing and acceptance

Automated tests cover:

- parsing hour and minute effort input;
- daily, weekly, and monthly aggregation;
- grouping parallel item progress without merging records;
- day-level and week-level period boundaries;
- missing-effort behavior;
- work-item completion and reopening;
- legacy database migration and rollback;
- quick entry, inline editing, deletion Undo, summary copying, and CSV export.

Release verification must confirm that the packaged application launches, records and reloads data after restart, generates correct week and month summaries, exits when closed, and installs a working desktop shortcut.
