import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface ShellNavItem {
  id: string;
  label: string;
  selected: boolean;
  href?: string;
  onSelect?: () => void;
  ariaLabel?: string;
  state?: unknown;
}

export interface ShellPlaceAction {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface ShellBackAction {
  label: string;
  href: string;
  state?: unknown;
}

export interface ShellHeaderConfig {
  backAction?: ShellBackAction;
  navItems?: ShellNavItem[];
  placeTitle?: string;
  placeKind?: 'home' | 'space' | 'project';
  onRenamePlace?: (name: string) => void | Promise<void>;
  placeActions?: ShellPlaceAction[];
}

type ShellHeaderConfigSetter = (config: ShellHeaderConfig) => void;

const ShellHeaderConfigContext = createContext<ShellHeaderConfig>({});
const ShellHeaderConfigSetterContext = createContext<ShellHeaderConfigSetter | null>(null);

export const ShellHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [headerConfig, setHeaderConfigState] = useState<ShellHeaderConfig>({});
  const setHeaderConfig = useCallback((config: ShellHeaderConfig) => {
    setHeaderConfigState(config);
  }, []);
  const setterValue = useMemo(() => setHeaderConfig, [setHeaderConfig]);

  return (
    <ShellHeaderConfigSetterContext.Provider value={setterValue}>
      <ShellHeaderConfigContext.Provider value={headerConfig}>
        {children}
      </ShellHeaderConfigContext.Provider>
    </ShellHeaderConfigSetterContext.Provider>
  );
};

export const useShellHeader = (config: ShellHeaderConfig): void => {
  const setHeaderConfig = useContext(ShellHeaderConfigSetterContext);

  useEffect(() => {
    if (!setHeaderConfig) {
      return;
    }
    setHeaderConfig(config);
  }, [config, setHeaderConfig]);

  useEffect(() => {
    if (!setHeaderConfig) {
      return undefined;
    }
    return () => {
      setHeaderConfig({});
    };
  }, [setHeaderConfig]);
};

export const useShellHeaderConfig = (): ShellHeaderConfig => {
  return useContext(ShellHeaderConfigContext);
};
