import type { HubProjectSummary } from '../services/hub/types';

export const buildDefaultProjectCreatePayload = ({
  existingProjects,
  name,
  sessionUserId,
}: {
  existingProjects: HubProjectSummary[];
  name: string;
  sessionUserId: string;
}) => {
  const nextOrder =
    existingProjects.reduce(
      (maxOrder, project) => Math.max(maxOrder, project.position ?? project.sort_order ?? 0),
      0,
    ) + 1;

  return {
    name,
    sort_order: nextOrder,
    position: nextOrder,
    pinned: false,
    layout_config: {
      modules_enabled: true,
      workspace_enabled: true,
      doc_binding_mode: 'owned',
      modules: [
        {
          module_type: 'table',
          size_tier: 'L',
          lens: 'project',
        },
        {
          module_type: 'kanban',
          size_tier: 'L',
          lens: 'project',
          binding: {
            source_mode: 'owned',
          },
        },
        {
          module_type: 'calendar',
          size_tier: 'M',
          lens: 'project',
        },
      ],
    },
    member_user_ids: [sessionUserId],
  };
};
