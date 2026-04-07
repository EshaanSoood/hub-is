const PROJECT_COLOR_PALETTE = [
  'bg-[color:var(--color-primary)]',
  'bg-[color:var(--color-info)]',
  'bg-[color:var(--color-success)]',
  'bg-[color:var(--color-warning)]',
  'bg-[color:var(--color-danger)]',
] as const;

const hashProjectId = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getProjectColor = (projectId: string | null | undefined): string => {
  if (!projectId) {
    return 'bg-[color:var(--color-muted)]';
  }
  const index = hashProjectId(projectId) % PROJECT_COLOR_PALETTE.length;
  return PROJECT_COLOR_PALETTE[index] || PROJECT_COLOR_PALETTE[0];
};

export { PROJECT_COLOR_PALETTE };
