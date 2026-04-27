import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { useLongPress } from '../../hooks/useLongPress';
import { useWidgetInsertState, type WidgetInsertState } from './hooks/useWidgetInsertState';
import { Icon } from '../primitives';
import { WidgetEmptyState } from './WidgetFeedback';

interface ScratchPadEntry {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string | null;
  archived: boolean;
}

interface ScratchPadSkinProps {
  sizeTier: 'S' | 'M' | 'L';
  storageKey: string;
  legacyStorageKey?: string;
  legacyStorageKeys?: string[];
  initialEntries?: ScratchPadEntry[];
  onInsertToEditor?: (item: { id: string; type: string; title: string }) => void;
  readOnly?: boolean;
  previewMode?: boolean;
}

const parseEntries = (raw: string | null): ScratchPadEntry[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): ScratchPadEntry | null => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const value = item as Record<string, unknown>;
        const rawText =
          typeof value.text === 'string'
            ? value.text
            : typeof value.previewText === 'string'
              ? value.previewText
              : '';
        const text = rawText.trim();
        if (!text || typeof value.id !== 'string' || typeof value.createdAt !== 'string') {
          return null;
        }

        return {
          id: value.id,
          text,
          createdAt: value.createdAt,
          updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
          archived: Boolean(value.archived || value.actioned),
        };
      })
      .filter((entry): entry is ScratchPadEntry => Boolean(entry));
  } catch {
    return [];
  }
};

function readEntriesForStorageKey(
  storageKey: string,
  legacyStorageKey?: string,
  legacyStorageKeys: string[] = [],
): ScratchPadEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const current = window.localStorage.getItem(storageKey);
  if (current) {
    return parseEntries(current);
  }

  const legacyKeys = [legacyStorageKey, ...legacyStorageKeys].filter((key): key is string => Boolean(key));
  for (const legacyKey of legacyKeys) {
    const entries = parseEntries(window.localStorage.getItem(legacyKey));
    if (entries.length > 0) {
      return entries;
    }
  }

  return [];
}

const clipPreview = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return 'Untitled scratch note';
  }
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return `${trimmed.slice(0, 117)}...`;
};

const ScratchPadEditor = ({
  value,
  rows,
  placeholder,
  saveLabel,
  readOnly = false,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  rows: number;
  placeholder: string;
  saveLabel: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel?: () => void;
}) => (
  <div className="paper-card">
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      readOnly={readOnly}
      className="w-full resize-y border-0 bg-transparent px-sm py-sm text-sm text-text outline-none placeholder:text-text-secondary"
      placeholder={placeholder}
      aria-label="Scratch Pad editor"
    />
    <div className="widget-rule flex justify-between gap-2 px-xs py-1">
      {onCancel ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={onCancel}
          className="ghost-button bg-surface px-sm py-1 text-xs font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          Cancel
        </button>
      ) : (
        <span />
      )}
        <button
          type="button"
          disabled={readOnly}
          onClick={onSave}
          className="interactive interactive-fold cta-primary px-sm py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {saveLabel}
        </button>
    </div>
  </div>
);

const ScratchPadRow = ({
  entry,
  isEditing,
  draftText,
  onSelect,
  onDraftChange,
  onSaveEdit,
  onArchive,
  onRestore,
  onDelete,
  onCancelEdit,
  showDelete,
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
  readOnly = false,
  previewMode = false,
}: {
  entry: ScratchPadEntry;
  isEditing: boolean;
  draftText: string;
  onSelect: () => void;
  onDraftChange: (value: string) => void;
  onSaveEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onCancelEdit: () => void;
  showDelete: boolean;
  activeItemId: WidgetInsertState['activeItemId'];
  activeItemType: WidgetInsertState['activeItemType'];
  setActiveItem: WidgetInsertState['setActiveItem'];
  clearActiveItem: WidgetInsertState['clearActiveItem'];
  onInsertToEditor?: WidgetInsertState['onInsertToEditor'];
  readOnly?: boolean;
  previewMode?: boolean;
}) => {
  const preview = clipPreview(entry.text);
  const longPressHandlers = useLongPress(() => {
    if (!previewMode && !isEditing) {
      setActiveItem(entry.id, 'quick-thought', preview);
    }
  });
  const showInsertAction = activeItemId === entry.id && activeItemType === 'quick-thought';

  return (
    <div
      className={cn('paper-card relative overflow-hidden px-sm py-xs', entry.archived ? 'opacity-60' : null)}
      {...(!previewMode && !isEditing ? longPressHandlers : {})}
    >
      <div
        aria-hidden="true"
        className={cn(
          'absolute bottom-0 left-0 top-0 w-1 rounded-l-control',
          entry.archived ? 'bg-border-muted' : 'bg-capture-rail',
        )}
      />

      {isEditing ? (
        <ScratchPadEditor
          value={draftText}
          rows={4}
          placeholder="Refine this scratch note..."
          saveLabel="Save"
          readOnly={readOnly}
          onChange={onDraftChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          {previewMode ? (
            <div className="w-full text-left">
              <p className="text-[13px] font-medium text-text">{preview}</p>
              <p className="mt-1 text-[11px] text-text-secondary">
                {entry.updatedAt ? `Updated ${entry.updatedAt}` : entry.createdAt}
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={readOnly}
              onClick={onSelect}
              className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label={entry.archived ? `Archived scratch note: ${preview}` : `Open scratch note: ${preview}`}
            >
            <p className="text-[13px] font-medium text-text">{preview}</p>
            <p className="mt-1 text-[11px] text-text-secondary">
              {entry.updatedAt ? `Updated ${entry.updatedAt}` : entry.createdAt}
            </p>
            </button>
          )}

          {!previewMode ? <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {!entry.archived ? (
              <>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={onSelect}
                  className="ghost-button inline-flex items-center gap-1 bg-surface px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <Icon name="edit" className="text-[12px]" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={onArchive}
                  className="ghost-button bg-surface px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Archive
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={onRestore}
                className="ghost-button bg-surface px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Restore
              </button>
            )}
            {showDelete ? (
              <button
                type="button"
                disabled={readOnly}
                onClick={onDelete}
                className="ghost-button inline-flex items-center gap-1 bg-surface px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Icon name="trash" className="text-[12px]" />
                Delete
              </button>
            ) : null}
          </div> : null}
          {showInsertAction && !previewMode ? (
            <button
              type="button"
              data-widget-insert-ignore="true"
              onClick={() => {
                onInsertToEditor?.({ id: entry.id, type: 'quick-thought', title: preview });
                clearActiveItem();
              }}
              className="interactive interactive-fold cta-primary absolute right-2 top-1/2 z-10 -translate-y-1/2 px-2 py-1 text-xs font-semibold shadow-soft"
            >
              Insert
            </button>
          ) : null}
        </>
      )}
    </div>
  );
};

export const ScratchPadSkin = ({
  sizeTier,
  storageKey,
  legacyStorageKey,
  legacyStorageKeys,
  initialEntries,
  onInsertToEditor,
  readOnly = false,
  previewMode = false,
}: ScratchPadSkinProps) => {
  const {
    activeItemId,
    activeItemType,
    setActiveItem,
    clearActiveItem,
  } = useWidgetInsertState({ onInsertToEditor: previewMode ? undefined : onInsertToEditor });
  const persistStorageKeyRef = useRef(storageKey);
  const skipNextPersistRef = useRef(true);
  const [entries, setEntries] = useState<ScratchPadEntry[]>(
    () => (previewMode ? [] : readEntriesForStorageKey(storageKey, legacyStorageKey, legacyStorageKeys)),
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [draftText, setDraftText] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const composerContainerRef = useRef<HTMLDivElement | null>(null);
  const isInteractive = !previewMode && !readOnly;
  const renderedEntries = useMemo(
    () => (previewMode ? initialEntries ?? [] : entries),
    [entries, initialEntries, previewMode],
  );

  useEffect(() => {
    if (previewMode) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    if (skipNextPersistRef.current) {
      persistStorageKeyRef.current = storageKey;
      skipNextPersistRef.current = false;
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries, previewMode, storageKey]);

  const liveEntries = useMemo(() => renderedEntries.filter((entry) => !entry.archived), [renderedEntries]);
  const archivedEntries = useMemo(() => renderedEntries.filter((entry) => entry.archived), [renderedEntries]);

  const addEntry = () => {
    if (!isInteractive) {
      return;
    }
    const text = draftText.trim();
    if (!text) {
      return;
    }

    const now = new Date().toLocaleString();
    setEntries((current) => [
      {
        id: `quick-thought-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        text,
        createdAt: now,
        updatedAt: null,
        archived: false,
      },
      ...current,
    ]);
    setDraftText('');
    setAnnouncement('Scratch Pad note saved to this project.');
  };

  const startEditing = (entry: ScratchPadEntry) => {
    if (!isInteractive) {
      return;
    }
    setEditingEntryId(entry.id);
    setDraftText(entry.text);
  };

  const saveEdit = (entryId: string) => {
    if (!isInteractive) {
      return;
    }
    const nextText = draftText.trim();
    if (!nextText) {
      return;
    }

    const nextUpdatedAt = new Date().toLocaleString();
    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              text: nextText,
              updatedAt: nextUpdatedAt,
            }
          : entry,
      ),
    );
    setEditingEntryId(null);
    setDraftText('');
    setAnnouncement('Scratch Pad note updated.');
  };

  const cancelEditing = () => {
    if (!isInteractive) {
      return;
    }
    setEditingEntryId(null);
    setDraftText('');
  };

  const archiveEntry = (entryId: string) => {
    if (!isInteractive) {
      return;
    }
    setEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, archived: true } : entry)));
    if (editingEntryId === entryId) {
      cancelEditing();
    }
    setAnnouncement('Scratch Pad note archived.');
  };

  const restoreEntry = (entryId: string) => {
    if (!isInteractive) {
      return;
    }
    setEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, archived: false } : entry)));
    setAnnouncement('Scratch Pad note restored.');
  };

  const deleteEntry = (entryId: string) => {
    if (!isInteractive) {
      return;
    }
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    if (editingEntryId === entryId) {
      cancelEditing();
    }
    setAnnouncement('Scratch Pad note deleted.');
  };

  const visibleEntries = sizeTier === 'M' ? liveEntries.slice(0, 5) : liveEntries;
  const showComposer = sizeTier !== 'S';
  const showArchivedSection = sizeTier === 'L' && archivedEntries.length > 0;
  return (
    <div className="widget-sheet flex h-full min-h-0 flex-col p-sm">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {showComposer && !previewMode ? (
        !readOnly ? (
          <div ref={composerContainerRef}>
            <ScratchPadEditor
              value={editingEntryId ? '' : draftText}
              rows={sizeTier === 'L' ? 6 : 4}
              placeholder="Capture a note for this project..."
              saveLabel="Save Note"
              readOnly={!isInteractive}
              onChange={setDraftText}
              onSave={addEntry}
            />
          </div>
        ) : null
      ) : null}

      <div className={showComposer ? 'mt-sm min-h-0 flex-1 overflow-y-auto pr-1' : 'min-h-0 flex-1 overflow-y-auto pr-1'}>
        {visibleEntries.length === 0 ? (
          <WidgetEmptyState
            title="Nothing captured for this project yet."
            iconName="thought-pile"
            sizeTier={sizeTier}
          />
        ) : (
          <div className="space-y-1">
            {visibleEntries.map((entry) => (
              <ScratchPadRow
                key={entry.id}
                entry={entry}
                isEditing={editingEntryId === entry.id}
                draftText={editingEntryId === entry.id ? draftText : entry.text}
                onSelect={() => startEditing(entry)}
                onDraftChange={setDraftText}
                onSaveEdit={() => saveEdit(entry.id)}
                onArchive={() => archiveEntry(entry.id)}
                onRestore={() => restoreEntry(entry.id)}
                onDelete={() => deleteEntry(entry.id)}
                onCancelEdit={cancelEditing}
                showDelete={!readOnly && false}
                activeItemId={activeItemId}
                activeItemType={activeItemType}
                setActiveItem={setActiveItem}
                clearActiveItem={clearActiveItem}
                onInsertToEditor={onInsertToEditor}
                readOnly={!isInteractive}
                previewMode={previewMode}
              />
            ))}
          </div>
        )}
      </div>

      {showArchivedSection && !previewMode ? (
        <div className="mt-xs">
          <button
            type="button"
            onClick={() => setArchiveOpen((current) => !current)}
            aria-expanded={archiveOpen}
            className="text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {archiveOpen ? 'Hide Archived' : 'Archived'} ({archivedEntries.length})
          </button>

          {archiveOpen ? (
            <div className="mt-1 space-y-1">
              {archivedEntries.map((entry) => (
                <ScratchPadRow
                  key={entry.id}
                  entry={entry}
                  isEditing={false}
                  draftText={entry.text}
                  onSelect={() => undefined}
                  onDraftChange={() => undefined}
                  onSaveEdit={() => undefined}
                  onArchive={() => undefined}
                  onRestore={() => restoreEntry(entry.id)}
                  onDelete={() => deleteEntry(entry.id)}
                  onCancelEdit={() => undefined}
                  showDelete={!readOnly}
                  activeItemId={activeItemId}
                  activeItemType={activeItemType}
                  setActiveItem={setActiveItem}
                  clearActiveItem={clearActiveItem}
                  onInsertToEditor={onInsertToEditor}
                  readOnly={!isInteractive}
                />
              ))}
              {isInteractive ? (
                <button
                  type="button"
                  onClick={() => {
                    setEntries((current) => current.filter((entry) => !entry.archived));
                    setAnnouncement('Archived Scratch Pad notes cleared.');
                  }}
                  className="text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Clear all archived
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
