const { fetch } = globalThis;

const SEARCH_TERMS = ['task', 'meeting', 'project', 'plan', 'note', 'timeline'];
const MENTION_QUERIES = ['al', 'me', 'pl', 'ta'];

const parseTokenPool = () => {
  const raw = String(process.env.HUB_PERF_TOKEN_POOL || '').trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
};

const randomInt = (min, max) => {
  if (max <= min) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomFloat = (min, max) => {
  if (max <= min) {
    return min;
  }
  return Math.random() * (max - min) + min;
};

const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];

const authHeaders = (token) => ({
  Accept: 'application/json',
  Authorization: `Bearer ${token}`,
});

const readEnvelope = async (response, path) => {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.ok !== true || body.data == null) {
    const message = body?.error?.message || `Failed to load ${path} (${response.status}).`;
    throw new Error(message);
  }
  return body.data;
};

const requestJson = async (baseUrl, token, path) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  return readEnvelope(response, path);
};

const pickProject = (projects, fixedProjectId) => {
  if (fixedProjectId) {
    return projects.find((project) => String(project.id || project.project_id || '') === fixedProjectId) || null;
  }

  const nonPersonal = projects.filter((project) => project?.is_personal !== true);
  if (nonPersonal.length > 0) {
    return randomFrom(nonPersonal);
  }
  return projects[0] || null;
};

export const seedSessionState = async (context) => {
  const baseUrl = String(process.env.HUB_PERF_BASE_URL || process.env.HUB_BASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('HUB_PERF_BASE_URL or HUB_BASE_URL is required.');
  }
  const tokenPool = parseTokenPool();
  if (tokenPool.length === 0) {
    throw new Error('HUB_PERF_TOKEN_POOL is empty. Set HUB_ACCESS_TOKEN or related perf token env vars.');
  }

  const token = randomFrom(tokenPool);
  const fixedProjectId = String(process.env.HUB_PERF_FIXED_PROJECT_ID || process.env.HUB_PROJECT_ID || '').trim();
  const thinkMinMs = Number(process.env.HUB_PERF_THINK_MIN_MS || '100');
  // Keep randomFloat ranges valid even if HUB_PERF_THINK_MAX_MS is misconfigured below HUB_PERF_THINK_MIN_MS.
  const thinkMaxMs = Math.max(thinkMinMs, Number(process.env.HUB_PERF_THINK_MAX_MS || '500'));

  context.vars.authHeader = `Bearer ${token}`;
  context.vars.searchTerm = randomFrom(SEARCH_TERMS);
  context.vars.mentionQuery = randomFrom(MENTION_QUERIES);
  context.vars.thinkShortSeconds = randomFloat(thinkMinMs, thinkMaxMs) / 1000;
  context.vars.thinkMediumSeconds = randomFloat(thinkMinMs * 2, thinkMaxMs * 2) / 1000;

  const projectsPayload = await requestJson(baseUrl, token, '/api/hub/projects');
  const projects = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : [];
  const project = pickProject(projects, fixedProjectId);
  if (!project) {
    throw new Error('No accessible project found for the configured performance token pool.');
  }

  const projectId = String(project.id || project.project_id || '').trim();
  if (!projectId) {
    throw new Error('Resolved project is missing a stable identifier.');
  }

  context.vars.projectId = projectId;

  const panesPayload = await requestJson(baseUrl, token, `/api/hub/projects/${encodeURIComponent(projectId)}/panes`);
  const panes = Array.isArray(panesPayload.panes) ? panesPayload.panes : [];
  const pane = panes[0] || null;
  const paneId = pane ? String(pane.pane_id || pane.id || '').trim() : '';
  context.vars.paneId = paneId;
  context.vars.paneQuery = paneId ? `&source_pane_id=${encodeURIComponent(paneId)}` : '';

  const reminderOffsetMinutes = randomInt(30, 120);
  const eventOffsetMinutes = randomInt(120, 360);
  const eventDurationMinutes = randomInt(30, 90);
  const now = Date.now();
  const reminderAt = new Date(now + reminderOffsetMinutes * 60_000).toISOString();
  const eventStart = new Date(now + eventOffsetMinutes * 60_000);
  const eventEnd = new Date(eventStart.getTime() + eventDurationMinutes * 60_000);
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  context.vars.reminderTitle = `Perf reminder ${uniqueSuffix}`;
  context.vars.remindAtIso = reminderAt;
  context.vars.taskTitle = `Perf task ${uniqueSuffix}`;
  context.vars.eventTitle = `Perf event ${uniqueSuffix}`;
  context.vars.eventStartIso = eventStart.toISOString();
  context.vars.eventEndIso = eventEnd.toISOString();
  context.vars.eventTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  context.vars.homeTasksLimit = String(randomInt(6, 12));
  context.vars.homeEventsLimit = String(randomInt(4, 8));
  context.vars.homeCapturesLimit = String(randomInt(4, 8));
  context.vars.homeNotificationsLimit = String(randomInt(4, 8));
};
