import type { HubPaneSummary } from '../../services/hub/types';

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asBoolean = (value: unknown): boolean => value === true;

const asInteger = (value: unknown): number | null => Number.isInteger(value) ? Number(value) : null;

export const isRoomProjectPane = (pane: HubPaneSummary, roomId: string): boolean => {
  const layout = pane.layout_config;
  return asText(layout?.room_id) === roomId && asBoolean(layout?.fixed_room_project);
};

export const getRoomProjectSlot = (pane: HubPaneSummary): number | null =>
  asInteger(pane.layout_config?.room_slot);

export const sortRoomProjectPanes = (panes: HubPaneSummary[]): HubPaneSummary[] =>
  [...panes].sort((left, right) => {
    const leftSlot = getRoomProjectSlot(left) ?? Number.MAX_SAFE_INTEGER;
    const rightSlot = getRoomProjectSlot(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftSlot !== rightSlot) {
      return leftSlot - rightSlot;
    }
    return left.name.localeCompare(right.name);
  });

export const getRoomProjectPanes = (panes: HubPaneSummary[], roomId: string): HubPaneSummary[] =>
  sortRoomProjectPanes(panes.filter((pane) => isRoomProjectPane(pane, roomId)));
