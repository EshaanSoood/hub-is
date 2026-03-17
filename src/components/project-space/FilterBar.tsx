import { Button, Card, FilterChip, SectionHeader, Select } from '../primitives';

interface FilterOption {
  value: string;
  label: string;
}

interface SelectFilterControlProps {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

const SelectFilterControl = ({ id, label, value, options, onChange }: SelectFilterControlProps) => (
  <label htmlFor={id} className="flex min-w-36 flex-col gap-1 text-xs text-muted">
    <span className="font-semibold uppercase tracking-wide">{label}</span>
    <Select
      id={id}
      value={value}
      onValueChange={onChange}
      options={options}
      triggerClassName="h-8 px-2 py-1.5 text-sm"
      contentClassName="min-w-36"
    />
  </label>
);

interface SearchInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

const SearchInput = ({ id, value, onChange, placeholder }: SearchInputProps) => (
  <label htmlFor={id} className="flex min-w-44 flex-1 flex-col gap-1 text-xs text-muted">
    <span className="font-semibold uppercase tracking-wide">Search</span>
    <input
      id={id}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="rounded-control border border-subtle bg-surface px-2 py-1.5 text-sm text-text"
    />
  </label>
);

export const FilterBar = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Card variant="surface" aria-label={title} className="p-3 shadow-none">
    <div className="flex flex-wrap items-end gap-3">{children}</div>
  </Card>
);

export const CalendarToolbar = ({ monthLabel }: { monthLabel: string }) => (
  <Card variant="surface" className="p-3 shadow-none">
    <SectionHeader title="Calendar Toolbar" subtitle={monthLabel} actions={
      <>
        <Button type="button" size="sm" variant="secondary">
          Previous
        </Button>
        <Button type="button" size="sm" variant="secondary">
          Today
        </Button>
        <Button type="button" size="sm" variant="secondary">
          Next
        </Button>
      </>
    } />
  </Card>
);

const ActiveFilterSummary = ({
  userValue,
  categoryValue,
}: {
  userValue: string;
  categoryValue: string;
}) => (
  <div className="flex flex-wrap gap-2">
    <FilterChip selected={userValue !== 'all'}>User: {userValue}</FilterChip>
    <FilterChip selected={categoryValue !== 'all'}>Category: {categoryValue}</FilterChip>
  </div>
);

export const CalendarFilterBar = ({
  userValue,
  categoryValue,
  searchValue,
  onUserChange,
  onCategoryChange,
  onSearchChange,
  userOptions,
  categoryOptions,
}: {
  userValue: string;
  categoryValue: string;
  searchValue: string;
  onUserChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  userOptions: FilterOption[];
  categoryOptions: FilterOption[];
}) => (
  <div className="space-y-2">
    <FilterBar title="Calendar filter bar">
      <SelectFilterControl id="calendar-user-filter" label="User" value={userValue} options={userOptions} onChange={onUserChange} />
      <SelectFilterControl
        id="calendar-category-filter"
        label="Category"
        value={categoryValue}
        options={categoryOptions}
        onChange={onCategoryChange}
      />
      <SearchInput
        id="calendar-search-filter"
        value={searchValue}
        onChange={onSearchChange}
        placeholder="Search event chips"
      />
    </FilterBar>
    <ActiveFilterSummary userValue={userValue} categoryValue={categoryValue} />
  </div>
);

export const TaskListToolbar = ({
  userValue,
  categoryValue,
  searchValue,
  onUserChange,
  onCategoryChange,
  onSearchChange,
  userOptions,
  categoryOptions,
}: {
  userValue: string;
  categoryValue: string;
  searchValue: string;
  onUserChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  userOptions: FilterOption[];
  categoryOptions: FilterOption[];
}) => (
  <div className="space-y-2">
    <FilterBar title="Task list toolbar">
      <SelectFilterControl id="task-user-filter" label="User" value={userValue} options={userOptions} onChange={onUserChange} />
      <SelectFilterControl
        id="task-category-filter"
        label="Category"
        value={categoryValue}
        options={categoryOptions}
        onChange={onCategoryChange}
      />
      <SearchInput id="task-search-filter" value={searchValue} onChange={onSearchChange} placeholder="Search tasks" />
    </FilterBar>
    <ActiveFilterSummary userValue={userValue} categoryValue={categoryValue} />
  </div>
);
