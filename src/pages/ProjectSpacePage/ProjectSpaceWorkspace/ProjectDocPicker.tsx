import type { ReactElement } from 'react';
import type { HubProjectDoc, HubProjectSummary } from '../../../services/hub/types';

export interface ProjectDocPickerProps {
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  activeProjectDocId: string | null;
  onSelectProjectDoc: (docId: string) => void;
  onCreateProjectDoc: (title: string) => Promise<HubProjectDoc | null>;
  onUpdateProjectDoc: (docId: string, patch: { title?: string; position?: number }) => Promise<HubProjectDoc>;
  onDeleteProjectDoc: (docId: string) => Promise<void>;
}

export const ProjectDocPicker = ({
  activeProject,
  activeProjectDocId,
  onSelectProjectDoc,
}: ProjectDocPickerProps): ReactElement => {
  const docs = activeProject?.docs ?? [];
  return (
    <select
      className="rounded-control border border-border-muted bg-surface px-2 py-1 text-sm text-text"
      aria-label="Project doc"
      value={activeProjectDocId ?? docs[0]?.doc_id ?? ''}
      onChange={(event) => onSelectProjectDoc(event.target.value)}
      disabled={!activeProject}
    >
      {docs.map((doc) => (
        <option key={doc.doc_id} value={doc.doc_id}>
          {doc.title || 'Untitled'}
        </option>
      ))}
    </select>
  );
};
