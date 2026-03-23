/// <reference types="node" />

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseReminderInput } from '../index.ts';
import type { ReminderRecurrence } from '../types.ts';

interface ExpectedReminderResult {
  title: string;
  remind_at: string | null;
  recurrence: ReminderRecurrence | null;
  context_hint: string | null;
}

interface DatasetExample {
  id: string;
  input: string;
  expected: ExpectedReminderResult;
}

interface DatasetTier {
  examples: DatasetExample[];
}

interface DatasetFile {
  meta: {
    reference_now: string;
    timezone: string;
  };
  tiers: Record<string, DatasetTier>;
}

const datasetPath = new URL('../../../../../working files/merged-reminder-parser.json', import.meta.url);
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as DatasetFile;

const withinTolerance = (actual: string | null, expected: string | null, _timezone: string): boolean => {
  void _timezone;
  if (actual === expected) {
    return true;
  }
  if (!actual || !expected) {
    return false;
  }
  const actualTime = new Date(`${actual}Z`).getTime();
  const expectedTime = new Date(`${expected}Z`).getTime();
  return Math.abs(actualTime - expectedTime) <= 5 * 60 * 1000;
};

test('parseReminderInput matches the merged dataset and reports pass rates', () => {
  const tierRates = new Map<string, number>();
  const fieldCounts = {
    title: { passed: 0, total: 0 },
    remind_at: { passed: 0, total: 0 },
    recurrence: { passed: 0, total: 0 },
    context_hint: { passed: 0, total: 0 },
  };

  for (const [tierName, tier] of Object.entries(dataset.tiers)) {
    let tierPassed = 0;

    for (const example of tier.examples) {
      const result = parseReminderInput(example.input, {
        now: dataset.meta.reference_now,
        timezone: dataset.meta.timezone,
      });

      const titlePass = result.fields.title === example.expected.title;
      const remindPass = withinTolerance(result.fields.remind_at, example.expected.remind_at, dataset.meta.timezone);
      const recurrencePass = JSON.stringify(result.fields.recurrence) === JSON.stringify(example.expected.recurrence);
      const contextPass =
        example.expected.context_hint === null ||
        (() => {
          if (result.fields.context_hint === null) {
            return false;
          }
          const actual = result.fields.context_hint.toLowerCase().trim();
          const expected = example.expected.context_hint.toLowerCase().trim();
          return actual === expected || actual.includes(expected) || expected.includes(actual);
        })();

      fieldCounts.title.total += 1;
      fieldCounts.remind_at.total += 1;
      fieldCounts.recurrence.total += 1;
      fieldCounts.context_hint.total += 1;
      if (titlePass) fieldCounts.title.passed += 1;
      if (remindPass) fieldCounts.remind_at.passed += 1;
      if (recurrencePass) fieldCounts.recurrence.passed += 1;
      if (contextPass) fieldCounts.context_hint.passed += 1;

      const fullPass = titlePass && remindPass && recurrencePass && contextPass;
      if (fullPass) {
        tierPassed += 1;
        continue;
      }

      throw new assert.AssertionError({
        message: `${example.id} "${example.input}" | expected=${JSON.stringify(example.expected)} | received=${JSON.stringify(result)}`,
        actual: result,
        expected: example.expected,
        operator: 'parseReminderInput',
      });
    }

    const rate = tier.examples.length > 0 ? tierPassed / tier.examples.length : 0;
    tierRates.set(tierName, rate);
    console.log(`${tierName}: ${(rate * 100).toFixed(1)}% (${tierPassed}/${tier.examples.length})`);
  }

  for (const [fieldName, counts] of Object.entries(fieldCounts)) {
    const rate = counts.total > 0 ? (counts.passed / counts.total) * 100 : 0;
    console.log(`${fieldName}: ${rate.toFixed(1)}% (${counts.passed}/${counts.total})`);
  }

  for (const [tierName, rate] of tierRates) {
    if (/^tier[123]_/.test(tierName)) {
      assert.ok(rate >= 0.8, `${tierName} pass rate ${rate.toFixed(2)} is below 0.80`);
    } else {
      assert.ok(rate >= 0.7, `${tierName} pass rate ${rate.toFixed(2)} is below 0.70`);
    }
  }
});
