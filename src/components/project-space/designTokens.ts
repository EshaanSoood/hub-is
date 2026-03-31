export type PriorityLevel = 'high' | 'medium' | 'low';

// Priority colors are reserved for priority semantics only.
export const COLLABORATOR_TONES = [
  'bg-[rgb(86_143_191)]',
  'bg-[rgb(106_163_147)]',
  'bg-[rgb(196_154_96)]',
  'bg-[rgb(151_132_181)]',
  'bg-[rgb(177_156_102)]',
  'bg-[rgb(124_144_165)]',
] as const;

export const CATEGORY_TONES: Record<string, string> = {
  youtube: 'bg-[rgb(86_143_191_/_0.2)] border-[rgb(86_143_191)] text-[color:var(--color-text-secondary)]',
  writing: 'bg-[rgb(106_163_147_/_0.2)] border-[rgb(106_163_147)] text-[color:var(--color-text-secondary)]',
  design: 'bg-[rgb(151_132_181_/_0.2)] border-[rgb(151_132_181)] text-[color:var(--color-text-secondary)]',
  marketing: 'bg-[rgb(177_156_102_/_0.2)] border-[rgb(177_156_102)] text-[color:var(--color-text-secondary)]',
};
