import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureRepoDir, loadEnvFilesIntoProcess, resolveRepoPath } from '../dev/lib/env.mjs';
import { summarizeHubApiReport } from './summarize-hub-api-report.mjs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBoolean = (value, fallback = false) => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const readArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    dryRun: false,
    reportPath: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--report' && args[index + 1]) {
      parsed.reportPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
};

const collectTokenPool = () => {
  const envPool = String(process.env.HUB_PERF_TOKENS || '').trim();
  if (envPool) {
    return envPool
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
  }

  const fallbackNames = [
    'HUB_OWNER_ACCESS_TOKEN',
    'HUB_ACCESS_TOKEN',
    'HUB_COLLAB_ACCESS_TOKEN',
    'LOCAL_OWNER_ACCESS_TOKEN',
    'LOCAL_MEMBER_ACCESS_TOKEN',
    'LOCAL_COLLAB_ACCESS_TOKEN',
  ];

  return [...new Set(
    fallbackNames
      .map((name) => String(process.env[name] || '').trim())
      .filter(Boolean),
  )];
};

const computeProfile = () => {
  const userBaseSize = Math.max(1, Math.round(asNumber(process.env.HUB_PERF_USER_BASE_SIZE, 500)));
  const activeUserFraction = Math.min(1, Math.max(0.01, asNumber(process.env.HUB_PERF_ACTIVE_USER_FRACTION, 0.35)));
  const peakWindowMinutes = Math.max(5, asNumber(process.env.HUB_PERF_PEAK_WINDOW_MINUTES, 60));
  const timeCompression = Math.max(1, asNumber(process.env.HUB_PERF_TIME_COMPRESSION, 60));
  const burstMultiplier = Math.max(1.1, asNumber(process.env.HUB_PERF_BURST_MULTIPLIER, 2.5));
  const requestTimeoutMs = Math.max(1000, Math.round(asNumber(process.env.HUB_PERF_REQUEST_TIMEOUT_MS, 15000)));

  const thinkMinSeconds = Math.max(1, asNumber(process.env.HUB_PERF_THINK_MIN_SECONDS, 5));
  const thinkMaxSeconds = Math.max(thinkMinSeconds, asNumber(process.env.HUB_PERF_THINK_MAX_SECONDS, 25));
  const compressedThinkMinMs = Math.max(100, Math.round((thinkMinSeconds * 1000) / timeCompression));
  const compressedThinkMaxMs = Math.max(
    compressedThinkMinMs,
    Math.round((thinkMaxSeconds * 1000) / timeCompression),
  );

  const activeUsers = Math.max(1, Math.round(userBaseSize * activeUserFraction));
  const peakArrivalsPerSecond = Math.max(
    1,
    Math.ceil((activeUsers / (peakWindowMinutes * 60)) * timeCompression),
  );
  const warmupArrivalsPerSecond = Math.max(1, Math.ceil(peakArrivalsPerSecond * 0.5));
  const burstArrivalsPerSecond = Math.max(
    peakArrivalsPerSecond + 1,
    Math.ceil(peakArrivalsPerSecond * burstMultiplier),
  );

  return {
    userBaseSize,
    activeUsers,
    activeUserFraction,
    peakWindowMinutes,
    timeCompression,
    burstMultiplier,
    requestTimeoutMs,
    thinkMinSeconds,
    thinkMaxSeconds,
    compressedThinkMinMs,
    compressedThinkMaxMs,
    warmupArrivalsPerSecond,
    peakArrivalsPerSecond,
    burstArrivalsPerSecond,
    warmupDurationSeconds: Math.max(1, Math.round(asNumber(process.env.HUB_PERF_WARMUP_SECONDS, 60))),
    peakDurationSeconds: Math.max(1, Math.round(asNumber(process.env.HUB_PERF_PEAK_SECONDS, 180))),
    burstDurationSeconds: Math.max(1, Math.round(asNumber(process.env.HUB_PERF_BURST_SECONDS, 60))),
    recoveryDurationSeconds: Math.max(1, Math.round(asNumber(process.env.HUB_PERF_RECOVERY_SECONDS, 60))),
  };
};

const buildArtilleryScript = ({ baseUrl, profile, processorPath, enableMutations }) => {
  const mutationScenario = enableMutations
    ? `
  - name: mutation_session
    weight: 5
    flow:
      - function: "seedSessionState"
      - post:
          url: "/api/hub/tasks"
          name: "POST /api/hub/tasks"
          headers:
            Authorization: "{{ authHeader }}"
            Content-Type: "application/json"
          json:
            title: "{{ taskTitle }}"
            status: "todo"
            priority: "medium"
      - think: "{{ thinkShortSeconds }}"
      - post:
          url: "/api/hub/reminders"
          name: "POST /api/hub/reminders"
          headers:
            Authorization: "{{ authHeader }}"
            Content-Type: "application/json"
          json:
            title: "{{ reminderTitle }}"
            remind_at: "{{ remindAtIso }}"
      - think: "{{ thinkShortSeconds }}"
      - post:
          url: "/api/hub/projects/{{ projectId }}/events/from-nlp"
          name: "POST /api/hub/projects/:projectId/events/from-nlp"
          headers:
            Authorization: "{{ authHeader }}"
            Content-Type: "application/json"
          json:
            title: "{{ eventTitle }}"
            start_dt: "{{ eventStartIso }}"
            end_dt: "{{ eventEndIso }}"
            timezone: "{{ eventTimezone }}"
`
    : '';

  return `config:
  target: "${baseUrl}"
  http:
    timeout: ${profile.requestTimeoutMs}
  plugins:
    metrics-by-endpoint:
      useOnlyRequestNames: true
  processor: "${processorPath}"
  phases:
    - duration: ${profile.warmupDurationSeconds}
      arrivalRate: ${profile.warmupArrivalsPerSecond}
      rampTo: ${profile.peakArrivalsPerSecond}
      name: warmup
    - duration: ${profile.peakDurationSeconds}
      arrivalRate: ${profile.peakArrivalsPerSecond}
      name: simulated_peak
    - duration: ${profile.burstDurationSeconds}
      arrivalRate: ${profile.peakArrivalsPerSecond}
      rampTo: ${profile.burstArrivalsPerSecond}
      name: queueing_burst
    - duration: ${profile.recoveryDurationSeconds}
      arrivalRate: ${profile.peakArrivalsPerSecond}
      name: recovery
scenarios:
  - name: dashboard_session
    weight: 40
    flow:
      - function: "seedSessionState"
      - get:
          url: "/api/hub/me"
          name: "GET /api/hub/me"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkShortSeconds }}"
      - get:
          url: "/api/hub/home?tasks_limit={{ homeTasksLimit }}&events_limit={{ homeEventsLimit }}&captures_limit={{ homeCapturesLimit }}&notifications_limit={{ homeNotificationsLimit }}"
          name: "GET /api/hub/home"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkShortSeconds }}"
      - get:
          url: "/api/hub/tasks?lens=assigned&limit=12"
          name: "GET /api/hub/tasks [assigned]"
          headers:
            Authorization: "{{ authHeader }}"
      - get:
          url: "/api/hub/notifications?unread=1"
          name: "GET /api/hub/notifications"
          headers:
            Authorization: "{{ authHeader }}"
      - get:
          url: "/api/hub/calendar?mode=relevant"
          name: "GET /api/hub/calendar"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkMediumSeconds }}"
      - get:
          url: "/api/hub/search?q={{ searchTerm }}&limit=12"
          name: "GET /api/hub/search"
          headers:
            Authorization: "{{ authHeader }}"
  - name: project_session
    weight: 35
    flow:
      - function: "seedSessionState"
      - get:
          url: "/api/hub/projects"
          name: "GET /api/hub/projects"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkShortSeconds }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}"
          name: "GET /api/hub/projects/:projectId"
          headers:
            Authorization: "{{ authHeader }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/panes"
          name: "GET /api/hub/projects/:projectId/panes"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkShortSeconds }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/collections"
          name: "GET /api/hub/projects/:projectId/collections"
          headers:
            Authorization: "{{ authHeader }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/tasks?limit=20{{ paneQuery }}"
          name: "GET /api/hub/projects/:projectId/tasks"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkMediumSeconds }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/timeline"
          name: "GET /api/hub/projects/:projectId/timeline"
          headers:
            Authorization: "{{ authHeader }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/calendar?mode=relevant"
          name: "GET /api/hub/projects/:projectId/calendar"
          headers:
            Authorization: "{{ authHeader }}"
  - name: workspace_search_session
    weight: 20
    flow:
      - function: "seedSessionState"
      - get:
          url: "/api/hub/projects/{{ projectId }}/panes"
          name: "GET /api/hub/projects/:projectId/panes"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkShortSeconds }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/mentions/search?q={{ mentionQuery }}&limit=12"
          name: "GET /api/hub/projects/:projectId/mentions/search"
          headers:
            Authorization: "{{ authHeader }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/records/search?query={{ searchTerm }}&limit=12"
          name: "GET /api/hub/projects/:projectId/records/search"
          headers:
            Authorization: "{{ authHeader }}"
      - think: "{{ thinkShortSeconds }}"
      - get:
          url: "/api/hub/projects/{{ projectId }}/tasks?limit=12{{ paneQuery }}"
          name: "GET /api/hub/projects/:projectId/tasks"
          headers:
            Authorization: "{{ authHeader }}"
      - get:
          url: "/api/hub/home?tasks_limit=8&events_limit=6&captures_limit=6&notifications_limit=6"
          name: "GET /api/hub/home"
          headers:
            Authorization: "{{ authHeader }}"
${mutationScenario}`;
};

const printUsage = () => {
  console.log('npm run perf:hub-api -- [--dry-run] [--report artifacts/perf/custom-report.json]');
  console.log('');
  console.log('Environment');
  console.log('  HUB_BASE_URL or HUB_PERF_BASE_URL');
  console.log('  HUB_PERF_TOKENS or HUB_OWNER_ACCESS_TOKEN/HUB_ACCESS_TOKEN/HUB_COLLAB_ACCESS_TOKEN');
  console.log('  HUB_PROJECT_ID or HUB_PERF_FIXED_PROJECT_ID');
  console.log('  HUB_PERF_ENABLE_MUTATIONS=true to include create-task/create-reminder/create-event traffic');
};

const artilleryBinary = () => {
  const suffix = process.platform === 'win32' ? '.cmd' : '';
  return resolveRepoPath(`node_modules/.bin/artillery${suffix}`);
};

const main = async () => {
  await loadEnvFilesIntoProcess(['.env.local', '.env'], { override: false });
  await loadEnvFilesIntoProcess(['.env.local.tokens.local'], { override: true });

  const args = readArgs();
  if (args.help) {
    printUsage();
    return;
  }

  const baseUrl = String(process.env.HUB_PERF_BASE_URL || process.env.HUB_BASE_URL || 'http://127.0.0.1:3001')
    .trim()
    .replace(/\/+$/, '');
  const tokenPool = collectTokenPool();
  if (tokenPool.length === 0) {
    throw new Error('No performance token pool found. Set HUB_PERF_TOKENS or HUB_ACCESS_TOKEN/HUB_OWNER_ACCESS_TOKEN.');
  }

  const enableMutations = asBoolean(process.env.HUB_PERF_ENABLE_MUTATIONS, false);
  const profile = computeProfile();

  ensureRepoDir('artifacts/perf');
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = resolveRepoPath(args.reportPath || `artifacts/perf/hub-api-user-base-${runId}.json`);
  const summaryJsonPath = reportPath.replace(/\.json$/i, '.summary.json');
  const summaryMarkdownPath = reportPath.replace(/\.json$/i, '.summary.md');
  const tempDir = await mkdtemp(resolve(tmpdir(), 'hub-api-perf-'));
  const scriptPath = resolve(tempDir, 'hub-api-user-base.artillery.yml');
  const processorPath = resolveRepoPath('scripts/perf/hub-api-user-base-processor.mjs');

  const script = buildArtilleryScript({
    baseUrl,
    profile,
    processorPath,
    enableMutations,
  });

  await writeFile(scriptPath, script, 'utf8');

  console.log('Hub API 500-user-base profile');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Token pool size: ${tokenPool.length}`);
  console.log(`User base: ${profile.userBaseSize}`);
  console.log(`Peak active users: ${profile.activeUsers} (${(profile.activeUserFraction * 100).toFixed(1)}%)`);
  console.log(`Peak window: ${profile.peakWindowMinutes} minutes`);
  console.log(`Time compression: ${profile.timeCompression}x`);
  console.log(`Arrivals/sec: warmup=${profile.warmupArrivalsPerSecond} peak=${profile.peakArrivalsPerSecond} burst=${profile.burstArrivalsPerSecond}`);
  console.log(`Mutations enabled: ${enableMutations ? 'yes' : 'no'}`);
  console.log(`Report path: ${relative(repoRoot, reportPath)}`);

  if (args.dryRun) {
    console.log('');
    console.log(script);
    return;
  }

  await execFileAsync(
    artilleryBinary(),
    ['run', '--output', reportPath, scriptPath],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        HUB_PERF_BASE_URL: baseUrl,
        HUB_PERF_TOKEN_POOL: tokenPool.join(','),
        HUB_PERF_THINK_MIN_MS: String(profile.compressedThinkMinMs),
        HUB_PERF_THINK_MAX_MS: String(profile.compressedThinkMaxMs),
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  ).then(({ stdout, stderr }) => {
    if (stdout.trim()) {
      process.stdout.write(stdout);
    }
    if (stderr.trim()) {
      process.stderr.write(stderr);
    }
  });

  const summary = await summarizeHubApiReport(reportPath, {
    writeJsonPath: summaryJsonPath,
    writeMarkdownPath: summaryMarkdownPath,
  });

  console.log('');
  console.log('Summary');
  if (summary.overallLatency) {
    console.log(`Overall p50=${summary.overallLatency.p50.toFixed(2)}ms p95=${summary.overallLatency.p95.toFixed(2)}ms p99.9=${summary.overallLatency.p999.toFixed(2)}ms`);
  }
  if (summary.endpointLatencies.length > 0) {
    console.log('Slowest endpoints by p95');
    for (const metric of summary.endpointLatencies.slice(0, 10)) {
      console.log(`- ${metric.endpoint}: count=${Math.round(metric.count)} p95=${metric.p95.toFixed(2)}ms p99.9=${metric.p999.toFixed(2)}ms`);
    }
  }
  console.log(`Summary JSON: ${relative(repoRoot, summaryJsonPath)}`);
  console.log(`Summary Markdown: ${relative(repoRoot, summaryMarkdownPath)}`);
};

await main();
