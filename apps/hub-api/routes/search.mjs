const SEARCH_TYPES = new Set(['record', 'project']);
const TYPE_ORDER = {
  record: 0,
  project: 1,
  project: 2,
};

const escapeLikePattern = (value) => String(value || '').replace(/[\\%_]/g, (char) => `\\${char}`);

const normalizeScore = (value) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : Number.MAX_SAFE_INTEGER;
};

export const createSearchRoutes = (deps) => {
  const {
    // Search keeps direct db access because these FTS queries need dynamic IN(...)
    // placeholder lists per request and cannot be shared as fixed prepared statements.
    db,
    withPolicyGate,
    send,
    jsonResponse,
    okEnvelope,
    errorEnvelope,
    asText,
    asInteger,
    projectMembershipsByUserStmt,
  } = deps;

  const visibleSpaceIdsForUser = (userId) =>
    Array.from(
      new Set(
        projectMembershipsByUserStmt
          .all(userId)
          .map((membership) => asText(membership.space_id))
          .filter(Boolean),
      ),
    );

  const visibleWorkProjectIdsForUser = (visibleSpaceIds) => {
    if (visibleSpaceIds.length === 0) {
      return [];
    }
    const placeholders = visibleSpaceIds.map(() => '?').join(', ');
    return db.prepare(`
      SELECT project_id
      FROM projects
      WHERE space_id IN (${placeholders})
    `).all(...visibleSpaceIds).map((row) => asText(row.project_id)).filter(Boolean);
  };

  const compareResults = (left, right) => {
    const scoreDiff = normalizeScore(left.score) - normalizeScore(right.score);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    const typeDiff = (TYPE_ORDER[left.type] ?? 99) - (TYPE_ORDER[right.type] ?? 99);
    if (typeDiff !== 0) {
      return typeDiff;
    }
    return String(left.title || '').localeCompare(String(right.title || ''));
  };

  const searchRecords = ({ query, limit, visibleSpaceIds, requestLog = null }) => {
    const placeholders = visibleSpaceIds.map(() => '?').join(', ');
    const matchSql = `
      SELECT
        r.record_id AS id,
        r.title AS title,
        r.space_id AS space_id,
        s.name AS space_name,
        CASE
          WHEN ts.record_id IS NOT NULL THEN 'task'
          WHEN es.record_id IS NOT NULL THEN 'event'
          ELSE 'record'
        END AS content_type,
        bm25(search_records_fts) AS score
      FROM search_records_fts
      JOIN records r ON r.record_id = search_records_fts.record_id
      JOIN spaces s ON s.space_id = r.space_id
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      LEFT JOIN event_state es ON es.record_id = r.record_id
      WHERE search_records_fts MATCH ?
        AND r.archived_at IS NULL
        AND r.space_id IN (${placeholders})
      ORDER BY score ASC, r.updated_at DESC, r.record_id DESC
      LIMIT ?
    `;
    const loweredQuery = query.toLowerCase();
    const escapedQuery = escapeLikePattern(loweredQuery);
    const fallbackSql = `
      SELECT
        r.record_id AS id,
        r.title AS title,
        r.space_id AS space_id,
        s.name AS space_name,
        CASE
          WHEN ts.record_id IS NOT NULL THEN 'task'
          WHEN es.record_id IS NOT NULL THEN 'event'
          ELSE 'record'
        END AS content_type,
        CASE
          WHEN LOWER(r.title) = ? THEN 0
          WHEN LOWER(r.title) LIKE ? ESCAPE '\\' THEN 1
          ELSE 2
        END AS score
      FROM records r
      JOIN spaces s ON s.space_id = r.space_id
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      LEFT JOIN event_state es ON es.record_id = r.record_id
      WHERE r.archived_at IS NULL
        AND r.space_id IN (${placeholders})
        AND LOWER(r.title) LIKE ? ESCAPE '\\'
      ORDER BY score ASC, r.updated_at DESC, r.record_id DESC
      LIMIT ?
    `;

    try {
      return db.prepare(matchSql).all(query, ...visibleSpaceIds, limit);
    } catch (error) {
      requestLog?.warn?.('FTS record search failed; using LIKE fallback.', { error });
      return db.prepare(fallbackSql).all(
        loweredQuery,
        `${escapedQuery}%`,
        ...visibleSpaceIds,
        `%${escapedQuery}%`,
        limit,
      );
    }
  };

  const searchProjects = ({ query, limit, visibleWorkProjectIds, requestLog = null }) => {
    const placeholders = visibleWorkProjectIds.map(() => '?').join(', ');
    const matchSql = `
      SELECT
        p.project_id AS id,
        p.name AS title,
        p.space_id AS space_id,
        s.name AS space_name,
        bm25(search_projects_fts) AS score
      FROM search_projects_fts
      JOIN projects p ON p.project_id = search_projects_fts.project_id
      JOIN spaces s ON s.space_id = p.space_id
      WHERE search_projects_fts MATCH ?
        AND p.project_id IN (${placeholders})
      ORDER BY score ASC, p.updated_at DESC, p.project_id DESC
      LIMIT ?
    `;
    const loweredQuery = query.toLowerCase();
    const escapedQuery = escapeLikePattern(loweredQuery);
    const fallbackSql = `
      SELECT
        p.project_id AS id,
        p.name AS title,
        p.space_id AS space_id,
        s.name AS space_name,
        CASE
          WHEN LOWER(p.name) = ? THEN 0
          WHEN LOWER(p.name) LIKE ? ESCAPE '\\' THEN 1
          ELSE 2
        END AS score
      FROM projects p
      JOIN spaces s ON s.space_id = p.space_id
      WHERE p.project_id IN (${placeholders})
        AND LOWER(p.name) LIKE ? ESCAPE '\\'
      ORDER BY score ASC, p.updated_at DESC, p.project_id DESC
      LIMIT ?
    `;

    try {
      return db.prepare(matchSql).all(query, ...visibleWorkProjectIds, limit);
    } catch (error) {
      requestLog?.warn?.('FTS project search failed; using LIKE fallback.', { error });
      return db.prepare(fallbackSql).all(
        loweredQuery,
        `${escapedQuery}%`,
        ...visibleWorkProjectIds,
        `%${escapedQuery}%`,
        limit,
      );
    }
  };

  const globalSearch = withPolicyGate('hub.view', async ({ request, response, requestUrl, auth }) => {
    const query = asText(requestUrl.searchParams.get('q'));
    if (!query) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'q is required.')));
      return;
    }

    const limit = asInteger(requestUrl.searchParams.get('limit'), 20, 1, 50);
    const requestedType = asText(requestUrl.searchParams.get('type')).toLowerCase();
    if (requestedType && !SEARCH_TYPES.has(requestedType)) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'type must be record or project.')));
      return;
    }

    const visibleSpaceIds = visibleSpaceIdsForUser(auth.user.user_id);
    if (visibleSpaceIds.length === 0) {
      send(response, jsonResponse(200, okEnvelope({ query, results: [] })));
      return;
    }
    const typesToSearch = requestedType ? [requestedType] : ['record', 'project'];
    const visibleWorkProjectIds = typesToSearch.includes('project') ? visibleWorkProjectIdsForUser(visibleSpaceIds) : [];
    const results = [];

    for (const type of typesToSearch) {
      if (type === 'record') {
        results.push(
          ...searchRecords({ query, limit, visibleSpaceIds, requestLog: request.log }).map((row) => ({
            type: 'record',
            id: row.id,
            title: row.title,
            space_id: row.space_id,
            space_name: row.space_name,
            content_type: row.content_type,
            score: row.score,
          })),
        );
      } else if (type === 'project') {
        if (visibleWorkProjectIds.length === 0) {
          continue;
        }
        results.push(
          ...searchProjects({ query, limit, visibleWorkProjectIds, requestLog: request.log }).map((row) => ({
            type: 'project',
            id: row.id,
            title: row.title,
            space_id: row.space_id,
            space_name: row.space_name,
            score: row.score,
          })),
        );
      }
    }

    const merged = results
      .sort(compareResults)
      .slice(0, limit)
      .map(({ score, ...result }) => result);

    send(response, jsonResponse(200, okEnvelope({ query, results: merged })));
  });

  return {
    globalSearch,
  };
};
