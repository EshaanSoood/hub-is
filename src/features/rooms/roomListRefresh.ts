const ROOM_LIST_REFRESH_EVENT = 'hub:rooms:refresh';

export const requestRoomListRefresh = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ROOM_LIST_REFRESH_EVENT));
};

export const subscribeRoomListRefresh = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = () => {
    callback();
  };
  window.addEventListener(ROOM_LIST_REFRESH_EVENT, listener);
  return () => {
    window.removeEventListener(ROOM_LIST_REFRESH_EVENT, listener);
  };
};
