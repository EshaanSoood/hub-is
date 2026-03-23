/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { confidencePass } from '../passes/confidencePass.ts';
import { keywordPass } from '../passes/keywordPass.ts';
import { patternPass } from '../passes/patternPass.ts';
import { structurePass } from '../passes/structurePass.ts';
import type { IntentParseContext } from '../types.ts';

const makeContext = (rawInput: string): IntentParseContext => {
  const normalizedInput = rawInput.toLowerCase();
  return {
    rawInput,
    normalizedInput,
    tokens: normalizedInput.split(/\s+/).filter(Boolean),
    options: { threshold: 0.65 },
    scores: { task: 0, reminder: 0, event: 0, note: 0 },
    topTwoGap: 0,
    resultIntent: 'ambiguous',
    ambiguous: true,
    debugSteps: [],
    signals: [],
    warnings: [],
    state: {
      reminder: null,
      event: null,
      task: null,
    },
  };
};

test('intent passes accumulate signals and compute confidence', () => {
  const ctx = makeContext('remind me tomorrow at 3pm to call mom');

  keywordPass(ctx);
  patternPass(ctx);
  structurePass(ctx);
  confidencePass(ctx);

  assert.equal(ctx.resultIntent, 'reminder');
  assert.ok(ctx.scores.reminder >= ctx.scores.task);
  assert.ok(ctx.debugSteps.length > 0);
});
