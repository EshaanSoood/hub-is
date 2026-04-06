# NLP Parser Dependency Audit

Scope: 56 files across `src/lib/nlp/{intent,task-parser,reminder-parser,shared}` and `src/lib/calendar-nlp`.
Import totals below count only source/test/support files. The calendar parser README is included in the inventory but excluded from dependency counts because its `import` lines are documentation examples, not runtime dependencies.

Counts below are import statements. The `External` bucket includes Node built-ins used in tests; the third-party package list only includes non-Node packages from `node_modules`.

## File inventory

### Intent classifier (11 files)

- `src/lib/nlp/intent/__tests__/intent-passes.test.ts`
- `src/lib/nlp/intent/__tests__/intent-scoring.test.ts`
- `src/lib/nlp/intent/__tests__/intent.test.ts`
- `src/lib/nlp/intent/constants.ts`
- `src/lib/nlp/intent/index.ts`
- `src/lib/nlp/intent/passes/confidencePass.ts`
- `src/lib/nlp/intent/passes/keywordPass.ts`
- `src/lib/nlp/intent/passes/patternPass.ts`
- `src/lib/nlp/intent/passes/structurePass.ts`
- `src/lib/nlp/intent/types.ts`
- `src/lib/nlp/intent/utils.ts`

### Task parser (13 files)

- `src/lib/nlp/task-parser/__tests__/due-date-extraction.test.ts`
- `src/lib/nlp/task-parser/__tests__/task-parser-passes.test.ts`
- `src/lib/nlp/task-parser/__tests__/task-parser.test.ts`
- `src/lib/nlp/task-parser/__tests__/title-cleanup.test.ts`
- `src/lib/nlp/task-parser/constants.ts`
- `src/lib/nlp/task-parser/index.ts`
- `src/lib/nlp/task-parser/passes/assigneePass.ts`
- `src/lib/nlp/task-parser/passes/dateTypoCorrectionPass.ts`
- `src/lib/nlp/task-parser/passes/dueDatePass.ts`
- `src/lib/nlp/task-parser/passes/priorityPass.ts`
- `src/lib/nlp/task-parser/passes/titlePass.ts`
- `src/lib/nlp/task-parser/types.ts`
- `src/lib/nlp/task-parser/utils.ts`

### Reminder parser (15 files)

- `src/lib/nlp/reminder-parser/__tests__/recurrence.test.ts`
- `src/lib/nlp/reminder-parser/__tests__/reminder-parser-passes.test.ts`
- `src/lib/nlp/reminder-parser/__tests__/reminder-parser.test.ts`
- `src/lib/nlp/reminder-parser/__tests__/time-extraction.test.ts`
- `src/lib/nlp/reminder-parser/constants.ts`
- `src/lib/nlp/reminder-parser/index.ts`
- `src/lib/nlp/reminder-parser/passes/absoluteTimePass.ts`
- `src/lib/nlp/reminder-parser/passes/chronoFallbackPass.ts`
- `src/lib/nlp/reminder-parser/passes/namedDatePass.ts`
- `src/lib/nlp/reminder-parser/passes/prefixPass.ts`
- `src/lib/nlp/reminder-parser/passes/recurrencePass.ts`
- `src/lib/nlp/reminder-parser/passes/relativeTimePass.ts`
- `src/lib/nlp/reminder-parser/passes/titlePass.ts`
- `src/lib/nlp/reminder-parser/types.ts`
- `src/lib/nlp/reminder-parser/utils.ts`

### Calendar parser (13 files)

- `src/lib/calendar-nlp/README.md`
- `src/lib/calendar-nlp/__tests__/calendar-parser.test.ts`
- `src/lib/calendar-nlp/constants.ts`
- `src/lib/calendar-nlp/index.ts`
- `src/lib/calendar-nlp/passes/alertsPass.ts`
- `src/lib/calendar-nlp/passes/attendeesPass.ts`
- `src/lib/calendar-nlp/passes/chronoPass.ts`
- `src/lib/calendar-nlp/passes/durationPass.ts`
- `src/lib/calendar-nlp/passes/locationPass.ts`
- `src/lib/calendar-nlp/passes/recurrencePass.ts`
- `src/lib/calendar-nlp/passes/titlePass.ts`
- `src/lib/calendar-nlp/types.ts`
- `src/lib/calendar-nlp/utils.ts`

### Shared NLP infra (4 files)

- `src/lib/nlp/shared/constants.ts`
- `src/lib/nlp/shared/title-utils.ts`
- `src/lib/nlp/shared/types.ts`
- `src/lib/nlp/shared/utils.ts`

No standalone dataset files were found in the audited parser scope.

## Cross-boundary imports

No parser-system files import code from outside `src/lib/nlp` or `src/lib/calendar-nlp`. There are currently no Hub OS internal entanglement points in scope.

## Shared NLP imports

| Parser | Importer file | What it imports | Source path | Dependency type |
| --- | --- | --- | --- | --- |
| Calendar parser | `src/lib/calendar-nlp/passes/titlePass.ts` | `{ TITLE_SMALL_WORDS }` | `src/lib/nlp/shared/constants.ts` | shared infra |
| Calendar parser | `src/lib/calendar-nlp/passes/titlePass.ts` | `{ stripLeadingTitleFiller, stripReminderLeadPrefix, stripTrailingDanglingPreposition, }` | `src/lib/nlp/shared/title-utils.ts` | shared infra |
| Intent classifier | `src/lib/nlp/intent/types.ts` | `type { DebugStep, ParseWarning }` | `src/lib/nlp/shared/types.ts` | shared infra |
| Reminder parser | `src/lib/nlp/reminder-parser/index.ts` | `type { ParseWarning }` | `src/lib/nlp/shared/types.ts` | shared infra |
| Reminder parser | `src/lib/nlp/reminder-parser/types.ts` | `type { DebugStep, FieldSpan, ParseWarning }` | `src/lib/nlp/shared/types.ts` | shared infra |
| Reminder parser | `src/lib/nlp/reminder-parser/utils.ts` | `{ addDays, addMinutes, formatDateTimeInTimezone, getZonedParts, normalizeWhitespace, parseReferenceDate, toIsoDate, }` | `src/lib/nlp/shared/utils.ts` | shared infra |
| Reminder parser | `src/lib/nlp/reminder-parser/utils.ts` | `{ TITLE_SMALL_WORDS }` | `src/lib/nlp/shared/constants.ts` | shared infra |
| Reminder parser | `src/lib/nlp/reminder-parser/utils.ts` | `{ stripLeadingTitleFiller, stripReminderLeadPrefix, stripResidualTemporalTokens, stripTrailingDanglingPreposition, }` | `src/lib/nlp/shared/title-utils.ts` | shared infra |
| Task parser | `src/lib/nlp/task-parser/constants.ts` | `{ TITLE_SMALL_WORDS }` | `src/lib/nlp/shared/constants.ts` | shared infra |
| Task parser | `src/lib/nlp/task-parser/index.ts` | `{ classifyIntent }` | `src/lib/nlp/intent/index.ts` | cross-parser |
| Task parser | `src/lib/nlp/task-parser/index.ts` | `type { ParseWarning }` | `src/lib/nlp/shared/types.ts` | shared infra |
| Task parser | `src/lib/nlp/task-parser/index.ts` | `{ formatDateTimeInTimezone, parseReferenceDate }` | `src/lib/nlp/shared/utils.ts` | shared infra |
| Task parser | `src/lib/nlp/task-parser/types.ts` | `type { DebugStep, FieldSpan, ParseWarning }` | `src/lib/nlp/shared/types.ts` | shared infra |
| Task parser | `src/lib/nlp/task-parser/utils.ts` | `{ SHARED_ACRONYM_MAP }` | `src/lib/nlp/shared/constants.ts` | shared infra |
| Task parser | `src/lib/nlp/task-parser/utils.ts` | `{ addDays, formatDateInTimezone, formatDateTimeInTimezone, getZonedDateParts, getZonedParts, normalizeWhitespace, parseReferenceDate, toIsoDate, }` | `src/lib/nlp/shared/utils.ts` | shared infra |
| Task parser | `src/lib/nlp/task-parser/utils.ts` | `{ stripLeadingTitleFiller, stripReminderLeadPrefix, stripResidualTemporalTokens, stripTrailingDanglingPreposition, }` | `src/lib/nlp/shared/title-utils.ts` | shared infra |

## External dependencies

- `chrono-node`

Node built-ins used by parser files/tests:

- `node:assert`
- `node:assert/strict`
- `node:fs`
- `node:test`

## Summary

| Parser | Self | Shared NLP | Hub OS internal | External |
| --- | ---: | ---: | ---: | ---: |
| Intent classifier | 27 | 1 | 0 | 7 |
| Task parser | 32 | 8 | 0 | 10 |
| Reminder parser | 37 | 5 | 0 | 10 |
| Calendar parser | 27 | 2 | 0 | 6 |
| Shared NLP infra | 2 | 0 | 0 | 0 |

Key takeaways:

- The parser system is self-contained within `src/lib/nlp` and `src/lib/calendar-nlp`; no imports cross into the wider Hub OS app.
- Shared-core candidates are `src/lib/nlp/shared/{constants.ts,types.ts,title-utils.ts,utils.ts}`. The calendar parser currently uses the shared title/constants helpers, and the task parser also depends on `src/lib/nlp/intent/index.ts`.
- The only third-party package used directly by the audited parser system is `chrono-node`.
