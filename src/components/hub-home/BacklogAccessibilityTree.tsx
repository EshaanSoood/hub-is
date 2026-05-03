import {
  useId,
  useRef,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { BacklogTaskItem } from './types';
import { HUB_BACKLOG_DRAG_MIME } from './types';

interface BacklogAccessibilityTreeProps {
  active: boolean;
  accessibleDescription: string;
  accessibleLabel: string;
  activeKeyboardDrag: boolean;
  actions: BacklogAccessibilityAction[];
  detail: string;
  onBeginKeyboardDrag?: () => void;
  onFocus: () => void;
  onOpen: () => void;
  onRovingKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onSetRef: (node: HTMLElement | null) => void;
  positionInSet: number;
  priority?: BacklogTaskItem['priority'];
  setSize: number;
  title: string;
  typeLabel: string;
  dragPayload?: string;
}

export interface BacklogAccessibilityAction {
  id: string;
  label: string;
  disabled?: boolean;
  onInvoke: () => void;
  showVisual?: boolean;
}

const visualActionButtonClassName =
  'ghost-button bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-surface-highest disabled:cursor-not-allowed disabled:opacity-60';

const accessibleActionButtonClassName =
  'sr-only focus:not-sr-only focus:mr-2 focus:inline-flex focus:rounded-control focus:bg-surface-highest focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-text focus:outline-none focus:ring-2 focus:ring-focus-ring';

const priorityClassName = (priority: BacklogTaskItem['priority']): string => {
  if (priority === 'urgent') {
    return 'facet-chip facet-persimmon';
  }
  if (priority === 'high') {
    return 'facet-chip facet-persimmon';
  }
  if (priority === 'medium') {
    return 'facet-chip facet-ochre';
  }
  if (priority === 'low') {
    return 'facet-chip facet-moss';
  }
  return 'facet-chip ghost-button bg-surface-low text-text-secondary';
};

export const BacklogAccessibilityTree = ({
  active,
  accessibleDescription,
  accessibleLabel,
  activeKeyboardDrag,
  actions,
  detail,
  onBeginKeyboardDrag,
  onFocus,
  onOpen,
  onRovingKeyDown,
  onSetRef,
  positionInSet,
  priority,
  setSize,
  title,
  typeLabel,
  dragPayload,
}: BacklogAccessibilityTreeProps) => {
  const itemRef = useRef<HTMLLIElement | null>(null);
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest('[data-backlog-action="true"]')) {
      return;
    }
    onOpen();
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!dragPayload) {
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(HUB_BACKLOG_DRAG_MIME, dragPayload);
  };

  const helpId = useId();
  const moveActionFocus = (nextIndex: number) => {
    const nextAction = actionRefs.current[nextIndex];
    if (!nextAction) {
      return;
    }
    window.requestAnimationFrame(() => {
      nextAction.focus();
    });
  };
  const restoreItemFocus = () => {
    window.requestAnimationFrame(() => {
      itemRef.current?.focus();
    });
  };

  return (
    <li
      role="treeitem"
      aria-label={accessibleLabel}
      aria-describedby={helpId}
      aria-level={1}
      aria-setsize={setSize}
      aria-posinset={positionInSet}
      aria-expanded
      aria-selected={active}
      ref={(node) => {
        itemRef.current = node;
        onSetRef(node);
      }}
      tabIndex={active ? 0 : -1}
      onClick={handleClick}
      onFocus={onFocus}
      onKeyDown={(event) => {
        onRovingKeyDown(event);
        if (event.defaultPrevented) {
          return;
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          moveActionFocus(0);
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpen();
          return;
        }
        if (event.key === ' ' && onBeginKeyboardDrag) {
          event.preventDefault();
          onBeginKeyboardDrag();
        }
      }}
      className={`paper-card rounded-control p-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-focus-ring ${
        activeKeyboardDrag ? 'ring-2 ring-focus-ring' : ''
      }`}
    >
      <div
        draggable={Boolean(dragPayload)}
        onDragStart={handleDragStart}
        className="rounded-control"
      >
        <p id={helpId} className="sr-only">{accessibleDescription}</p>
        <div aria-hidden="true">
          {priority ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ghost-button bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {typeLabel}
                  </span>
                  <span className={`uppercase tracking-wide ${priorityClassName(priority)}`}>
                    {priority}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-text">{title}</p>
                <p className="mt-1 text-xs text-muted">{detail}</p>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <span className="ghost-button bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                {typeLabel}
              </span>
              <p className="mt-2 truncate text-sm font-medium text-text">{title}</p>
              <p className="mt-1 text-xs text-muted">{detail}</p>
            </div>
          )}
        </div>
        <ul role="group" aria-label="Task actions" data-backlog-action="true" className="sr-only">
          <li role="none">
            <button
              ref={(node) => {
                actionRefs.current[0] = node;
              }}
              type="button"
              tabIndex={-1}
              data-backlog-action="true"
              className={accessibleActionButtonClassName}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'Escape') {
                  event.preventDefault();
                  restoreItemFocus();
                  return;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveActionFocus(1);
                  return;
                }
                if (event.key === 'End') {
                  event.preventDefault();
                  moveActionFocus(actions.length);
                }
              }}
              onClick={onOpen}
            >
              Open
            </button>
          </li>
          {actions.map((action, index) => (
            <li key={action.id} role="none">
              <button
                ref={(node) => {
                  actionRefs.current[index + 1] = node;
                }}
                type="button"
                tabIndex={-1}
                data-backlog-action="true"
                className={accessibleActionButtonClassName}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'Escape') {
                    event.preventDefault();
                    restoreItemFocus();
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveActionFocus(index);
                    return;
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    moveActionFocus(Math.min(actions.length, index + 2));
                    return;
                  }
                  if (event.key === 'Home') {
                    event.preventDefault();
                    moveActionFocus(0);
                    return;
                  }
                  if (event.key === 'End') {
                    event.preventDefault();
                    moveActionFocus(actions.length);
                  }
                }}
                onClick={action.onInvoke}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
        <div aria-hidden="true" data-backlog-action="true" className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            action.showVisual === false ? null : (
              <button
                key={action.id}
                type="button"
                tabIndex={-1}
                data-backlog-action="true"
                className={visualActionButtonClassName}
                onClick={action.onInvoke}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            )
          ))}
        </div>
      </div>
    </li>
  );
};
