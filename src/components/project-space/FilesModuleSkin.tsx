import { useEffect, useMemo, useRef, useState } from 'react';
import { useLongPress } from '../../hooks/useLongPress';
import { cn } from '../../lib/cn';
import { useModuleInsertState, type ModuleInsertPayload, type ModuleInsertState } from './hooks/useModuleInsertState';
import { FileRecordSummary } from './record-primitives/FileRecordSummary';
import { Icon } from '../primitives';

export interface FilesModuleItem {
  id: string;
  name: string;
  ext: string;
  sizeLabel: string;
  uploadedAt: string;
  uploadedAtTimestamp?: number;
  uploadProgress?: number;
  openUrl?: string;
  thumbnailUrl?: string;
  sizeBytes?: number;
}

interface FilesModuleSkinProps {
  sizeTier: 'S' | 'M' | 'L';
  files: FilesModuleItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  onInsertToEditor?: (item: ModuleInsertPayload) => void;
  readOnly?: boolean;
}

type SortKey = 'name' | 'date' | 'size' | 'type';
type FilterKey = 'all' | 'images' | 'documents' | 'video' | 'audio' | 'archives';
type UploadPhase = 'uploading' | 'completing' | 'complete' | 'done';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'webm']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'aac']);
const ARCHIVE_EXTS = new Set(['zip', 'rar', 'tar', 'gz']);

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'images', label: 'Images' },
  { key: 'documents', label: 'Documents' },
  { key: 'video', label: 'Video' },
  { key: 'audio', label: 'Audio' },
  { key: 'archives', label: 'Archives' },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
  { key: 'type', label: 'Type' },
];

const normalizeExt = (file: FilesModuleItem): string => file.ext.toLowerCase();

const filterFiles = (files: FilesModuleItem[], filter: FilterKey): FilesModuleItem[] => {
  if (filter === 'all') {
    return files;
  }
  if (filter === 'images') {
    return files.filter((file) => IMAGE_EXTS.has(normalizeExt(file)));
  }
  if (filter === 'documents') {
    return files.filter((file) => DOC_EXTS.has(normalizeExt(file)));
  }
  if (filter === 'video') {
    return files.filter((file) => VIDEO_EXTS.has(normalizeExt(file)));
  }
  if (filter === 'audio') {
    return files.filter((file) => AUDIO_EXTS.has(normalizeExt(file)));
  }
  if (filter === 'archives') {
    return files.filter((file) => ARCHIVE_EXTS.has(normalizeExt(file)));
  }
  return files;
};

const parseDate = (file: FilesModuleItem): number => {
  return typeof file.uploadedAtTimestamp === 'number' && Number.isFinite(file.uploadedAtTimestamp) ? file.uploadedAtTimestamp : 0;
};

const sortFiles = (files: FilesModuleItem[], key: SortKey): FilesModuleItem[] => {
  return [...files].sort((left, right) => {
    if (key === 'name') {
      return left.name.localeCompare(right.name);
    }
    if (key === 'type') {
      return left.ext.localeCompare(right.ext);
    }
    if (key === 'size') {
      return (left.sizeBytes ?? 0) - (right.sizeBytes ?? 0);
    }
    return parseDate(right) - parseDate(left);
  });
};

const uploadLabel = (file: FilesModuleItem): string => {
  if (file.uploadProgress !== undefined && file.uploadProgress < 100) {
    return 'Uploading...';
  }
  return `${file.sizeLabel} · ${file.uploadedAt}`;
};

const UploadProgressBar = ({ progress }: { progress: number }) => {
  const [phase, setPhase] = useState<UploadPhase>('uploading');
  const timersRef = useRef<number[]>([]);
  const sparkleVectors = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        angle: `${(360 / 7) * index}deg`,
        travel: `${10 + (index % 5) * 2}px`,
      })),
    [],
  );

  useEffect(() => {
    if (progress < 100) {
      return;
    }

    const startTimer = window.setTimeout(() => {
      setPhase('completing');
    }, 0);
    const completeTimer = window.setTimeout(() => {
      setPhase('complete');
    }, 450);
    const doneTimer = window.setTimeout(() => {
      setPhase('done');
    }, 1950);
    const createdTimers = [startTimer, completeTimer, doneTimer];
    timersRef.current.push(...createdTimers);

    return () => {
      for (const timer of createdTimers) {
        window.clearTimeout(timer);
      }
      timersRef.current = timersRef.current.filter((timer) => !createdTimers.includes(timer));
    };
  }, [progress]);

  if (phase === 'done') {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" aria-hidden="true">
      {(phase === 'uploading' || phase === 'completing') && (
        <div
          className="h-full rounded-r-sm bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      )}

      {phase === 'completing'
        ? sparkleVectors.map((sparkle, index) => (
            <span
              key={index}
              className="absolute bottom-[1px] left-1/2 text-[8px] text-primary opacity-60"
              style={{
                animation: 'sparkle-out 0.4s ease-out forwards',
                ['--angle' as string]: sparkle.angle,
                ['--travel' as string]: sparkle.travel,
              }}
            >
              {'✦'}
            </span>
          ))
        : null}

      {phase === 'complete' ? (
        <span className="absolute bottom-1 right-2 text-[11px] text-muted" style={{ animation: 'fade-in-out 1.5s ease forwards' }}>
          Complete
        </span>
      ) : null}
    </div>
  );
};

const DropZone = ({
  sizeTier,
  hasFiles,
  onFiles,
  readOnly = false,
}: {
  sizeTier: 'S' | 'M' | 'L';
  hasFiles: boolean;
  onFiles: (files: File[]) => void;
  readOnly?: boolean;
}) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const useStackedLayout = sizeTier === 'L' && !hasFiles;
  const containerClassName = cn(
    'relative rounded-control border border-dashed',
    useStackedLayout ? 'flex flex-col items-center justify-center gap-3 px-md py-6 text-center' : 'flex items-center justify-between',
    sizeTier === 'S' ? 'gap-xs px-sm py-1.5' : null,
    sizeTier === 'M' ? (hasFiles ? 'gap-xs px-sm py-1.5' : 'gap-sm px-sm py-2.5') : null,
    sizeTier === 'L' && hasFiles ? 'gap-sm px-sm py-3.5' : null,
  );
  const contentClassName = cn('min-w-0', useStackedLayout ? 'flex flex-col items-center text-center' : 'flex items-center gap-2 text-left');
  const iconClassName = cn(
    'shrink-0 text-muted',
    useStackedLayout ? 'rounded-full border border-border-muted bg-surface px-3 py-3' : 'text-[14px]',
  );
  const label = readOnly ? 'Files are read-only' : sizeTier === 'L' && hasFiles ? 'Drop more files' : 'Drop files';
  const helperText = useStackedLayout ? (readOnly ? 'Uploads are disabled in this pane.' : 'Drag files here or use upload.') : null;
  const buttonClassName = cn(
    'flex items-center justify-center rounded-control border border-border-muted bg-surface text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60',
    useStackedLayout ? 'h-8 min-w-[5.5rem] px-3 text-xs font-medium' : 'h-7 w-7 text-lg',
  );
  const baseBackground = useStackedLayout
    ? 'color-mix(in srgb, var(--color-primary) 4%, transparent)'
    : 'color-mix(in srgb, var(--color-surface-elevated) 65%, transparent)';

  const readFiles = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length > 0) {
      onFiles(nextFiles);
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (readOnly) {
          return;
        }
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        if (readOnly) {
          return;
        }
        setDragOver(false);
        readFiles(event.dataTransfer.files);
      }}
      className={containerClassName}
      style={{
        borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-border-muted)',
        background: dragOver ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : baseBackground,
      }}
    >
      <div className={contentClassName}>
        <span className={iconClassName} aria-hidden="true">
          <Icon name="upload" className={useStackedLayout ? 'text-base' : 'text-[14px]'} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-text">{label}</span>
          {helperText ? <span className="mt-1 block text-xs text-muted">{helperText}</span> : null}
        </span>
      </div>
      <button
        type="button"
        disabled={readOnly}
        className={buttonClassName}
        onClick={() => inputRef.current?.click()}
        aria-label="Upload files"
      >
        {useStackedLayout ? 'Upload' : <Icon name="plus" className="text-[14px]" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={readOnly}
        className="hidden"
        onChange={(event) => {
          if (readOnly) {
            event.target.value = '';
            return;
          }
          readFiles(event.target.files);
          event.target.value = '';
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};

const FileRow = ({
  file,
  onOpen,
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: {
  file: FilesModuleItem;
  onOpen: (file: FilesModuleItem) => void;
  activeItemId: ModuleInsertState['activeItemId'];
  activeItemType: ModuleInsertState['activeItemType'];
  setActiveItem: ModuleInsertState['setActiveItem'];
  clearActiveItem: ModuleInsertState['clearActiveItem'];
  onInsertToEditor?: ModuleInsertState['onInsertToEditor'];
}) => {
  const uploading = file.uploadProgress !== undefined && file.uploadProgress < 100;
  const longPressHandlers = useLongPress(() => {
    if (!uploading) {
      setActiveItem(file.id, 'file', file.name);
    }
  });
  const showInsertAction = activeItemId === file.id && activeItemType === 'file';

  return (
    <div className="relative" {...longPressHandlers}>
      <button
        type="button"
        onClick={() => {
          if (!uploading) {
            onOpen(file);
          }
        }}
        onFocus={() => {
          if (!uploading) {
            setActiveItem(file.id, 'file', file.name);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            clearActiveItem();
          }
        }}
        disabled={uploading}
        className="group relative flex w-full items-center gap-xs overflow-visible rounded-control bg-transparent px-sm py-xs text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        aria-label={`Open ${file.name}`}
      >
        <FileRecordSummary
          name={file.name}
          ext={file.ext}
          metaLabel={uploadLabel(file)}
          thumbnailUrl={file.thumbnailUrl}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-control opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }}
        />
        {file.uploadProgress !== undefined ? <UploadProgressBar progress={file.uploadProgress} /> : null}
      </button>
      {showInsertAction ? (
        <button
          type="button"
          data-module-insert-ignore="true"
          onClick={() => {
            onInsertToEditor?.({ id: file.id, type: 'file', title: file.name });
            clearActiveItem();
          }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-control bg-primary px-2 py-1 text-xs font-semibold text-on-primary shadow-soft"
        >
          Insert
        </button>
      ) : null}
    </div>
  );
};

const FileTile = ({
  file,
  onOpen,
  activeItemId,
  activeItemType,
  setActiveItem,
  clearActiveItem,
  onInsertToEditor,
}: {
  file: FilesModuleItem;
  onOpen: (file: FilesModuleItem) => void;
  activeItemId: ModuleInsertState['activeItemId'];
  activeItemType: ModuleInsertState['activeItemType'];
  setActiveItem: ModuleInsertState['setActiveItem'];
  clearActiveItem: ModuleInsertState['clearActiveItem'];
  onInsertToEditor?: ModuleInsertState['onInsertToEditor'];
}) => {
  const uploading = file.uploadProgress !== undefined && file.uploadProgress < 100;
  const longPressHandlers = useLongPress(() => {
    if (!uploading) {
      setActiveItem(file.id, 'file', file.name);
    }
  });
  const showInsertAction = activeItemId === file.id && activeItemType === 'file';

  return (
    <div role="listitem" className="relative" {...longPressHandlers}>
      <button
        type="button"
        onClick={() => {
          if (!uploading) {
            onOpen(file);
          }
        }}
        onFocus={() => {
          if (!uploading) {
            setActiveItem(file.id, 'file', file.name);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            clearActiveItem();
          }
        }}
        disabled={uploading}
        aria-label={`Open ${file.name}`}
        className="relative w-full overflow-visible rounded-panel border border-border-muted bg-surface text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70"
      >
        <FileRecordSummary
          name={file.name}
          ext={file.ext}
          metaLabel={uploadLabel(file)}
          thumbnailUrl={file.thumbnailUrl}
          presentation="tile"
        />
        {file.uploadProgress !== undefined ? <UploadProgressBar progress={file.uploadProgress} /> : null}
      </button>
      {showInsertAction ? (
        <button
          type="button"
          data-module-insert-ignore="true"
          onClick={() => {
            onInsertToEditor?.({ id: file.id, type: 'file', title: file.name });
            clearActiveItem();
          }}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-control bg-primary px-2 py-1 text-xs font-semibold text-on-primary shadow-soft"
        >
          Insert
        </button>
      ) : null}
    </div>
  );
};

const ToolbarButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className="rounded-control border border-border-muted px-xs py-[3px] text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    style={{
      background: active ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
      color: active ? 'var(--color-primary)' : 'var(--color-muted)',
    }}
  >
    {label}
  </button>
);

const FilesModuleSmall = ({
  files,
  onUpload,
  onOpenFile,
  insertState,
  readOnly = false,
}: {
  files: FilesModuleItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  insertState: ModuleInsertState;
  readOnly?: boolean;
}) => {
  const visible = useMemo(() => files.slice(0, 4), [files]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-xs rounded-panel border border-border-muted bg-surface-elevated p-sm">
      <DropZone sizeTier="S" hasFiles={files.length > 0} onFiles={onUpload} readOnly={readOnly} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-[2px] pr-1">
          {visible.length === 0 ? (
            <p className="m-0 py-sm text-center text-xs text-muted">
              {files.length === 0 ? 'No files in this pane.' : 'Add files to this pane'}
            </p>
          ) : null}
          {visible.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              onOpen={onOpenFile}
              activeItemId={insertState.activeItemId}
              activeItemType={insertState.activeItemType}
              setActiveItem={insertState.setActiveItem}
              clearActiveItem={insertState.clearActiveItem}
              onInsertToEditor={insertState.onInsertToEditor}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const FilesModuleMedium = ({
  files,
  onUpload,
  onOpenFile,
  insertState,
  readOnly = false,
}: {
  files: FilesModuleItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  insertState: ModuleInsertState;
  readOnly?: boolean;
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const sorted = useMemo(() => sortFiles(files, sortKey), [files, sortKey]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-sm rounded-panel border border-border-muted bg-surface-elevated p-md">
      <DropZone sizeTier="M" hasFiles={files.length > 0} onFiles={onUpload} readOnly={readOnly} />

      <div role="toolbar" aria-label="Sort files" className="flex items-center gap-1">
        <span className="mr-1 text-xs text-muted">Sort:</span>
        {SORT_OPTIONS.map((option) => (
          <ToolbarButton key={option.key} active={sortKey === option.key} label={option.label} onClick={() => setSortKey(option.key)} />
        ))}
      </div>

      <div role="list" aria-label="Files" className="min-h-0 flex-1 overflow-y-auto pr-1">
        {sorted.length === 0 ? (
          <p className="m-0 py-lg text-center text-sm text-muted">
            {files.length === 0 ? 'No files in this pane.' : 'Add files to this pane'}
          </p>
        ) : null}
        {sorted.map((file) => (
          <div role="listitem" key={file.id}>
            <FileRow
              file={file}
              onOpen={onOpenFile}
              activeItemId={insertState.activeItemId}
              activeItemType={insertState.activeItemType}
              setActiveItem={insertState.setActiveItem}
              clearActiveItem={insertState.clearActiveItem}
              onInsertToEditor={insertState.onInsertToEditor}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const FilesModuleLarge = ({
  files,
  onUpload,
  onOpenFile,
  insertState,
  readOnly = false,
}: {
  files: FilesModuleItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  insertState: ModuleInsertState;
  readOnly?: boolean;
}) => {
  const [filterKey, setFilterKey] = useState<FilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');

  const visible = useMemo(() => sortFiles(filterFiles(files, filterKey), sortKey), [files, filterKey, sortKey]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-md rounded-panel border border-border-muted bg-surface-elevated p-md">
      <DropZone sizeTier="L" hasFiles={files.length > 0} onFiles={onUpload} readOnly={readOnly} />

      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div role="toolbar" aria-label="Filter by file type" className="flex flex-wrap gap-1">
          {FILTER_OPTIONS.map((option) => (
            <ToolbarButton
              key={option.key}
              active={filterKey === option.key}
              label={option.label}
              onClick={() => setFilterKey(option.key)}
            />
          ))}
        </div>

        <div role="toolbar" aria-label="Sort files" className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted">Sort:</span>
          {SORT_OPTIONS.map((option) => (
            <ToolbarButton key={option.key} active={sortKey === option.key} label={option.label} onClick={() => setSortKey(option.key)} />
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="m-0 py-xl text-center text-sm text-muted">
          {filterKey === 'all' ? (files.length === 0 ? 'No files in this pane.' : 'Add files to this pane') : `No ${filterKey} files`}
        </p>
      ) : (
        <div role="list" aria-label="Files" className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-sm">
            {visible.map((file) => (
              <FileTile
                key={file.id}
                file={file}
                onOpen={onOpenFile}
                activeItemId={insertState.activeItemId}
                activeItemType={insertState.activeItemType}
                setActiveItem={insertState.setActiveItem}
                clearActiveItem={insertState.clearActiveItem}
                onInsertToEditor={insertState.onInsertToEditor}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const FilesModuleSkin = ({
  sizeTier,
  files,
  onUpload,
  onOpenFile,
  onInsertToEditor,
  readOnly = false,
}: FilesModuleSkinProps) => {
  const insertState = useModuleInsertState({ onInsertToEditor });
  const liveMessage = useMemo(() => {
    const uploading = files.filter((file) => file.uploadProgress !== undefined && file.uploadProgress < 100);
    if (uploading.length > 0) {
      return `Uploading ${uploading.length} file${uploading.length === 1 ? '' : 's'}.`;
    }
    return '';
  }, [files]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-2" aria-label="Files module">
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>
      {sizeTier === 'S' ? <FilesModuleSmall files={files} onUpload={onUpload} onOpenFile={onOpenFile} insertState={insertState} readOnly={readOnly} /> : null}
      {sizeTier === 'M' ? <FilesModuleMedium files={files} onUpload={onUpload} onOpenFile={onOpenFile} insertState={insertState} readOnly={readOnly} /> : null}
      {sizeTier === 'L' ? <FilesModuleLarge files={files} onUpload={onUpload} onOpenFile={onOpenFile} insertState={insertState} readOnly={readOnly} /> : null}
    </section>
  );
};
