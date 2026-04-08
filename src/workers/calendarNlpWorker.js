/* global self */

import { parseEventInput } from '../lib/calendar-nlp/index.ts';

const emptyPreview = (timezone) =>
  parseEventInput('', { timezone });

self.onmessage = (event) => {
  const { requestId, draft, timezone } = event.data ?? {};
  if (typeof requestId !== 'number') {
    return;
  }

  try {
    const preview = draft && String(draft).trim()
      ? parseEventInput(String(draft), { timezone })
      : emptyPreview(timezone);

    self.postMessage({
      requestId,
      parsedDraft: String(draft ?? ''),
      preview,
      error: null,
    });
  } catch {
    self.postMessage({
      requestId,
      parsedDraft: String(draft ?? ''),
      preview: emptyPreview(timezone),
      error: 'Could not parse event details.',
    });
  }
};
