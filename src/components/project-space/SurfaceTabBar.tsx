import { TabButton, Tabs, TabsList } from '../primitives';

export interface SurfaceTabItem<T extends string> {
  id: T;
  label: string;
}

interface SurfaceTabBarProps<T extends string> {
  ariaLabel: string;
  activeSurface: T;
  idPrefix: string;
  items: ReadonlyArray<SurfaceTabItem<T>>;
  onSelectSurface: (surface: T) => void;
  panelIdPrefix?: string;
}

export const SurfaceTabBar = <T extends string>({
  ariaLabel,
  activeSurface,
  idPrefix,
  items,
  onSelectSurface,
  panelIdPrefix,
}: SurfaceTabBarProps<T>) => (
  <Tabs value={activeSurface} onValueChange={(nextValue) => onSelectSurface(nextValue as T)} activationMode="manual">
    <TabsList aria-label={ariaLabel}>
      {items.map((item) => (
        <TabButton
          key={item.id}
          id={`${idPrefix}-${item.id}`}
          value={item.id}
          aria-controls={panelIdPrefix ? `${panelIdPrefix}-${item.id}` : undefined}
          selected={activeSurface === item.id}
        >
          {item.label}
        </TabButton>
      ))}
    </TabsList>
  </Tabs>
);
