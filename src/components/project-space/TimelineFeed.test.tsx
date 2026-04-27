import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TimelineFeed, TIMELINE_FILTER_TYPES, type TimelineEventType, type TimelineFilterValue } from './TimelineFeed';

afterEach(() => {
  cleanup();
});

const clusters = [
  {
    date: 'Sat Apr 25 2026',
    items: [
      {
        id: 'task-1',
        type: 'task' as TimelineEventType,
        label: 'Draft brief',
        timestamp: '4/25/2026, 10:00:00 AM',
        timestampRelative: '2h ago',
        dotColor: '',
      },
      {
        id: 'event-1',
        type: 'event' as TimelineEventType,
        label: 'Design review',
        timestamp: '4/25/2026, 11:00:00 AM',
        timestampRelative: '1h ago',
        dotColor: '',
      },
    ],
  },
];

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(10, 0, 0, 0);

const yesterdayClusters = [
  {
    date: yesterday.toDateString(),
    items: [
      {
        id: 'workspace-1',
        type: 'workspace' as TimelineEventType,
        label: 'Home Ground created',
        timestamp: yesterday.toLocaleString(),
        timestampIso: yesterday.toISOString(),
        timestampRelative: '1d ago',
        dotColor: '',
      },
    ],
  },
];

const TimelineFeedHarness = () => {
  const [activeFilters, setActiveFilters] = useState<TimelineEventType[]>(TIMELINE_FILTER_TYPES);

  const handleFilterToggle = (type: TimelineFilterValue) => {
    if (type === 'all') {
      setActiveFilters(TIMELINE_FILTER_TYPES);
      return;
    }

    setActiveFilters((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  };

  return (
    <TimelineFeed
      clusters={clusters}
      activeFilters={activeFilters}
      isLoading={false}
      hasMore={false}
      onFilterToggle={handleFilterToggle}
      onLoadMore={() => {}}
      onItemClick={() => {}}
    />
  );
};

describe('TimelineFeed', () => {
  it('applies relative date labels when only the cluster date is parseable', () => {
    render(
      <TimelineFeed
        clusters={[
          {
            date: yesterday.toDateString(),
            items: [
              {
                id: 'workspace-raw-date',
                type: 'workspace' as TimelineEventType,
                label: 'Home Ground created',
                timestamp: '',
                timestampRelative: '1d ago',
                dotColor: '',
              },
            ],
          },
        ]}
        activeFilters={TIMELINE_FILTER_TYPES}
        isLoading={false}
        hasMore={false}
        onFilterToggle={() => {}}
        onLoadMore={() => {}}
        onItemClick={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: yesterday.toDateString() })).not.toBeInTheDocument();
  });

  it('renders quiet relative date labels and keeps precise timestamps off-row', () => {
    render(
      <TimelineFeed
        clusters={yesterdayClusters}
        activeFilters={TIMELINE_FILTER_TYPES}
        isLoading={false}
        hasMore={false}
        onFilterToggle={() => {}}
        onLoadMore={() => {}}
        onItemClick={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toHaveClass('timeline-date-label', 'text-muted', 'font-semibold');
    expect(screen.queryByText('1d ago')).not.toBeInTheDocument();
    expect(screen.getByText('Home Ground created')).toHaveAttribute('title', yesterday.toLocaleString());
    expect(screen.getByRole('article', { name: `workspace: Home Ground created. ${yesterday.toLocaleString()}` })).toHaveClass('timeline-entry-row');
    expect(screen.getByRole('feed').firstElementChild).toHaveClass('timeline-mast', 'pb-6');
  });

  it('can bottom-anchor short timeline content inside its scroll region', () => {
    render(
      <TimelineFeed
        clusters={clusters}
        activeFilters={TIMELINE_FILTER_TYPES}
        bottomAnchor
        isLoading={false}
        hasMore={false}
        onFilterToggle={() => {}}
        onLoadMore={() => {}}
        onItemClick={() => {}}
      />,
    );

    expect(screen.getByRole('feed').firstElementChild).toHaveClass('min-h-full', 'justify-end');
  });

  it('uses a checkbox dropdown with an all filter for timeline filters', async () => {
    const user = userEvent.setup();

    render(<TimelineFeedHarness />);

    expect(screen.getByText('Draft brief')).toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /timeline filters: all/i }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Events' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Events' }));

    expect(screen.getByRole('menu', { name: /timeline filters: tasks, milestones, files, workspace/i })).toBeInTheDocument();
    expect(screen.getByText('Draft brief')).toBeInTheDocument();
    expect(screen.queryByText('Design review')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'All' })).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'All' }));

    expect(screen.getByRole('menu', { name: /timeline filters: all/i })).toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();
  });
});
