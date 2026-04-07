import { useMemo } from 'react';
import {
  DATE_BUCKET_LABELS,
  DATE_BUCKET_ORDER,
  bucketForDate,
  type DateBucketId,
} from '../lib/dateBuckets';

export { DATE_BUCKET_LABELS, DATE_BUCKET_ORDER, bucketForDate };
export type { DateBucketId };

interface DateBucketSection<TItem> {
  id: DateBucketId;
  label: string;
  items: TItem[];
}

interface UseDateBucketsArgs<TItem> {
  items: TItem[];
  // Keep this function stable (e.g. via useCallback) to avoid unnecessary recomputes.
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
