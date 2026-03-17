#!/usr/bin/env node
import process from 'node:process';
import { parseEventInput } from '../../src/lib/calendar-nlp/index.ts';

const args = process.argv.slice(2);

const options = {
  timezone: undefined,
  locale: undefined,
  now: undefined,
  debug: false,
};

const inputParts = [];

for (let index = 0; index < args.length; index += 1) {
  const token = args[index];
  if (token === '--timezone' && args[index + 1]) {
    options.timezone = args[index + 1];
    index += 1;
    continue;
  }
  if (token === '--locale' && args[index + 1]) {
    options.locale = args[index + 1];
    index += 1;
    continue;
  }
  if (token === '--now' && args[index + 1]) {
    options.now = args[index + 1];
    index += 1;
    continue;
  }
  if (token === '--debug') {
    options.debug = true;
    continue;
  }

  inputParts.push(token);
}

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
  }
  return chunks.join('').trim();
};

const main = async () => {
  const inlineInput = inputParts.join(' ').trim();
  const stdinInput = process.stdin.isTTY ? '' : await readStdin();
  const input = (inlineInput || stdinInput).trim();

  if (!input) {
    console.error('Usage: echo "dentist thursday at 3 remind me 30m before" | npm run parse-cli');
    process.exitCode = 1;
    return;
  }

  const timezoneProvided = Boolean(options.timezone);
  const result = parseEventInput(input, options);
  if (!timezoneProvided) {
    process.stderr.write(`[parse-cli] detected timezone: ${result.meta.timezone}\n`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

await main();
