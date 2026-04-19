import { MentionPicker } from '../../../components/project-space/MentionPicker';
import { readPlainComment } from './commentModel';
import type { ComponentProps, FormEvent, ReactElement } from 'react';
import type { HubRecordDetail } from '../../../shared/api-types/records';

type MentionPickerProps = ComponentProps<typeof MentionPicker>;

interface ProjectSpaceInspectorOverlayCommentsSectionProps {
  accessToken: string;
  projectId: string;
  comments: HubRecordDetail['comments'];
  inspectorCommentText: string;
  setInspectorCommentText: (nextValue: string) => void;
  onInsertRecordCommentMention: MentionPickerProps['onSelect'];
  onAddRecordComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export const ProjectSpaceInspectorOverlayCommentsSection = ({
  accessToken,
  projectId,
  comments,
  inspectorCommentText,
  setInspectorCommentText,
  onInsertRecordCommentMention,
  onAddRecordComment,
}: ProjectSpaceInspectorOverlayCommentsSectionProps): ReactElement => (
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
