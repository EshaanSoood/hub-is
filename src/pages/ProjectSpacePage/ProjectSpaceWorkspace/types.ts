export type TopLevelProjectTab = 'overview' | 'work' | 'tools';

export type OverviewSubView = 'timeline' | 'calendar' | 'tasks' | 'kanban';

export interface TimelineEvent {
  timeline_event_id: string;
  event_type: string;
  primary_entity_type: string;
  primary_entity_id: string;
  summary_json: Record<string, unknown>;
  created_at: string;
}
