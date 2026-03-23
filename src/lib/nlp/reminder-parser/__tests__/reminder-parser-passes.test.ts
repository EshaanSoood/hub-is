/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { absoluteTimePass } from '../passes/absoluteTimePass.ts';
import { chronoFallbackPass } from '../passes/chronoFallbackPass.ts';
import { namedDatePass } from '../passes/namedDatePass.ts';
import { prefixPass } from '../passes/prefixPass.ts';
import { recurrencePass } from '../passes/recurrencePass.ts';
import { relativeTimePass } from '../passes/relativeTimePass.ts';
import { titlePass } from '../passes/titlePass.ts';
import { createReminderParseContext } from '../utils.ts';

test('reminder passes extract recurrence and time across stages', () => {
  const ctx = createReminderParseContext('remind me every monday at 3pm to call dentist');

  prefixPass(ctx);
  recurrencePass(ctx);
  assert.equal(ctx.result.fields.recurrence?.frequency, 'weekly');

  relativeTimePass(ctx);
  absoluteTimePass(ctx);
  assert.ok(ctx.result.fields.remind_at);

  namedDatePass(ctx);
  chronoFallbackPass(ctx);

  titlePass(ctx);
  assert.equal(ctx.result.fields.title, 'Call Dentist');
  assert.ok(ctx.result.meta.debugSteps.length > 0);
});
