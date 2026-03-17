import { useMemo } from 'react';
import { MentionPicker } from './MentionPicker';
import { appendMentionToken, mentionToken } from '../../features/notes/mentionTokens';
import type { HubMentionTarget } from '../../services/hub/types';

interface CommentComposerProps {
  accessToken: string;
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  submitLabel?: string;
  placeholder?: string;
  nodeKeyLabel?: string | null;
  includeRecordMentions?: boolean;
}

export const CommentComposer = ({
  accessToken,
  projectId,
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled = false,
  submitLabel = 'Submit',
  placeholder = 'Write a comment',
  nodeKeyLabel = null,
  includeRecordMentions = true,
}: CommentComposerProps) => {
  const includeTypes = useMemo(() => (includeRecordMentions ? (['user', 'record'] as const) : (['user'] as const)), [includeRecordMentions]);

  const appendMention = (target: HubMentionTarget) => {
    const token = mentionToken({
      entity_type: target.entity_ref.entity_type as 'user' | 'record',
      entity_id: target.entity_ref.entity_id,
      label: target.label,
    });

    onChange(appendMentionToken(value, token));
  };

  return (
    <div className="space-y-2">
      {nodeKeyLabel ? <p className="text-xs text-muted">Target block: {nodeKeyLabel}</p> : null}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text"
        rows={4}
        placeholder={placeholder}
        aria-label="Comment body"
      />
      <div className="flex flex-wrap items-center gap-2">
        <MentionPicker
          accessToken={accessToken}
          projectId={projectId}
          onSelect={appendMention}
          buttonLabel="@ Mention"
          ariaLabel="Insert mention"
          includeTypes={[...includeTypes]}
        />
        <button
          type="button"
          className="rounded-panel border border-border-muted px-3 py-1.5 text-xs font-semibold text-primary"
          onClick={onSubmit}
          disabled={disabled}
          aria-label={submitLabel}
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="rounded-panel border border-border-muted px-3 py-1.5 text-xs font-semibold text-primary"
            onClick={onCancel}
            aria-label="Cancel comment"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
};
