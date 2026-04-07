import { useMemo } from 'react';

export type DateBucketId =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'rest-of-week'
  | 'later-this-month'
  | 'later-this-year'
  | 'beyond'
  | 'no-date';

export const DATE_BUCKET_ORDER: DateBucketId[] = [
  'overdue',
  'today',
  'tomorrow',
  'rest-of-week',
  'later-this-month',
  'later-this-year',
  'beyond',
  'no-date',
];

export const DATE_BUCKET_LABELS: Record<DateBucketId, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  'rest-of-week': 'Rest of the Week',
  'later-this-month': 'Later This Month',
  'later-this-year': 'Later This Year',
  beyond: 'Beyond',
  'no-date': 'No Date',
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const parseIsoDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const isSameCalendarDay = (left: Date, right: Date): boolean =>
  startOfDay(left).getTime() === startOfDay(right).getTime();

const endOfWeek = (date: Date): Date => {
  const next = startOfDay(date);
  const dayOffset = 6 - next.getDay();
  next.setDate(next.getDate() + dayOffset);
  next.setHours(23, 59, 59, 999);
  return next;
};

const endOfMonth = (date: Date): Date => {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  next.setHours(23, 59, 59, 999);
  return next;
};

const endOfYear = (date: Date): Date => {
  const next = new Date(date.getFullYear(), 11, 31);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const bucketForDate = (value: string | null | undefined, now: Date): DateBucketId => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return 'no-date';
  }
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);
  const weekEnd = endOfWeek(now);
  const hasRestOfWeekWindow = dayAfterTomorrowStart <= weekEnd;

  if (parsed < todayStart) {
    return 'overdue';
  }
  if (isSameCalendarDay(parsed, now)) {
    return 'today';
  }
  if (isSameCalendarDay(parsed, tomorrowStart)) {
    return 'tomorrow';
  }
  if (hasRestOfWeekWindow && parsed >= dayAfterTomorrowStart && parsed <= weekEnd) {
    return 'rest-of-week';
  }
  if (parsed <= endOfMonth(now)) {
    return 'later-this-month';
  }
  if (parsed <= endOfYear(now)) {
    return 'later-this-year';
  }
  return 'beyond';
};

interface DateBucketSection<TItem> {
  id: DateBucketId;
  label: string;
  items: TItem[];
}

interface UseDateBucketsArgs<TItem> {
  items: TItem[];
  getDate: (item: TItem) => string | null | undefined;
  now: Date;
  order?: DateBucketId[];
  labels?: Record<DateBucketId, string>;
  includeEmpty?: boolean;
}

export const useDateBuckets = <TItem>({
  items,
  getDate,
  now,
  order = DATE_BUCKET_ORDER,
  labels = DATE_BUCKET_LABELS,
  includeEmpty = false,
}: UseDateBucketsArgs<TItem>): DateBucketSection<TItem>[] =>
  useMemo(() => {
    const buckets = new Map<DateBucketId, TItem[]>(
      order.map((bucketId) => [bucketId, []]),
    );

    for (const item of items) {
      const bucketId = bucketForDate(getDate(item), now);
      const bucketItems = buckets.get(bucketId);
      if (bucketItems) {
        bucketItems.push(item);
      }
    }

    return order.flatMap((bucketId) => {
      const bucketItems = buckets.get(bucketId) ?? [];
      if (!includeEmpty && bucketItems.length === 0) {
        return [];
      }
      return [{
        id: bucketId,
        label: labels[bucketId],
        items: bucketItems,
      }];
    });
  }, [getDate, includeEmpty, items, labels, now, order]);
