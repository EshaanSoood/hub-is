/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assigneePass } from '../passes/assigneePass.ts';
import { dateTypoCorrectionPass } from '../passes/dateTypoCorrectionPass.ts';
import { dueDatePass } from '../passes/dueDatePass.ts';
import { priorityPass } from '../passes/priorityPass.ts';
import { titlePass } from '../passes/titlePass.ts';
import { createTaskParseContext } from '../utils.ts';

test('task passes extract priority assignee due date and title in order', () => {
  const ctx = createTaskParseContext('urgent @sam fix login by tomorrow morning');

  priorityPass(ctx);
  assert.equal(ctx.result.fields.priority, 'high');

  assigneePass(ctx);
  assert.deepEqual(ctx.result.fields.assignee_hints, ['@sam']);

  dateTypoCorrectionPass(ctx);
  dueDatePass(ctx);
  assert.ok(ctx.result.fields.due_at);

  titlePass(ctx);
  assert.equal(ctx.result.fields.title, 'Fix Login');
  assert.ok(ctx.result.meta.debugSteps.length > 0);
});
