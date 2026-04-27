import type { KeyboardEvent } from 'react';

interface DocCommentItem {
  comment_id: string;
  body_json: Record<string, unknown>;
  status: 'open' | 'resolved';
  created_at: string;
  anchor_payload?: {
    kind: 'node';
    nodeKey: string;
    context?: Record<string, unknown> | null;
  };
  orphaned?: boolean;
  is_orphaned?: boolean;
}

interface CommentRailProps {
  comments: DocCommentItem[];
  orphanedComments: DocCommentItem[];
  onToggleStatus: (commentId: string, status: 'open' | 'resolved') => void;
  onJumpToComment: (comment: DocCommentItem) => void;
  showResolved: boolean;
  onToggleShowResolved: () => void;
}

const readPlainComment = (bodyJson: Record<string, unknown>): string => {
  const text = bodyJson.text;
  if (typeof text === 'string') {
    return text;
  }
  const content = bodyJson.content;
  if (typeof content === 'string') {
    return content;
  }
  return JSON.stringify(bodyJson);
};

const handleListEnter = (event: KeyboardEvent<HTMLButtonElement>, activate: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activate();
  }
};

export const CommentRail = ({
  comments,
  orphanedComments,
  onToggleStatus,
  onJumpToComment,
  showResolved,
  onToggleShowResolved,
}: CommentRailProps) => {
  const openComments = comments.filter((comment) => comment.status === 'open');
  const resolvedComments = comments.filter((comment) => comment.status === 'resolved');

  return (
    <section className="widget-sheet p-4" aria-label="Doc comments">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="heading-3 text-text">Doc comments</h3>
        <button
          type="button"
          className="ghost-button bg-surface px-2 py-1 text-xs font-semibold text-primary"
          onClick={onToggleShowResolved}
          aria-label={showResolved ? 'Hide resolved comments' : 'Show resolved comments'}
        >
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>

      <ul className="mt-3 space-y-2" aria-label="Open comment threads">
        {openComments.map((comment) => (
          <li key={comment.comment_id} className="paper-card p-3">
            <button
              type="button"
              className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => onJumpToComment(comment)}
              onKeyDown={(event) => handleListEnter(event, () => onJumpToComment(comment))}
              aria-label={`Comment on block ${comment.anchor_payload?.nodeKey || 'unknown block'}`}
            >
              <p className="text-sm text-text">{readPlainComment(comment.body_json)}</p>
              <p className="mt-1 text-xs text-muted">
                Block: {comment.anchor_payload?.nodeKey || 'unknown'} · {new Date(comment.created_at).toLocaleString()}
              </p>
            </button>
            <button
              type="button"
              className="ghost-button mt-2 bg-surface px-2 py-1 text-xs font-semibold text-primary"
              onClick={() => onToggleStatus(comment.comment_id, 'resolved')}
              aria-label="Resolve comment"
            >
              Resolve
            </button>
          </li>
        ))}
      </ul>

      {showResolved ? (
        <ul className="mt-2 space-y-2" aria-label="Resolved comment threads">
          {resolvedComments.map((comment) => (
            <li key={comment.comment_id} className="paper-card p-3">
              <button
                type="button"
                className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                onClick={() => onJumpToComment(comment)}
                onKeyDown={(event) => handleListEnter(event, () => onJumpToComment(comment))}
                aria-label={`Resolved comment on block ${comment.anchor_payload?.nodeKey || 'unknown block'}`}
              >
                <p className="text-sm text-text">{readPlainComment(comment.body_json)}</p>
                <p className="mt-1 text-xs text-muted">
                  Block: {comment.anchor_payload?.nodeKey || 'unknown'} · {new Date(comment.created_at).toLocaleString()}
                </p>
              </button>
              <button
                type="button"
                className="ghost-button mt-2 bg-surface px-2 py-1 text-xs font-semibold text-primary"
                onClick={() => onToggleStatus(comment.comment_id, 'open')}
                aria-label="Reopen comment"
              >
                Reopen
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {orphanedComments.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-primary">Orphaned comments</h4>
          <ul className="mt-2 space-y-2" aria-label="Orphaned comments">
            {orphanedComments.map((comment) => (
              <li key={comment.comment_id} className="paper-card p-3">
                <p className="text-sm text-text">{readPlainComment(comment.body_json)}</p>
                <p className="mt-1 text-xs text-muted">
                  Missing block: {comment.anchor_payload?.nodeKey || 'unknown'} · {new Date(comment.created_at).toLocaleString()}
                </p>
                <button
                  type="button"
                  className="ghost-button mt-2 bg-surface px-2 py-1 text-xs font-semibold text-primary"
                  onClick={() => onToggleStatus(comment.comment_id, comment.status === 'open' ? 'resolved' : 'open')}
                  aria-label={comment.status === 'open' ? 'Resolve orphaned comment' : 'Reopen orphaned comment'}
                >
                  {comment.status === 'open' ? 'Resolve' : 'Reopen'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
