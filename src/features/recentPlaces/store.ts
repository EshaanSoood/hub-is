import { buildProjectWorkHref } from '../../lib/hubRoutes';
import type { RecentPanePlaceInput, RecentPlaceEntry, RecentPlaceKind } from './types';

const RECENT_PLACES_STORAGE_KEY = 'hub:sidebar:recent-places';
const RECENT_PLACES_UPDATED_EVENT = 'hub:recent-places-updated';
const MAX_STORED_RECENT_PLACES = 12;
export const MAX_VISIBLE_RECENT_PLACES = 4;

const parseTimestamp = (value: string | null): number => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Number(new Date(value));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const hasContribution = (entry: RecentPlaceEntry): boolean =>
  entry.contributionCount > 0 && parseTimestamp(entry.lastContributedAt) > Number.NEGATIVE_INFINITY;

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
  value === 'pane' || value === 'space';

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
    || typeof candidate.paneName !== 'string'
    || typeof candidate.href !== 'string'
    || typeof candidate.lastVisitedAt !== 'string'
    || (candidate.paneId !== null && typeof candidate.paneId !== 'string')
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

  if (candidate.kind === 'pane' && (candidate.paneId === null || !candidate.paneName.trim())) {
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
    paneId: candidate.paneId,
    paneName: candidate.paneName,
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

const panePlaceKey = (spaceId: string, paneId: string): string => `pane:${spaceId}:${paneId}`;

const paneHref = (input: RecentPanePlaceInput): string =>
  input.href ?? buildProjectWorkHref(input.spaceId, input.paneId);

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
    return parsed
      .map(sanitizeRecentPlaceEntry)
      .filter((entry): entry is RecentPlaceEntry => entry !== null)
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

export const recordRecentPaneVisit = (input: RecentPanePlaceInput) => {
  const nowIso = new Date().toISOString();
  const currentEntries = readRecentPlaces();
  const key = panePlaceKey(input.spaceId, input.paneId);
  const existing = currentEntries.find((entry) => entry.key === key) || null;

  writeRecentPlaces(upsertRecentPlace(currentEntries, {
    contributionCount: existing?.contributionCount ?? 0,
    href: paneHref(input),
    key,
    kind: 'pane',
    lastContributedAt: existing?.lastContributedAt ?? null,
    lastContributionKind: existing?.lastContributionKind ?? null,
    lastVisitedAt: nowIso,
    paneId: input.paneId,
    paneName: input.paneName,
    spaceId: input.spaceId,
    spaceName: input.spaceName,
    visitCount: (existing?.visitCount ?? 0) + 1,
  }));
};

export const recordRecentPaneContribution = (
  input: RecentPanePlaceInput,
  contributionKind: string,
) => {
  const nowIso = new Date().toISOString();
  const currentEntries = readRecentPlaces();
  const key = panePlaceKey(input.spaceId, input.paneId);
  const existing = currentEntries.find((entry) => entry.key === key) || null;

  writeRecentPlaces(upsertRecentPlace(currentEntries, {
    contributionCount: (existing?.contributionCount ?? 0) + 1,
    href: paneHref(input),
    key,
    kind: 'pane',
    lastContributedAt: nowIso,
    lastContributionKind: contributionKind,
    lastVisitedAt: nowIso,
    paneId: input.paneId,
    paneName: input.paneName,
    spaceId: input.spaceId,
    spaceName: input.spaceName,
    visitCount: (existing?.visitCount ?? 0) + 1,
  }));
};
