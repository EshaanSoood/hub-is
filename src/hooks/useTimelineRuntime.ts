import { useCallback, useMemo, useState } from 'react';

import { listTimeline } from '../services/hub/records';
import { TIMELINE_FILTER_TYPES, type TimelineCluster, type TimelineEventType, type TimelineFilterValue } from '../components/project-space/TimelineFeed';

type ProjectTimelineItem = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  summary?: Record<string, unknown>;
  created_at: string;
};

interface UseTimelineRuntimeParams {
  accessToken: string;
  projectId: string;
  timeline: ProjectTimelineItem[];
  setTimeline: React.Dispatch<React.SetStateAction<ProjectTimelineItem[]>>;
}

const timelineTypeFromRecordKind = (recordKind: string): TimelineEventType | null => {
  const normalized = recordKind.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes('task') || normalized.includes('reminder')) {
    return 'task';
  }
  if (normalized.includes('event') || normalized.includes('calendar') || normalized.includes('meeting')) {
    return 'event';
  }
  if (normalized.includes('milestone')) {
    return 'milestone';
  }
  if (normalized.includes('file') || normalized.includes('asset') || normalized.includes('attachment')) {
    return 'file';
  }
  return 'workspace';
};

const timelineTypeFromEvent = (eventType: string, summary: Record<string, unknown>): TimelineEventType => {
  const normalized = eventType.toLowerCase();
  if (normalized.startsWith('record.')) {
    const recordKind = typeof summary.record_kind === 'string' ? summary.record_kind : '';
    const fromRecordKind = timelineTypeFromRecordKind(recordKind);
    if (fromRecordKind) {
      return fromRecordKind;
    }
  }
  if (normalized.includes('task')) {
    return 'task';
  }
  if (normalized.includes('event') || normalized.includes('calendar')) {
    return 'event';
  }
  if (normalized.includes('milestone')) {
    return 'milestone';
  }
  if (normalized.includes('file') || normalized.includes('asset') || normalized.includes('attach')) {
    return 'file';
  }
  return 'workspace';
};

const timelineDotColor: Record<TimelineEventType, string> = {
  task: 'rgb(220 80 100)',
  event: 'rgb(52 124 212)',
  milestone: 'rgb(245 168 80)',
  file: 'rgb(132 156 178)',
  workspace: 'rgb(46 185 166)',
};

const relativeTime = (iso: string): string => {
  const stamp = Number(new Date(iso));
  if (!Number.isFinite(stamp)) {
    return 'just now';
  }
  const deltaSec = Math.max(0, Math.floor((Date.now() - stamp) / 1000));
  if (deltaSec < 60) {
    return `${deltaSec}s ago`;
  }
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) {
    return `${deltaMin}m ago`;
  }
  const deltaHour = Math.floor(deltaMin / 60);
  if (deltaHour < 24) {
    return `${deltaHour}h ago`;
  }
  return `${Math.floor(deltaHour / 24)}d ago`;
};

const humanizeTimelineEventType = (eventType: string): string => {
  const words = eventType
    .trim()
    .replace(/[._]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return 'Activity';
  }
  return [words[0].charAt(0).toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ');
};

export const useTimelineRuntime = ({
  accessToken,
  projectId,
  timeline,
  setTimeline,
}: UseTimelineRuntimeParams) => {
  const [timelineFilters, setTimelineFilters] = useState<TimelineEventType[]>(() => [...TIMELINE_FILTER_TYPES]);

  const refreshTimeline = useCallback(async () => {
    const nextTimeline = await listTimeline(accessToken, projectId);
    setTimeline(nextTimeline);
  }, [accessToken, projectId, setTimeline]);

  const timelineClusters = useMemo<TimelineCluster[]>(() => {
    const buckets = new Map<string, TimelineCluster['items']>();
    const orderedKeys: string[] = [];

    for (const item of timeline) {
      const summarySource = item.summary_json ?? item.summary;
      const summary = summarySource && typeof summarySource === 'object' ? summarySource : {};
      const type = timelineTypeFromEvent(item.event_type, summary);
      if (!timelineFilters.includes(type)) {
        continue;
      }

      const date = new Date(item.created_at);
      const key = date.toDateString();
      if (!buckets.has(key)) {
        buckets.set(key, []);
        orderedKeys.push(key);
      }
      const summaryMessage = typeof summary.message === 'string' ? summary.message.trim() : '';
      const message = summaryMessage || humanizeTimelineEventType(item.event_type);

      buckets.get(key)?.push({
        id: item.timeline_event_id,
        type,
        label: message,
        timestamp: date.toLocaleString(),
        timestampIso: item.created_at,
        timestampRelative: relativeTime(item.created_at),
        dotColor: timelineDotColor[type],
        linkedRecordId: item.primary_entity_type === 'record' ? item.primary_entity_id : undefined,
        linkedRecordType: item.primary_entity_type === 'record' ? item.primary_entity_type : undefined,
      });
    }

    return orderedKeys.map((key) => ({
      date: key,
      items: buckets.get(key) ?? [],
    }));
  }, [timeline, timelineFilters]);

  const toggleTimelineFilter = useCallback((type: TimelineFilterValue) => {
    if (type === 'all') {
      setTimelineFilters([...TIMELINE_FILTER_TYPES]);
      return;
    }

    setTimelineFilters((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }, []);

  return {
    refreshTimeline,
    timelineClusters,
    timelineFilters,
    toggleTimelineFilter,
  };
};
