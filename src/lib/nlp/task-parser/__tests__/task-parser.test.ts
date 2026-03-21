/// <reference types="node" />

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseTaskInput } from '../index.ts';
import type { TaskPriority } from '../types.ts';

interface ExpectedTaskResult {
  title: string;
  due_at: string | null;
  priority: TaskPriority;
  assignee_hints: string[];
}

interface DatasetExample {
  id: string;
  input: string;
  expected: ExpectedTaskResult;
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

const datasetPath = new URL('../../../../../working files/merged-task-parser.json', import.meta.url);
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as DatasetFile;

test('parseTaskInput matches the merged dataset and reports pass rates', () => {
  const tierRates = new Map<string, number>();
  const tierFailures = new Map<string, string[]>();
  const fieldCounts = {
    title: { passed: 0, total: 0 },
    due_at: { passed: 0, total: 0 },
    priority: { passed: 0, total: 0 },
    assignee_hints: { passed: 0, total: 0 },
  };

  for (const [tierName, tier] of Object.entries(dataset.tiers)) {
    let tierPassed = 0;
    const failures: string[] = [];

    for (const example of tier.examples) {
      const result = parseTaskInput(example.input, {
        now: dataset.meta.reference_now,
        timezone: dataset.meta.timezone,
      });

      const expectedAssignees = example.expected.assignee_hints.map((value) => value.toLowerCase()).sort();
      const actualAssignees = result.fields.assignee_hints.map((value) => value.toLowerCase()).sort();

      const titlePass = result.fields.title === example.expected.title;
      const duePass = (() => {
        if (result.fields.due_at === example.expected.due_at) return true;
        if (!result.fields.due_at || !example.expected.due_at) return false;
        if (example.expected.due_at.includes('T')) return result.fields.due_at === example.expected.due_at;
        return result.fields.due_at.slice(0, 10) === example.expected.due_at;
      })();
      const priorityPass = result.fields.priority === example.expected.priority;
      let assigneePass = true;
      try {
        assert.deepEqual(actualAssignees, expectedAssignees);
      } catch {
        assigneePass = false;
      }

      fieldCounts.title.total += 1;
      fieldCounts.due_at.total += 1;
      fieldCounts.priority.total += 1;
      fieldCounts.assignee_hints.total += 1;
      if (titlePass) fieldCounts.title.passed += 1;
      if (duePass) fieldCounts.due_at.passed += 1;
      if (priorityPass) fieldCounts.priority.passed += 1;
      if (assigneePass) fieldCounts.assignee_hints.passed += 1;

      const fullPass = titlePass && duePass && priorityPass && assigneePass;
      if (fullPass) {
        tierPassed += 1;
        continue;
      }

      failures.push(
        [
          `${example.id} "${example.input}"`,
          `expected=${JSON.stringify(example.expected)}`,
          `received=${JSON.stringify(result)}`,
        ].join(' | '),
      );
    }

    const rate = tier.examples.length > 0 ? tierPassed / tier.examples.length : 0;
    tierRates.set(tierName, rate);
    tierFailures.set(tierName, failures);
    console.log(`${tierName}: ${(rate * 100).toFixed(1)}% (${tierPassed}/${tier.examples.length})`);
  }

  for (const [fieldName, counts] of Object.entries(fieldCounts)) {
    const rate = counts.total > 0 ? (counts.passed / counts.total) * 100 : 0;
    console.log(`${fieldName}: ${rate.toFixed(1)}% (${counts.passed}/${counts.total})`);
  }

  for (const [tierName, rate] of tierRates) {
    if (/^tier[123]_/.test(tierName)) {
      assert.ok(
        rate >= 0.8,
        `${tierName} pass rate ${rate.toFixed(2)} is below 0.80${
          tierFailures.get(tierName)?.length ? ` | sample failures: ${tierFailures.get(tierName)?.slice(0, 3).join(' || ')}` : ''
        }`,
      );
    } else {
      assert.ok(
        rate >= 0.7,
        `${tierName} pass rate ${rate.toFixed(2)} is below 0.70${
          tierFailures.get(tierName)?.length ? ` | sample failures: ${tierFailures.get(tierName)?.slice(0, 3).join(' || ')}` : ''
        }`,
      );
    }
  }
});
