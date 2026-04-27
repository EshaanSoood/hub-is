import { useEffect, useRef, useState } from 'react';
import { hubRequest } from '../../../services/hub/transport';
import type { WidgetPickerSeedData } from './widgetPickerTypes';

interface SeedDataState {
  seedData: WidgetPickerSeedData;
  loading: boolean;
  error: string | null;
}

const emptySeedData: WidgetPickerSeedData = {};

export const useWidgetPickerSeedData = (open: boolean, accessToken?: string): SeedDataState => {
  const cacheRef = useRef(new Map<string, WidgetPickerSeedData>());
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
    void hubRequest<{ seedData: WidgetPickerSeedData }>(
      accessToken,
      '/api/hub/widget-picker/seed-data',
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
          error: error instanceof Error ? error.message : 'Widget previews failed to load.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, open]);

  return state;
};
