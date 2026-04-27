export const projectCreatedTimelineMessage = (project) => `${String(project?.name || 'Space').trim() || 'Space'} created`;

const isProjectCreatedTimelineRecord = (row, project) =>
  row?.event_type === 'project.created'
  && row?.primary_entity_type === 'project'
  && row?.primary_entity_id === project?.project_id;

const timelineSortValue = (row) => {
  const parsed = Date.parse(row?.created_at || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortTimelineRecordsDescending = (left, right) => {
  const byCreatedAt = timelineSortValue(right) - timelineSortValue(left);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }
  return String(right?.timeline_event_id || '').localeCompare(String(left?.timeline_event_id || ''));
};

const projectCreatedTimelineRecord = (project) => ({
  timeline_event_id: `project_created_${project.project_id}`,
  project_id: project.project_id,
  actor_user_id: project.created_by || null,
  event_type: 'project.created',
  primary_entity_type: 'project',
  primary_entity_id: project.project_id,
  secondary_entities: [],
  summary_json: { message: projectCreatedTimelineMessage(project) },
  created_at: project.created_at || new Date().toISOString(),
});

export const ensureProjectCreatedTimelineStart = (rows, project) => {
  if (!project?.project_id) {
    return rows;
  }

  let hasProjectCreatedStart = false;
  const normalizedRows = rows.map((row) => {
    if (!isProjectCreatedTimelineRecord(row, project)) {
      return row;
    }

    hasProjectCreatedStart = true;
    return {
      ...row,
      summary_json: {
        ...row.summary_json,
        message: projectCreatedTimelineMessage(project),
      },
    };
  });

  if (!hasProjectCreatedStart) {
    normalizedRows.push(projectCreatedTimelineRecord(project));
  }

  return normalizedRows.sort(sortTimelineRecordsDescending);
};
