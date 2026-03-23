/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { classifyIntent } from '../index.ts';

describe('intent classifier scoring edge cases', () => {
  test('classifies "meeting with sarah at 3pm" as calendar_event', () => {
    const result = classifyIntent('meeting with sarah at 3pm');
    assert.equal(result.intent, 'calendar_event');
    assert.notEqual(result.intent, 'task');
  });

  test('classifies "buy groceries" as task', () => {
    const result = classifyIntent('buy groceries');
    assert.equal(result.intent, 'task');
    assert.notEqual(result.intent, 'calendar_event');
  });

  test('classifies "remind me to call mom" as reminder', () => {
    const result = classifyIntent('remind me to call mom');
    assert.equal(result.intent, 'reminder');
  });

  test('keeps "dentist at 4" as task (known issue)', () => {
    const result = classifyIntent('dentist at 4');
    // Known issue: this looks event-like but currently resolves to task.
    assert.equal(result.intent, 'task');
    assert.equal(result.secondaryIntent, 'calendar_event');
  });

  test('classifies "fix the login bug urgent" as task with high confidence', () => {
    const result = classifyIntent('fix the login bug urgent');
    assert.equal(result.intent, 'task');
    assert.ok(result.confidence >= 0.8);
  });

  test('classifies "birthday party saturday" as calendar_event', () => {
    const result = classifyIntent('birthday party saturday');
    assert.equal(result.intent, 'calendar_event');
  });

  test('marks "pick up kids at 3" ambiguous', () => {
    const result = classifyIntent('pick up kids at 3');
    assert.equal(result.ambiguous, true);
  });

  test('classifies "schedule a call with vendor" as task', () => {
    const result = classifyIntent('schedule a call with vendor');
    assert.equal(result.intent, 'task');
  });

  test('classifies empty input as low-confidence task', () => {
    const result = classifyIntent('');
    assert.equal(result.intent, 'task');
    assert.ok(result.confidence <= 0.3);
  });

  test('classifies "???" as task and marks ambiguous', () => {
    const result = classifyIntent('???');
    assert.equal(result.intent, 'task');
    assert.equal(result.ambiguous, true);
  });
});
