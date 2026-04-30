import { describe, expect, it } from 'vitest';
import { parseProductivityInput } from '../index.ts';

const baseOptions = {
  now: '2026-04-30T12:00:00Z',
  timezone: 'America/New_York',
};

describe('parseProductivityInput', () => {
  it('routes explicit reminder phrasing to the reminder parser', () => {
    const result = parseProductivityInput('remind me to call mom tomorrow at 8am', baseOptions);

    expect(result.intent).toBe('reminder');
    expect(result.parser).toBe('reminder');
    expect(result.result?.fields.title).toContain('Call Mom');
  });

  it('routes calendar input to the calendar parser', () => {
    const result = parseProductivityInput('team sync next monday at 3pm', baseOptions);

    expect(result.intent).toBe('calendar');
    expect(result.parser).toBe('calendar');
    if (result.parser !== 'calendar') {
      throw new Error('expected calendar parser result');
    }
    expect(result.result.fields.time).toBeTruthy();
  });

  it('routes task input to the task parser', () => {
    const result = parseProductivityInput('finish the launch checklist tomorrow', baseOptions);

    expect(result.intent).toBe('task');
    expect(result.parser).toBe('task');
    if (result.parser !== 'task') {
      throw new Error('expected task parser result');
    }
    expect(result.result.fields.title.length).toBeGreaterThan(0);
  });

  it('abstains when intent is none', () => {
    const result = parseProductivityInput('???', baseOptions);

    expect(result.intent).toBe('none');
    expect(result.parser).toBeNull();
    expect(result.result).toBeNull();
  });
});
