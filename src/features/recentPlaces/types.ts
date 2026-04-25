export type RecentPlaceKind = 'pane' | 'space';

export interface RecentPlaceEntry {
  contributionCount: number;
  href: string;
  key: string;
  kind: RecentPlaceKind;
  lastContributedAt: string | null;
  lastContributionKind: string | null;
  lastVisitedAt: string;
  paneId: string | null;
  paneName: string;
  spaceId: string;
  spaceName: string;
  visitCount: number;
}

export interface RecentPanePlaceInput {
  href?: string;
  paneId: string;
  paneName: string;
  spaceId: string;
  spaceName: string;
}
