export const noopAsync = async () => {};
export const noop = () => {};

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const asText = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const addMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export const weekDate = (dayOffset: number, hour: number) => {
  const date = new Date();
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date;
};
