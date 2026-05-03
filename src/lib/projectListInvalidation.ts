type ProjectListInvalidationDetail = {
  spaceId: string;
};

const PROJECT_LIST_INVALIDATED_EVENT = 'hub:project-list-invalidated';

export const notifyProjectListInvalidated = (spaceId: string): void => {
  if (!spaceId || typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProjectListInvalidationDetail>(PROJECT_LIST_INVALIDATED_EVENT, {
      detail: { spaceId },
    }),
  );
};

export const subscribeToProjectListInvalidation = (
  spaceId: string | null | undefined,
  listener: () => void,
): (() => void) => {
  if (!spaceId || typeof window === 'undefined') {
    return () => undefined;
  }

  const onInvalidated = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail as Partial<ProjectListInvalidationDetail> : null;
    if (detail?.spaceId === spaceId) {
      listener();
    }
  };

  window.addEventListener(PROJECT_LIST_INVALIDATED_EVENT, onInvalidated);
  return () => window.removeEventListener(PROJECT_LIST_INVALIDATED_EVENT, onInvalidated);
};
