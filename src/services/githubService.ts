import { mockPullRequests } from '../data/mockData';
import { env } from '../lib/env';
import type { IntegrationOutcome, PullRequestItem } from '../types/domain';

const browserGitHubIntegrationBlocked =
  'Browser GitHub integration is disabled. Route pull request reads through hub-api or the desktop bridge.';

export const listPullRequests = async (): Promise<IntegrationOutcome<PullRequestItem[]>> => {
  if (env.useMocks) {
    return { data: mockPullRequests };
  }

  return { blockedReason: browserGitHubIntegrationBlocked };
};
