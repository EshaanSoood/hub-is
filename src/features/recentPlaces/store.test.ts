import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_VISIBLE_RECENT_PLACES,
  readRecentPlaces,
  recordRecentPaneContribution,
  recordRecentPaneVisit,
  selectRecentPlaces,
} from './store';

const STORAGE_KEY = 'hub:sidebar:recent-places';

describe('recent places store', () => {
  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    vi.useRealTimers();
  });

  it('deduplicates pane visits by pane scope', () => {
    recordRecentPaneVisit({
      paneId: 'pane-a',
      paneName: 'Alpha',
      spaceId: 'space-1',
      spaceName: 'Space One',
    });
    recordRecentPaneVisit({
      paneId: 'pane-a',
      paneName: 'Alpha',
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
    recordRecentPaneVisit({
      paneId: 'pane-1',
      paneName: 'First',
      spaceId: 'space-1',
      spaceName: 'Space One',
    });
    advanceTime();
    recordRecentPaneVisit({
      paneId: 'pane-2',
      paneName: 'Second',
      spaceId: 'space-1',
      spaceName: 'Space One',
    });
    advanceTime();
    recordRecentPaneVisit({
      paneId: 'pane-3',
      paneName: 'Third',
      spaceId: 'space-2',
      spaceName: 'Space Two',
    });
    advanceTime();
    recordRecentPaneVisit({
      paneId: 'pane-4',
      paneName: 'Fourth',
      spaceId: 'space-2',
      spaceName: 'Space Two',
    });
    advanceTime();
    recordRecentPaneContribution({
      paneId: 'pane-2',
      paneName: 'Second',
      spaceId: 'space-1',
      spaceName: 'Space One',
    }, 'record-update');
    advanceTime();
    recordRecentPaneContribution({
      paneId: 'pane-4',
      paneName: 'Fourth',
      spaceId: 'space-2',
      spaceName: 'Space Two',
    }, 'record-create');

    const visible = selectRecentPlaces();
    expect(visible).toHaveLength(MAX_VISIBLE_RECENT_PLACES);
    expect(visible[0]?.paneId).toBe('pane-4');
    expect(visible[1]?.paneId).toBe('pane-2');
    expect(visible.slice(2).map((entry) => entry.paneId)).toEqual(['pane-3', 'pane-1']);
  });
});
