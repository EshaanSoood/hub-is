import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_VISIBLE_RECENT_PLACES,
  readRecentPlaces,
  recordRecentProjectContribution,
  recordRecentProjectVisit,
  selectRecentPlaces,
} from './store';

const STORAGE_KEY = 'hub:sidebar:recent-places';

describe('recent places store', () => {
  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    vi.useRealTimers();
  });

  it('deduplicates project visits by project scope', () => {
    recordRecentProjectVisit({
      projectId: 'project-a',
      projectName: 'Alpha',
      spaceId: 'space-1',
      spaceName: 'Space One',
    });
    recordRecentProjectVisit({
      projectId: 'project-a',
      projectName: 'Alpha',
      spaceId: 'space-1',
      spaceName: 'Space One',
    });

    const entries = readRecentPlaces();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.visitCount).toBe(2);
  });

  it('prioritizes contributed places over passive visits and limits the visible set', () => {
    vi.useFakeTimers();
    const baseTime = new Date('2026-04-24T18:00:00.000Z');
    let step = 0;
    const advanceTime = () => {
      vi.setSystemTime(new Date(baseTime.getTime() + step));
      step += 1;
    };

    advanceTime();
    recordRecentProjectVisit({
      projectId: 'project-1',
      projectName: 'First',
      spaceId: 'space-1',
      spaceName: 'Space One',
    });
    advanceTime();
    recordRecentProjectVisit({
      projectId: 'project-2',
      projectName: 'Second',
      spaceId: 'space-1',
      spaceName: 'Space One',
    });
    advanceTime();
    recordRecentProjectVisit({
      projectId: 'project-3',
      projectName: 'Third',
      spaceId: 'space-2',
      spaceName: 'Space Two',
    });
    advanceTime();
    recordRecentProjectVisit({
      projectId: 'project-4',
      projectName: 'Fourth',
      spaceId: 'space-2',
      spaceName: 'Space Two',
    });
    advanceTime();
    recordRecentProjectContribution({
      projectId: 'project-2',
      projectName: 'Second',
      spaceId: 'space-1',
      spaceName: 'Space One',
    }, 'record-update');
    advanceTime();
    recordRecentProjectContribution({
      projectId: 'project-4',
      projectName: 'Fourth',
      spaceId: 'space-2',
      spaceName: 'Space Two',
    }, 'record-create');

    const visible = selectRecentPlaces();
    expect(visible).toHaveLength(MAX_VISIBLE_RECENT_PLACES);
    expect(visible[0]?.projectId).toBe('project-4');
    expect(visible[1]?.projectId).toBe('project-2');
    expect(visible.slice(2).map((entry) => entry.projectId)).toEqual(['project-3', 'project-1']);
  });
});
