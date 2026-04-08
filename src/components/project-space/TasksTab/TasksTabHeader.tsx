import { cn } from '../../../lib/cn';
import type { SortChain, SortDimension } from './index';

interface LensOption {
  id: string;
  label: string;
}

interface TasksTabHeaderProps {
  showSortControls: boolean;
  sortChain: SortChain;
  onSortChainChange: (chain: SortChain) => void;
  collaborators: LensOption[];
  categories: LensOption[];
  activeUserId: string;
  activeCategoryId: string;
  onUserChange: (userId: string) => void;
  onCategoryChange: (categoryId: string) => void;
}

const SORT_DIMENSIONS: SortDimension[] = ['date', 'priority', 'category'];
const GROUP_BY_LABELS: Record<SortDimension, string> = {
  date: 'Chronological',
  priority: 'Priority',
  category: 'Category',
};

const promoteDimension = (chain: SortChain, clicked: SortDimension): SortChain => {
  if (chain[0] === clicked) {
    return chain;
  }
  const rest = chain.filter((dimension) => dimension !== clicked) as [SortDimension, SortDimension];
  return [clicked, rest[0], rest[1]];
};

export const TasksTabHeader = ({
  showSortControls,
  sortChain,
  onSortChainChange,
  collaborators,
  categories,
  activeUserId,
  activeCategoryId,
  onUserChange,
  onCategoryChange,
}: TasksTabHeaderProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSortControls ? (
        <>
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="text-xs text-muted">Group by</legend>
            {SORT_DIMENSIONS.map((dimension) => {
              const active = sortChain[0] === dimension;
              return (
                <label
                  key={dimension}
                  className={cn(
                    'inline-flex cursor-pointer items-center rounded-control border px-2 py-1.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-focus-ring',
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
                  )}
                >
                  <input
                    type="radio"
                    name="tasks-group-by"
                    value={dimension}
                    checked={active}
                    onChange={() => onSortChainChange(promoteDimension(sortChain, dimension))}
                    className="sr-only"
                  />
                  {GROUP_BY_LABELS[dimension]}
                </label>
              );
            })}
          </fieldset>

          <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />
        </>
      ) : null}

      {collaborators.map((collaborator) => (
        <button
          key={collaborator.id}
          type="button"
          aria-pressed={activeUserId === collaborator.id}
          onClick={() => onUserChange(collaborator.id)}
          className={cn(
            'rounded-control border px-2 py-1.5 text-xs transition-colors',
            activeUserId === collaborator.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
          )}
        >
          {collaborator.label}
        </button>
      ))}

      <span className="mx-1 h-4 w-px bg-border-subtle" aria-hidden="true" />

      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={activeCategoryId === category.id}
          onClick={() => onCategoryChange(category.id)}
          className={cn(
            'rounded-control border px-2 py-1.5 text-xs transition-colors',
            activeCategoryId === category.id ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface text-muted hover:text-text',
          )}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
};
