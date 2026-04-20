import { MentionPicker } from '../MentionPicker';
import type { ComponentProps, FormEvent, ReactElement } from 'react';
import type { HubRecordDetail } from '../../../shared/api-types/records';

type MentionPickerProps = ComponentProps<typeof MentionPicker>;

const readCommentText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => readCommentText(item))
      .filter((item) => item.length > 0)
      .join(' ')
      .trim();
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const text = record.text;
    if (typeof text === 'string') {
      return text;
    }
    return readCommentText(record.content ?? record.children ?? record.value ?? null);
  }
  return '';
};

const readPlainComment = (bodyJson: unknown): string => {
  if (bodyJson == null) {
    return '';
  }

  if (typeof bodyJson !== 'object') {
    return String(bodyJson);
  }

  const record = bodyJson as Record<string, unknown>;
  const text = record.text;
  if (typeof text === 'string') {
    return text;
  }
  const content = record.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const plainContent = readCommentText(content);
    if (plainContent) {
      return plainContent;
    }
  }
  return JSON.stringify(record);
};

export interface RecordInspectorCommentsSectionProps {
  accessToken: string;
  projectId: string;
  comments: HubRecordDetail['comments'];
  inspectorCommentText: string;
  setInspectorCommentText: (nextValue: string) => void;
  onInsertRecordCommentMention: MentionPickerProps['onSelect'];
  onAddRecordComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export const RecordInspectorCommentsSection = ({
  accessToken,
  projectId,
  comments,
  inspectorCommentText,
  setInspectorCommentText,
  onInsertRecordCommentMention,
  onAddRecordComment,
}: RecordInspectorCommentsSectionProps): ReactElement => (
  <section className="rounded-panel border border-border-muted p-3">
    <h3 className="text-sm font-semibold text-primary">Comments + Mentions</h3>
    <ul className="mt-2 space-y-2">
      {comments.length === 0 ? (
        <li className="text-sm text-muted">No comments yet.</li>
      ) : (
        comments.map((comment) => (
          <li key={comment.comment_id} className="rounded-panel border border-border-muted p-2">
            <p className="text-sm text-text">{readPlainComment(comment.body_json)}</p>
            <p className="text-xs text-muted">{comment.status}</p>
          </li>
        ))
      )}
    </ul>

    <form
      className="mt-2 space-y-2"
      onSubmit={(event) => {
        void onAddRecordComment(event);
      }}
    >
      <textarea
        value={inspectorCommentText}
        onChange={(event) => setInspectorCommentText(event.target.value)}
        className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text"
        rows={3}
        placeholder="Type comment. Use mention picker for users/records."
        aria-label="Record comment"
      />
      <div className="flex flex-wrap items-center gap-2">
        <MentionPicker
          accessToken={accessToken}
          projectId={projectId}
          onSelect={onInsertRecordCommentMention}
          buttonLabel="@ Mention"
          ariaLabel="Add mention to record comment"
        />
        <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
          Add comment
        </button>
      </div>
    </form>
  </section>
);
