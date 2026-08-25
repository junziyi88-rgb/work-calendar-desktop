# Work Calendar Desktop App Design

## Product goal

Build a personal Windows desktop application that makes planning and recording work feel like editing a calendar. A user can begin recording within ten seconds, compare planned and actual time, and understand at day end what was completed, how time was spent, and what remains unfinished.

## Scope

Version 1 includes day, week, and month calendar views; planned tasks; automatic and manual time recording; task segments; planned-versus-actual comparison; projects, tags, statuses, search, filters, daily review, basic analytics, notifications, global shortcuts, system tray behavior, a floating timer, local SQLite storage, recycle bin, automatic backup, and CSV, JSON, and ICS export.

Version 1 excludes recurring tasks, accounts, cloud sync, collaboration, third-party calendar sync, database encryption, and AI features. Interfaces for later calendar integrations may be added, but no provider integration ships in this version.

## Platform and architecture

The app targets Windows 10 and Windows 11. It uses Electron for native desktop behavior, React and TypeScript for the renderer, Vite for development and builds, and SQLite through `better-sqlite3` in Electron's main process. Renderer code never accesses Node APIs directly; all persistence and desktop capabilities use typed IPC exposed by a narrow preload bridge.

The app is split into five bounded areas:

- `domain`: pure task, time-segment, statistics, and validation logic.
- `main`: SQLite repositories, backups and exports, tray, shortcuts, notifications, idle handling, and window lifecycle.
- `preload`: the typed IPC bridge used by the renderer.
- `renderer`: calendar, editor, review, analytics, settings, and floating-timer interfaces.
- `shared`: serializable contracts shared across Electron processes.

## Core data model

### Project

Contains `id`, `name`, `color`, `archivedAt`, `createdAt`, and `updatedAt`. Projects are the primary grouping dimension.

### Tag

Contains `id`, `name`, `color`, `createdAt`, and `updatedAt`. Tasks can have zero or more tags.

### Task

Contains `id`, `title`, `projectId`, optional notes, status (`todo`, `in_progress`, `completed`, or `cancelled`), optional planned start and end timestamps, optional completion timestamp, soft-deletion timestamp, and audit timestamps. A task may span days and may own multiple actual work segments.

### Time segment

Contains `id`, `taskId`, start timestamp, optional end timestamp, source (`timer` or `manual`), optional note, and audit timestamps. Only one active segment is permitted by default. A setting can enable parallel active segments. Segments crossing midnight are split into per-day portions for statistics without destroying the original segment.

### Daily review

Contains local date, accomplishments, blockers, tomorrow focus, daily target minutes, and audit timestamps. Time distribution and planned deviation are computed rather than duplicated.

### App setting

Stores theme, week start, workday boundaries, default planned duration, parallel-timer preference, notification privacy, startup behavior, global shortcut, long-timer threshold, backup directory, and retention count.

## Main interaction model

The week view is the default home screen. The top bar provides date navigation, view switching, search, a running timer, and a quick-add action. A slim left rail contains Calendar, Review, Insights, Projects, Recycle Bin, and Settings.

Planned tasks appear as pale blocks with a dashed border. Actual segments appear as solid project-colored blocks. A planned task that begins timing retains its planned interval and adds a separate actual segment, so deviations remain visible. Selecting either representation opens one task editor.

Dragging on empty calendar space creates a planned task with the dragged interval. Planned blocks can be moved and resized. Actual manual segments can be moved and resized; timer-created segments require an explicit edit action before their times change. A task crossing midnight is visually continued across days.

The month view displays per-day task count, completion rate, and total actual time. The day view provides greater vertical resolution. All views share the same task editor and filters.

## Recording time

A user can start, pause, resume, finish, or switch the current timer from the task editor, top bar, tray menu, global shortcut flow, or floating timer. Starting another task while a timer is active prompts to pause the current one unless parallel timing is enabled.

Manual entry supports exact start/end fields and drag creation on the calendar. A task may contain any number of segments and shows their combined duration. After system resume, the app identifies segments that remained active during sleep and asks whether to keep or subtract that interval. A configurable notification warns about unusually long active segments.

## Planning and review

Statuses are `todo`, `in_progress`, `completed`, and `cancelled`. Unfinished planned tasks can be moved to the next day individually or in a day-end review action; the app never silently changes dates.

Daily review displays completed work, project time distribution, planned versus actual variance, blockers, and tomorrow's focus. Statistics include daily and weekly actual time, project shares, completion rate, planned-versus-actual variance, and focus periods. Users can set a daily target without turning the application into an attendance tool.

## Search and filtering

Search matches task titles and notes. Filters cover date range, project, tags, and status. Calendar, review, and insights screens use the same filter state while the application is open.

## Desktop behavior

Closing the main window hides it to the system tray unless the user explicitly quits. Startup launch is optional. The tray provides show, quick add, start/recent task, pause/resume, stop, and quit. A configurable global shortcut opens quick add. The optional always-on-top floating timer shows task title, elapsed time, pause/resume, and stop.

Notifications cover upcoming tasks, overdue planned tasks, and long-running timers. Privacy mode hides task titles in notifications.

## Persistence, recovery, and export

SQLite is stored below Electron's per-user application data directory. Schema migrations are transactional. Deleting projects, tasks, and time segments is soft by default; the recycle bin supports restore and permanent deletion.

The database is backed up once per local day after the first successful app launch that day and before migrations. Backup retention is configurable and defaults to 14 files. Import-free recovery restores a chosen app backup only after first making a safety copy of the current database.

CSV exports flattened work segments, JSON exports the complete user data set, and ICS exports planned tasks as calendar events. Export files use UTF-8 and local-time values with explicit offsets.

## Error handling

Renderer forms validate required titles and valid time ranges before IPC. Main-process handlers validate again. Database writes use transactions where multiple tables change. User-facing errors state the failed action and preserve entered form content. Background failures such as backup or notification scheduling are logged locally and surfaced through a non-blocking warning.

If the database cannot be opened, the app offers retry, open backup location, or start a new database after preserving the unreadable file. If an export fails, partial output is removed.

## Visual direction and accessibility

The design is minimal, calm, and information-dense: warm neutral surfaces, restrained project colors, thin dividers, clear typography, and no gradients or decorative dashboards. Light and dark themes follow the system by default and can be overridden.

Keyboard focus is always visible. Core flows work without a mouse. Status is never communicated only by color: planned blocks also use dashed borders, actual blocks are solid, and running timers include a motion-safe indicator and text label. The renderer respects reduced-motion settings.

## Quality criteria

- Quick add opens from anywhere in the app and from the global shortcut.
- Starting a timer for a recent task requires no more than two actions.
- Planned and actual time remain separately inspectable after editing.
- Durations stay correct across midnight, daylight-saving offsets, sleep, and restart.
- Closing to tray never loses an active timer.
- Core domain rules, repositories, IPC handlers, and primary renderer workflows have automated tests.
- The packaged Windows installer launches successfully on a clean user profile.

