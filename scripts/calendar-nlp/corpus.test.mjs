import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { flattenCorpusExamples, loadCorpus, runCorpusExample } from './corpus-harness.mjs';

const DEFAULT_CORPUS_PATHS = [];

const envPaths = (process.env.CALENDAR_NLP_CORPUS_PATHS ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const corpusPaths = envPaths.length > 0 ? envPaths : DEFAULT_CORPUS_PATHS;
const availableCorpusPaths = corpusPaths.filter((entry) => existsSync(entry));

test('calendar nlp corpus snapshots', async (t) => {
  if (corpusPaths.length === 0) {
    t.skip('No corpus files found. Set CALENDAR_NLP_CORPUS_PATHS to valid JSON files.');
    return;
  }

  if (availableCorpusPaths.length === 0) {
    assert.fail(`No configured corpus files exist. CALENDAR_NLP_CORPUS_PATHS=${corpusPaths.join(',')}`);
  }

  const parsedMaxFailures = Number(process.env.CALENDAR_NLP_MAX_FAILURES ?? 20);
  const maxFailuresToPrint = Number.isFinite(parsedMaxFailures) ? Math.max(0, Math.trunc(parsedMaxFailures)) : 20;

  for (const corpusPath of availableCorpusPaths) {
    const corpus = loadCorpus(corpusPath);
    const examples = flattenCorpusExamples(corpus.tiers);
    const parseOpts = {
      now: corpus.meta?.reference_now,
      timezone: corpus.meta?.timezone,
      locale: corpus.meta?.locale,
      debug: true,
    };

    const rawTolerance = process.env.CALENDAR_NLP_CONFIDENCE_TOLERANCE ?? corpus.meta?.confidence_tolerance ?? 0.2;
    const parsedTolerance = Number(rawTolerance);
    const tolerance = Number.isFinite(parsedTolerance) ? parsedTolerance : 0.2;

    await t.test(corpus.path, () => {
      const failures = [];

      for (const example of examples) {
        const outcome = runCorpusExample(example, parseOpts, tolerance);
        if (!outcome.ok) {
          failures.push(outcome.diff || `${example.id} failed`);
        }
      }

      if (failures.length > 0) {
        const printed = failures.slice(0, maxFailuresToPrint).join('\n\n');
        const truncatedSuffix =
          failures.length > maxFailuresToPrint
            ? `\n\n... and ${String(failures.length - maxFailuresToPrint)} more failures`
            : '';
        assert.fail(`${failures.length} mismatches in ${corpus.path}\n\n${printed}${truncatedSuffix}`);
      }
    });
  }
});
