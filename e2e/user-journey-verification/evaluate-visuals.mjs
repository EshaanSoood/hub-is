#!/usr/bin/env node
/* global fetch, process, setTimeout */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = 'gpt-5.2';

// Baseline from OpenAI GPT-5.2 model page Tier 1: 500 RPM.
const GPT52_TIER1_RPM = 500;
const DOC_MIN_INTERVAL_MS = Math.ceil(60_000 / GPT52_TIER1_RPM);
const DEFAULT_BASE_PAUSE_MS = Math.max(400, DOC_MIN_INTERVAL_MS * 3);

const SYSTEM_PROMPT =
  'You are a strict visual QA evaluator for Hub OS screenshots. Evaluate only visual/layout quality. Keep findings factual and concise.';

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const parseEnvLine = (line) => {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }
  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
};

const readOptionalEnvFile = async (filePath) => {
  try {
    const raw = await readFile(filePath, 'utf8');
    const output = {};
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed) {
        output[parsed.key] = parsed.value;
      }
    }
    return output;
  } catch {
    return {};
  }
};

const resolveOpenAiApiKey = async () => {
  const direct = String(process.env.OPENAI_API_KEY || '').trim();
  if (direct) {
    return direct;
  }

  const localEnv = await readOptionalEnvFile(resolve(__dirname, '.env.local'));
  const moduleVerificationEnv = await readOptionalEnvFile(resolve(__dirname, '..', 'module-verification', '.env.local'));
  const e2eTokensEnv = await readOptionalEnvFile(resolve(__dirname, '..', '.env.tokens.local'));
  return String(localEnv.OPENAI_API_KEY || moduleVerificationEnv.OPENAI_API_KEY || e2eTokensEnv.OPENAI_API_KEY || '').trim();
};

const resolveScenario = () => String(process.env.JOURNEY_SCENARIO || 'baseline').trim().toLowerCase() === 'stress'
  ? 'stress'
  : 'baseline';

const resolveScreenshotsDir = () =>
  resolve(
    process.cwd(),
    process.env.JOURNEY_SCREENSHOT_DIR || resolve(__dirname, 'screenshots'),
  );

const resolveOutputPath = (scenario) =>
  resolve(
    process.cwd(),
    process.env.JOURNEY_VISUAL_OUTPUT_PATH || resolve(__dirname, `visual-evaluation-${scenario}.json`),
  );

const parseScreenshotName = (filename) => {
  const match = filename.match(/^(baseline|stress)-([a-z0-9_-]+)-([a-z0-9_-]+)-(desktop|tablet|mobile)\.png$/i);
  if (!match) {
    return null;
  }
  return {
    scenario: match[1].toLowerCase(),
    phase: match[2].toLowerCase(),
    state: match[3].toLowerCase(),
    viewport: match[4].toLowerCase(),
  };
};

const extractCompletionText = (payload) => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const segments = [];
  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  for (const outputItem of outputs) {
    const contents = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const content of contents) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        segments.push(content.text.trim());
      }
    }
  }
  return segments.join('\n').trim();
};

const extractJsonObject = (rawText) => {
  const raw = String(rawText || '').trim();
  if (!raw) {
    return null;
  }

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end < start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
};

const normalizeEvaluation = (parsed) => {
  const ratingRaw = String(parsed?.rating || '').toUpperCase();
  const rating = ratingRaw === 'PASS' || ratingRaw === 'WARN' || ratingRaw === 'FAIL' ? ratingRaw : 'WARN';
  const issuesRaw = Array.isArray(parsed?.issues)
    ? parsed.issues
    : typeof parsed?.issues === 'string'
      ? [parsed.issues]
      : [];

  const issues = issuesRaw
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .slice(0, 12);

  const summary = String(parsed?.summary || '').trim().slice(0, 600);

  return {
    rating,
    issues,
    summary,
  };
};

const parseDurationToken = (raw) => {
  const value = String(raw || '').trim();
  if (!value) {
    return 0;
  }

  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10) * 1000;
  }

  const tokenRegex = /(\d+(?:\.\d+)?)(ms|s|m|h)/gi;
  let match;
  let total = 0;
  while ((match = tokenRegex.exec(value))) {
    const amount = Number.parseFloat(match[1]);
    const unit = String(match[2] || '').toLowerCase();
    if (!Number.isFinite(amount)) {
      continue;
    }
    if (unit === 'ms') {
      total += amount;
    } else if (unit === 's') {
      total += amount * 1000;
    } else if (unit === 'm') {
      total += amount * 60_000;
    } else if (unit === 'h') {
      total += amount * 3_600_000;
    }
  }

  if (total > 0) {
    return Math.ceil(total);
  }

  const asDateMs = Date.parse(value);
  if (Number.isFinite(asDateMs)) {
    return Math.max(0, asDateMs - Date.now());
  }

  return 0;
};

class AdaptiveRateLimiter {
  constructor(basePauseMs) {
    this.basePauseMs = Math.max(100, basePauseMs);
    this.nextAllowedAt = 0;
    this.lastPauseMs = this.basePauseMs;
  }

  async waitForTurn() {
    const waitMs = this.nextAllowedAt - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  scheduleFromHeaders(headers) {
    const remaining = Number.parseInt(String(headers.get('x-ratelimit-remaining-requests') || '').trim(), 10);
    const resetMs = parseDurationToken(headers.get('x-ratelimit-reset-requests'));

    let pauseMs = this.basePauseMs;
    if (Number.isFinite(remaining) && remaining <= 1 && resetMs > 0) {
      pauseMs = Math.max(pauseMs, resetMs + 250);
    } else if (Number.isFinite(remaining) && remaining <= 3 && resetMs > 0) {
      pauseMs = Math.max(pauseMs, Math.ceil(resetMs / Math.max(remaining, 1)) + 150);
    }

    this.lastPauseMs = pauseMs;
    this.nextAllowedAt = Date.now() + pauseMs;
    return pauseMs;
  }

  scheduleRetry(headers, attempt) {
    const retryAfterMs = parseDurationToken(headers?.get('retry-after'));
    const resetMs = parseDurationToken(headers?.get('x-ratelimit-reset-requests'));
    const backoffMs = Math.min(15_000, this.basePauseMs * (2 ** attempt));

    const pauseMs = Math.max(this.basePauseMs, backoffMs, retryAfterMs, resetMs);
    this.lastPauseMs = pauseMs;
    this.nextAllowedAt = Date.now() + pauseMs;
    return pauseMs;
  }
}

const evaluateScreenshot = async (filePath, fileName, apiKey, limiter) => {
  const imageBuffer = await readFile(filePath);
  const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  const prompt = [
    `Screenshot filename: ${fileName}`,
    '',
    'Evaluate visual quality only (layout, overlap, spacing, truncation, alignment, responsiveness, broken rendering).',
    'Return STRICT JSON object with exactly:',
    '{"rating":"PASS|WARN|FAIL","issues":["..."],"summary":"..."}',
    'Use an empty issues array if none.',
    'Do not include markdown or extra keys.',
  ].join('\n');

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await limiter.waitForTurn();

    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: dataUrl },
            ],
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => null);

    if (response.ok) {
      limiter.scheduleFromHeaders(response.headers);
      const rawText = extractCompletionText(payload);
      const parsed = extractJsonObject(rawText);
      if (!parsed) {
        throw new Error(`Model response for ${fileName} was not valid JSON.`);
      }
      return {
        evaluation: normalizeEvaluation(parsed),
        headers: {
          remaining_requests: response.headers.get('x-ratelimit-remaining-requests'),
          reset_requests: response.headers.get('x-ratelimit-reset-requests'),
        },
      };
    }

    const detail = payload?.error?.message || `HTTP ${response.status}`;
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt >= 3) {
      throw new Error(`OpenAI request failed for ${fileName}: ${detail}`);
    }

    limiter.scheduleRetry(response.headers, attempt + 1);
  }

  throw new Error(`OpenAI request failed for ${fileName}: exhausted retries.`);
};

const writeReport = async (outputPath, report) => {
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

const main = async () => {
  const scenario = resolveScenario();
  const screenshotsDir = resolveScreenshotsDir();
  const outputPath = resolveOutputPath(scenario);
  const apiKey = await resolveOpenAiApiKey();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for evaluate-visuals.mjs');
  }

  const entries = (await readdir(screenshotsDir))
    .filter((entry) => entry.toLowerCase().endsWith('.png'))
    .sort((left, right) => left.localeCompare(right));

  if (entries.length === 0) {
    throw new Error(`No screenshots found in ${screenshotsDir}`);
  }

  const basePauseMs = Math.max(
    100,
    Number.parseInt(String(process.env.JOURNEY_VISION_BASE_PAUSE_MS || DEFAULT_BASE_PAUSE_MS), 10) || DEFAULT_BASE_PAUSE_MS,
  );
  const limiter = new AdaptiveRateLimiter(basePauseMs);

  const report = {
    scenario,
    generated_at: new Date().toISOString(),
    model: OPENAI_MODEL,
    rate_limit_strategy: {
      source: 'OpenAI GPT-5.2 model docs (Tier 1 baseline RPM=500) + runtime x-ratelimit headers',
      docs_tier1_rpm: GPT52_TIER1_RPM,
      docs_min_interval_ms: DOC_MIN_INTERVAL_MS,
      base_pause_ms: basePauseMs,
    },
    summary: {
      PASS: 0,
      WARN: 0,
      FAIL: 0,
      ERROR: 0,
    },
    screenshots: [],
  };

  for (const filename of entries) {
    const parsedName = parseScreenshotName(filename);
    if (!parsedName || parsedName.scenario !== scenario) {
      continue;
    }

    const absolutePath = resolve(screenshotsDir, filename);
    try {
      const result = await evaluateScreenshot(absolutePath, filename, apiKey, limiter);
      const rating = result.evaluation.rating;
      report.summary[rating] += 1;
      report.screenshots.push({
        file: filename,
        phase: parsedName.phase,
        state: parsedName.state,
        viewport: parsedName.viewport,
        rating,
        issues: result.evaluation.issues,
        summary: result.evaluation.summary,
        headers: result.headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.summary.ERROR += 1;
      report.screenshots.push({
        file: filename,
        phase: parsedName.phase,
        state: parsedName.state,
        viewport: parsedName.viewport,
        rating: 'ERROR',
        issues: [message],
        summary: 'Visual evaluation failed for this screenshot.',
      });
    }

    await writeReport(outputPath, report);
  }

  await writeReport(outputPath, report);

  const total = report.screenshots.length;
  process.stdout.write(
    `Visual evaluation (${scenario}) complete with model ${OPENAI_MODEL}. ${total} screenshots, PASS=${report.summary.PASS}, WARN=${report.summary.WARN}, FAIL=${report.summary.FAIL}, ERROR=${report.summary.ERROR}. Output: ${outputPath}\n`,
  );
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
