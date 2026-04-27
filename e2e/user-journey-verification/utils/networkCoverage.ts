import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page, Response } from '@playwright/test';
import type { JourneyScenario } from './stateTags.ts';

interface SnapshotRoute {
  method: string;
  path_pattern: string;
}

interface SnapshotPayload {
  route_count: number;
  routes: SnapshotRoute[];
}

type CoverageStatus = 'hit_ok' | 'hit_non_2xx' | 'not_hit' | 'waived';

export interface RouteCoverageEntry {
  method: string;
  path_pattern: string;
  status: CoverageStatus;
  count: number;
  statuses: number[];
  waiver_reason?: string;
}

export interface RouteCoverageReport {
  scenario: JourneyScenario;
  generated_at: string;
  manifest_path: string;
  total_routes: number;
  summary: {
    hit_ok: number;
    hit_non_2xx: number;
    not_hit: number;
    waived: number;
  };
  entries: RouteCoverageEntry[];
  unmatched_calls: Array<{
    method: string;
    path: string;
    statuses: number[];
    count: number;
  }>;
}

const DEFAULT_MANIFEST_PATH = path.join('apps', 'hub-api', 'api-snapshot.json');

const DEFAULT_WAIVERS: Record<string, string> = {
  'POST /api/hub/chat/provision': 'Chat provisioning is not exercised by the user journey suite.',
  'POST /api/hub/chat/snapshots': 'Chat snapshot creation is out of scope for journey verification.',
  'GET /api/hub/chat/snapshots': 'Chat snapshot listing is out of scope for journey verification.',
  'DELETE /api/hub/chat/snapshots/([^/]+)': 'Chat snapshot deletion is out of scope for journey verification.',
  'POST /api/hub/spaces/([^/]+)/invites': 'Invite flow is not part of baseline/stress user journey checks.',
  'POST /api/hub/spaces/([^/]+)/invites/([^/]+)': 'Invite acceptance flow is not part of baseline/stress user journey checks.',
  'GET /api/hub/spaces/([^/]+)/automation-rules': 'Automation rules are unrelated to scoped widget verification.',
  'POST /api/hub/spaces/([^/]+)/automation-rules': 'Automation rules are unrelated to scoped widget verification.',
  'PATCH /api/hub/automation-rules/([^/]+)': 'Automation rules are unrelated to scoped widget verification.',
  'DELETE /api/hub/automation-rules/([^/]+)': 'Automation rules are unrelated to scoped widget verification.',
  'GET /api/hub/spaces/([^/]+)/automation-runs': 'Automation runs are unrelated to scoped widget verification.',
};

const routeKey = (method: string, pathPattern: string): string => `${method.toUpperCase()} ${pathPattern}`;

const parseWaiverEnv = (): Record<string, string> => {
  const raw = process.env.JOURNEY_COVERAGE_WAIVERS_JSON;
  if (!raw) {
    return DEFAULT_WAIVERS;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return {
      ...DEFAULT_WAIVERS,
      ...parsed,
    };
  } catch {
    return DEFAULT_WAIVERS;
  }
};

const toPatternRegex = (pattern: string): RegExp => {
  return new RegExp(`^${pattern}$`);
};

const normalizePath = (urlText: string): string => {
  try {
    const url = new URL(urlText);
    return url.pathname;
  } catch {
    return urlText;
  }
};

const isHubApiPath = (pathname: string): boolean => pathname.startsWith('/api/hub/');

const resolveManifestPath = (): string => {
  return path.resolve(process.cwd(), process.env.JOURNEY_API_MANIFEST_PATH || DEFAULT_MANIFEST_PATH);
};

const resolveCoverageOutputPath = (): string => {
  return path.resolve(
    process.cwd(),
    process.env.JOURNEY_COVERAGE_JSON || path.join('e2e', 'user-journey-verification', 'network-coverage.json'),
  );
};

const resolveCoverageMarkdownPath = (): string => {
  return path.resolve(
    process.cwd(),
    process.env.JOURNEY_COVERAGE_MD || path.join('e2e', 'user-journey-verification', 'network-coverage.md'),
  );
};

const toMarkdown = (report: RouteCoverageReport): string => {
  const lines: string[] = [];
  lines.push('# Network Coverage');
  lines.push('');
  lines.push(`- Scenario: ${report.scenario}`);
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Manifest: ${report.manifest_path}`);
  lines.push(`- Routes: ${report.total_routes}`);
  lines.push(`- hit_ok: ${report.summary.hit_ok}`);
  lines.push(`- hit_non_2xx: ${report.summary.hit_non_2xx}`);
  lines.push(`- not_hit: ${report.summary.not_hit}`);
  lines.push(`- waived: ${report.summary.waived}`);
  lines.push('');
  lines.push('| Status | Method | Path Pattern | Count | Status Codes | Reason |');
  lines.push('| --- | --- | --- | ---: | --- | --- |');

  for (const entry of report.entries) {
    lines.push(
      `| ${entry.status} | ${entry.method} | ${entry.path_pattern} | ${entry.count} | ${entry.statuses.join(', ') || '-'} | ${entry.waiver_reason || '-'} |`,
    );
  }

  lines.push('');
  lines.push('## Unmatched Calls');
  lines.push('');

  if (report.unmatched_calls.length === 0) {
    lines.push('- None');
  } else {
    for (const call of report.unmatched_calls) {
      lines.push(`- ${call.method} ${call.path} :: count=${call.count} statuses=[${call.statuses.join(', ')}]`);
    }
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
};

interface MatchedRoute {
  route: SnapshotRoute;
  regex: RegExp;
}

export class NetworkCoverageTracker {
  private readonly scenario: JourneyScenario;

  private readonly manifestPath: string;

  private readonly routes: MatchedRoute[];

  private readonly waivers: Record<string, string>;

  private readonly statusByRoute = new Map<string, number[]>();

  private readonly unmatched = new Map<string, { method: string; path: string; statuses: number[] }>();

  constructor(scenario: JourneyScenario, manifestPath: string, routes: SnapshotRoute[]) {
    this.scenario = scenario;
    this.manifestPath = manifestPath;
    this.routes = routes.map((route) => ({ route, regex: toPatternRegex(route.path_pattern) }));
    this.waivers = parseWaiverEnv();
  }

  private recordRouteStatus(route: SnapshotRoute, status: number): void {
    const key = routeKey(route.method, route.path_pattern);
    const existing = this.statusByRoute.get(key) || [];
    existing.push(status);
    this.statusByRoute.set(key, existing);
  }

  private recordUnmatched(method: string, pathName: string, status: number): void {
    const key = `${method} ${pathName}`;
    const existing = this.unmatched.get(key);
    if (existing) {
      existing.statuses.push(status);
      return;
    }
    this.unmatched.set(key, {
      method,
      path: pathName,
      statuses: [status],
    });
  }

  private matchRoute(method: string, pathName: string): SnapshotRoute | null {
    for (const candidate of this.routes) {
      if (candidate.route.method !== method) {
        continue;
      }
      if (candidate.regex.test(pathName)) {
        return candidate.route;
      }
    }
    return null;
  }

  recordResponse(response: Response): void {
    const method = response.request().method().toUpperCase();
    const pathName = normalizePath(response.url());
    if (!isHubApiPath(pathName)) {
      return;
    }

    const status = response.status();
    const matched = this.matchRoute(method, pathName);
    if (matched) {
      this.recordRouteStatus(matched, status);
      return;
    }

    this.recordUnmatched(method, pathName, status);
  }

  attachPage(page: Page): void {
    page.on('response', (response) => this.recordResponse(response));
  }

  attachContext(context: BrowserContext): void {
    context.on('page', (page) => {
      this.attachPage(page);
    });
    for (const page of context.pages()) {
      this.attachPage(page);
    }
  }

  buildReport(): RouteCoverageReport {
    const entries: RouteCoverageEntry[] = [];
    const summary = {
      hit_ok: 0,
      hit_non_2xx: 0,
      not_hit: 0,
      waived: 0,
    };

    for (const route of this.routes.map((entry) => entry.route)) {
      const key = routeKey(route.method, route.path_pattern);
      const statuses = this.statusByRoute.get(key) || [];
      const waiverReason = this.waivers[key];

      let status: CoverageStatus;
      if (waiverReason) {
        status = 'waived';
      } else if (statuses.length === 0) {
        status = 'not_hit';
      } else if (statuses.some((code) => code < 200 || code >= 300)) {
        status = 'hit_non_2xx';
      } else {
        status = 'hit_ok';
      }

      summary[status] += 1;
      entries.push({
        method: route.method,
        path_pattern: route.path_pattern,
        status,
        count: statuses.length,
        statuses: [...new Set(statuses)].sort((a, b) => a - b),
        ...(waiverReason ? { waiver_reason: waiverReason } : {}),
      });
    }

    entries.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status.localeCompare(right.status);
      }
      if (left.method !== right.method) {
        return left.method.localeCompare(right.method);
      }
      return left.path_pattern.localeCompare(right.path_pattern);
    });

    const unmatchedCalls = Array.from(this.unmatched.values())
      .map((entry) => ({
        ...entry,
        count: entry.statuses.length,
        statuses: [...new Set(entry.statuses)].sort((a, b) => a - b),
      }))
      .sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));

    return {
      scenario: this.scenario,
      generated_at: new Date().toISOString(),
      manifest_path: this.manifestPath,
      total_routes: this.routes.length,
      summary,
      entries,
      unmatched_calls: unmatchedCalls,
    };
  }

  async writeArtifacts(jsonPath = resolveCoverageOutputPath(), markdownPath = resolveCoverageMarkdownPath()): Promise<RouteCoverageReport> {
    const report = this.buildReport();
    await mkdir(path.dirname(jsonPath), { recursive: true });
    await mkdir(path.dirname(markdownPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await writeFile(markdownPath, toMarkdown(report), 'utf8');
    return report;
  }
}

export const loadCoverageManifest = async (): Promise<{ manifestPath: string; routes: SnapshotRoute[] }> => {
  const manifestPath = resolveManifestPath();
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as SnapshotPayload;
  const routes = parsed.routes.map((route) => ({
    method: String(route.method || '').toUpperCase(),
    path_pattern: String(route.path_pattern || ''),
  }));
  return {
    manifestPath,
    routes,
  };
};

export const createCoverageTracker = async (scenario: JourneyScenario): Promise<NetworkCoverageTracker> => {
  const { manifestPath, routes } = await loadCoverageManifest();
  return new NetworkCoverageTracker(scenario, manifestPath, routes);
};
