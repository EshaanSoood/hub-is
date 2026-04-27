import { FileInspectorActionBar } from '../FileInspectorActionBar';
import { Icon } from '../../primitives';
import type { FormEvent, ReactElement } from 'react';
import type { HubProjectSummary } from '../../../services/hub/types';
import type { HubRecordDetail } from '../../../shared/api-types/records';

interface RecordInspectorAttachmentsSectionProps {
  attachments: HubRecordDetail['attachments'];
  projects: HubProjectSummary[];
  selectedAttachmentId: string | null;
  inspectorMutationProjectCanEdit: boolean;
  uploadingAttachment: boolean;
  setSelectedAttachmentId: (attachmentId: string | null) => void;
  onRenameAttachment: (attachmentId: string, nextName: string) => Promise<void>;
  onMoveAttachment: (attachmentId: string, projectIdToMove: string) => Promise<void>;
  onDetachAttachment: (attachmentId: string) => Promise<void>;
  onAttachFile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export const RecordInspectorAttachmentsSection = ({
  attachments,
  projects,
  selectedAttachmentId,
  inspectorMutationProjectCanEdit,
  uploadingAttachment,
  setSelectedAttachmentId,
  onRenameAttachment,
  onMoveAttachment,
  onDetachAttachment,
  onAttachFile,
}: RecordInspectorAttachmentsSectionProps): ReactElement => {
  const selectedAttachment = selectedAttachmentId
    ? attachments.find((attachment) => attachment.attachment_id === selectedAttachmentId)
    : null;

  return (
    <section className="rounded-panel border border-border-muted p-3">
      <h3 className="text-sm font-semibold text-primary">Attachments</h3>
      {attachments.length > 0 ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {attachments.map((attachment) => {
              const selected = selectedAttachmentId === attachment.attachment_id;
              return (
                <button
                  key={attachment.attachment_id}
                  type="button"
                  onClick={() => setSelectedAttachmentId(attachment.attachment_id)}
                  aria-pressed={selected}
                  className={`rounded-control border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    selected ? 'border-primary text-text bg-primary/10' : 'border-border-muted text-muted bg-transparent'
                  }`}
                >
                  {attachment.name}
                </button>
              );
            })}
          </div>

          {selectedAttachment ? (
            <FileInspectorActionBar
              fileName={selectedAttachment.name || 'Attachment'}
              downloadUrl={selectedAttachment.proxy_url || ''}
              shareableLink={selectedAttachment.proxy_url || ''}
              projects={projects.map((project) => ({ id: project.project_id, name: project.name }))}
              readOnly={!inspectorMutationProjectCanEdit}
              onRename={(nextName) => {
                void onRenameAttachment(selectedAttachment.attachment_id, nextName);
              }}
              onMove={(projectIdToMove) => {
                void onMoveAttachment(selectedAttachment.attachment_id, projectIdToMove);
              }}
              onRemove={() => {
                void onDetachAttachment(selectedAttachment.attachment_id);
              }}
            />
          ) : null}

          <ul className="space-y-1">
            {attachments.map((attachment) => (
              <li key={attachment.attachment_id} className="text-sm text-muted">
                {attachment.name} ({attachment.mime_type})
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No attachments yet.</p>
      )}
      {inspectorMutationProjectCanEdit ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            void onAttachFile(event);
          }}
        >
          <input name="attachment-file" type="file" className="text-xs text-muted" aria-label="Attach file" />
          <button
            type="submit"
            disabled={uploadingAttachment}
            className="inline-flex items-center gap-1 rounded-panel border border-border-muted px-2 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="upload" className="text-[12px]" />
            {uploadingAttachment ? 'Uploading...' : 'Attach'}
          </button>
        </form>
      ) : (
        <p className="mt-2 text-xs text-muted">Attachments are read-only in this project.</p>
      )}
    </section>
  );
};
