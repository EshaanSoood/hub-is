/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assigneePass } from '../passes/assigneePass.ts';
import { dateTypoCorrectionPass } from '../passes/dateTypoCorrectionPass.ts';
import { dueDatePass } from '../passes/dueDatePass.ts';
import { priorityPass } from '../passes/priorityPass.ts';
import { titlePass } from '../passes/titlePass.ts';
import { createTaskParseContext } from '../utils.ts';
import { parseTaskInput } from '../index.ts';

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

test('task parser removes recurrence lead words from title when due date is extracted', () => {
  const result = parseTaskInput('send emails every tuesday at 7 pm', {
    now: '2026-03-22T12:00:00-04:00',
    timezone: 'America/New_York',
  });

  assert.equal(result.fields.title, 'Send Emails');
  assert.equal(result.meta.maskedInput, 'send emails');
});

test('task parser removes trailing punctuation after due date extraction', () => {
  const result = parseTaskInput('go for meeting with greg every sunday at 12 pm till 8th may.', {
    now: '2026-03-22T12:00:00-04:00',
    timezone: 'America/New_York',
  });

  assert.equal(result.fields.title, 'Go for Meeting with Greg');
  assert.equal(result.meta.maskedInput, 'go for meeting with greg');
});

test('task parser only extracts @mentions as assignees and keeps bare names in title context', () => {
  const result = parseTaskInput('meeting with sarah next monday at noon', {
    now: '2026-03-27T10:00:00',
    timezone: 'America/New_York',
  });

  assert.deepEqual(result.fields.assignee_hints, []);
  assert.equal(result.fields.title, 'Meeting with Sarah');
});

test('task parser only accepts @mentions from knownAssignees when allowlist is provided', () => {
  const result = parseTaskInput('follow up with @sam and @zoe tomorrow', {
    now: '2026-03-27T10:00:00',
    timezone: 'America/New_York',
    knownAssignees: ['sam'],
  });

  assert.deepEqual(result.fields.assignee_hints, ['@sam']);
  assert.equal(result.fields.title.includes('@sam'), false);
  assert.equal(result.fields.title.includes('@zoe'), true);
});
