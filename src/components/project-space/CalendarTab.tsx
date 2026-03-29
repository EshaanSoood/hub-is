import { useMemo } from 'react';
import { Chip } from '../primitives';
import { CATEGORY_TONES, COLLABORATOR_TONES, type PriorityLevel } from './designTokens';
import { cn } from '../../lib/cn';
import { getPriorityClasses } from '../../lib/priorityStyles';

export type CalendarTimeView = 'day' | 'week' | 'month' | 'year';

export interface CalendarLensOption {
  id: string;
  label: string;
}

export interface CalendarEvent {
  id: string;
  date: Date;
  label: string;
  categoryId: string;
  assigneeId: string;
  priority: PriorityLevel;
}

interface CalendarTabProps {
  events: CalendarEvent[];
  collaborators: CalendarLensOption[];
  categories: CalendarLensOption[];
  timeView: CalendarTimeView;
  activeUserId: string;
  activeCategoryId: string;
  onTimeViewChange: (view: CalendarTimeView) => void;
  onUserChange: (userId: string) => void;
  onCategoryChange: (categoryId: string) => void;
}

const TIME_VIEWS: Array<{ id: CalendarTimeView; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

const getDaysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number): number => new Date(year, month, 1).getDay();

export const CalendarTab = ({
  events,
  collaborators,
  categories,
  timeView,
  activeUserId,
  activeCategoryId,
  onTimeViewChange,
  onUserChange,
  onCategoryChange,
}: CalendarTabProps) => {
  const collaboratorToneById = useMemo(
    () => Object.fromEntries(collaborators.map((user, index) => [user.id, COLLABORATOR_TONES[index % COLLABORATOR_TONES.length]])),
    [collaborators],
  );

  const filteredEvents = useMemo(
    () => events.filter((event) => (activeUserId === 'all' || event.assigneeId === activeUserId) && (activeCategoryId === 'all' || event.categoryId === activeCategoryId)),
    [activeCategoryId, activeUserId, events],
  );

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const blanks = Array.from({ length: firstDay }, (_, index) => `blank-${index}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        {TIME_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={timeView === view.id}
            onClick={() => onTimeViewChange(view.id)}
            className={cn(
              'rounded-control border px-2 py-1 text-xs transition-colors',
              timeView === view.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {view.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {collaborators.map((user) => (
          <button
            key={user.id}
            type="button"
            aria-pressed={activeUserId === user.id}
            onClick={() => onUserChange(user.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-control border px-2 py-1 text-xs transition-colors',
              activeUserId === user.id
                ? 'border-subtle bg-elevated text-text'
                : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {user.id !== 'all' ? (
              <span className={cn('h-2 w-2 rounded-full', collaboratorToneById[user.id] ?? 'bg-muted')} aria-hidden="true" />
            ) : null}
            {user.label}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={activeCategoryId === category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'rounded-control border px-2 py-1 text-xs transition-colors',
              activeCategoryId === category.id
                ? CATEGORY_TONES[category.id] ?? 'border-subtle bg-elevated text-text'
                : 'border-subtle bg-surface text-muted hover:text-text',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {timeView !== 'month' ? (
        <div className="rounded-panel border border-subtle bg-surface p-2 text-xs text-muted">
          {timeView === 'week' ? 'Week layout is a dedicated future layout.' : null}
          {timeView === 'day' ? 'Day layout is a dedicated future layout.' : null}
          {timeView === 'year' ? 'Year layout is a dedicated future layout.' : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {blanks.map((blankKey) => (
            <div key={blankKey} aria-hidden="true" />
          ))}

          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const dayDate = new Date(year, month, day);
            const dayEvents = filteredEvents.filter((event) => isSameDay(event.date, dayDate));
            const visible = dayEvents.slice(0, 2);

            return (
              <div
                key={`${year}-${month}-${day}`}
                className={cn(
                  'min-h-20 rounded-control border p-1.5',
                  isSameDay(dayDate, today)
                    ? 'border-primary bg-primary/10'
                    : 'border-subtle bg-surface',
                )}
              >
                <p className={cn('text-right text-[11px]', isSameDay(dayDate, today) ? 'font-bold text-primary' : 'text-muted')}>
                  {day}
                </p>
                <div className="mt-1 space-y-1">
                  {visible.map((event) => (
                    <div key={event.id} className="inline-flex w-full items-center gap-1 overflow-hidden rounded-sm border border-subtle bg-elevated px-1 py-0.5 text-[10px] text-text" title={event.label}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', getPriorityClasses(event.priority).dot)} aria-hidden="true" />
                      <span className="truncate">{event.label}</span>
                    </div>
                  ))}
                  {dayEvents.length > visible.length ? (
                    <Chip className="text-[10px]">+{dayEvents.length - visible.length} more</Chip>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
