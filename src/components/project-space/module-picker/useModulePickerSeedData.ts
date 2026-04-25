import { useEffect, useRef, useState } from 'react';
import { hubRequest } from '../../../services/hub/transport';
import type { ModulePickerSeedData } from './modulePickerTypes';

interface SeedDataState {
  seedData: ModulePickerSeedData;
  loading: boolean;
  error: string | null;
}

const emptySeedData: ModulePickerSeedData = {};

export const useModulePickerSeedData = (open: boolean, accessToken?: string): SeedDataState => {
  const cacheRef = useRef(new Map<string, ModulePickerSeedData>());
  const [state, setState] = useState<SeedDataState>({
    seedData: emptySeedData,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!open || !accessToken) {
      return;
    }
    const cached = cacheRef.current.get(accessToken);
    if (cached) {
      setState({ seedData: cached, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    void hubRequest<{ seedData: ModulePickerSeedData }>(
      accessToken,
      '/api/hub/module-picker/seed-data',
      { method: 'GET' },
    )
      .then((data) => {
        if (cancelled) {
          return;
        }
        cacheRef.current.set(accessToken, data.seedData);
        setState({ seedData: data.seedData, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setState({
          seedData: emptySeedData,
          loading: false,
          error: error instanceof Error ? error.message : 'Module previews failed to load.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, open]);

  return state;
};
