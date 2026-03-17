#!/usr/bin/env node
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 8787;
const PARSE_CLI_PATH = fileURLToPath(new URL('./parse-cli.mjs', import.meta.url));

function runParseCli(input, opts = {}) {
  const args = ['--experimental-strip-types', PARSE_CLI_PATH];
  if (opts.timezone) args.push('--timezone', String(opts.timezone));
  if (opts.locale) args.push('--locale', String(opts.locale));
  if (opts.now) args.push('--now', String(opts.now));
  if (opts.debug) args.push('--debug');

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
}

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Calendar NLP Scratch UI</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 16px; max-width: 900px; }
    .row { margin: 12px 0; }
    label { font-weight: 600; display: block; margin-bottom: 6px; }
    textarea, input { width: 100%; font-size: 16px; padding: 10px; }
    textarea { min-height: 84px; }
    button { font-size: 16px; padding: 10px 14px; margin-right: 8px; margin-top: 8px; }
    pre { white-space: pre-wrap; word-break: break-word; background: #f6f6f6; padding: 12px; border: 1px solid #ddd; }
    .hint { color: #333; }
    .status { padding: 10px; border: 1px solid #ddd; background: #fffbe6; }
  </style>
</head>
<body>
  <h1>Calendar NLP Scratch UI</h1>
  <p class="hint">Type an event phrase, then press <strong>Parse</strong>. Use the copy buttons to copy JSON output.</p>

  <div class="row">
    <label for="input">Input</label>
    <textarea id="input" aria-describedby="inputHelp" placeholder="e.g. dentist thursday at 3 remind me 30m before"></textarea>
    <div id="inputHelp" class="hint">
      Tip: Press Parse. (Optional: enable Enter submits below.)
    </div>
  </div>

  <div class="row">
    <label for="opts">Options (optional)</label>
    <div class="hint">Leave blank to use system defaults.</div>
    <div style="display: grid; gap: 10px; grid-template-columns: 1fr 1fr;">
      <div>
        <label for="timezone">Timezone</label>
        <input id="timezone" placeholder="America/New_York" />
      </div>
      <div>
        <label for="locale">Locale</label>
        <input id="locale" placeholder="en-US" />
      </div>
    </div>
    <div style="display: grid; gap: 10px; grid-template-columns: 1fr 1fr;">
      <div>
        <label for="now">Reference now (ISO, optional)</label>
        <input id="now" placeholder="2026-02-25T12:00:00-05:00" />
      </div>
      <div>
        <label style="display:inline-flex; gap: 8px; align-items:center; margin-top: 26px;">
          <input id="enterSubmits" type="checkbox" />
          Enter submits (Shift+Enter for newline)
        </label>
      </div>
    </div>
  </div>

  <div class="row">
    <button id="parseBtn">Parse</button>
    <button id="copyBtn" disabled>Copy output</button>
    <button id="copyAllBtn" disabled>Copy all</button>
    <button id="clearBtn">Clear</button>
  </div>

  <div class="row status" id="status" role="status" aria-live="polite">
    Ready.
  </div>

  <div class="row">
    <label for="output">Output JSON</label>
    <pre id="output" tabindex="0" aria-label="Parsed JSON output"></pre>
  </div>

<script>
  const inputEl = document.getElementById('input');
  const tzEl = document.getElementById('timezone');
  const localeEl = document.getElementById('locale');
  const nowEl = document.getElementById('now');
  const enterSubmitsEl = document.getElementById('enterSubmits');

  const parseBtn = document.getElementById('parseBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const clearBtn = document.getElementById('clearBtn');

  const outputEl = document.getElementById('output');
  const statusEl = document.getElementById('status');

  let lastOutput = '';
  let allOutput = '';

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
  }

  async function doParse() {
    const input = inputEl.value.trim();
    if (!input) {
      setStatus('Nothing to parse.');
      return;
    }

    setStatus('Parsing...');

    const payload = {
      input,
      timezone: tzEl.value.trim() || null,
      locale: localeEl.value.trim() || null,
      now: nowEl.value.trim() || null
    };

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Parse failed');

      lastOutput = JSON.stringify(json, null, 2);
      allOutput += 'INPUT: ' + input + '\\n' + lastOutput + '\\n\\n';

      outputEl.textContent = lastOutput;
      copyBtn.disabled = false;
      copyAllBtn.disabled = false;

      setStatus('Parsed. Output updated.');
      outputEl.focus();
    } catch (e) {
      setStatus('Error: ' + (e && e.message ? e.message : String(e)));
    }
  }

  parseBtn.addEventListener('click', doParse);

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    outputEl.textContent = '';
    lastOutput = '';
    allOutput = '';
    copyBtn.disabled = true;
    copyAllBtn.disabled = true;
    setStatus('Cleared.');
    inputEl.focus();
  });

  copyBtn.addEventListener('click', async () => {
    if (!lastOutput) return;
    try {
      await copyText(lastOutput);
      setStatus('Copied output to clipboard.');
    } catch {
      setStatus('Copy failed. Your browser may block clipboard without HTTPS or permission.');
    }
  });

  copyAllBtn.addEventListener('click', async () => {
    if (!allOutput.trim()) return;
    try {
      await copyText(allOutput.trim());
      setStatus('Copied all outputs to clipboard.');
    } catch {
      setStatus('Copy failed. Your browser may block clipboard without HTTPS or permission.');
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (!enterSubmitsEl.checked) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doParse();
    }
  });

  inputEl.focus();
</script>
</body>
</html>
`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(INDEX_HTML);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/parse') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const input = String(payload.input || '');
          const opts = {};
          if (payload.timezone) opts.timezone = payload.timezone;
          if (payload.locale) opts.locale = payload.locale;
          if (payload.now) opts.now = payload.now;

          const result = runParseCli(input, opts);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: e?.message ?? String(e) }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error: ' + (e?.message ?? String(e)));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Scratch UI running: http://127.0.0.1:${PORT}`);
  console.log(`Uses parse-cli at: ${PARSE_CLI_PATH}`);
});
