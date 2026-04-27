/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import type { RemindersRuntime } from '../useRemindersRuntime.ts';

describe('useRemindersRuntime widget surface', () => {
  test('exports useRemindersRuntime and type import compiles', async () => {
    const runtimeShapeCheck: RemindersRuntime | null = null;
    void runtimeShapeCheck;

    const mod = await import('../useRemindersRuntime.ts');
    assert.equal(typeof mod.useRemindersRuntime, 'function');
  });
});
