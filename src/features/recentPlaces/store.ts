import { buildProjectWorkHref } from '../../lib/hubRoutes';
import type { RecentProjectPlaceInput, RecentPlaceEntry, RecentPlaceKind } from './types';

const RECENT_PLACES_STORAGE_KEY = 'hub:sidebar:recent-places';
const RECENT_PLACES_UPDATED_EVENT = 'hub:recent-places-updated';
const MAX_STORED_RECENT_PLACES = 12;
export const MAX_VISIBLE_RECENT_PLACES = 4;
let lastRecentPlaceTimestampMs = 0;

const parseTimestamp = (value: string | null): number => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Number(new Date(value));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const hasContribution = (entry: RecentPlaceEntry): boolean =>
  entry.contributionCount > 0 && parseTimestamp(entry.lastContributedAt) > Number.NEGATIVE_INFINITY;

const nextRecentPlaceTimestamp = (): string => {
  const nowMs = Date.now();
  const nextMs = nowMs <= lastRecentPlaceTimestampMs ? lastRecentPlaceTimestampMs + 1 : nowMs;
  lastRecentPlaceTimestampMs = nextMs;
  return new Date(nextMs).toISOString();
};

const recentPlaceSort = (left: RecentPlaceEntry, right: RecentPlaceEntry): number => {
  const leftContributed = hasContribution(left);
  const rightContributed = hasContribution(right);
  if (leftContributed !== rightContributed) {
    return leftContributed ? -1 : 1;
  }

  const leftPrimary = leftContributed ? parseTimestamp(left.lastContributedAt) : parseTimestamp(left.lastVisitedAt);
  const rightPrimary = rightContributed ? parseTimestamp(right.lastContributedAt) : parseTimestamp(right.lastVisitedAt);
  if (leftPrimary !== rightPrimary) {
    return rightPrimary - leftPrimary;
  }

  const leftSecondary = parseTimestamp(left.lastVisitedAt);
  const rightSecondary = parseTimestamp(right.lastVisitedAt);
  if (leftSecondary !== rightSecondary) {
    return rightSecondary - leftSecondary;
  }

  return left.key.localeCompare(right.key);
};

const isRecentPlaceKind = (value: unknown): value is RecentPlaceKind =>
  value === 'project' || value === 'space';

const sanitizeRecentPlaceEntry = (value: unknown): RecentPlaceEntry | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.key !== 'string'
    || !isRecentPlaceKind(candidate.kind)
    || typeof candidate.spaceId !== 'string'
    || typeof candidate.spaceName !== 'string'
    || typeof candidate.projectName !== 'string'
    || typeof candidate.href !== 'string'
    || typeof candidate.lastVisitedAt !== 'string'
    || (candidate.projectId !== null && typeof candidate.projectId !== 'string')
    || (candidate.lastContributedAt !== null && typeof candidate.lastContributedAt !== 'string')
    || (candidate.lastContributionKind !== null && typeof candidate.lastContributionKind !== 'string')
    || typeof candidate.visitCount !== 'number'
    || typeof candidate.contributionCount !== 'number'
  ) {
    return null;
  }

  if (!candidate.spaceId.trim() || !candidate.spaceName.trim() || !candidate.href.startsWith('/')) {
    return null;
  }

  if (candidate.kind === 'project' && (candidate.projectId === null || !candidate.projectName.trim())) {
    return null;
  }

  return {
    contributionCount: Math.max(0, Math.floor(candidate.contributionCount)),
    href: candidate.href,
    key: candidate.key,
    kind: candidate.kind,
    lastContributedAt: candidate.lastContributedAt,
    lastContributionKind: candidate.lastContributionKind,
    lastVisitedAt: candidate.lastVisitedAt,
    projectId: candidate.projectId,
    projectName: candidate.projectName,
    spaceId: candidate.spaceId,
    spaceName: candidate.spaceName,
    visitCount: Math.max(0, Math.floor(candidate.visitCount)),
  };
};

const dedupeRecentPlaces = (entries: RecentPlaceEntry[]): RecentPlaceEntry[] => {
  const nextByKey = new Map<string, RecentPlaceEntry>();
  for (const entry of entries) {
    const existing = nextByKey.get(entry.key);
    if (!existing) {
      nextByKey.set(entry.key, entry);
      continue;
    }
    nextByKey.set(entry.key, recentPlaceSort(entry, existing) <= 0 ? entry : existing);
  }
  return [...nextByKey.values()];
};

const writeRecentPlaces = (entries: RecentPlaceEntry[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      RECENT_PLACES_STORAGE_KEY,
      JSON.stringify(dedupeRecentPlaces(entries).sort(recentPlaceSort).slice(0, MAX_STORED_RECENT_PLACES)),
    );
    window.dispatchEvent(new CustomEvent(RECENT_PLACES_UPDATED_EVENT));
  } catch {
    // Ignore storage failures so recent places remain non-blocking.
  }
};

const projectPlaceKey = (spaceId: string, projectId: string): string => `project:${spaceId}:${projectId}`;

const projectHref = (input: RecentProjectPlaceInput): string =>
  input.href ?? buildProjectWorkHref(input.spaceId, input.projectId);

const upsertRecentPlace = (
  currentEntries: RecentPlaceEntry[],
  nextEntry: RecentPlaceEntry,
): RecentPlaceEntry[] => [
  nextEntry,
  ...currentEntries.filter((entry) => entry.key !== nextEntry.key),
].sort(recentPlaceSort).slice(0, MAX_STORED_RECENT_PLACES);

export const readRecentPlaces = (): RecentPlaceEntry[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_PLACES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return dedupeRecentPlaces(parsed
      .map(sanitizeRecentPlaceEntry)
      .filter((entry): entry is RecentPlaceEntry => entry !== null))
      .sort(recentPlaceSort)
      .slice(0, MAX_STORED_RECENT_PLACES);
  } catch {
    return [];
  }
};

export const selectRecentPlaces = (limit = MAX_VISIBLE_RECENT_PLACES): RecentPlaceEntry[] =>
  readRecentPlaces().slice(0, limit);

export const subscribeRecentPlaces = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => {
    callback();
  };

  window.addEventListener(RECENT_PLACES_UPDATED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(RECENT_PLACES_UPDATED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
};

export const recordRecentProjectVisit = (input: RecentProjectPlaceInput) => {
  const nowIso = nextRecentPlaceTimestamp();
  const currentEntries = readRecentPlaces();
  const key = projectPlaceKey(input.spaceId, input.projectId);
  const existing = currentEntries.find((entry) => entry.key === key) || null;

  writeRecentPlaces(upsertRecentPlace(currentEntries, {
    contributionCount: existing?.contributionCount ?? 0,
    href: projectHref(input),
    key,
    kind: 'project',
    lastContributedAt: existing?.lastContributedAt ?? null,
    lastContributionKind: existing?.lastContributionKind ?? null,
    lastVisitedAt: nowIso,
    projectId: input.projectId,
    projectName: input.projectName,
    spaceId: input.spaceId,
    spaceName: input.spaceName,
    visitCount: (existing?.visitCount ?? 0) + 1,
  }));
};

export const recordRecentProjectContribution = (
  input: RecentProjectPlaceInput,
  contributionKind: string,
) => {
  const nowIso = nextRecentPlaceTimestamp();
  const currentEntries = readRecentPlaces();
  const key = projectPlaceKey(input.spaceId, input.projectId);
  const existing = currentEntries.find((entry) => entry.key === key) || null;

  writeRecentPlaces(upsertRecentPlace(currentEntries, {
    contributionCount: (existing?.contributionCount ?? 0) + 1,
    href: projectHref(input),
    key,
    kind: 'project',
    lastContributedAt: nowIso,
    lastContributionKind: contributionKind,
    lastVisitedAt: nowIso,
    projectId: input.projectId,
    projectName: input.projectName,
    spaceId: input.spaceId,
    spaceName: input.spaceName,
    visitCount: (existing?.visitCount ?? 0) + 1,
  }));
};
