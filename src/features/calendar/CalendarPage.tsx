import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import type { DateSelectArg, EventChangeArg, EventClickArg } from '@fullcalendar/core';
import { ChevronLeft, ChevronRight, Filter, Plus, Search } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { mapCalendarEvents } from './eventMapping';
import { TaskEditor, type InitialRange } from './TaskEditor';
import { summarizeDay } from '../../domain/statistics';

interface Props { quickAddSignal: number }

export function CalendarPage({ quickAddSignal }: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const { data, settings, saveTask, deleteTask, saveSegment, startTimer, stopTimer } = useAppStore();
  const [view, setView] = useState('timeGridWeek');
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'planned' | 'actual'>('planned');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [initialRange, setInitialRange] = useState<InitialRange | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (quickAddSignal > 0) {
      const now = new Date(); now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
      setInitialRange({ start: now.toISOString(), end: new Date(now.getTime() + settings.defaultPlannedMinutes * 60_000).toISOString() });
      setSelectedTaskId(null); setEditorOpen(true);
    }
  }, [quickAddSignal, settings.defaultPlannedMinutes]);

  const filteredData = useMemo(() => {
    const tasks = data.tasks.filter((task) => (!search.trim() || `${task.title} ${task.notes}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) && (!projectFilter || task.projectId === projectFilter) && (!statusFilter || task.status === statusFilter) && (!tagFilter || task.tagIds.includes(tagFilter)));
    const ids = new Set(tasks.map((task) => task.id));
    return { ...data, tasks, segments: data.segments.filter((segment) => ids.has(segment.taskId)) };
  }, [data, search, projectFilter, statusFilter, tagFilter]);
  const events = useMemo(() => mapCalendarEvents(filteredData), [filteredData]);
  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId) ?? null;

  const openNew = (range?: InitialRange) => { setSelectedTaskId(null); setInitialRange(range ?? null); setEditorOpen(true); };
  const onSelect = (arg: DateSelectArg) => openNew({ start: arg.start.toISOString(), end: arg.end.toISOString() });
  const onEventClick = (arg: EventClickArg) => { setSelectedTaskId(arg.event.extendedProps.taskId); setInitialRange(null); setEditorOpen(true); };
  const onChange = async (arg: EventChangeArg) => {
    const kind = arg.event.extendedProps.kind;
    if (kind === 'planned') {
      const task = data.tasks.find((item) => item.id === arg.event.extendedProps.taskId);
      if (task) await saveTask({ ...task, plannedStart: arg.event.start?.toISOString() ?? null, plannedEnd: arg.event.end?.toISOString() ?? null });
    } else {
      const segment = data.segments.find((item) => item.id === arg.event.extendedProps.segmentId);
      if (segment) await saveSegment({ ...segment, start: arg.event.start!.toISOString(), end: arg.event.end?.toISOString() ?? null });
    }
  };
  const changeView = (next: string) => { setView(next); calendarRef.current?.getApi().changeView(next); };

  return <div className="calendar-page">
    <div className="calendar-toolbar">
      <div className="date-controls"><button className="icon-button" aria-label="上一段时间" onClick={() => calendarRef.current?.getApi().prev()}><ChevronLeft size={18} /></button><button className="today-button" onClick={() => calendarRef.current?.getApi().today()}>今天</button><button className="icon-button" aria-label="下一段时间" onClick={() => calendarRef.current?.getApi().next()}><ChevronRight size={18} /></button><strong>{title}</strong></div>
      <div className="toolbar-actions">
        <label className="search-control"><Search size={15} /><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务" /></label>
        <div className="filter-menu"><button className={projectFilter || statusFilter || tagFilter ? 'icon-button filter-trigger active' : 'icon-button filter-trigger'} aria-label="筛选日历" onClick={() => setFilterOpen((value) => !value)}><Filter size={15} /></button>{filterOpen && <div className="filter-popover"><div><p className="eyebrow">FILTER CALENDAR</p><button className="text-button" onClick={() => { setProjectFilter(''); setStatusFilter(''); setTagFilter(''); }}>清除</button></div><label>项目<select aria-label="按项目筛选" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="">全部项目</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>状态<select aria-label="按状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">全部状态</option><option value="todo">待办</option><option value="in_progress">进行中</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select></label>{data.tags.length > 0 && <label>标签<select aria-label="按标签筛选" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">全部标签</option>{data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>}</div>}</div>
        <div className="create-mode" aria-label="拖拽创建类型"><button className={createMode === 'planned' ? 'active' : ''} onClick={() => setCreateMode('planned')}>计划</button><button className={createMode === 'actual' ? 'active' : ''} onClick={() => setCreateMode('actual')}>补记</button></div>
        <div className="view-switcher" aria-label="日历视图">{[['timeGridDay', '日'], ['timeGridWeek', '周'], ['dayGridMonth', '月']].map(([id, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => changeView(id)}>{label}</button>)}</div>
        <button className="primary-button compact" onClick={() => openNew()}><Plus size={16} />添加</button>
      </div>
    </div>
    <div className="calendar-canvas">
      <FullCalendar
        ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} locale={zhCnLocale}
        initialView="timeGridWeek" headerToolbar={false} firstDay={settings.weekStartsOn}
        slotMinTime={`${String(settings.dayStartHour).padStart(2, '0')}:00:00`} slotMaxTime={`${String(settings.dayEndHour).padStart(2, '0')}:00:00`}
        nowIndicator selectable selectMirror editable eventResizableFromStart allDaySlot={false} expandRows height="100%"
        events={events} select={onSelect} eventClick={onEventClick} eventDrop={onChange} eventResize={onChange}
        datesSet={(arg) => setTitle(arg.view.title)}
        dayCellContent={(arg) => { const date = arg.date.toLocaleDateString('en-CA'); const summary = summarizeDay({ date, ...filteredData, offsetMinutes: -arg.date.getTimezoneOffset() }); const count = filteredData.tasks.filter((task) => task.plannedStart?.slice(0, 10) === date).length; return <div className="month-day-label"><span>{arg.dayNumberText}</span>{arg.view.type === 'dayGridMonth' && <small>{count} 项 · {(summary.actualMinutes / 60).toFixed(1)}h</small>}</div>; }}
        eventContent={(arg) => <div className="event-inner"><span className="event-time">{arg.timeText}</span><strong>{arg.event.title}</strong>{arg.event.extendedProps.kind === 'actual' && <span className="event-kind">实际</span>}</div>}
        dayMaxEvents={3}
      />
    </div>
    {editorOpen && <TaskEditor key={`${selectedTaskId ?? 'new'}:${initialRange?.start ?? ''}:${createMode}`} task={selectedTask} initialRange={initialRange} projects={data.projects} tags={data.tags} segments={data.segments} recordActual={!selectedTask && createMode === 'actual'}
      onSave={saveTask} onDelete={async (id) => { await deleteTask(id); setEditorOpen(false); }} onClose={() => setEditorOpen(false)}
      onStartTimer={startTimer} onStopTimer={stopTimer} onSaveSegment={saveSegment} />}
  </div>;
}
