import { addDays, periodRange, weekStart } from '../../domain/periods';
import type { SummaryKind } from '../../shared/contracts';

interface Props {
  anchor: string;
  kind: SummaryKind;
  onSelect(date: string): void;
}

export function PeriodCalendar({ anchor, kind, onSelect }: Props) {
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const gridStart = weekStart(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const { start, end } = periodRange(kind, anchor);
  return <section className="period-calendar" aria-label="总结日历">
    <header><strong>{Number(anchor.slice(0, 4))}年{Number(anchor.slice(5, 7))}月</strong><span>点击日期选择{kind === 'week' ? '所在周' : '月份'}</span></header>
    <div className="calendar-weekdays">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-days">{days.map((day) => {
      const selected = day >= start && day < end;
      const outside = day.slice(0, 7) !== anchor.slice(0, 7);
      return <button type="button" key={day} aria-label={`选择 ${day}`} className={`${selected ? 'selected-period ' : ''}${outside ? 'outside-month' : ''}`.trim()} onClick={() => onSelect(day)}><span>{Number(day.slice(8, 10))}</span></button>;
    })}</div>
  </section>;
}
