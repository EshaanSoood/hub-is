import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Icon, InlineNotice } from '../../../components/primitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/project-space/ProjectSpaceDialogPrimitives';
import { HubRequestError } from '../../../services/hub/transport';
import type { HubProjectDoc, HubProjectSummary } from '../../../services/hub/types';

const projectToolbarButtonClassName =
  'interactive interactive-fold card-folded inline-flex h-8 items-center justify-center bg-surface-low px-3 text-xs font-semibold text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const projectToolbarIconButtonClassName = `${projectToolbarButtonClassName} w-8 px-0`;

export interface ProjectDocPickerProps {
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

export const ProjectDocPicker = ({
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
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreDeleteButtonFocusRef = useRef(true);
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
  const [docPendingDeletion, setDocPendingDeletion] = useState<HubProjectDoc | null>(null);

  const focusedDoc = docs[focusedIndex] ?? activeDoc;
  const actionDoc = focusedDoc && focusedIndex !== addOptionIndex ? focusedDoc : activeDoc;
  const activeLabel = activeDoc?.title || 'Untitled';
  const activeOptionId = focusedIndex === addOptionIndex ? `${listboxId}-add` : `${listboxId}-${docs[focusedIndex]?.doc_id ?? 'empty'}`;

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
    setDocPendingDeletion(null);
    buttonRef.current?.focus();
  }, []);

  const selectDoc = useCallback((docId: string) => {
    onSelectProjectDoc(docId);
    closePicker();
  }, [closePicker, onSelectProjectDoc]);

  const openAddForm = useCallback(() => {
    setAdding(true);
    setEditingDocId(null);
    setNewDocTitle('Untitled');
  }, []);

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
        openAddForm();
        return;
      }
      const selectedDoc = docs[focusedIndex];
      if (selectedDoc) {
        selectDoc(selectedDoc.doc_id);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker();
    }
  }, [activeProjectCanEdit, addOptionIndex, closePicker, docs, focusedIndex, openAddForm, selectDoc]);

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

  const handleRenameDoc = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingDocId) {
      return;
    }
    setMutationError(null);
    setBusyDocId(editingDocId);
    try {
      await onUpdateProjectDoc(editingDocId, { title: editingTitle.trim() || 'Untitled' });
      setEditingDocId(null);
      listboxRef.current?.focus();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Doc could not be renamed.');
    } finally {
      setBusyDocId(null);
    }
  };

  const requestDeleteDoc = useCallback((doc: HubProjectDoc) => {
    setMutationError(null);
    if (docs.length <= 1) {
      setMutationError('A project must keep at least one doc.');
      return;
    }
    setAdding(false);
    setEditingDocId(null);
    restoreDeleteButtonFocusRef.current = true;
    setDocPendingDeletion(doc);
  }, [docs.length]);

  const closeDeleteDialog = useCallback(() => {
    setDocPendingDeletion(null);
    window.requestAnimationFrame(() => deleteButtonRef.current?.focus());
  }, []);

  const confirmDeleteDoc = async () => {
    if (!docPendingDeletion) {
      return;
    }
    setMutationError(null);
    setBusyDocId(docPendingDeletion.doc_id);
    try {
      await onDeleteProjectDoc(docPendingDeletion.doc_id);
      restoreDeleteButtonFocusRef.current = false;
      setDocPendingDeletion(null);
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
        disabled={!activeProject}
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
              return (
                <div
                  key={doc.doc_id}
                  id={`${listboxId}-${doc.doc_id}`}
                  role="option"
                  aria-selected={selected}
                  className={`flex min-h-10 items-center rounded-control px-2 py-1 text-sm ${
                    focused ? 'bg-surface' : ''
                  }`}
                  tabIndex={-1}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectDoc(doc.doc_id);
                    }
                  }}
                  onClick={() => selectDoc(doc.doc_id)}
                >
                  <span className="min-w-0 flex-1 truncate text-left text-text">{doc.title || 'Untitled'}</span>
                </div>
              );
            })}
            {activeProjectCanEdit ? (
              <div
                id={`${listboxId}-add`}
                role="option"
                aria-selected="false"
                tabIndex={-1}
                className={`mt-1 flex min-h-10 items-center gap-2 rounded-control px-2 py-1 text-sm font-semibold text-primary ${
                  focusedIndex === addOptionIndex ? 'bg-surface' : ''
                }`}
                onMouseEnter={() => setFocusedIndex(addOptionIndex)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openAddForm();
                  }
                }}
                onClick={openAddForm}
              >
                <Icon name="plus" className="text-[14px]" />
                <span>Add doc</span>
              </div>
            ) : null}
          </div>

          {activeProjectCanEdit && actionDoc ? (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-muted pt-2">
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{actionDoc.title || 'Untitled'}</span>
              <button
                type="button"
                className={projectToolbarIconButtonClassName}
                aria-label={`Rename ${actionDoc.title || 'Untitled'}`}
                onClick={() => {
                  setAdding(false);
                  setEditingDocId(actionDoc.doc_id);
                  setEditingTitle(actionDoc.title || 'Untitled');
                }}
              >
                <Icon name="edit" className="text-[14px]" />
              </button>
              <button
                ref={deleteButtonRef}
                type="button"
                className={projectToolbarIconButtonClassName}
                aria-label={`Delete ${actionDoc.title || 'Untitled'}`}
                disabled={busyDocId === actionDoc.doc_id}
                onClick={() => requestDeleteDoc(actionDoc)}
              >
                <Icon name="trash" className="text-[14px]" />
              </button>
            </div>
          ) : null}

          {adding ? (
            <form className="mt-2 flex items-center gap-1 border-t border-border-muted pt-2" onSubmit={handleCreateDoc}>
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
          ) : null}

          {editingDocId ? (
            <form className="mt-2 flex items-center gap-1 border-t border-border-muted pt-2" onSubmit={handleRenameDoc}>
              <input
                ref={renameInputRef}
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
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
                disabled={busyDocId === editingDocId}
              >
                <Icon name="checkmark" className="text-[14px]" />
              </button>
            </form>
          ) : null}

          {mutationError ? (
            <InlineNotice variant="danger" className="mt-2" title="Doc update failed">
              {mutationError}
            </InlineNotice>
          ) : null}
        </div>
      ) : null}

      <Dialog open={Boolean(docPendingDeletion)} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDeleteDialog();
        }
      }}>
        <DialogContent
          open={Boolean(docPendingDeletion)}
          className="dialog-panel-compact-size"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restoreDeleteButtonFocusRef.current) {
              deleteButtonRef.current?.focus();
              return;
            }
            listboxRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              This will permanently delete {docPendingDeletion?.title || 'Untitled'}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-control border border-border-muted bg-surface-low px-3 py-2 text-sm font-semibold text-secondary hover:bg-surface-container hover:text-secondary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              autoFocus
              onClick={closeDeleteDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              className="interactive interactive-fold rounded-control bg-danger px-3 py-2 text-sm font-semibold text-on-primary hover:bg-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!docPendingDeletion || busyDocId === docPendingDeletion.doc_id}
              onClick={() => void confirmDeleteDoc()}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
