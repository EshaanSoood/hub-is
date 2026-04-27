export type RecentPlaceKind = 'project' | 'space';

export interface RecentPlaceEntry {
  contributionCount: number;
  href: string;
  key: string;
  kind: RecentPlaceKind;
  lastContributedAt: string | null;
  lastContributionKind: string | null;
  lastVisitedAt: string;
  projectId: string | null;
  projectName: string;
  spaceId: string;
  spaceName: string;
  visitCount: number;
}

export interface RecentProjectPlaceInput {
  href?: string;
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
}
