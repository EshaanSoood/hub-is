import { createContext, useContext, useMemo, useState } from 'react';
import { mockActivityEvents, nowIso } from '../data/mockData';
import type { ActivityEvent } from '../types/domain';

interface ActivityContextValue {
  events: ActivityEvent[];
  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

export const ActivityProvider = ({ children }: { children: React.ReactNode }) => {
  const [events, setEvents] = useState<ActivityEvent[]>(mockActivityEvents);

  const value = useMemo<ActivityContextValue>(
    () => ({
      events,
      addEvent: (event) => {
        const next: ActivityEvent = {
          ...event,
          id: `evt-${Date.now()}`,
          timestamp: nowIso(),
        };
        setEvents((existing) => [next, ...existing]);
      },
    }),
    [events],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
};

export const useActivity = (): ActivityContextValue => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used inside ActivityProvider');
  }
  return context;
};
