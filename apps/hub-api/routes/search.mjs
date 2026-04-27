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

  const visibleProjectIdsForUser = (userId) =>
    Array.from(
      new Set(
        projectMembershipsByUserStmt
          .all(userId)
          .map((membership) => asText(membership.project_id))
          .filter(Boolean),
      ),
    );

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

  const searchRecords = ({ query, limit, visibleProjectIds, requestLog = null }) => {
    const placeholders = visibleProjectIds.map(() => '?').join(', ');
    const matchSql = `
      SELECT
        r.record_id AS id,
        r.title AS title,
        r.project_id AS project_id,
        p.name AS project_name,
        CASE
          WHEN ts.record_id IS NOT NULL THEN 'task'
          WHEN es.record_id IS NOT NULL THEN 'event'
          ELSE 'record'
        END AS content_type,
        bm25(search_records_fts) AS score
      FROM search_records_fts
      JOIN records r ON r.record_id = search_records_fts.record_id
      JOIN projects p ON p.project_id = r.project_id
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      LEFT JOIN event_state es ON es.record_id = r.record_id
      WHERE search_records_fts MATCH ?
        AND r.archived_at IS NULL
        AND r.project_id IN (${placeholders})
      ORDER BY score ASC, r.updated_at DESC, r.record_id DESC
      LIMIT ?
    `;
    const loweredQuery = query.toLowerCase();
    const escapedQuery = escapeLikePattern(loweredQuery);
    const fallbackSql = `
      SELECT
        r.record_id AS id,
        r.title AS title,
        r.project_id AS project_id,
        p.name AS project_name,
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
      JOIN projects p ON p.project_id = r.project_id
      LEFT JOIN task_state ts ON ts.record_id = r.record_id
      LEFT JOIN event_state es ON es.record_id = r.record_id
      WHERE r.archived_at IS NULL
        AND r.project_id IN (${placeholders})
        AND LOWER(r.title) LIKE ? ESCAPE '\\'
      ORDER BY score ASC, r.updated_at DESC, r.record_id DESC
      LIMIT ?
    `;

    try {
      return db.prepare(matchSql).all(query, ...visibleProjectIds, limit);
    } catch (error) {
      requestLog?.warn?.('FTS record search failed; using LIKE fallback.', { error });
      return db.prepare(fallbackSql).all(
        loweredQuery,
        `${escapedQuery}%`,
        ...visibleProjectIds,
        `%${escapedQuery}%`,
        limit,
      );
    }
  };

  const searchProjects = ({ query, limit, visibleProjectIds, requestLog = null }) => {
    const placeholders = visibleProjectIds.map(() => '?').join(', ');
    const matchSql = `
      SELECT
        p.project_id AS id,
        p.project_id AS project_id,
        p.name AS title,
        p.name AS project_name,
        bm25(search_projects_fts) AS score
      FROM search_projects_fts
      JOIN projects p ON p.project_id = search_projects_fts.project_id
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
        p.project_id AS project_id,
        p.name AS title,
        p.name AS project_name,
        CASE
          WHEN LOWER(p.name) = ? THEN 0
          WHEN LOWER(p.name) LIKE ? ESCAPE '\\' THEN 1
          ELSE 2
        END AS score
      FROM projects p
      WHERE p.project_id IN (${placeholders})
        AND LOWER(p.name) LIKE ? ESCAPE '\\'
      ORDER BY score ASC, p.updated_at DESC, p.project_id DESC
      LIMIT ?
    `;

    try {
      return db.prepare(matchSql).all(query, ...visibleProjectIds, limit);
    } catch (error) {
      requestLog?.warn?.('FTS project search failed; using LIKE fallback.', { error });
      return db.prepare(fallbackSql).all(
        loweredQuery,
        `${escapedQuery}%`,
        ...visibleProjectIds,
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

    const visibleProjectIds = visibleProjectIdsForUser(auth.user.user_id);
    if (visibleProjectIds.length === 0) {
      send(response, jsonResponse(200, okEnvelope({ query, results: [] })));
      return;
    }

    const typesToSearch = requestedType ? [requestedType] : ['record', 'project'];
    const results = [];

    for (const type of typesToSearch) {
      if (type === 'record') {
        results.push(
          ...searchRecords({ query, limit, visibleProjectIds, requestLog: request.log }).map((row) => ({
            type: 'record',
            id: row.id,
            title: row.title,
            project_id: row.project_id,
            project_name: row.project_name,
            content_type: row.content_type,
            score: row.score,
          })),
        );
      } else if (type === 'project') {
        results.push(
          ...searchProjects({ query, limit, visibleProjectIds, requestLog: request.log }).map((row) => ({
            type: 'project',
            id: row.id,
            title: row.title,
            project_id: row.project_id,
            project_name: row.project_name,
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
