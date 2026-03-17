import { useEffect, useMemo, useRef, useState } from 'react';

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

const EXT_ICON: Record<string, string> = {
  pdf: '\ud83d\udcc4',
  doc: '\ud83d\udcdd',
  docx: '\ud83d\udcdd',
  xls: '\ud83d\udcca',
  xlsx: '\ud83d\udcca',
  ppt: '\ud83d\udcc8',
  pptx: '\ud83d\udcc8',
  mp4: '\ud83c\udfac',
  mov: '\ud83c\udfac',
  mp3: '\ud83c\udfb5',
  wav: '\ud83c\udfb5',
  zip: '\ud83d\udce6',
  rar: '\ud83d\udce6',
  txt: '\ud83d\udccb',
  md: '\ud83d\udccb',
  default: '\ud83d\udcce',
};

const iconForExt = (ext: string): string => EXT_ICON[ext.toLowerCase()] ?? EXT_ICON.default;

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

const DropZone = ({ compact, onFiles, readOnly = false }: { compact?: boolean; onFiles: (files: File[]) => void; readOnly?: boolean }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      className="relative flex items-center justify-between gap-xs rounded-control border border-dashed px-sm"
      style={{
        paddingTop: compact ? 'var(--space-xs)' : 'var(--space-sm)',
        paddingBottom: compact ? 'var(--space-xs)' : 'var(--space-sm)',
        borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-border-muted)',
        background: dragOver ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
      }}
    >
      <span className="text-xs text-muted">{readOnly ? 'Read-only file view' : compact ? 'Drop files here' : 'Drag and drop files, or use +'}</span>
      <button
        type="button"
        disabled={readOnly}
        className="h-7 w-7 rounded-control border border-border-muted bg-surface text-lg text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={() => inputRef.current?.click()}
        aria-label="Upload files"
      >
        +
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          readFiles(event.target.files);
          event.target.value = '';
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};

const FileRow = ({ file, onOpen }: { file: FilesModuleItem; onOpen: (file: FilesModuleItem) => void }) => {
  const uploading = file.uploadProgress !== undefined && file.uploadProgress < 100;

  return (
    <button
      type="button"
      onClick={() => {
        if (!uploading) {
          onOpen(file);
        }
      }}
      disabled={uploading}
      className="group relative flex w-full items-center gap-xs overflow-visible rounded-control px-sm py-xs text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70"
      style={{
        background: 'transparent',
      }}
      aria-label={`Open ${file.name}`}
    >
      <span className="shrink-0 text-base" aria-hidden="true">
        {iconForExt(file.ext)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-text">{file.name}</span>
        <span className="block text-[11px] font-normal text-text-secondary">{uploadLabel(file)}</span>
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-control opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }}
      />
      {file.uploadProgress !== undefined ? <UploadProgressBar progress={file.uploadProgress} /> : null}
    </button>
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
  readOnly = false,
}: {
  files: FilesModuleItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  readOnly?: boolean;
}) => {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    if (!query.trim()) {
      return files.slice(0, 4);
    }
    const lowered = query.toLowerCase();
    return files.filter((file) => file.name.toLowerCase().includes(lowered)).slice(0, 4);
  }, [files, query]);

  return (
    <div className="flex flex-col gap-xs rounded-panel border border-border-muted bg-surface-elevated p-sm">
      <DropZone compact onFiles={onUpload} readOnly={readOnly} />

      <div className="flex flex-col gap-[2px]">
        {visible.length === 0 ? (
          <p className="m-0 py-sm text-center text-xs text-muted">
            {query ? 'No files match' : readOnly ? 'No files in this pane (read-only)' : 'Add files to this pane'}
          </p>
        ) : null}
        {visible.map((file) => (
          <FileRow key={file.id} file={file} onOpen={onOpenFile} />
        ))}
      </div>

      <input
        type="search"
        placeholder="Search files..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded-control border border-border-muted bg-surface px-xs py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        aria-label="Search files"
      />
    </div>
  );
};

const FilesModuleMedium = ({
  files,
  onUpload,
  onOpenFile,
  readOnly = false,
}: {
  files: FilesModuleItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  readOnly?: boolean;
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const sorted = useMemo(() => sortFiles(files, sortKey), [files, sortKey]);

  return (
    <div className="flex flex-col gap-sm rounded-panel border border-border-muted bg-surface-elevated p-md">
      <DropZone onFiles={onUpload} readOnly={readOnly} />

      <div role="toolbar" aria-label="Sort files" className="flex items-center gap-1">
        <span className="mr-1 text-xs text-muted">Sort:</span>
        {SORT_OPTIONS.map((option) => (
          <ToolbarButton key={option.key} active={sortKey === option.key} label={option.label} onClick={() => setSortKey(option.key)} />
        ))}
      </div>

      <div role="list" aria-label="Files" className="flex flex-col gap-[2px]">
        {sorted.length === 0 ? (
          <p className="m-0 py-lg text-center text-sm text-muted">
            {readOnly ? 'No files in this pane (read-only)' : 'Add files to this pane'}
          </p>
        ) : null}
        {sorted.map((file) => (
          <div role="listitem" key={file.id}>
            <FileRow file={file} onOpen={onOpenFile} />
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
  readOnly = false,
}: {
  files: FilesModuleItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FilesModuleItem) => void;
  readOnly?: boolean;
}) => {
  const [filterKey, setFilterKey] = useState<FilterKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');

  const visible = useMemo(() => sortFiles(filterFiles(files, filterKey), sortKey), [files, filterKey, sortKey]);

  return (
    <div className="flex flex-col gap-md rounded-panel border border-border-muted bg-surface-elevated p-md">
      <DropZone onFiles={onUpload} readOnly={readOnly} />

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
          {filterKey === 'all' ? (readOnly ? 'No files in this pane (read-only)' : 'Add files to this pane') : `No ${filterKey} files`}
        </p>
      ) : (
        <div role="list" aria-label="Files" className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-sm">
          {visible.map((file) => {
            const uploading = file.uploadProgress !== undefined && file.uploadProgress < 100;
            const useThumbnail = IMAGE_EXTS.has(file.ext.toLowerCase()) && Boolean(file.thumbnailUrl);
            return (
              <div role="listitem" key={file.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!uploading) {
                      onOpenFile(file);
                    }
                  }}
                  disabled={uploading}
                  aria-label={`Open ${file.name}`}
                  className="relative w-full overflow-visible rounded-panel border border-border-muted bg-surface text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div
                    className="flex h-24 items-center justify-center overflow-hidden"
                    style={{
                      background: useThumbnail ? undefined : 'var(--color-surface-elevated)',
                      borderTopLeftRadius: 'var(--radius-panel)',
                      borderTopRightRadius: 'var(--radius-panel)',
                    }}
                  >
                    {useThumbnail ? (
                      <img src={file.thumbnailUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[32px]" aria-hidden="true">
                        {iconForExt(file.ext)}
                      </span>
                    )}
                  </div>
                  <div className="p-xs">
                    <span className="block truncate text-xs font-medium text-text">{file.name}</span>
                    <span className="block text-[11px] font-normal text-text-secondary">{uploadLabel(file)}</span>
                  </div>
                  {file.uploadProgress !== undefined ? <UploadProgressBar progress={file.uploadProgress} /> : null}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const FilesModuleSkin = ({ sizeTier, files, onUpload, onOpenFile, readOnly = false }: FilesModuleSkinProps) => {
  const liveMessage = useMemo(() => {
    const uploading = files.filter((file) => file.uploadProgress !== undefined && file.uploadProgress < 100);
    if (uploading.length > 0) {
      return `Uploading ${uploading.length} file${uploading.length === 1 ? '' : 's'}.`;
    }
    return '';
  }, [files]);

  return (
    <section className="space-y-2" aria-label="Files module">
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>
      {sizeTier === 'S' ? <FilesModuleSmall files={files} onUpload={onUpload} onOpenFile={onOpenFile} readOnly={readOnly} /> : null}
      {sizeTier === 'M' ? <FilesModuleMedium files={files} onUpload={onUpload} onOpenFile={onOpenFile} readOnly={readOnly} /> : null}
      {sizeTier === 'L' ? <FilesModuleLarge files={files} onUpload={onUpload} onOpenFile={onOpenFile} readOnly={readOnly} /> : null}
    </section>
  );
};
