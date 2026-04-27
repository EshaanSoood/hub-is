import type { CalendarEventSummary, DayCell } from './types';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const OVERFLOW_LIMIT = 3;

export const asDateLabel = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fromLocalDateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(key);
  }
  return new Date(year, month - 1, day);
};

export const toDateKey = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return toLocalDateKey(date);
};

export const formatEventTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const sortEventsByStart = (items: CalendarEventSummary[]): CalendarEventSummary[] =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left.event_state.start_dt).getTime();
    const rightTime = new Date(right.event_state.start_dt).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.record_id.localeCompare(right.record_id);
  });

export const formatCompactDateLabel = (date: Date): string =>
  date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

export const formatWeekRangeLabel = (centerDate: Date): string => {
  const start = addDays(centerDate, -3);
  const end = addDays(centerDate, 3);
  const startMonthDay = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endMonthDay = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endDay = end.toLocaleDateString(undefined, { day: 'numeric' });

  if (start.getFullYear() !== end.getFullYear()) {
    const startWithYear = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const endWithYear = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startWithYear} - ${endWithYear}`;
  }

  if (start.getMonth() === end.getMonth()) {
    return `${startMonthDay} - ${endDay}, ${end.getFullYear()}`;
  }

  return `${startMonthDay} - ${endMonthDay}, ${end.getFullYear()}`;
};

export const toTimeInputValue = (value: string, fallback: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
};

export const buildMonthCells = (monthCursor: Date): DayCell[] => {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = previousMonthDays - i;
    const date = new Date(year, month - 1, day);
    cells.push({ iso: toLocalDateKey(date), day, currentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ iso: toLocalDateKey(date), day, currentMonth: true });
  }

  while (cells.length < 42) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    const date = new Date(year, month + 1, day);
    cells.push({ iso: toLocalDateKey(date), day, currentMonth: false });
  }

  return cells;
};
