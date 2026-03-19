import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../primitives';

interface QuickThoughtEntry {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string | null;
  archived: boolean;
}

interface QuickThoughtsModuleSkinProps {
  sizeTier: 'S' | 'M' | 'L';
  storageKey: string;
  legacyStorageKey?: string;
  readOnly?: boolean;
}

const parseEntries = (raw: string | null): QuickThoughtEntry[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): QuickThoughtEntry | null => {
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
      .filter((entry): entry is QuickThoughtEntry => Boolean(entry));
  } catch {
    return [];
  }
};

function readEntriesForStorageKey(storageKey: string, legacyStorageKey?: string): QuickThoughtEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const current = window.localStorage.getItem(storageKey);
  if (current) {
    return parseEntries(current);
  }

  if (!legacyStorageKey) {
    return [];
  }

  const legacy = window.localStorage.getItem(legacyStorageKey);
  return parseEntries(legacy);
}

const clipPreview = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return 'Untitled thought';
  }
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return `${trimmed.slice(0, 117)}...`;
};

const QuickThoughtEditor = ({
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
  <div className="rounded-control border border-border-muted bg-surface">
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      readOnly={readOnly}
      className="w-full resize-y border-0 bg-transparent px-sm py-sm text-sm text-text outline-none"
      placeholder={placeholder}
      aria-label="Quick Thought editor"
    />
    <div className="flex justify-between gap-2 border-t border-border-muted px-xs py-1">
      {onCancel ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={onCancel}
          className="rounded-control border border-border-muted px-sm py-1 text-xs font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
        className="rounded-control bg-primary px-sm py-1 text-xs font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {saveLabel}
      </button>
    </div>
  </div>
);

const ThoughtRow = ({
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
  readOnly = false,
}: {
  entry: QuickThoughtEntry;
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
  readOnly?: boolean;
}) => {
  const preview = clipPreview(entry.text);

  return (
    <div
      className="relative rounded-control bg-surface-elevated px-sm py-xs"
      style={{ paddingLeft: 'calc(var(--space-sm) + 6px)', opacity: entry.archived ? 0.6 : 1 }}
    >
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-control"
        style={{ background: entry.archived ? 'var(--color-border-muted)' : 'var(--color-capture-rail)' }}
      />

      {isEditing ? (
        <QuickThoughtEditor
          value={draftText}
          rows={4}
          placeholder="Refine this thought..."
          saveLabel="Save"
          readOnly={readOnly}
          onChange={onDraftChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <button
            type="button"
            disabled={readOnly}
            onClick={onSelect}
            className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label={entry.archived ? `Archived thought: ${preview}` : `Open thought: ${preview}`}
          >
            <p className="text-[13px] font-medium text-text">{preview}</p>
            <p className="mt-1 text-[11px] text-text-secondary">
              {entry.updatedAt ? `Updated ${entry.updatedAt}` : entry.createdAt}
            </p>
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {!entry.archived ? (
              <>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={onSelect}
                  className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <Icon name="edit" className="text-[12px]" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={onArchive}
                  className="rounded-control border border-border-muted px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Archive
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={onRestore}
                className="rounded-control border border-border-muted px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Restore
              </button>
            )}
            {showDelete ? (
              <button
                type="button"
                disabled={readOnly}
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Icon name="trash" className="text-[12px]" />
                Delete
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};

export const QuickThoughtsModuleSkin = ({
  sizeTier,
  storageKey,
  legacyStorageKey,
  readOnly = false,
}: QuickThoughtsModuleSkinProps) => {
  const persistStorageKeyRef = useRef(storageKey);
  const skipNextPersistRef = useRef(true);
  const [entries, setEntries] = useState<QuickThoughtEntry[]>(() => readEntriesForStorageKey(storageKey, legacyStorageKey));
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [draftText, setDraftText] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const isInteractive = !readOnly;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (skipNextPersistRef.current) {
      persistStorageKeyRef.current = storageKey;
      skipNextPersistRef.current = false;
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(entries));
    if (legacyStorageKey && legacyStorageKey !== storageKey) {
      window.localStorage.removeItem(legacyStorageKey);
    }
  }, [entries, legacyStorageKey, storageKey]);

  const liveEntries = useMemo(() => entries.filter((entry) => !entry.archived), [entries]);
  const archivedEntries = useMemo(() => entries.filter((entry) => entry.archived), [entries]);

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
    setAnnouncement('Quick Thought saved to this pane.');
  };

  const startEditing = (entry: QuickThoughtEntry) => {
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
    setAnnouncement('Quick Thought updated.');
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
    setAnnouncement('Quick Thought archived.');
  };

  const restoreEntry = (entryId: string) => {
    if (!isInteractive) {
      return;
    }
    setEntries((current) => current.map((entry) => (entry.id === entryId ? { ...entry, archived: false } : entry)));
    setAnnouncement('Quick Thought restored.');
  };

  const deleteEntry = (entryId: string) => {
    if (!isInteractive) {
      return;
    }
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    if (editingEntryId === entryId) {
      cancelEditing();
    }
    setAnnouncement('Quick Thought deleted.');
  };

  const visibleEntries = sizeTier === 'M' ? liveEntries.slice(0, 5) : liveEntries;
  const showComposer = sizeTier !== 'S';
  const showArchivedSection = sizeTier === 'L' && archivedEntries.length > 0;

  return (
    <div className="rounded-panel border border-border-muted bg-surface-elevated p-sm">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="mb-xs flex items-start justify-between gap-xs">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
            <Icon name="thought-pile" className="text-[16px]" />
            Quick Thoughts
          </p>
          <p className="mt-1 text-[11px] text-text-secondary">Pane-local capture. These notes stay in this workspace only.</p>
        </div>
        <button
          type="button"
          disabled={!isInteractive}
          onClick={() => {
            setEditingEntryId(null);
            setDraftText('');
            setAnnouncement('Ready for a new Quick Thought.');
          }}
          className="flex h-7 w-7 items-center justify-center rounded-control border border-border-muted text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="New Quick Thought"
        >
          <Icon name="plus" className="text-[14px]" />
        </button>
      </div>

      {showComposer ? (
        readOnly ? (
          <div className="rounded-control border border-border-muted bg-surface px-sm py-sm text-sm text-muted">
            Quick Thoughts are read-only for you in this pane.
          </div>
        ) : (
          <QuickThoughtEditor
            value={editingEntryId ? '' : draftText}
            rows={sizeTier === 'L' ? 6 : 4}
            placeholder="Capture a thought for this pane..."
            saveLabel="Save Thought"
            readOnly={!isInteractive}
            onChange={setDraftText}
            onSave={addEntry}
          />
        )
      ) : null}

      <div className={showComposer ? 'mt-sm' : ''}>
        {visibleEntries.length === 0 ? (
          <p className="m-0 py-sm text-center font-heading text-sm text-muted">Nothing captured for this pane yet.</p>
        ) : (
          <div className="space-y-1">
            {visibleEntries.map((entry) => (
              <ThoughtRow
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
                readOnly={!isInteractive}
              />
            ))}
          </div>
        )}
      </div>

      {showArchivedSection ? (
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
                <ThoughtRow
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
                  readOnly={!isInteractive}
                />
              ))}
              {isInteractive ? (
                <button
                  type="button"
                  onClick={() => {
                    setEntries((current) => current.filter((entry) => !entry.archived));
                    setAnnouncement('Archived Quick Thoughts cleared.');
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

export const InboxCaptureModuleSkin = QuickThoughtsModuleSkin;
