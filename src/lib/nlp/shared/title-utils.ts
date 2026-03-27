import { normalizeWhitespace } from './utils.ts';

export const stripReminderLeadPrefix = (input: string): string => {
  let output = normalizeWhitespace(input);
  let previous = '';
  while (output !== previous) {
    previous = output;
    output = normalizeWhitespace(
      output.replace(
        /^(?:remind\s+me\s+to|remind\s+me|don'?t\s+forget\s+to|don'?t\s+let\s+me\s+forget\s+to|dont\s+forget\s+to|dont\s+let\s+me\s+forget\s+to)\b[\s,:-]*/i,
        ' ',
      ),
    );
  }
  return output;
};

export const stripTrailingDanglingPreposition = (input: string): string => {
  let output = normalizeWhitespace(input);
  let previous = '';
  while (output !== previous) {
    previous = output;
    output = normalizeWhitespace(output.replace(/\b(?:for|to|by|with|at|on|in|from)\b[.,;:!?-]*$/i, ' '));
  }
  return output;
};

export const stripLeadingTitleFiller = (input: string): string => {
  let output = normalizeWhitespace(input);
  let previous = '';
  while (output !== previous) {
    previous = output;
    output = normalizeWhitespace(output.replace(/^(?:to(?:\s+the)?|that(?:\s+i)?|about)\b[\s,:-]*/i, ' '));
  }
  return output;
};
