import type { ReactElement } from 'react';
import type { HubRecordDetail } from '../../../shared/api-types/records';

interface ProjectSpaceInspectorOverlayActivitySectionProps {
  activity: HubRecordDetail['activity'];
}

export const ProjectSpaceInspectorOverlayActivitySection = ({
  activity,
}: ProjectSpaceInspectorOverlayActivitySectionProps): ReactElement => (
  <section className="rounded-panel border border-border-muted p-3">
    <h3 className="text-sm font-semibold text-primary">Activity</h3>
    <ul className="mt-2 space-y-1">
      {activity.length === 0 ? (
        <li className="text-xs text-muted">No activity yet.</li>
      ) : (
        activity.map((entry) => (
          <li key={entry.timeline_event_id} className="text-xs text-muted">
            {entry.event_type} · {new Date(entry.created_at).toLocaleString()}
          </li>
        ))
      )}
    </ul>
  </section>
);
