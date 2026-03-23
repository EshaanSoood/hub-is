/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyIntent } from '../index.ts';

type IntentType = 'task' | 'reminder' | 'event' | 'note' | 'ambiguous' | 'calendar_event';

interface DatasetExample {
  id: string;
  input: string;
  expected_intent: IntentType;
  ambiguous: boolean;
}

interface DatasetTier {
  description: string;
  examples: DatasetExample[];
}

interface DatasetFile {
  tiers: Record<string, DatasetTier>;
}

const datasetPath = new URL('../../../../../working files/merged-intent-classifier.json', import.meta.url);
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8')) as DatasetFile;

test('classifyIntent matches the merged dataset', () => {
  for (const [tierName, tier] of Object.entries(dataset.tiers)) {
    for (const example of tier.examples) {
      const result = classifyIntent(example.input);
      try {
        const expectedIntent = example.expected_intent === 'calendar_event' ? 'event' : example.expected_intent;
        assert.equal(result.intent, expectedIntent, `${example.id} expected ${expectedIntent} but got ${result.intent} for "${example.input}"`);
        assert.equal(
          result.ambiguous,
          example.ambiguous,
          `${example.id} expected ambiguous=${example.ambiguous} but got ${result.ambiguous}`,
        );
      } catch (error) {
        const details = [
          `${tierName}:${example.id} "${example.input}"`,
          `expected intent=${example.expected_intent} ambiguous=${example.ambiguous}`,
          `received intent=${result.intent} ambiguous=${result.ambiguous} topTwoGap=${result.meta.topTwoGap.toFixed(2)}`,
          `scores=${JSON.stringify(result.scores)}`,
        ].join(' | ');
        throw new assert.AssertionError({
          message: details,
          actual: error,
          expected: 'matching classification',
          operator: 'classifyIntent',
        });
      }
    }
  }
});
