export const QUICK_ADD_PROJECT_REQUEST_EVENT = 'hub:quick-add-project-requested';

export const requestQuickAddProject = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(QUICK_ADD_PROJECT_REQUEST_EVENT));
};

export const subscribeQuickAddProjectRequest = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler: EventListener = () => {
    callback();
  };
  window.addEventListener(QUICK_ADD_PROJECT_REQUEST_EVENT, handler);
  return () => {
    window.removeEventListener(QUICK_ADD_PROJECT_REQUEST_EVENT, handler);
  };
};
