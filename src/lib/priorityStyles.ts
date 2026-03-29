export type PriorityTone = 'high' | 'medium' | 'low' | 'none';

const normalizePriorityTone = (priority: string | null | undefined): PriorityTone => {
  const normalized = priority?.toLowerCase();
  if (normalized === 'urgent' || normalized === 'high') {
    return 'high';
  }
  if (normalized === 'medium') {
    return 'medium';
  }
  if (normalized === 'low') {
    return 'low';
  }
  return 'none';
};

export const PRIORITY_DOT_CLASS: Record<PriorityTone, string> = {
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
  none: 'bg-priority-none',
};

export const PRIORITY_TEXT_CLASS: Record<PriorityTone, string> = {
  high: 'text-priority-high',
  medium: 'text-priority-medium',
  low: 'text-priority-low',
  none: 'text-priority-none',
};

export const PRIORITY_BORDER_CLASS: Record<PriorityTone, string> = {
  high: 'border-priority-high',
  medium: 'border-priority-medium',
  low: 'border-priority-low',
  none: 'border-priority-none',
};

export const PRIORITY_TINT_CLASS: Record<PriorityTone, string> = {
  high: 'bg-priority-high-tint',
  medium: 'bg-priority-medium-tint',
  low: 'bg-priority-low-tint',
  none: 'bg-priority-none-tint',
};

export const PRIORITY_BG_CLASS: Record<PriorityTone, string> = PRIORITY_DOT_CLASS;

export const getPriorityClasses = (priority: string | null | undefined) => {
  const tone = normalizePriorityTone(priority);
  return {
    tone,
    dot: PRIORITY_DOT_CLASS[tone],
    text: PRIORITY_TEXT_CLASS[tone],
    border: PRIORITY_BORDER_CLASS[tone],
    bg: PRIORITY_BG_CLASS[tone],
    tint: PRIORITY_TINT_CLASS[tone],
  };
};
