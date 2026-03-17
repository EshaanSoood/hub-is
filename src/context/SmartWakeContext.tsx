import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { serviceRegistry } from '../lib/serviceRegistry';
import { pollServiceHealth, sleepService, wakeService } from '../services/smartWakeService';
import type { ServiceId, ServiceState } from '../types/domain';

const INACTIVITY_WINDOW_MS = 5 * 60 * 1000;
const AUTO_SLEEP_CHECK_MS = 15 * 1000;

const sleepEligibleServiceIds: ServiceId[] = ['nextcloud', 'openproject', 'invoiceNinja'];

const initialStateByService: Record<ServiceId, ServiceState> = {
  keycloak: 'ready',
  n8n: 'ready',
  postmark: 'ready',
  ntfy: 'ready',
  nextcloud: 'sleeping',
  openproject: 'sleeping',
  invoiceNinja: 'ready',
  github: 'ready',
};

const currentTimestamps = (): Record<ServiceId, number> => {
  const now = Date.now();
  return {
    keycloak: now,
    n8n: now,
    postmark: now,
    ntfy: now,
    nextcloud: now,
    openproject: now,
    invoiceNinja: now,
    github: now,
  };
};

interface SmartWakeContextValue {
  states: Record<ServiceId, ServiceState>;
  cards: Array<(typeof serviceRegistry)[number] & { state: ServiceState }>;
  announcement: string;
  inactivityWindowMs: number;
  workflowInProgress: boolean;
  uploadInProgress: boolean;
  wake: (serviceId: ServiceId, continueAction?: () => Promise<void>) => Promise<string | undefined>;
  ensureReady: (serviceId: ServiceId) => Promise<string | undefined>;
  sleep: (serviceId: ServiceId) => Promise<string | undefined>;
  touchService: (serviceId: ServiceId) => void;
  runWorkflow: <T>(operation: () => Promise<T>) => Promise<T>;
  beginUpload: (serviceId: ServiceId) => void;
  endUpload: (serviceId: ServiceId) => void;
}

const SmartWakeContext = createContext<SmartWakeContextValue | undefined>(undefined);

export const SmartWakeProvider = ({ children }: { children: React.ReactNode }) => {
  const [states, setStates] = useState<Record<ServiceId, ServiceState>>(initialStateByService);
  const [announcement, setAnnouncement] = useState('');
  const [lastInteractionAt, setLastInteractionAt] = useState<Record<ServiceId, number>>(currentTimestamps);
  const [workflowCount, setWorkflowCount] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);

  const statesRef = useRef(states);
  const lastInteractionRef = useRef(lastInteractionAt);
  const workflowCountRef = useRef(workflowCount);
  const uploadCountRef = useRef(uploadCount);

  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  useEffect(() => {
    lastInteractionRef.current = lastInteractionAt;
  }, [lastInteractionAt]);

  useEffect(() => {
    workflowCountRef.current = workflowCount;
  }, [workflowCount]);

  useEffect(() => {
    uploadCountRef.current = uploadCount;
  }, [uploadCount]);

  const touchService = useCallback((serviceId: ServiceId) => {
    setLastInteractionAt((current) => ({
      ...current,
      [serviceId]: Date.now(),
    }));
  }, []);

  const runWorkflow = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setWorkflowCount((current) => current + 1);
    try {
      const result = await operation();
      setAnnouncement('Workflow complete');
      return result;
    } finally {
      setWorkflowCount((current) => Math.max(0, current - 1));
    }
  }, []);

  const sleep = useCallback(async (serviceId: ServiceId): Promise<string | undefined> => {
    const service = serviceRegistry.find((entry) => entry.id === serviceId);
    if (!service) {
      return 'Service is not registered.';
    }

    if (statesRef.current[serviceId] === 'sleeping') {
      return undefined;
    }

    if (workflowCountRef.current > 0 || uploadCountRef.current > 0) {
      return 'Sleep blocked while workflow or upload is active.';
    }

    setWorkflowCount((current) => current + 1);
    setStates((current) => ({ ...current, [serviceId]: 'stopping' }));

    try {
      const result = await sleepService(service);
      if (result.blockedReason || result.error) {
        setStates((current) => ({ ...current, [serviceId]: 'error' }));
        setAnnouncement('Service start failed');
        return result.blockedReason || result.error;
      }

      setStates((current) => ({ ...current, [serviceId]: 'sleeping' }));
      setAnnouncement('Workflow complete');
      touchService(serviceId);
      return undefined;
    } finally {
      setWorkflowCount((current) => Math.max(0, current - 1));
    }
  }, [touchService]);

  const wake = useCallback(
    async (serviceId: ServiceId, continueAction?: () => Promise<void>): Promise<string | undefined> => {
      const service = serviceRegistry.find((entry) => entry.id === serviceId);
      if (!service) {
        return 'Service is not registered.';
      }

      touchService(serviceId);

      if (statesRef.current[serviceId] === 'ready') {
        if (continueAction) {
          await runWorkflow(async () => {
            await continueAction();
            return true;
          });
        }
        return undefined;
      }

      setAnnouncement('Starting service...');
      setStates((current) => ({ ...current, [serviceId]: 'starting' }));

      setWorkflowCount((current) => current + 1);
      try {
        const wakeResult = await wakeService(service);
        if (wakeResult.blockedReason || wakeResult.error) {
          setStates((current) => ({ ...current, [serviceId]: 'error' }));
          setAnnouncement('Service start failed');
          return wakeResult.blockedReason || wakeResult.error;
        }

        const healthResult = await pollServiceHealth(service);
        if (healthResult.blockedReason || healthResult.error || !healthResult.data?.ready) {
          setStates((current) => ({ ...current, [serviceId]: 'error' }));
          setAnnouncement('Service start failed');
          return healthResult.blockedReason || healthResult.error || 'Service did not report healthy.';
        }

        setStates((current) => ({ ...current, [serviceId]: 'ready' }));
        touchService(serviceId);
        setAnnouncement('Service ready');

        if (continueAction) {
          await continueAction();
          setAnnouncement('Workflow complete');
        }

        return undefined;
      } finally {
        setWorkflowCount((current) => Math.max(0, current - 1));
      }
    },
    [runWorkflow, touchService],
  );

  const ensureReady = useCallback(
    async (serviceId: ServiceId): Promise<string | undefined> => {
      if (statesRef.current[serviceId] === 'ready') {
        touchService(serviceId);
        return undefined;
      }

      return wake(serviceId);
    },
    [touchService, wake],
  );

  const beginUpload = useCallback(
    (serviceId: ServiceId) => {
      touchService(serviceId);
      setUploadCount((current) => current + 1);
      setAnnouncement('Starting service...');
    },
    [touchService],
  );

  const endUpload = useCallback((serviceId: ServiceId) => {
    touchService(serviceId);
    setUploadCount((current) => Math.max(0, current - 1));
    setAnnouncement('Workflow complete');
  }, [touchService]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (workflowCountRef.current > 0 || uploadCountRef.current > 0) {
        return;
      }

      const now = Date.now();

      sleepEligibleServiceIds.forEach((serviceId) => {
        const isReady = statesRef.current[serviceId] === 'ready';
        const inactivity = now - lastInteractionRef.current[serviceId];
        if (isReady && inactivity > INACTIVITY_WINDOW_MS) {
          void sleep(serviceId);
        }
      });
    }, AUTO_SLEEP_CHECK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [sleep]);

  const cards = useMemo(
    () =>
      serviceRegistry.map((service) => ({
        ...service,
        state: states[service.id],
      })),
    [states],
  );

  const value = useMemo<SmartWakeContextValue>(
    () => ({
      states,
      cards,
      announcement,
      inactivityWindowMs: INACTIVITY_WINDOW_MS,
      workflowInProgress: workflowCount > 0,
      uploadInProgress: uploadCount > 0,
      wake,
      ensureReady,
      sleep,
      touchService,
      runWorkflow,
      beginUpload,
      endUpload,
    }),
    [announcement, beginUpload, cards, endUpload, ensureReady, runWorkflow, sleep, states, touchService, uploadCount, wake, workflowCount],
  );

  return <SmartWakeContext.Provider value={value}>{children}</SmartWakeContext.Provider>;
};

export const useSmartWakeContext = (): SmartWakeContextValue => {
  const context = useContext(SmartWakeContext);
  if (!context) {
    throw new Error('useSmartWakeContext must be used inside SmartWakeProvider');
  }
  return context;
};
