import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
} from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { Icon, InlineNotice } from '../../../components/primitives';
import { ProjectSwitcher } from '../../../components/project-space/ProjectSwitcher';
import type { HubProjectSummary, HubProjectMember, HubProjectDoc } from '../../../services/hub/types';
import type { FilesWidgetContract, ScratchPadContract } from '../../../components/project-space/widgetContracts';
import type { ProjectLateralSource } from '../../../components/motion/hubMotion';
import { dialogLayoutIds } from '../../../styles/motion';
import { useProjectControlEffects } from '../hooks/useProjectControlEffects';
import { ProjectSpaceProjectSettingsDialog } from './ProjectSpaceProjectSettingsDialog';
import { ProjectToolbarResourceDialogs } from './ProjectToolbarResourceDialogs';
import { HubRequestError } from '../../../services/hub/transport';

const projectToolbarButtonClassName =
  'interactive interactive-fold card-folded inline-flex h-8 items-center justify-center bg-surface-low px-3 text-xs font-semibold text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const projectToolbarIconButtonClassName = `${projectToolbarButtonClassName} w-8 px-0`;

export interface ProjectSpaceProjectChromeProps {
  projectId: string;
  activeProject: HubProjectSummary | null;
  activeProjectDocId: string | null;
  activeProjectCanEdit: boolean;
  canWriteProject: boolean;
  openedFromPinned: boolean;
  orderedEditableProjects: HubProjectSummary[];
  readOnlyProjects: HubProjectSummary[];
  projectMemberList: HubProjectMember[];
  sessionUserId: string;
  activeEditableProjectIndex: number;
  widgetsEnabled: boolean;
  workspaceEnabled: boolean;
  projectMutationError: string | null;
  filesContract: FilesWidgetContract;
  scratchPadContract: ScratchPadContract;
  onNavigateToProject: (params: {
    projectId: string;
    projectName?: string | null;
    projectSource?: ProjectLateralSource;
    query?: string;
    extraState?: unknown;
  }) => void;
  onCreateProject: (name: string) => Promise<HubProjectSummary | null>;
  onMoveProject: (project: HubProjectSummary, direction: 'up' | 'down') => Promise<void>;
  onTogglePinned: (project: HubProjectSummary) => Promise<void>;
  onToggleProjectMember: (project: HubProjectSummary, memberUserId: string) => Promise<void>;
  onDeleteProject: (project: HubProjectSummary) => Promise<void>;
  onUpdateProject: (projectId: string, patch: { name?: string; layout_config?: Record<string, unknown> }) => Promise<void>;
  onToggleActiveProjectRegion: (region: 'widgets_enabled' | 'workspace_enabled') => void;
  onSelectProjectDoc: (docId: string) => void;
  onCreateProjectDoc: (title: string) => Promise<HubProjectDoc | null>;
  onUpdateProjectDoc: (docId: string, patch: { title?: string; position?: number }) => Promise<HubProjectDoc>;
  onDeleteProjectDoc: (docId: string) => Promise<void>;
}

interface ProjectDocPickerProps {
  activeProject: HubProjectSummary | null;
  activeProjectCanEdit: boolean;
  activeProjectDocId: string | null;
  onSelectProjectDoc: (docId: string) => void;
  onCreateProjectDoc: (title: string) => Promise<HubProjectDoc | null>;
  onUpdateProjectDoc: (docId: string, patch: { title?: string; position?: number }) => Promise<HubProjectDoc>;
  onDeleteProjectDoc: (docId: string) => Promise<void>;
}

const sortDocs = (docs: HubProjectDoc[]): HubProjectDoc[] =>
  [...docs].sort((left, right) => {
    if (left.position !== right.position) {
      return left.position - right.position;
    }
    return left.doc_id.localeCompare(right.doc_id);
  });

const ProjectDocPicker = ({
  activeProject,
  activeProjectCanEdit,
  activeProjectDocId,
  onSelectProjectDoc,
  onCreateProjectDoc,
  onUpdateProjectDoc,
  onDeleteProjectDoc,
}: ProjectDocPickerProps): ReactElement => {
  const listboxId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const docs = useMemo(() => sortDocs(activeProject?.docs ?? []), [activeProject?.docs]);
  const activeDoc = docs.find((doc) => doc.doc_id === activeProjectDocId) ?? docs[0] ?? null;
  const addOptionIndex = docs.length;
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('Untitled');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const activeIndex = Math.max(0, docs.findIndex((doc) => doc.doc_id === activeDoc?.doc_id));
    setFocusedIndex(activeIndex);
    window.requestAnimationFrame(() => listboxRef.current?.focus());
  }, [activeDoc?.doc_id, docs, open]);

  useEffect(() => {
    if (adding) {
      window.requestAnimationFrame(() => addInputRef.current?.focus());
    }
  }, [adding]);

  useEffect(() => {
    if (editingDocId) {
      window.requestAnimationFrame(() => renameInputRef.current?.focus());
    }
  }, [editingDocId]);

  const closePicker = useCallback(() => {
    setOpen(false);
    setAdding(false);
    setEditingDocId(null);
    setMutationError(null);
    buttonRef.current?.focus();
  }, []);

  const selectDoc = useCallback((docId: string) => {
    onSelectProjectDoc(docId);
    closePicker();
  }, [closePicker, onSelectProjectDoc]);

  const handleListboxKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const optionCount = docs.length + (activeProjectCanEdit ? 1 : 0);
    if (optionCount === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((current) => Math.min(current + 1, optionCount - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeProjectCanEdit && focusedIndex === addOptionIndex) {
        setAdding(true);
        setNewDocTitle('Untitled');
        return;
      }
      const focusedDoc = docs[focusedIndex];
      if (focusedDoc) {
        selectDoc(focusedDoc.doc_id);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker();
    }
  }, [activeProjectCanEdit, addOptionIndex, closePicker, docs, focusedIndex, selectDoc]);

  const handleCreateDoc = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutationError(null);
    setBusyDocId('new');
    try {
      const createdDoc = await onCreateProjectDoc(newDocTitle.trim() || 'Untitled');
      if (createdDoc) {
        onSelectProjectDoc(createdDoc.doc_id);
      }
      closePicker();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Doc could not be created.');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleRenameDoc = async (event: FormEvent<HTMLFormElement>, docId: string) => {
    event.preventDefault();
    setMutationError(null);
    setBusyDocId(docId);
    try {
      await onUpdateProjectDoc(docId, { title: editingTitle.trim() || 'Untitled' });
      setEditingDocId(null);
      listboxRef.current?.focus();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Doc could not be renamed.');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleDeleteDoc = async (doc: HubProjectDoc) => {
    if (!window.confirm(`Delete "${doc.title}"?`)) {
      return;
    }
    setMutationError(null);
    setBusyDocId(doc.doc_id);
    try {
      await onDeleteProjectDoc(doc.doc_id);
      listboxRef.current?.focus();
    } catch (error) {
      if (error instanceof HubRequestError && error.status === 409) {
        setMutationError('A project must keep at least one doc.');
      } else {
        setMutationError(error instanceof Error ? error.message : 'Doc could not be deleted.');
      }
    } finally {
      setBusyDocId(null);
    }
  };

  const activeLabel = activeDoc?.title || 'Untitled';
  const activeOptionId = focusedIndex === addOptionIndex ? `${listboxId}-add` : `${listboxId}-${docs[focusedIndex]?.doc_id ?? 'empty'}`;

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        className={`${projectToolbarButtonClassName} min-w-32 justify-between gap-2`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active doc: ${activeLabel}`}
        onClick={() => {
          setOpen((current) => !current);
          setMutationError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        disabled={!activeProject || docs.length === 0}
      >
        <span className="truncate">{activeLabel}</span>
        <Icon name="chevron-down" className="text-[14px]" />
      </button>
      {open ? (
        <div className="absolute left-0 top-10 z-30 w-72 rounded-panel border border-border-muted bg-elevated p-2 shadow-soft">
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={activeOptionId}
            className="max-h-72 overflow-y-auto focus-visible:outline-none"
            onKeyDown={handleListboxKeyDown}
          >
            {docs.map((doc, index) => {
              const selected = doc.doc_id === activeProjectDocId;
              const focused = index === focusedIndex;
              const editing = editingDocId === doc.doc_id;
              return (
                <div
                  key={doc.doc_id}
                  id={`${listboxId}-${doc.doc_id}`}
                  role="option"
                  aria-selected={selected}
                  className={`flex min-h-10 items-center gap-2 rounded-control px-2 py-1 text-sm ${
                    focused ? 'bg-surface' : ''
                  }`}
                  tabIndex={-1}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !editing) {
                      event.preventDefault();
                      selectDoc(doc.doc_id);
                    }
                  }}
                  onClick={() => {
                    if (!editing) {
                      selectDoc(doc.doc_id);
                    }
                  }}
                >
                  {editing ? (
                    <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(event) => void handleRenameDoc(event, doc.doc_id)}>
                      <input
                        ref={renameInputRef}
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.stopPropagation();
                            closePicker();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-control border border-border-muted bg-surface px-2 py-1 text-sm text-text"
                        aria-label="Doc title"
                      />
                      <button
                        type="submit"
                        className={projectToolbarIconButtonClassName}
                        aria-label="Save doc title"
                        disabled={busyDocId === doc.doc_id}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Icon name="checkmark" className="text-[14px]" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left text-text">{doc.title || 'Untitled'}</span>
                      {activeProjectCanEdit ? (
                        <span className="inline-flex gap-1">
                          <button
                            type="button"
                            className={projectToolbarIconButtonClassName}
                            aria-label={`Rename ${doc.title || 'Untitled'}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingDocId(doc.doc_id);
                              setEditingTitle(doc.title || 'Untitled');
                            }}
                          >
                            <Icon name="edit" className="text-[14px]" />
                          </button>
                          <button
                            type="button"
                            className={projectToolbarIconButtonClassName}
                            aria-label={`Delete ${doc.title || 'Untitled'}`}
                            disabled={busyDocId === doc.doc_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteDoc(doc);
                            }}
                          >
                            <Icon name="trash" className="text-[14px]" />
                          </button>
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
            {activeProjectCanEdit ? (
              <div
                id={`${listboxId}-add`}
                role="option"
                aria-selected="false"
                tabIndex={-1}
                className={`mt-1 rounded-control px-2 py-1 ${focusedIndex === addOptionIndex ? 'bg-surface' : ''}`}
                onMouseEnter={() => setFocusedIndex(addOptionIndex)}
              >
                {adding ? (
                  <form className="flex items-center gap-1" onSubmit={handleCreateDoc}>
                    <input
                      ref={addInputRef}
                      value={newDocTitle}
                      onChange={(event) => setNewDocTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.stopPropagation();
                          closePicker();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-control border border-border-muted bg-surface px-2 py-1 text-sm text-text"
                      aria-label="New doc title"
                    />
                    <button type="submit" className={projectToolbarIconButtonClassName} aria-label="Create doc" disabled={busyDocId === 'new'}>
                      <Icon name="checkmark" className="text-[14px]" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="flex min-h-8 w-full items-center gap-2 text-left text-sm font-semibold text-primary"
                    onClick={() => {
                      setAdding(true);
                      setNewDocTitle('Untitled');
                    }}
                  >
                    <Icon name="plus" className="text-[14px]" />
                    <span>Add doc</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
          {mutationError ? (
            <InlineNotice variant="danger" className="mt-2" title="Doc update failed">
              {mutationError}
            </InlineNotice>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const ProjectSpaceWorkProjectChrome = ({
  projectId,
  activeProject,
  activeProjectDocId,
  activeProjectCanEdit,
  canWriteProject,
  openedFromPinned,
  orderedEditableProjects,
  readOnlyProjects,
  projectMemberList,
  sessionUserId,
  activeEditableProjectIndex,
  widgetsEnabled,
  workspaceEnabled,
  projectMutationError,
  filesContract,
  scratchPadContract,
  onNavigateToProject,
  onCreateProject,
  onMoveProject,
  onTogglePinned,
  onToggleProjectMember,
  onDeleteProject,
  onUpdateProject,
  onToggleActiveProjectRegion,
  onSelectProjectDoc,
  onCreateProjectDoc,
  onUpdateProjectDoc,
  onDeleteProjectDoc,
}: ProjectSpaceProjectChromeProps): ReactElement => {
  const prefersReducedMotion = useReducedMotion();
  const [creatingProjectName, setCreatingProjectName] = useState('');
  const [showCreateProjectControl, setShowCreateProjectControl] = useState(false);
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(!openedFromPinned);
  const [showOtherProjects, setShowOtherProjects] = useState(false);
  const [otherProjectQuery, setOtherProjectQuery] = useState('');
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const previousOpenedFromPinnedRef = useRef(openedFromPinned);
  const createProjectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const projectSettingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createProjectNameInputRef = useRef<HTMLInputElement | null>(null);

  useProjectControlEffects({
    openedFromPinned,
    previousOpenedFromPinnedRef,
    setShowProjectSwitcher,
    showCreateProjectControl,
    createProjectNameInputRef,
  });

  const filteredReadOnlyProjects = useMemo(() => {
    const query = otherProjectQuery.trim().toLowerCase();
    if (!query) {
      return readOnlyProjects;
    }
    return readOnlyProjects.filter((project) => project.name.toLowerCase().includes(query));
  }, [otherProjectQuery, readOnlyProjects]);

  const handleProjectSettingsOpenChange = useCallback(
    (nextOpen: boolean) => {
      setProjectSettingsOpen(nextOpen);
    },
    [],
  );

  const onCreateProjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = creatingProjectName.trim();
    if (!trimmedName) {
      return;
    }
    const nextProject = await onCreateProject(trimmedName);
    if (!nextProject) {
      return;
    }

    setCreatingProjectName('');
    setShowCreateProjectControl(false);
    createProjectTriggerRef.current?.focus();
    onNavigateToProject({
      projectId: nextProject.space_id,
      projectName: nextProject.name,
      projectSource: 'click',
    });
  };

  return (
    <div className="rounded-panel border border-subtle bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="heading-3 text-primary">Projects</h2>
        <div className="flex flex-wrap gap-2">
          {openedFromPinned ? (
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setShowProjectSwitcher((current) => !current)}
              aria-expanded={showProjectSwitcher}
              aria-label={showProjectSwitcher ? 'Hide project switcher' : 'Show project switcher'}
            >
              {showProjectSwitcher ? 'Hide project switcher' : 'Show project switcher'}
            </button>
          ) : null}
          {readOnlyProjects.length > 0 ? (
            <button
              type="button"
              className="rounded-control border border-border-muted px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={() => setShowOtherProjects((current) => !current)}
              aria-expanded={showOtherProjects}
            >
              {showOtherProjects ? 'Hide other projects' : `Other projects (${readOnlyProjects.length})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {showProjectSwitcher ? (
            <div className="min-w-0 flex-1 overflow-x-auto">
              <ProjectSwitcher
                projects={orderedEditableProjects.map((project, index) => ({
                  id: project.project_id,
                  label: project.name,
                  shortcutNumber: index + 1,
                }))}
                activeProjectId={activeProject?.project_id ?? null}
                onProjectChange={(nextProjectId, source) => {
                  const nextProject = orderedEditableProjects.find((project) => project.project_id === nextProjectId) || null;
                  onNavigateToProject({
                    projectId: nextProjectId,
                    projectName: nextProject?.name,
                    projectSource: source,
                  });
                }}
                onMoveProject={(projectIdToMove, direction) => {
                  const project = orderedEditableProjects.find((entry) => entry.project_id === projectIdToMove);
                  if (project) {
                    void onMoveProject(project, direction);
                  }
                }}
              />
            </div>
          ) : openedFromPinned ? (
            <p className="text-xs text-muted">Project switcher hidden. Use the focusable toggle above to reveal it.</p>
          ) : null}
          <ProjectDocPicker
            activeProject={activeProject}
            activeProjectCanEdit={activeProjectCanEdit}
            activeProjectDocId={activeProjectDocId}
            onSelectProjectDoc={onSelectProjectDoc}
            onCreateProjectDoc={onCreateProjectDoc}
            onUpdateProjectDoc={onUpdateProjectDoc}
            onDeleteProjectDoc={onDeleteProjectDoc}
          />
          {canWriteProject ? (
            <button
              ref={createProjectTriggerRef}
              type="button"
              className={projectToolbarButtonClassName}
              aria-expanded={showCreateProjectControl}
              onClick={() => setShowCreateProjectControl((current) => !current)}
            >
              New project
            </button>
          ) : null}
          <ProjectToolbarResourceDialogs
            activeProject={activeProject}
            activeProjectCanEdit={activeProjectCanEdit}
            filesContract={filesContract}
            scratchPadContract={scratchPadContract}
            buttonClassName={projectToolbarButtonClassName}
          />
          <motion.div
            layoutId={!prefersReducedMotion && projectSettingsOpen ? dialogLayoutIds.projectSettings : undefined}
            className="inline-flex"
          >
            <button
              ref={projectSettingsTriggerRef}
              type="button"
              className={projectToolbarIconButtonClassName}
              aria-label="Project settings"
              aria-expanded={projectSettingsOpen}
              onClick={() => setProjectSettingsOpen(true)}
              disabled={!activeProject}
            >
              <Icon name="settings" className="text-[14px]" />
            </button>
          </motion.div>
        </div>

        {showCreateProjectControl && canWriteProject ? (
          <form className="flex flex-wrap items-center gap-2" onSubmit={onCreateProjectSubmit}>
            <input
              ref={createProjectNameInputRef}
              value={creatingProjectName}
              onChange={(event) => setCreatingProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setShowCreateProjectControl(false);
                  createProjectTriggerRef.current?.focus();
                }
              }}
              className="rounded-panel border border-border-muted bg-surface px-3 py-1.5 text-sm text-text"
              placeholder="New project name"
              aria-label="New project name"
            />
            <button type="submit" className="rounded-panel border border-border-muted px-3 py-1.5 text-sm font-semibold text-primary">
              Create project
            </button>
          </form>
        ) : null}

        {showOtherProjects ? (
          <div className="rounded-panel border border-border-muted bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Other projects</h3>
              <input
                value={otherProjectQuery}
                onChange={(event) => setOtherProjectQuery(event.target.value)}
                className="rounded-panel border border-border-muted bg-surface-elevated px-2 py-1 text-xs text-text"
                placeholder="Search projects"
                aria-label="Search read-only projects"
              />
            </div>
            <div className="mt-3 space-y-2">
              {filteredReadOnlyProjects.length === 0 ? (
                <p className="text-sm text-muted">No matching read-only projects.</p>
              ) : (
                filteredReadOnlyProjects.map((project) => (
                  <button
                    key={project.project_id}
                    type="button"
                    onClick={() => {
                      onNavigateToProject({
                        projectId: project.project_id,
                        projectName: project.name,
                        projectSource: 'click',
                      });
                    }}
                    className="flex w-full items-center justify-between rounded-panel border border-border-muted px-3 py-2 text-left"
                  >
                    <span className="text-sm font-medium text-text">{project.name}</span>
                    <span className="text-xs text-muted">Read only</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
      {projectMutationError ? (
        <InlineNotice variant="danger" className="mt-2" title="Project update failed">
          {projectMutationError}
        </InlineNotice>
      ) : null}

      {activeProject ? (
        <Dialog open={projectSettingsOpen} onOpenChange={handleProjectSettingsOpenChange}>
          <DialogContent
            open={projectSettingsOpen}
            animated
            layoutId={dialogLayoutIds.projectSettings}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              projectSettingsTriggerRef.current?.focus();
            }}
          >
            <ProjectSpaceProjectSettingsDialog
              projectId={projectId}
              activeProject={activeProject}
              activeProjectCanEdit={activeProjectCanEdit}
              activeEditableProjectIndex={activeEditableProjectIndex}
              orderedEditableProjects={orderedEditableProjects}
              projectMemberList={projectMemberList}
              sessionUserId={sessionUserId}
              widgetsEnabled={widgetsEnabled}
              workspaceEnabled={workspaceEnabled}
              onRequestClose={() => handleProjectSettingsOpenChange(false)}
              onTogglePinned={onTogglePinned}
              onMoveProject={onMoveProject}
              onToggleProjectMember={onToggleProjectMember}
              onDeleteProject={onDeleteProject}
              onUpdateProject={onUpdateProject}
              onToggleActiveProjectRegion={onToggleActiveProjectRegion}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};
