#!/usr/bin/env node
/**
 * Disposable local textbox runner:
 * - Type a line, hit Enter -> prints parsed JSON
 * - Type /copy -> copies the LAST output to clipboard
 * - Type /clear -> clears screen
 * - Ctrl+C to exit
 *
 * Works on macOS + Linux (requires pbcopy or xclip/wl-copy).
 */

import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PARSE_CLI_PATH = fileURLToPath(new URL('./parse-cli.mjs', import.meta.url));

let parseEventInput = null;
let parseSource = '';

const loadParser = async () => {
  try {
    const mod = await import('../../src/lib/calendar-nlp/index.ts');
    if (typeof mod.parseEventInput === 'function') {
      parseEventInput = mod.parseEventInput;
      parseSource = 'direct import from src/lib/calendar-nlp/index.ts';
      return;
    }
  } catch {
    // Fall through to next loader.
  }

  try {
    const mod = await import('../../src/lib/calendar-nlp/index.js');
    if (typeof mod.parseEventInput === 'function') {
      parseEventInput = mod.parseEventInput;
      parseSource = 'direct import from src/lib/calendar-nlp/index.js';
      return;
    }
  } catch {
    // Fall through to CLI fallback.
  }

  parseEventInput = (input, opts = {}) => {
    const args = ['--experimental-strip-types', PARSE_CLI_PATH];
    if (opts.timezone) {
      args.push('--timezone', String(opts.timezone));
    }
    if (opts.locale) {
      args.push('--locale', String(opts.locale));
    }
    if (opts.now) {
      args.push('--now', String(opts.now));
    }
    if (opts.debug) {
      args.push('--debug');
    }

    const run = spawnSync('node', args, {
      input,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (run.status !== 0) {
      const stderr = (run.stderr || '').trim();
      throw new Error(stderr || 'parse-cli invocation failed');
    }

    return JSON.parse(run.stdout || '{}');
  };
  parseSource = 'parse-cli fallback (node --experimental-strip-types)';
};

const copyToClipboard = (text) => {
  if (!text) {
    return { ok: false, msg: 'Nothing to copy yet.' };
  }

  let run = spawnSync('pbcopy', [], { input: text });
  if (run.status === 0) {
    return { ok: true, msg: 'Copied (pbcopy).' };
  }

  run = spawnSync('wl-copy', [], { input: text });
  if (run.status === 0) {
    return { ok: true, msg: 'Copied (wl-copy).' };
  }

  run = spawnSync('xclip', ['-selection', 'clipboard'], { input: text });
  if (run.status === 0) {
    return { ok: true, msg: 'Copied (xclip).' };
  }

  return {
    ok: false,
    msg: 'Clipboard tool not found. Install pbcopy (mac), wl-copy (Wayland), or xclip (X11).',
  };
};

await loadParser();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'event> ',
});

let lastOutput = '';

console.log('Textbox runner: type an event line and press Enter.');
console.log('Commands: /copy (copy last JSON), /clear, /exit');
console.log(`Parser source: ${parseSource}`);
rl.prompt();

rl.on('line', (line) => {
  const input = line.trim();
  if (!input) {
    rl.prompt();
    return;
  }

  if (input === '/exit') {
    rl.close();
    return;
  }
  if (input === '/clear') {
    console.clear();
    rl.prompt();
    return;
  }
  if (input === '/copy') {
    const result = copyToClipboard(lastOutput);
    console.log(result.ok ? result.msg : result.msg);
    rl.prompt();
    return;
  }

  try {
    const result = parseEventInput(input, {});
    lastOutput = JSON.stringify(result, null, 2);
    console.log('\n--- JSON ---');
    console.log(lastOutput);
    console.log('------------\n');
    console.log('Tip: type "/copy" to copy the last JSON.\n');
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    console.log(`Parse error: ${message}`);
  }

  rl.prompt();
});

rl.on('close', () => {
  console.log('\nbye.');
  process.exit(0);
});
