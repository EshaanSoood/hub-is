import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { createProjectDoc, deleteProjectDoc, updateProjectDoc } from '../services/hub/docs';
import type { HubProjectDoc, HubProjectSummary } from '../services/hub/types';

const sortProjectDocs = (docs: HubProjectDoc[]): HubProjectDoc[] =>
  [...docs].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    return left.doc_id.localeCompare(right.doc_id);
  });

interface UseProjectDocsRuntimeParams {
  accessToken: string;
  activeProject: HubProjectSummary | null;
  setProjects: Dispatch<SetStateAction<HubProjectSummary[]>>;
}

export const useProjectDocsRuntime = ({
  accessToken,
  activeProject,
  setProjects,
}: UseProjectDocsRuntimeParams) => {
  const [activeDocIdByProjectId, setActiveDocIdByProjectId] = useState<Record<string, string>>({});
  const activeProjectDocs = useMemo(
    () => sortProjectDocs(activeProject?.docs ?? []),
    [activeProject?.docs],
  );
  const activeProjectDocId = useMemo(() => {
    if (!activeProject) {
      return null;
    }
    const selectedDocId = activeDocIdByProjectId[activeProject.project_id];
    if (selectedDocId && activeProjectDocs.some((doc) => doc.doc_id === selectedDocId)) {
      return selectedDocId;
    }
    return activeProjectDocs[0]?.doc_id ?? null;
  }, [activeDocIdByProjectId, activeProject, activeProjectDocs]);

  const onSelectProjectDoc = useCallback((docId: string) => {
    if (!activeProject) {
      return;
    }
    setActiveDocIdByProjectId((current) => ({
      ...current,
      [activeProject.project_id]: docId,
    }));
  }, [activeProject]);

  const updateDocsForActiveProject = useCallback((resolveDocs: (currentDocs: HubProjectDoc[]) => HubProjectDoc[]) => {
    if (!activeProject) {
      return;
    }
    setProjects((currentProjects) => currentProjects.map((projectEntry) => (
      projectEntry.project_id === activeProject.project_id
        ? { ...projectEntry, docs: sortProjectDocs(resolveDocs(projectEntry.docs)) }
        : projectEntry
    )));
  }, [activeProject, setProjects]);

  const onCreateProjectDoc = useCallback(async (title: string) => {
    if (!activeProject) {
      return null;
    }
    const createdDoc = await createProjectDoc(accessToken, activeProject.project_id, title);
    updateDocsForActiveProject((currentDocs) => [
      ...currentDocs.filter((doc) => doc.doc_id !== createdDoc.doc_id),
      createdDoc,
    ]);
    setActiveDocIdByProjectId((current) => ({
      ...current,
      [activeProject.project_id]: createdDoc.doc_id,
    }));
    return createdDoc;
  }, [accessToken, activeProject, updateDocsForActiveProject]);

  const onUpdateProjectDoc = useCallback(async (docId: string, patch: { title?: string; position?: number }) => {
    const updatedDoc = await updateProjectDoc(accessToken, docId, patch);
    updateDocsForActiveProject((currentDocs) => currentDocs.map((doc) => (
      doc.doc_id === updatedDoc.doc_id ? updatedDoc : doc
    )));
    return updatedDoc;
  }, [accessToken, updateDocsForActiveProject]);

  const onDeleteProjectDoc = useCallback(async (docId: string) => {
    if (!activeProject) {
      return;
    }
    const result = await deleteProjectDoc(accessToken, docId);
    const nextDocs = sortProjectDocs(result.docs);
    updateDocsForActiveProject(() => nextDocs);
    setActiveDocIdByProjectId((current) => ({
      ...current,
      [activeProject.project_id]: nextDocs[0]?.doc_id ?? '',
    }));
  }, [accessToken, activeProject, updateDocsForActiveProject]);

  return {
    activeProjectDocId,
    activeProjectDocs,
    onSelectProjectDoc,
    onCreateProjectDoc,
    onUpdateProjectDoc,
    onDeleteProjectDoc,
  };
};
