export const HUB_HOME_REFRESH_EVENT = 'hub:home-refresh-requested';

export const requestHubHomeRefresh = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(HUB_HOME_REFRESH_EVENT));
};

export const subscribeHubHomeRefresh = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler: EventListener = () => {
    callback();
  };
  window.addEventListener(HUB_HOME_REFRESH_EVENT, handler);
  return () => {
    window.removeEventListener(HUB_HOME_REFRESH_EVENT, handler);
  };
};
