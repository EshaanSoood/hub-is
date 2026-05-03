import { useEffect, useRef, useState, type ComponentProps, type ReactElement } from 'react';
import { WorkspaceDocSurface } from './WorkspaceDocSurface';
import type { HubProjectDoc, HubProjectSummary } from '../../services/hub/types';

type WorkspaceDocProps = ComponentProps<typeof WorkspaceDocSurface>;

interface ProjectDocsTabProps {
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  activeProjectDocId: string | null;
  onSelectProjectDoc: (docId: string) => void;
  workspaceDocProps: WorkspaceDocProps;
}

const formatDocMetadata = () => 'Unknown';

export const ProjectDocsTab = ({
  activeProject,
  activeProjectCanEdit,
  activeProjectDocId,
  onSelectProjectDoc,
  workspaceDocProps,
}: ProjectDocsTabProps): ReactElement => {
  const [openedDocId, setOpenedDocId] = useState<string | null>(null);
  const [restoreDocId, setRestoreDocId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const docs = activeProject?.docs ?? [];
  const openedDoc = openedDocId ? docs.find((doc) => doc.doc_id === openedDocId) ?? null : null;
  const selectedDocReady = Boolean(openedDoc && activeProjectDocId === openedDoc.doc_id);

  useEffect(() => {
    if (!selectedDocReady) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const panel = document.getElementById('project-doc-editor-panel');
      const editor = panel?.querySelector<HTMLElement>('[contenteditable="true"]');
      if (editor) {
        editor.focus();
        return;
      }
      panel?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedDocReady]);

  useEffect(() => {
    if (openedDocId || !restoreDocId) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      rowRefs.current[restoreDocId]?.focus();
      setRestoreDocId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openedDocId, restoreDocId]);

  const openDoc = (doc: HubProjectDoc) => {
    onSelectProjectDoc(doc.doc_id);
    setOpenedDocId(doc.doc_id);
  };

  if (!activeProject) {
    return (
      <section className="rounded-panel border border-subtle bg-elevated p-4">
        <p className="text-sm text-muted">No project selected.</p>
      </section>
    );
  }

  if (openedDoc) {
    return (
      <section id="project-doc-editor-panel" tabIndex={-1} className="space-y-3 focus-visible:outline-none">
        <button
          type="button"
          className="interactive interactive-fold rounded-control border border-border-muted bg-surface px-3 py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => {
            setRestoreDocId(openedDoc.doc_id);
            setOpenedDocId(null);
          }}
        >
          Back to docs
        </button>
        {selectedDocReady ? (
          <WorkspaceDocSurface
            {...workspaceDocProps}
            activeProjectCanEdit={activeProjectCanEdit}
            workspaceEnabled
          />
        ) : (
          <p role="status" aria-live="polite" className="text-sm text-muted">Opening document...</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-panel border border-subtle bg-elevated p-4" aria-labelledby="project-docs-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="project-docs-heading" className="heading-3 text-text">Docs</h3>
          <p className="mt-1 text-sm text-muted">Project documents.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-muted">
              <th scope="col" className="border-b border-border-muted px-3 py-2">Name</th>
              <th scope="col" className="border-b border-border-muted px-3 py-2">Last Edited</th>
              <th scope="col" className="border-b border-border-muted px-3 py-2">Date Created</th>
              <th scope="col" className="border-b border-border-muted px-3 py-2">Created By</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.doc_id} className="border-b border-border-muted">
                <td className="border-b border-border-muted px-3 py-2">
                  <button
                    ref={(node) => {
                      rowRefs.current[doc.doc_id] = node;
                    }}
                    type="button"
                    className="text-left font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    onClick={() => openDoc(doc)}
                  >
                    {doc.title || 'Untitled'}
                  </button>
                </td>
                <td className="border-b border-border-muted px-3 py-2 text-muted">{formatDocMetadata()}</td>
                <td className="border-b border-border-muted px-3 py-2 text-muted">{formatDocMetadata()}</td>
                <td className="border-b border-border-muted px-3 py-2 text-muted">{formatDocMetadata()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {docs.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No documents yet.</p>
      ) : null}
    </section>
  );
};
