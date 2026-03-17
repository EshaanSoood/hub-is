import { useCallback, useMemo, useState } from 'react';

import { listTimeline } from '../services/hub/records';
import type { TimelineCluster, TimelineEventType } from '../components/project-space/TimelineFeed';

type ProjectTimelineItem = {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
};

interface UseTimelineRuntimeParams {
  accessToken: string;
  projectId: string;
  timeline: ProjectTimelineItem[];
  setTimeline: React.Dispatch<React.SetStateAction<ProjectTimelineItem[]>>;
}

const timelineTypeFromEvent = (eventType: string): TimelineEventType => {
  const normalized = eventType.toLowerCase();
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

export const useTimelineRuntime = ({
  accessToken,
  projectId,
  timeline,
  setTimeline,
}: UseTimelineRuntimeParams) => {
  const [timelineFilters, setTimelineFilters] = useState<TimelineEventType[]>([
    'task',
    'event',
    'milestone',
    'file',
    'workspace',
  ]);

  const refreshTimeline = useCallback(async () => {
    const nextTimeline = await listTimeline(accessToken, projectId);
    setTimeline(nextTimeline);
  }, [accessToken, projectId, setTimeline]);

  const timelineClusters = useMemo<TimelineCluster[]>(() => {
    const buckets = new Map<string, TimelineCluster['items']>();
    const orderedKeys: string[] = [];

    for (const item of timeline) {
      const type = timelineTypeFromEvent(item.event_type);
      if (!timelineFilters.includes(type)) {
        continue;
      }

      const date = new Date(item.created_at);
      const key = date.toDateString();
      if (!buckets.has(key)) {
        buckets.set(key, []);
        orderedKeys.push(key);
      }

      const summary = item.summary_json && typeof item.summary_json === 'object' ? item.summary_json : {};
      const summaryMessage = typeof summary.message === 'string' ? summary.message.trim() : '';
      const message = summaryMessage || item.event_type.replace(/_/g, ' ');

      buckets.get(key)?.push({
        id: item.timeline_event_id,
        type,
        label: message,
        timestamp: date.toLocaleString(),
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

  const toggleTimelineFilter = useCallback((type: TimelineEventType) => {
    setTimelineFilters((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  }, []);

  return {
    refreshTimeline,
    timelineClusters,
    timelineFilters,
    toggleTimelineFilter,
  };
};
