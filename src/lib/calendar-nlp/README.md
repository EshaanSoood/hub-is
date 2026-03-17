# Calendar NLP Parser

Offline, tiny-footprint natural-language parser for event-like input.

## Weekday Semantics (Option B)

- Bare weekday (`sunday`) resolves to the upcoming occurrence, including today if today matches.
- `this <weekday>` resolves to the current-week occurrence, including today if today matches.
  If that weekday already passed in the current week, it resolves to the upcoming occurrence with lower confidence.
- `next <weekday>` resolves to the upcoming occurrence, except when today already is that weekday.
  On same-day input, it resolves to `+7 days`.
- `next week <weekday>` resolves to the weekday in next ISO week (next week's Monday baseline).
- Relative weekday phrases never resolve to a past date.

## API

```ts
import { parseEventInput } from './index';

const result = parseEventInput('dentist thursday at 3 remind me 30m before', {
  now: '2026-02-25T12:00:00-05:00',
  timezone: 'America/New_York',
  locale: 'en-US',
  debug: true,
});
```

## Output Schema

```ts
EventParseResult {
  fields: {
    title: string | null;
    date: string | null; // YYYY-MM-DD
    time: string | null; // HH:MM (24h)
    end_time: string | null; // HH:MM (24h)
    duration_minutes: number | null;
    location: string | null;
    recurrence: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
      interval: number | null;
      days: string[] | null; // lowercase weekdays
      exceptions: string[] | null; // ISO dates
      end_date: string | null; // ISO date
    };
    alerts: Array<{ offset_minutes: number }> | null; // negative means before
    attendees: string[] | null; // email only
  };
  meta: {
    locale: string;
    timezone: string;
    confidence: {
      title: number;
      date: number;
      time: number;
      end_time: number;
      duration_minutes: number;
      location: number;
      recurrence: number;
      alerts: number;
      attendees: number;
    };
    spans: {
      title: FieldSpan[];
      date: FieldSpan[];
      time: FieldSpan[];
      end_time: FieldSpan[];
      duration_minutes: FieldSpan[];
      location: FieldSpan[];
      recurrence: FieldSpan[];
      alerts: FieldSpan[];
      attendees: FieldSpan[];
    };
    cleanedInput: string;
    maskedInput: string;
    debugSteps: DebugStep[];
  };
}
```

## CLI

```bash
echo "dentist thursday at 3 remind me 30m before" | npm run parse-cli
```

Options:
- `--now <iso>`
- `--timezone <tz>`
- `--locale <locale>`
- `--debug`

When `--timezone` is omitted, the CLI uses the OS timezone and prints the detected timezone to stderr.

## Corpus Tests

The test harness loads external JSON corpus files (no corpus generation).

```bash
npm run test:nlp
```

Override corpus paths:

```bash
CALENDAR_NLP_CORPUS_PATHS="/path/to/corpus-a.json,/path/to/corpus-b.json" npm run test:nlp
```

Optional confidence tolerance override:

```bash
CALENDAR_NLP_CONFIDENCE_TOLERANCE=0.2 npm run test:nlp
```

On mismatch, tests print a golden diff with field-by-field expected/actual values and relevant spans.

Corpus harness behavior:
- `reference_now` and `timezone` in corpus `meta` are injected for deterministic tests.
- If either is omitted, parser defaults are used (`new Date()` and `Intl.DateTimeFormat().resolvedOptions().timeZone`).
