import { mockPullRequests } from '../data/mockData';
import { env } from '../lib/env';
import type { IntegrationOutcome, PullRequestItem } from '../types/domain';

export const listPullRequests = async (): Promise<IntegrationOutcome<PullRequestItem[]>> => {
  if (env.useMocks) {
    return { data: mockPullRequests };
  }

  if (!env.githubRepo || !env.githubToken) {
    return {
      blockedReason: 'Set VITE_GITHUB_REPOSITORY and VITE_GITHUB_TOKEN for live pull request reads.',
    };
  }

  const apiUrl = `https://api.github.com/repos/${env.githubRepo}/pulls`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.githubToken}`,
      },
    });

    if (!response.ok) {
      return { error: `GitHub API error ${response.status}` };
    }

    const payload = (await response.json()) as Array<{
      id: number;
      title: string;
      html_url: string;
      state: string;
      draft: boolean;
      user: { login: string };
      base: { repo: { full_name: string } };
    }>;

    const prs: PullRequestItem[] = payload.map((pr) => ({
      id: `${pr.id}`,
      title: pr.title,
      repository: pr.base.repo.full_name,
      author: pr.user.login,
      url: pr.html_url,
      status: pr.draft ? 'draft' : 'open',
    }));

    return { data: prs };
  } catch {
    return { error: 'Unable to fetch pull requests from GitHub.' };
  }
};
