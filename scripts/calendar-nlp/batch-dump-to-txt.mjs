#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const inputs = [
  'MEETING WITH BOB EVERY MONDAY AT 7 TILL JULY 24.',
  'DENTIST TOMORROW',
  'MEETING WITH SHANON 6 PM',
  'GUITAR LESSON FEBRUARY 25TH',
  'SALSA CLASS EVERY OTHER TUESDAY STARTING MARCH 11TH TILL AUGUST 9TH AT 9 PM',
  'SUDO PARSE AT 11PM DAY AFTER',
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const parseCliPath = path.resolve(scriptDir, 'parse-cli.mjs');
const outputPath = path.resolve(repoRoot, 'calendar-nlp-output.txt');

let output = '';

for (const input of inputs) {
  output += `INPUT: ${input}\n`;

  const run = spawnSync('node', ['--experimental-strip-types', parseCliPath], {
    input,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (run.status === 0) {
    const parsed = (run.stdout || '').trim();
    output += `${parsed}\n\n`;
  } else {
    const message = (run.stderr || run.stdout || 'parse-cli invocation failed').trim();
    output += `ERROR: ${message}\n\n`;
  }
}

writeFileSync(outputPath, output, 'utf8');
console.log('Wrote calendar-nlp-output.txt');
