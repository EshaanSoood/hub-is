
These token updates were locked during the §14 Kanban design session. They apply to all existing and future components. Update §1–10 implementations accordingly.

## Priority Color Corrections


```ts
// constants/priority.ts — replace existing PRIORITY_COLORS
export const PRIORITY_COLORS = {
  high:   "rgb(220 80 100)",   // unchanged — red, reads clearly
  medium: "rgb(245 168 80)",   // was pink — now warm amber
  low:    "rgb(130 190 160)",  // was light pink — now soft sage
} as const;
```

These amber and sage tones are reserved for priority only in v1. They are candidates for warning and success semantic tokens in a future token pass — do not wire them to other uses yet.

## Text Weight Hierarchy

Typography hierarchy is expressed through font weight, not color variation. All text remains `var(--color-text)` in its tier — weight carries the visual hierarchy so it works in both light and dark mode without additional tokens.

```css
/* Weight scale — add to tokens.css as comments for reference */
/* 700 — module headings, card titles, column headers, record names (the thing you look at first) */
/* 500 — labels, field names, chip text, button text, nav items (active but not dominant) */
/* 400 — metadata, dates, counts, helper text, placeholder text (supporting information) */
```

Applied in code as `fontWeight: 700 | 500 | 400` on the relevant element's inline style or className. DM Sans supports all three weights natively (loaded via Google Fonts import in `tokens.css`).

## New Mid-Tier Text Token

```css
/* tokens.css addition */
--color-text-secondary: rgb(180 194 210); /* dimmer than text, brighter than muted — for metadata */
```

Light mode equivalent: `rgb(80 100 124)`.

Use `--color-text-secondary` for secondary metadata (assignee names on cards, due dates, file sizes) where `--color-muted` is too recessive but `--color-text` is too dominant.

---

# §11 — Files Module

## Overview

The Files Module appears in three sizes (S / M / L) matching the pane module grid size tiers. All three sizes share the same upload mechanic — a drag-and-drop zone plus a `+` button — but progressively expose more capability. Clicking any file opens it in the existing Record Inspector (§8) with a file-specific action bar. Upload progress is shown inline on each file item with a pink sparkle completion animation.

---

## Shared Primitives

### FileTypeIcon

Small icon representing the file type. Not a component with logic — just a lookup from extension to icon character or SVG. Types: image, pdf, doc, sheet, video, audio, archive, unknown.

### UploadProgressBar

A thin bar (3px height) that runs along the bottom edge of a file row or card. Fills left-to-right in `var(--color-primary)` as upload progresses. On completion:
1. Bar fills fully
2. A brief scatter of small `✦` marks in `var(--color-primary)` at reduced opacity (0.6) animate outward from the center over ~400ms
3. Bar and sparkles fade out
4. The word "Complete" appears in muted text for 1.5s then fades
5. Row normalizes to its resting state

The sparkle elements are absolutely positioned spans, randomized in angle and travel distance (8–20px), CSS keyframe animated, removed from DOM after animation ends.

```tsx
// UploadProgressBar.tsx
  `PRIORITY_COLORS.medium` was previously `rgb(255 163 205)` — identical to `--color-primary`. This caused priority indicators and interactive elements to be visually indistinguishable. `PRIORITY_COLORS.low` was too light to read on dark denim.
import { useEffect, useRef, useState } from "react";

type Phase = "uploading" | "completing" | "complete" | "done";

interface UploadProgressBarProps {
  progress: number; // 0–100
  onDone?: () => void;
}

export function UploadProgressBar({ progress, onDone }: UploadProgressBarProps) {
  const [phase, setPhase] = useState<Phase>("uploading");
  const sparkleCount = 7;
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (progress >= 100 && phase === "uploading") {
      setPhase("completing");
      doneTimer.current = setTimeout(() => {
        setPhase("complete");
        setTimeout(() => {
          setPhase("done");
          onDone?.();
        }, 1500);
      }, 500);
    }
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, [progress, phase, onDone]);

  if (phase === "done") return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "3px",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* Progress bar fill */}
      {(phase === "uploading" || phase === "completing") && (
        <div
          style={{
            height: "100%",
            width: `${Math.min(progress, 100)}%`,
            background: "var(--color-primary)",
            transition: "width 0.15s ease-out",
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}

      {/* Sparkles */}
      {phase === "completing" &&
        Array.from({ length: sparkleCount }).map((_, i) => {
          const angle = (360 / sparkleCount) * i;
          const travel = 10 + Math.random() * 10;
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                bottom: "1px",
                fontSize: "8px",
                color: "var(--color-primary)",
                opacity: 0.6,
                animation: `sparkle-out 0.4s ease-out forwards`,
                // inline custom property per sparkle
                ["--angle" as string]: `${angle}deg`,
                ["--travel" as string]: `${travel}px`,
                transformOrigin: "center",
              }}
            >
              ✦
            </span>
          );
        })}

      {/* Complete label */}
      {phase === "complete" && (
        <span
          style={{
            position: "absolute",
            right: "var(--space-xs)",
            bottom: "4px",
            fontSize: "11px",
            color: "var(--color-muted)",
            animation: "fade-in-out 1.5s ease forwards",
          }}
        >
          Complete
        </span>
      )}

      {/* Keyframes injected once at app level — included here for reference */}
      {/* 
        @keyframes sparkle-out {
          0%   { transform: translate(-50%, 0) rotate(var(--angle)) translateY(0); opacity: 0.6; }
          100% { transform: translate(-50%, 0) rotate(var(--angle)) translateY(calc(-1 * var(--travel))); opacity: 0; }
        }
        @keyframes fade-in-out {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      */}
    </div>
  );
}
```

---

### FileRow

Used in Small and Medium sizes. One file per row.

```tsx
// FileRow.tsx
import { useState } from "react";
import { UploadProgressBar } from "./UploadProgressBar";

interface FileItem {
  id: string;
  name: string;
  ext: string;
  sizeLabel: string; // e.g. "2.4 MB"
  uploadedAt: string; // formatted display string
  uploadProgress?: number; // 0–100, undefined if fully uploaded
}

interface FileRowProps {
  file: FileItem;
  onOpen: (file: FileItem) => void; // opens Record Inspector
}

// CODE REVIEW NOTE: collaborator and category colors must not use pink range.
// File type icon colors use neutral muted palette only.

const EXT_ICON: Record<string, string> = {
  pdf: "📄", jpg: "🖼", jpeg: "🖼", png: "🖼", gif: "🖼", webp: "🖼",
  doc: "📝", docx: "📝", xls: "📊", xlsx: "📊", mp4: "🎬",
  mp3: "🎵", zip: "📦", rar: "📦", default: "📎",
};

function getIcon(ext: string) {
  return EXT_ICON[ext.toLowerCase()] ?? EXT_ICON.default;
}

export function FileRow({ file, onOpen }: FileRowProps) {
  const [hovered, setHovered] = useState(false);
  const uploading = file.uploadProgress !== undefined && file.uploadProgress < 100;

  return (
    <button
      onClick={() => !uploading && onOpen(file)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={uploading}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        width: "100%",
        padding: "var(--space-xs) var(--space-sm)",
        background: hovered && !uploading
          ? "color-mix(in srgb, var(--color-primary) 6%, transparent)"
          : "transparent",
        border: "none",
        borderRadius: "var(--radius-control)",
        cursor: uploading ? "not-allowed" : "pointer",
        opacity: uploading ? 0.7 : 1,
        textAlign: "left",
        transition: "background 0.15s ease",
        outline: "none",
        overflow: "visible", // never clip — popovers depend on this
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
      aria-label={`Open ${file.name}`}
    >
      {/* File type icon */}
      <span style={{ fontSize: "16px", flexShrink: 0 }} aria-hidden="true">
        {getIcon(file.ext)}
      </span>

      {/* Name + meta */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "13px",
            fontWeight: 500, // label weight
            color: "var(--color-text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "var(--font-body)",
          }}
        >
          {file.name}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 400, // metadata weight
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {file.sizeLabel} · {file.uploadedAt}
        </span>
      </span>

      {/* Upload progress overlay */}
      {file.uploadProgress !== undefined && (
        <UploadProgressBar progress={file.uploadProgress} />
      )}
    </button>
  );
}
```

---

### DropZone

Shared across all three sizes. Adjusts height via a `compact` prop (Small = compact).

```tsx
// DropZone.tsx
import { useRef, useState } from "react";

interface DropZoneProps {
  compact?: boolean;
  onFiles: (files: File[]) => void;
  onPlusClick: () => void; // triggers native file input
}

export function DropZone({ compact, onFiles, onPlusClick }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-xs)",
        padding: compact ? "var(--space-xs) var(--space-sm)" : "var(--space-sm) var(--space-md)",
        border: `1.5px dashed ${dragOver ? "var(--color-primary)" : "var(--color-border-muted)"}`,
        borderRadius: "var(--radius-control)",
        background: dragOver
          ? "color-mix(in srgb, var(--color-primary) 5%, transparent)"
          : "transparent",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <span
        style={{
          fontSize: compact ? "12px" : "13px",
          color: "var(--color-muted)",
          fontFamily: "var(--font-body)",
        }}
      >
        {compact ? "Drop files here" : "Drag and drop files, or use the + button"}
      </span>

      {/* Plus button */}
      <button
        onClick={() => { onPlusClick(); inputRef.current?.click(); }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--color-border-muted)",
          background: "transparent",
          color: "var(--color-text)",
          fontSize: "18px",
          cursor: "pointer",
          flexShrink: 0,
          outline: "none",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
        aria-label="Upload files"
      >
        +
      </button>

      {/* Hidden native file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
```

---

## FilesModuleSmall

Drop zone (compact) + plus button + 4 most recent file rows + search input at the bottom.

```tsx
// FilesModuleSmall.tsx
import { useState } from "react";
import { DropZone } from "./DropZone";
import { FileRow } from "./FileRow";
import type { FileItem } from "./FileRow";

interface FilesModuleSmallProps {
  files: FileItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FileItem) => void;
}

export function FilesModuleSmall({ files, onUpload, onOpenFile }: FilesModuleSmallProps) {
  const [query, setQuery] = useState("");

  const visible = query.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
    : files.slice(0, 4);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        padding: "var(--space-sm)",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-panel)",
        overflow: "visible", // never clip — popovers depend on this
      }}
    >
      <DropZone compact onFiles={onUpload} onPlusClick={() => {}} />

      {/* Recent file rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {visible.length === 0 && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--color-muted)",
              textAlign: "center",
              padding: "var(--space-sm) 0",
              fontFamily: "var(--font-body)",
              margin: 0,
            }}
          >
            {query ? "No files match" : "Add files to this pane"}
          </p>
        )}
        {visible.map((f) => (
          <FileRow key={f.id} file={f} onOpen={onOpenFile} />
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search files…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "var(--space-2xs) var(--space-xs)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-muted)",
          borderRadius: "var(--radius-control)",
          color: "var(--color-text)",
          fontSize: "12px",
          fontFamily: "var(--font-body)",
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
          (e.currentTarget as HTMLElement).style.borderColor = "transparent";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-muted)";
        }}
        aria-label="Search files"
      />
    </div>
  );
}
```

---

## FilesModuleMedium

Drop zone + plus button + sortable full file list.

```tsx
// FilesModuleMedium.tsx
import { useState } from "react";
import { DropZone } from "./DropZone";
import { FileRow } from "./FileRow";
import type { FileItem } from "./FileRow";

type SortKey = "name" | "date" | "size" | "type";

interface FilesModuleMediumProps {
  files: FileItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FileItem) => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

function sortFiles(files: FileItem[], key: SortKey): FileItem[] {
  return [...files].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "type") return a.ext.localeCompare(b.ext);
    if (key === "date") return a.uploadedAt.localeCompare(b.uploadedAt);
    if (key === "size") return a.sizeLabel.localeCompare(b.sizeLabel);
    return 0;
  });
}

export function FilesModuleMedium({ files, onUpload, onOpenFile }: FilesModuleMediumProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const sorted = sortFiles(files, sortKey);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        padding: "var(--space-md)",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-panel)",
        overflow: "visible",
      }}
    >
      <DropZone onFiles={onUpload} onPlusClick={() => {}} />

      {/* Sort bar */}
      <div
        role="toolbar"
        aria-label="Sort files"
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2xs)" }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            marginRight: "var(--space-2xs)",
          }}
        >
          Sort:
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortKey(opt.key)}
            aria-pressed={sortKey === opt.key}
            style={{
              padding: "3px var(--space-xs)",
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--color-border-muted)",
              background:
                sortKey === opt.key
                  ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                  : "transparent",
              color: sortKey === opt.key ? "var(--color-primary)" : "var(--color-muted)",
              fontSize: "12px",
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              outline: "none",
              transition: "background 0.15s, color 0.15s",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* File list */}
      <div
        role="list"
        aria-label="Files"
        style={{ display: "flex", flexDirection: "column", gap: "2px" }}
      >
        {sorted.length === 0 && (
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-muted)",
              textAlign: "center",
              padding: "var(--space-lg) 0",
              fontFamily: "var(--font-body)",
              margin: 0,
            }}
          >
            Add files to this pane
          </p>
        )}
        {sorted.map((f) => (
          <div role="listitem" key={f.id}>
            <FileRow file={f} onOpen={onOpenFile} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## FilesModuleLarge

Drop zone + plus button + filter chips by file type + sort + gallery grid.

```tsx
// FilesModuleLarge.tsx
import { useState } from "react";
import { DropZone } from "./DropZone";
import { UploadProgressBar } from "./UploadProgressBar";
import type { FileItem } from "./FileRow";

// CODE REVIEW NOTE: card accent colors are neutral only — never pink range.

type SortKey = "name" | "date" | "size" | "type";
type FilterKey = "all" | "images" | "documents" | "video" | "audio" | "archives";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);
const DOC_EXTS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "avi", "webm"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "aac"]);
const ARCHIVE_EXTS = new Set(["zip", "rar", "tar", "gz"]);

function filterFiles(files: FileItem[], filter: FilterKey): FileItem[] {
  if (filter === "all") return files;
  const ext = (f: FileItem) => f.ext.toLowerCase();
  if (filter === "images") return files.filter((f) => IMAGE_EXTS.has(ext(f)));
  if (filter === "documents") return files.filter((f) => DOC_EXTS.has(ext(f)));
  if (filter === "video") return files.filter((f) => VIDEO_EXTS.has(ext(f)));
  if (filter === "audio") return files.filter((f) => AUDIO_EXTS.has(ext(f)));
  if (filter === "archives") return files.filter((f) => ARCHIVE_EXTS.has(ext(f)));
  return files;
}

function sortFiles(files: FileItem[], key: SortKey): FileItem[] {
  return [...files].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "type") return a.ext.localeCompare(b.ext);
    if (key === "date") return a.uploadedAt.localeCompare(b.uploadedAt);
    if (key === "size") return a.sizeLabel.localeCompare(b.sizeLabel);
    return 0;
  });
}

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "images", label: "Images" },
  { key: "documents", label: "Documents" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "archives", label: "Archives" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

const EXT_ICON: Record<string, string> = {
  pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
  mp4: "🎬", mov: "🎬", mp3: "🎵", zip: "📦", rar: "📦", default: "📎",
};

interface FilesModuleLargeProps {
  files: FileItem[];
  onUpload: (files: File[]) => void;
  onOpenFile: (file: FileItem) => void;
  // thumbnailUrl: provide image thumbnail URL for image files
  getThumbnailUrl?: (file: FileItem) => string | undefined;
}

export function FilesModuleLarge({
  files,
  onUpload,
  onOpenFile,
  getThumbnailUrl,
}: FilesModuleLargeProps) {
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const visible = sortFiles(filterFiles(files, filterKey), sortKey);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        padding: "var(--space-md)",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-panel)",
        overflow: "visible",
      }}
    >
      <DropZone onFiles={onUpload} onPlusClick={() => {}} />

      {/* Filter + Sort bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
        }}
      >
        {/* Filter chips */}
        <div
          role="toolbar"
          aria-label="Filter by file type"
          style={{ display: "flex", gap: "var(--space-2xs)", flexWrap: "wrap" }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilterKey(opt.key)}
              aria-pressed={filterKey === opt.key}
              style={{
                padding: "4px var(--space-xs)",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--color-border-muted)",
                background:
                  filterKey === opt.key
                    ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                    : "transparent",
                color: filterKey === opt.key ? "var(--color-primary)" : "var(--color-muted)",
                fontSize: "12px",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                outline: "none",
                transition: "background 0.15s, color 0.15s",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div
          role="toolbar"
          aria-label="Sort files"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2xs)" }}
        >
          <span style={{ fontSize: "12px", color: "var(--color-muted)", fontFamily: "var(--font-body)" }}>
            Sort:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              aria-pressed={sortKey === opt.key}
              style={{
                padding: "4px var(--space-xs)",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--color-border-muted)",
                background:
                  sortKey === opt.key
                    ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                    : "transparent",
                color: sortKey === opt.key ? "var(--color-primary)" : "var(--color-muted)",
                fontSize: "12px",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                outline: "none",
                transition: "background 0.15s, color 0.15s",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery grid */}
      {visible.length === 0 ? (
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-muted)",
            textAlign: "center",
            padding: "var(--space-xl) 0",
            fontFamily: "var(--font-body)",
            margin: 0,
          }}
        >
          {filterKey === "all" ? "Add files to this pane" : `No ${filterKey} files`}
        </p>
      ) : (
        <div
          role="list"
          aria-label="Files"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "var(--space-sm)",
          }}
        >
          {visible.map((f) => {
            const thumbUrl = IMAGE_EXTS.has(f.ext.toLowerCase())
              ? getThumbnailUrl?.(f)
              : undefined;
            const uploading =
              f.uploadProgress !== undefined && f.uploadProgress < 100;

            return (
              <div role="listitem" key={f.id} style={{ position: "relative" }}>
                <button
                  onClick={() => !uploading && onOpenFile(f)}
                  disabled={uploading}
                  style={{
                    position: "relative",
                    width: "100%",
                    padding: 0,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border-muted)",
                    borderRadius: "var(--radius-panel)",
                    cursor: uploading ? "not-allowed" : "pointer",
                    opacity: uploading ? 0.7 : 1,
                    overflow: "visible",
                    outline: "none",
                    textAlign: "left",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 0 0 2px var(--color-primary)";
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                  aria-label={`Open ${f.name}`}
                >
                  {/* Thumbnail or icon area */}
                  <div
                    style={{
                      height: "96px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius-panel) var(--radius-panel) 0 0",
                      overflow: "hidden",
                      background: thumbUrl ? undefined : "var(--color-surface-elevated)",
                    }}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        aria-hidden="true"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "32px" }} aria-hidden="true">
                        {EXT_ICON[f.ext.toLowerCase()] ?? EXT_ICON.default}
                      </span>
                    )}
                  </div>

                  {/* Card footer */}
                  <div style={{ padding: "var(--space-xs)" }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 500, // label weight
                        color: "var(--color-text)",
                        fontFamily: "var(--font-body)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {f.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 400, // metadata weight
                        color: "var(--color-text-secondary)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {f.sizeLabel}
                    </span>
                  </div>

                  {/* Upload progress bar at card bottom */}
                  {f.uploadProgress !== undefined && (
                    <UploadProgressBar progress={f.uploadProgress} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## File Record Inspector — Action Bar Addendum

When the Record Inspector is opened for a file entity, a horizontal action bar renders directly below the filename/title area. It uses the existing inspector container and `InlineEditField` from §8.

```tsx
// FileInspectorActionBar.tsx
import { useState, useRef, useEffect } from "react";
import { FileMovePopover } from "./FileMovePopover";
import { ConfirmDialog } from "./ConfirmDialog"; // existing primitive from §8

interface FileInspectorActionBarProps {
  fileId: string;
  fileName: string;
  downloadUrl: string;
  shareableLink: string;
  panes: { id: string; name: string }[]; // destination options for Move
  onRename: (newName: string) => void;
  onMove: (destinationPaneId: string) => void;
  onRemove: () => void;
  onClose: () => void; // close inspector after remove
}

export function FileInspectorActionBar({
  fileId,
  fileName,
  downloadUrl,
  shareableLink,
  panes,
  onRename,
  onMove,
  onRemove,
  onClose,
}: FileInspectorActionBarProps) {
  const [copyLabel, setCopyLabel] = useState("Copy link");
  const [moveOpen, setMoveOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const moveButtonRef = useRef<HTMLButtonElement>(null);

  function handleCopyLink() {
    navigator.clipboard.writeText(shareableLink).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy link"), 2000);
    });
  }

  function handleMove(destId: string) {
    onMove(destId);
    setMoveOpen(false);
  }

  function handleRemoveConfirmed() {
    onRemove();
    setRemoveOpen(false);
    onClose();
  }

  const actions = [
    {
      label: "Download",
      onClick: () => { window.open(downloadUrl, "_blank", "noopener"); },
      danger: false,
    },
    {
      label: copyLabel,
      onClick: handleCopyLink,
      danger: false,
    },
  ];

  return (
    <>
      <div
        role="toolbar"
        aria-label="File actions"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-xs)",
          flexWrap: "wrap",
          padding: "var(--space-xs) 0",
          borderBottom: "1px solid var(--color-border-muted)",
          marginBottom: "var(--space-sm)",
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* Download + Copy link */}
        {actions.map((a) => (
          <ActionButton key={a.label} label={a.label} onClick={a.onClick} />
        ))}

        {/* Move — opens popover */}
        <div style={{ position: "relative" }}>
          <ActionButton
            ref={moveButtonRef}
            label="Move"
            onClick={() => setMoveOpen((o) => !o)}
            aria-expanded={moveOpen}
            aria-haspopup="listbox"
          />
          {moveOpen && (
            <FileMovePopover
              panes={panes}
              currentFileName={fileName}
              anchorRef={moveButtonRef}
              onSelect={handleMove}
              onClose={() => setMoveOpen(false)}
            />
          )}
        </div>

        {/* Rename — uses InlineEditField pattern inline */}
        <ActionButton label="Rename" onClick={() => {
          // Signal to parent inspector to put filename InlineEditField into edit mode
          // Implementation: parent passes an onRenameClick prop or uses a ref.
          // Here we expose onRename as a prop; the inspector title uses InlineEditField
          // and this button calls startEdit() on it.
          onRename(fileName);
        }} />

        {/* Remove — opens confirm dialog */}
        <ActionButton
          label="Remove"
          onClick={() => setRemoveOpen(true)}
          danger
        />
      </div>

      {/* Confirm remove dialog */}
      {removeOpen && (
        <ConfirmDialog
          heading={`Remove "${fileName}"?`}
          body="This file will be permanently removed from the project. This cannot be undone."
          confirmLabel="Remove file"
          onConfirm={handleRemoveConfirmed}
          onCancel={() => setRemoveOpen(false)}
        />
      )}
    </>
  );
}

// Small shared button for the action bar
import { forwardRef } from "react";

const ActionButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick: () => void;
    danger?: boolean;
    "aria-expanded"?: boolean;
    "aria-haspopup"?: string;
  }
>(function ActionButton({ label, onClick, danger, ...rest }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      style={{
        padding: "4px var(--space-xs)",
        borderRadius: "var(--radius-control)",
        border: `1px solid ${danger ? "color-mix(in srgb, var(--color-danger) 40%, transparent)" : "var(--color-border-muted)"}`,
        background: "transparent",
        color: danger ? "var(--color-danger)" : "var(--color-text)",
        fontSize: "12px",
        fontFamily: "var(--font-body)",
        cursor: "pointer",
        outline: "none",
        transition: "background 0.15s",
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
      {...rest}
    >
      {label}
    </button>
  );
});
```

---

## FileMovePopover

Opens anchored below the Move button. Lists available panes as destinations. Lightweight confirm built into the popover — not a separate dialog since this is relocating, not deleting.

```tsx
// FileMovePopover.tsx
import { useEffect, useRef } from "react";

interface FileMovePopoverProps {
  panes: { id: string; name: string }[];
  currentFileName: string;
  anchorRef: React.RefObject<HTMLElement>;
  onSelect: (paneId: string) => void;
  onClose: () => void;
}

export function FileMovePopover({
  panes,
  currentFileName,
  anchorRef,
  onSelect,
  onClose,
}: FileMovePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = (
    // two-step: pick then confirm
    [null, (v: string | null) => {}] as [string | null, (v: string | null) => void]
  );
  // Using useState properly:
  const [pending, setPending] = (useStateShim<string | null>(null));

  // Outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorRef, onClose]);

  // Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Move ${currentFileName} to pane`}
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 200,
        minWidth: "220px",
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border-muted)",
        borderRadius: "var(--radius-panel)",
        boxShadow: "0 4px 16px rgb(0 0 0 / 0.2)",
        padding: "var(--space-xs)",
        overflow: "visible",
      }}
    >
      {pending ? (
        // Confirm step
        <div style={{ padding: "var(--space-xs)" }}>
          <p style={{
            margin: "0 0 var(--space-xs)",
            fontSize: "13px",
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
          }}>
            Move to <strong>{panes.find((p) => p.id === pending)?.name}</strong>?
          </p>
          <div style={{ display: "flex", gap: "var(--space-xs)" }}>
            <button
              autoFocus
              onClick={() => onSelect(pending)}
              style={{
                flex: 1,
                padding: "var(--space-xs)",
                borderRadius: "var(--radius-control)",
                border: "none",
                background: "var(--color-primary)",
                color: "var(--color-on-primary)",
                fontSize: "12px",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                outline: "none",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              Move
            </button>
            <button
              onClick={() => setPending(null)}
              style={{
                flex: 1,
                padding: "var(--space-xs)",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--color-border-muted)",
                background: "transparent",
                color: "var(--color-text)",
                fontSize: "12px",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                outline: "none",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // Destination list
        <ul
          role="listbox"
          aria-label="Select destination pane"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          <li style={{
            padding: "var(--space-2xs) var(--space-xs)",
            fontSize: "11px",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
          }}>
            Move to pane
          </li>
          {panes.map((pane) => (
            <li key={pane.id} role="option" aria-selected={false}>
              <button
                onClick={() => setPending(pane.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "var(--space-xs) var(--space-sm)",
                  background: "transparent",
                  border: "none",
                  borderRadius: "var(--radius-control)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                  outline: "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "color-mix(in srgb, var(--color-primary) 8%, transparent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {pane.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Inline useState shim reference — replace with real import at the call site
function useStateShim<T>(init: T): [T, (v: T) => void] {
  // This is a placeholder comment — use React.useState in the real file
  // import { useState } from "react"; const [pending, setPending] = useState<string | null>(null);
  return [init, () => {}];
}
```

> **Note for implementor:** The `useStateShim` at the bottom of `FileMovePopover.tsx` is a placeholder comment artifact from the spec. Replace with a real `useState` import and call. The two-step confirm flow (pick pane → confirm) is intentional — it prevents accidental moves without being as heavy as a full dialog.

---

## Empty State

Applies to all three sizes when there are zero files and no active upload.

- **Small:** quiet muted text — "Add files to this pane" — centered in the list area, no icon, no button (the drop zone and `+` button are the invitation)
- **Medium / Large:** same copy, vertically centered in the content area with generous padding

---

## Accessibility Notes

- Upload progress changes are announced via `aria-live="polite"` on a visually-hidden region at the module root. Update the live region text when progress changes and when complete.
- The `+` button is the primary accessible upload entry point. Drag-and-drop is an enhancement.
- File rows and cards are `<button>` elements — keyboard reachable and activatable with Enter/Space.
- Remove requires confirm dialog with `autoFocus` on the destructive button (existing pattern from §8).
- `FileMovePopover` traps focus when open using the existing pattern established in §8.

---

*End of §11 — Files Module*

---

# §12 — Inbox Capture Module

## Overview

The Inbox Capture Module is a personal, solo scratchpad. No collaborative socket — Lexical editor but unsynced, owned by the current user only. Each saved entry collapses into a compact bar showing the first one to two lines. Entries can be quickly actioned (sent to Tasks, Reminders, or Calendar) without opening the full entry. Once actioned, the bar changes color state and shows a checkmark — n8n auto-archives actioned entries after 24 hours. Unactioned entries persist until manually archived. Archived entries live in a collapsible section at the bottom and are manually deleted.

**Two-context open behavior:**
- On the home screen of the Hub: new capture opens as a centered dialog box
- Inside a project: new capture opens in the Record Inspector sliding in from the right
- The bottom toolbar `+` button triggers whichever behavior is contextually correct

**Color identity:** Capture bars are deliberately distinct from Notification rows. Notifications use a faint primary pink tint. Capture bars use `var(--color-surface-elevated)` base with a warm teal left rail — personal, mine, not reactive.

```css
/* Capture-specific token — add to tokens.css */
--color-capture-rail: hsl(174, 60%, 45%); /* warm teal, rgb(46 185 166) approx */
--color-capture-rail-actioned: var(--color-primary); /* pink on actioned */
```

---

## Shared Primitives

### CaptureBar

The collapsed view of a single capture entry. Renders in all three module sizes.

**States:**
- `default` — teal left rail, quick action buttons visible on hover
- `actioned` — rail turns primary pink, checkmark icon replaces action buttons, no badge text needed
- `archived` — muted opacity, no actions, delete button only

```tsx
// CaptureBar.tsx
import { useState } from "react";

export interface CaptureEntry {
  id: string;
  previewText: string; // first ~2 lines of plain text extracted from Lexical doc
  createdAt: string; // formatted display string
  actioned: boolean;
  actionedDestination?: "tasks" | "reminder" | "calendar";
  archived: boolean;
}

interface CaptureBarProps {
  entry: CaptureEntry;
  onOpen: (entry: CaptureEntry) => void; // opens inspector or expands
  onAction: (id: string, destination: "tasks" | "reminder" | "calendar") => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void; // archive section only
  showDelete?: boolean; // true when rendered inside archive list
}

// CODE REVIEW NOTE: rail colors are teal/primary only — never reuse PRIORITY_COLORS here.

export function CaptureBar({
  entry,
  onOpen,
  onAction,
  onArchive,
  onDelete,
  showDelete,
}: CaptureBarProps) {
  const [hovered, setHovered] = useState(false);

  const railColor = entry.actioned
    ? "var(--color-capture-rail-actioned)"
    : "var(--color-capture-rail)";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2xs)",
        padding: "var(--space-xs) var(--space-sm)",
        paddingLeft: "calc(var(--space-sm) + 6px)", // room for rail
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-control)",
        opacity: entry.archived ? 0.5 : 1,
        transition: "opacity 0.15s",
        overflow: "visible",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left rail */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "3px",
          borderRadius: "var(--radius-control) 0 0 var(--radius-control)",
          background: railColor,
          transition: "background 0.2s ease",
        }}
      />

      {/* Preview text — clickable to open */}
      <button
        onClick={() => onOpen(entry)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          color: "var(--color-text)",
          fontFamily: "var(--font-body)",
          fontWeight: 500, // label weight — preview is the main content label
          fontSize: "13px",
          lineHeight: 1.45,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          outline: "none",
          width: "100%",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
          (e.currentTarget as HTMLElement).style.borderRadius = "2px";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
        aria-label={`Open capture: ${entry.previewText}`}
      >
        {entry.previewText}
      </button>

      {/* Footer row: timestamp + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-xs)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 400, // metadata weight
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-body)",
          }}
        >
          {entry.createdAt}
        </span>

        {/* Actions area */}
        {entry.actioned ? (
          // Actioned state — checkmark only
          <span
            aria-label="Actioned"
            style={{
              fontSize: "13px",
              color: "var(--color-primary)",
            }}
          >
            ✓
          </span>
        ) : showDelete ? (
          // Archive list — delete only
          <button
            onClick={() => onDelete(entry.id)}
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              padding: 0,
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            aria-label={`Delete capture: ${entry.previewText}`}
          >
            Delete
          </button>
        ) : (
          // Default — quick actions visible on hover (or always on touch)
          <div
            style={{
              display: "flex",
              gap: "var(--space-2xs)",
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.15s",
              // Always visible for keyboard users — opacity trick only for mouse
            }}
            aria-hidden={!hovered}
          >
            {(
              [
                { key: "tasks", label: "→ Tasks" },
                { key: "reminder", label: "→ Reminder" },
                { key: "calendar", label: "→ Calendar" },
              ] as const
            ).map((a) => (
              <button
                key={a.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(entry.id, a.key);
                }}
                tabIndex={hovered ? 0 : -1}
                style={{
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  background: "none",
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "var(--radius-control)",
                  padding: "2px var(--space-2xs)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  outline: "none",
                  whiteSpace: "nowrap",
                  transition: "color 0.1s, border-color 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-text)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--color-muted)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-muted)";
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
                aria-label={`${a.label} — ${entry.previewText}`}
              >
                {a.label}
              </button>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive(entry.id);
              }}
              tabIndex={hovered ? 0 : -1}
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                padding: "2px 0",
                outline: "none",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
              aria-label={`Archive capture: ${entry.previewText}`}
            >
              Archive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### CaptureEditorArea

The inline Lexical editor used in Medium and Large sizes. No socket, no collaboration — solo only. Renders a toolbar-free minimal editor with a Save button. On save, the entry collapses into a CaptureBar and the editor clears.

```tsx
// CaptureEditorArea.tsx
// Note: Lexical setup is project-specific. This component defines the shell
// and save behavior. Wire in your Lexical <LexicalComposer> and plugins as needed.

import { useRef } from "react";

interface CaptureEditorAreaProps {
  onSave: (plainTextPreview: string, lexicalState: unknown) => void;
  editorHeight?: number; // px, default 100
}

export function CaptureEditorArea({ onSave, editorHeight = 100 }: CaptureEditorAreaProps) {
  // In real implementation:
  // - Wrap with <LexicalComposer initialConfig={...}>
  // - Use <RichTextPlugin>, <OnChangePlugin> to track state
  // - Extract plain text preview (first 120 chars) for CaptureBar.previewText
  // - Clear editor on save via editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined)

  const editorRef = useRef<HTMLDivElement>(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-control)",
        border: "1px solid var(--color-border-muted)",
        overflow: "visible",
      }}
    >
      {/* Lexical editor mount point */}
      <div
        ref={editorRef}
        style={{
          minHeight: `${editorHeight}px`,
          padding: "var(--space-sm)",
          fontFamily: "var(--font-body)",
          fontSize: "14px",
          color: "var(--color-text)",
          lineHeight: "var(--leading-normal)",
          outline: "none",
          // Lexical ContentEditable will render here
        }}
        aria-label="Capture editor"
        aria-multiline="true"
      />

      {/* Save row */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "var(--space-2xs) var(--space-xs)",
          borderTop: "1px solid var(--color-border-muted)",
        }}
      >
        <button
          onClick={() => {
            // Call onSave with extracted preview text and Lexical state
            // onSave(plainTextPreview, editorState);
          }}
          style={{
            padding: "var(--space-2xs) var(--space-sm)",
            borderRadius: "var(--radius-control)",
            border: "none",
            background: "var(--color-primary)",
            color: "var(--color-on-primary)",
            fontSize: "13px",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            cursor: "pointer",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary-strong)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
```

---

### CaptureList

Shared list renderer used by all three sizes. Takes a slice of entries externally — the parent module decides how many to show.

```tsx
// CaptureList.tsx
import { useState } from "react";
import { CaptureBar } from "./CaptureBar";
import type { CaptureEntry } from "./CaptureBar";

interface CaptureListProps {
  entries: CaptureEntry[]; // already sliced by parent (top 5 for medium, all for large)
  archivedEntries: CaptureEntry[];
  onOpen: (entry: CaptureEntry) => void;
  onAction: (id: string, destination: "tasks" | "reminder" | "calendar") => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onClearArchive: () => void;
}

export function CaptureList({
  entries,
  archivedEntries,
  onOpen,
  onAction,
  onArchive,
  onDelete,
  onClearArchive,
}: CaptureListProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2xs)",
        overflow: "visible",
      }}
    >
      {/* Live entries */}
      {entries.length === 0 && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--color-muted)",
            fontFamily: "var(--font-heading)", // Outfit — reflective prompt language
            textAlign: "center",
            padding: "var(--space-md) 0",
            margin: 0,
          }}
        >
          What's on your mind?
        </p>
      )}
      {entries.map((entry) => (
        <CaptureBar
          key={entry.id}
          entry={entry}
          onOpen={onOpen}
          onAction={onAction}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}

      {/* Archive section */}
      {archivedEntries.length > 0 && (
        <div style={{ marginTop: "var(--space-xs)" }}>
          <button
            onClick={() => setArchiveOpen((o) => !o)}
            aria-expanded={archiveOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2xs)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-muted)",
              fontSize: "12px",
              fontFamily: "var(--font-body)",
              padding: "var(--space-2xs) 0",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <span aria-hidden="true">{archiveOpen ? "▾" : "▸"}</span>
            Archived ({archivedEntries.length})
          </button>

          {archiveOpen && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2xs)",
                marginTop: "var(--space-2xs)",
              }}
            >
              {archivedEntries.map((entry) => (
                <CaptureBar
                  key={entry.id}
                  entry={entry}
                  onOpen={onOpen}
                  onAction={onAction}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  showDelete
                />
              ))}
              <button
                onClick={onClearArchive}
                style={{
                  alignSelf: "flex-end",
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  padding: "var(--space-2xs) 0",
                  outline: "none",
                  marginTop: "var(--space-2xs)",
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                Clear all archived
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## CaptureModuleSmall

Bars only — no inline editor. Click a bar to open the inspector. The `+` button at the top opens a new blank capture in the inspector (or dialog on home screen). Shows all live entries — small module is intentionally compact with no list cap since there's no editor taking space.

```tsx
// CaptureModuleSmall.tsx
import { CaptureList } from "./CaptureList";
import type { CaptureEntry } from "./CaptureBar";

interface CaptureModuleSmallProps {
  entries: CaptureEntry[];
  archivedEntries: CaptureEntry[];
  onNewCapture: () => void; // opens inspector or dialog depending on context
  onOpen: (entry: CaptureEntry) => void;
  onAction: (id: string, destination: "tasks" | "reminder" | "calendar") => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onClearArchive: () => void;
}

export function CaptureModuleSmall({
  entries,
  archivedEntries,
  onNewCapture,
  onOpen,
  onAction,
  onArchive,
  onDelete,
  onClearArchive,
}: CaptureModuleSmallProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        padding: "var(--space-sm)",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-panel)",
        overflow: "visible",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            fontWeight: 700, // module heading weight
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Captures
        </span>
        <button
          onClick={onNewCapture}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "var(--radius-control)",
            border: "1px solid var(--color-border-muted)",
            background: "transparent",
            color: "var(--color-text)",
            fontSize: "18px",
            cursor: "pointer",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px var(--color-primary)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
          aria-label="New capture"
        >
          +
        </button>
      </div>

      <CaptureList
        entries={entries}
        archivedEntries={archivedEntries}
        onOpen={onOpen}
        onAction={onAction}
        onArchive={onArchive}
        onDelete={onDelete}
        onClearArchive={onClearArchive}
      />
    </div>
  );
}
```

---

## CaptureModuleMedium

Editor at top + top 5 live entries below.

```tsx
// CaptureModuleMedium.tsx
import { CaptureEditorArea } from "./CaptureEditorArea";
import { CaptureList } from "./CaptureList";
import type { CaptureEntry } from "./CaptureBar";

interface CaptureModuleMediumProps {
  entries: CaptureEntry[];
  archivedEntries: CaptureEntry[];
  onSave: (previewText: string, lexicalState: unknown) => void;
  onOpen: (entry: CaptureEntry) => void;
  onAction: (id: string, destination: "tasks" | "reminder" | "calendar") => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onClearArchive: () => void;
}

export function CaptureModuleMedium({
  entries,
  archivedEntries,
  onSave,
  onOpen,
  onAction,
  onArchive,
  onDelete,
  onClearArchive,
}: CaptureModuleMediumProps) {
  const TOP_N = 5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        padding: "var(--space-md)",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-panel)",
        overflow: "visible",
      }}
    >
      <CaptureEditorArea onSave={onSave} editorHeight={100} />
      <CaptureList
        entries={entries.slice(0, TOP_N)}
        archivedEntries={archivedEntries}
        onOpen={onOpen}
        onAction={onAction}
        onArchive={onArchive}
        onDelete={onDelete}
        onClearArchive={onClearArchive}
      />
    </div>
  );
}
```

---

## CaptureModuleLarge

Editor at top + full list — no slice cap.

```tsx
// CaptureModuleLarge.tsx
import { CaptureEditorArea } from "./CaptureEditorArea";
import { CaptureList } from "./CaptureList";
import type { CaptureEntry } from "./CaptureBar";

interface CaptureModuleLargeProps {
  entries: CaptureEntry[];
  archivedEntries: CaptureEntry[];
  onSave: (previewText: string, lexicalState: unknown) => void;
  onOpen: (entry: CaptureEntry) => void;
  onAction: (id: string, destination: "tasks" | "reminder" | "calendar") => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onClearArchive: () => void;
}

export function CaptureModuleLarge({
  entries,
  archivedEntries,
  onSave,
  onOpen,
  onAction,
  onArchive,
  onDelete,
  onClearArchive,
}: CaptureModuleLargeProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        padding: "var(--space-md)",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-panel)",
        overflow: "visible",
      }}
    >
      <CaptureEditorArea onSave={onSave} editorHeight={140} />
      <CaptureList
        entries={entries} // full list, no cap
        archivedEntries={archivedEntries}
        onOpen={onOpen}
        onAction={onAction}
        onArchive={onArchive}
        onDelete={onDelete}
        onClearArchive={onClearArchive}
      />
    </div>
  );
}
```

---

## n8n Auto-Archive Behavior (implementation note)

n8n watches for entries where `actioned === true`. After 24 hours from the `actionedAt` timestamp it sets `archived === true` on the entry. The module receives this state change via its normal data fetch — no client-side timer needed. The entry silently moves from the live list to the archive section on next render.

---

## Capture in the Record Inspector

When a capture is opened via the inspector (inside a project) or dialog (on home screen), it renders:
- Full Lexical editor with the saved content loaded
- Quick action buttons in the inspector action bar: **→ Tasks**, **→ Reminder**, **→ Calendar**
- **Archive** button in the action bar
- If already actioned: checkmark shown, action buttons replaced, archived timestamp shown if applicable
- Inspector title is the first line of the capture (truncated to one line)

---

## Accessibility Notes

- Quick action buttons are `tabIndex={-1}` when the bar is not hovered, `tabIndex={0}` when hovered. This keeps keyboard focus clean — keyboard users reach actions by focusing the bar and then Tabbing within it.
- `aria-live="polite"` region at module root announces when an entry is actioned or archived.
- Archive toggle uses `aria-expanded`.
- Empty state uses `var(--font-heading)` (Outfit) — consistent with the Tasks empty state reflective prompt language established in §8.

---

*End of §12 — Inbox Capture Module*

---

# §13 — Table Module

## Overview

The Table Module is a database record view powered by TanStack Table and TanStack Virtual. Rows are records, columns are the record type's fields. This is not a spreadsheet — no formulas, no merged cells, no freeform input. Simple tables inside workspace docs are handled by Lexical. This module is for structured record datasets only.

The design job here is purely a styling contract: map all visual elements to design tokens so the table feels native to the app. Behavior is largely delegated to TanStack Table.

---

## Visual Contract

### Table Shell

```tsx
// TableModule.tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { InlineEditField } from "./InlineEditField"; // existing primitive from §8

// CODE REVIEW NOTE: row accent colors and collaborator colors must not use pink range.
// PRIORITY_COLORS reserved for task priority only — never used as row tints here.

interface TableModuleProps<TData extends object> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onRowClick: (row: TData) => void; // opens Record Inspector
  onCellEdit?: (rowId: string, columnId: string, newValue: unknown) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function TableModule<TData extends object>({
  data,
  columns,
  onRowClick,
  onCellEdit,
  isLoading,
  emptyMessage = "No records yet",
}: TableModuleProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const parentRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // row height in px
    overscan: 10,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-panel)",
        overflow: "visible",
        height: "100%",
      }}
    >
      {/* Scrollable table container */}
      <div
        ref={parentRef}
        style={{
          flex: 1,
          overflow: "auto",
          borderRadius: "var(--radius-panel)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text)",
            tableLayout: "fixed",
          }}
          role="grid"
          aria-rowcount={rows.length}
        >
          {/* Header */}
          <thead
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: "var(--color-surface)",
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                          ? "descending"
                          : canSort
                          ? "none"
                          : undefined
                      }
                      style={{
                        padding: "var(--space-xs) var(--space-sm)",
                        textAlign: "left",
                        fontWeight: 700, // column heading weight
                        fontSize: "12px",
                        color: "var(--color-muted)",
                        borderBottom: "1px solid var(--color-border-muted)",
                        cursor: canSort ? "pointer" : "default",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        outline: "none",
                        transition: "color 0.1s",
                      }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "inset 0 0 0 2px var(--color-primary)";
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                      tabIndex={canSort ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (canSort && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          header.column.getToggleSortingHandler()?.(e);
                        }
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === "asc" && (
                        <span aria-hidden="true" style={{ marginLeft: "4px" }}>↑</span>
                      )}
                      {sorted === "desc" && (
                        <span aria-hidden="true" style={{ marginLeft: "4px" }}>↓</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Virtualized body */}
          <tbody
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: "var(--space-xl)",
                    textAlign: "center",
                    color: "var(--color-muted)",
                    fontSize: "13px",
                  }}
                >
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: "var(--space-xl)",
                    textAlign: "center",
                    color: "var(--color-muted)",
                    fontFamily: "var(--font-heading)",
                    fontSize: "14px",
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <TableRow
                    key={row.id}
                    row={row}
                    virtualRow={virtualRow}
                    onRowClick={onRowClick}
                    onCellEdit={onCellEdit}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — row count */}
      {!isLoading && rows.length > 0 && (
        <div
          style={{
            padding: "var(--space-2xs) var(--space-sm)",
            borderTop: "1px solid var(--color-border-muted)",
            fontSize: "11px",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            textAlign: "right",
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {rows.length} record{rows.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
```

---

### TableRow

Separated for clarity. Handles hover state, row click, and per-cell inline edit.

```tsx
// TableRow.tsx
import { useState } from "react";
import { flexRender, type Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";

interface TableRowProps<TData extends object> {
  row: Row<TData>;
  virtualRow: VirtualItem;
  onRowClick: (row: TData) => void;
  onCellEdit?: (rowId: string, columnId: string, newValue: unknown) => void;
}

export function TableRow<TData extends object>({
  row,
  virtualRow,
  onRowClick,
  onCellEdit,
}: TableRowProps<TData>) {
  const [hovered, setHovered] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  return (
    <tr
      key={row.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onRowClick(row.original)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualRow.start}px)`,
        height: `${virtualRow.size}px`,
        background: hovered
          ? "color-mix(in srgb, var(--color-primary) 5%, transparent)"
          : "transparent",
        borderBottom: "1px solid var(--color-border-muted)",
        cursor: "pointer",
        transition: "background 0.1s",
        display: "flex",
        alignItems: "center",
      }}
      aria-rowindex={virtualRow.index + 1}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          onClick={(e) => {
            if (onCellEdit) {
              e.stopPropagation(); // prevent row click when editing cell
              setEditingCell(cell.column.id);
            }
          }}
          style={{
            flex: 1,
            padding: "0 var(--space-sm)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "13px",
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            height: "100%",
            display: "flex",
            alignItems: "center",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "inset 0 0 0 2px var(--color-primary)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
            setEditingCell(null);
          }}
          tabIndex={onCellEdit ? 0 : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onCellEdit) {
              setEditingCell(cell.column.id);
            }
            if (e.key === "Escape") {
              setEditingCell(null);
            }
            if (e.key === "Tab") {
              setEditingCell(null); // let Tab move naturally to next cell
            }
          }}
        >
          {editingCell === cell.column.id && onCellEdit ? (
            // InlineEditField from §8 — reused here
            <InlineEditField
              value={String(cell.getValue() ?? "")}
              onSave={(val) => {
                onCellEdit(row.id, cell.column.id, val);
                setEditingCell(null);
              }}
              onCancel={() => setEditingCell(null)}
              autoFocus
            />
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </td>
      ))}
    </tr>
  );
}
```

---

## Styling Token Reference

All visual properties map directly to existing tokens — no new tokens introduced by this module.

| Element | Token |
|---|---|
| Table background | `var(--color-surface-elevated)` |
| Header background | `var(--color-surface)` |
| Header text | `var(--color-muted)` + `fontWeight: 700` |
| Row border | `var(--color-border-muted)` |
| Row hover | `color-mix(in srgb, var(--color-primary) 5%, transparent)` |
| Cell text | `var(--color-text)` + `fontWeight: 400` |
| Secondary cell text | `var(--color-text-secondary)` + `fontWeight: 400` |
| Sort indicator | `var(--color-text)` |
| Focus ring (header/cell) | `inset 0 0 0 2px var(--color-primary)` |
| Empty state text | `var(--font-heading)` + `var(--color-muted)` |
| Row count | `var(--color-muted)` + `fontWeight: 400` |

---

## Accessibility Notes

- `role="grid"` on the table element with `aria-rowcount`.
- Sortable column headers are `tabIndex={0}`, activate with Enter or Space, and carry `aria-sort`.
- Each row is keyboard reachable — Enter opens the Record Inspector.
- Editable cells are `tabIndex={0}`, Enter enters edit mode, Escape cancels, Tab exits naturally.
- Virtualized rows use `aria-rowindex` to preserve screen reader position.
- Row count footer uses `aria-live="polite"` so filter/sort result changes are announced.

---

*End of §13 — Table Module*

---

# §14 — Kanban Module

## Overview

The Kanban Module is a drag-and-drop card board powered by dnd-kit. Columns are derived from any grouping dimension the user chooses — status, assignee, priority, category, due date range, or any custom field on the record type. This module is shared: the Overview Tasks view and Work pane Kanban instances both use the same component, differing only in their data lens (`project` vs `pane_scratch` per the §6.4 contract).

Cards open the Record Inspector on click. Each card carries a `CommentIndicator` (§4) so comments are reachable directly from the board without opening the inspector first.

---

## Grouping Dimension System

The user picks one grouping dimension at a time. The board redraws columns from the unique values of that field. Config lives on the module instance and persists.

```ts
// types/kanban.ts

export type GroupingDimension =
  | "status"
  | "assignee"
  | "priority"
  | "category"
  | "due_date_range"
  | string; // custom field id

export interface KanbanColumn {
  id: string;
  label: string;
  color?: string; // optional left rail color for the column header
  cards: KanbanCard[];
  isAddable?: boolean; // true only when dimension === "status"
}

export interface KanbanCard {
  id: string;
  recordId: string;
  title: string;
  assignee?: { id: string; name: string; avatarUrl?: string };
  dueDate?: string; // formatted display string
  priority?: "high" | "medium" | "low";
  commentCount: number;
  hasUnreadComments: boolean;
}
```

---

## KanbanModule

Top-level component. Renders the dimension picker toolbar, the scrollable column track, and the add-column affordance.

```tsx
// KanbanModule.tsx
import { useState } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn as KanbanColumnComponent } from "./KanbanColumn";
import type { KanbanColumn, KanbanCard, GroupingDimension } from "./types/kanban";

// CODE REVIEW NOTE: column header colors and card accent colors must not use pink range.
// PRIORITY_COLORS from §A token addendum — amber for medium, sage for low, red for high.

interface KanbanModuleProps {
  columns: KanbanColumn[];
  activeGrouping: GroupingDimension;
  availableGroupings: { key: GroupingDimension; label: string }[];
  onGroupingChange: (dim: GroupingDimension) => void;
  onCardMove: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  onCardClick: (card: KanbanCard) => void; // opens Record Inspector
  onAddColumn: (label: string) => void; // status dimension only
  onAddCard: (columnId: string) => void;
  lens: "project" | "pane_scratch";
}

export function KanbanModule({
  columns,
  activeGrouping,
  availableGroupings,
  onGroupingChange,
  onCardMove,
  onCardClick,
  onAddColumn,
  onAddCard,
  lens,
}: KanbanModuleProps) {
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnLabel, setNewColumnLabel] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const cardId = String(active.id);
    const toColumnId = String(over.id);
    const fromColumn = columns.find((col) =>
      col.cards.some((c) => c.id === cardId)
    );
    if (fromColumn && fromColumn.id !== toColumnId) {
      onCardMove(cardId, fromColumn.id, toColumnId);
    }
  }

  function handleAddColumn() {
    if (newColumnLabel.trim()) {
      onAddColumn(newColumnLabel.trim());
      setNewColumnLabel("");
      setAddingColumn(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        height: "100%",
        overflow: "visible",
      }}
    >
      {/* Toolbar — grouping dimension picker + lens badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm)",
          padding: "0 var(--space-xs)",
          flexShrink: 0,
        }}
      >
        <div
          role="toolbar"
          aria-label="Group cards by"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2xs)" }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Group by:
          </span>
          {availableGroupings.map((g) => (
            <button
              key={g.key}
              onClick={() => onGroupingChange(g.key)}
              aria-pressed={activeGrouping === g.key}
              style={{
                padding: "4px var(--space-xs)",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--color-border-muted)",
                background:
                  activeGrouping === g.key
                    ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                    : "transparent",
                color:
                  activeGrouping === g.key
                    ? "var(--color-primary)"
                    : "var(--color-muted)",
                fontSize: "12px",
                fontWeight: 500, // chip label weight
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                outline: "none",
                transition: "background 0.15s, color 0.15s",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Lens badge — quiet indicator of data scope */}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 400,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            padding: "2px var(--space-xs)",
            border: "1px solid var(--color-border-muted)",
            borderRadius: "var(--radius-control)",
          }}
        >
          {lens === "project" ? "Project" : "This pane"}
        </span>
      </div>

      {/* Column track */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            overflowX: "auto",
            overflowY: "visible",
            flex: 1,
            padding: "0 var(--space-xs) var(--space-sm)",
            // No overflow:hidden — popovers must not clip
          }}
        >
          {columns.map((col) => (
            <KanbanColumnComponent
              key={col.id}
              column={col}
              onCardClick={onCardClick}
              onAddCard={onAddCard}
            />
          ))}

          {/* Add column — status dimension only */}
          {activeGrouping === "status" && (
            <div
              style={{
                flexShrink: 0,
                width: "240px",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xs)",
              }}
            >
              {addingColumn ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-xs)",
                    padding: "var(--space-xs)",
                    background: "var(--color-surface-elevated)",
                    borderRadius: "var(--radius-panel)",
                    border: "1px solid var(--color-border-muted)",
                  }}
                >
                  <input
                    autoFocus
                    type="text"
                    placeholder="Column name…"
                    value={newColumnLabel}
                    onChange={(e) => setNewColumnLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddColumn();
                      if (e.key === "Escape") {
                        setAddingColumn(false);
                        setNewColumnLabel("");
                      }
                    }}
                    style={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border-muted)",
                      borderRadius: "var(--radius-control)",
                      color: "var(--color-text)",
                      fontFamily: "var(--font-body)",
                      fontWeight: 400,
                      fontSize: "13px",
                      padding: "var(--space-2xs) var(--space-xs)",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 0 0 2px var(--color-primary)";
                    }}
                    onBlur={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                    aria-label="New column name"
                  />
                  <div style={{ display: "flex", gap: "var(--space-2xs)" }}>
                    <button
                      onClick={handleAddColumn}
                      style={{
                        flex: 1,
                        padding: "var(--space-2xs)",
                        borderRadius: "var(--radius-control)",
                        border: "none",
                        background: "var(--color-primary)",
                        color: "var(--color-on-primary)",
                        fontSize: "12px",
                        fontWeight: 500,
                        fontFamily: "var(--font-body)",
                        cursor: "pointer",
                        outline: "none",
                      }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "0 0 0 2px var(--color-primary-strong)";
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingColumn(false); setNewColumnLabel(""); }}
                      style={{
                        flex: 1,
                        padding: "var(--space-2xs)",
                        borderRadius: "var(--radius-control)",
                        border: "1px solid var(--color-border-muted)",
                        background: "transparent",
                        color: "var(--color-text)",
                        fontSize: "12px",
                        fontWeight: 500,
                        fontFamily: "var(--font-body)",
                        cursor: "pointer",
                        outline: "none",
                      }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "0 0 0 2px var(--color-primary)";
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  style={{
                    width: "100%",
                    padding: "var(--space-xs)",
                    borderRadius: "var(--radius-panel)",
                    border: `1.5px dashed var(--color-border-muted)`,
                    background: "transparent",
                    color: "var(--color-muted)",
                    fontSize: "13px",
                    fontWeight: 400,
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                    outline: "none",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-muted)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-muted)";
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 0 0 2px var(--color-primary)";
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                  aria-label="Add column"
                >
                  + Add column
                </button>
              )}
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}
```

---

## KanbanColumn

One column in the board. Renders the column header, card count, card list, and add-card button. Empty columns stay visible — collapsing creates confusion about where records went.

```tsx
// KanbanColumn.tsx
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanCard as KanbanCardComponent } from "./KanbanCard";
import type { KanbanColumn, KanbanCard } from "./types/kanban";

interface KanbanColumnProps {
  column: KanbanColumn;
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (columnId: string) => void;
}

export function KanbanColumn({ column, onCardClick, onAddCard }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      style={{
        flexShrink: 0,
        width: "260px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        overflow: "visible",
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-xs)",
          padding: "var(--space-xs) var(--space-xs)",
          borderRadius: "var(--radius-control)",
          // Optional left rail if column has a color (e.g. priority columns)
          ...(column.color
            ? {
                borderLeft: `3px solid ${column.color}`,
                paddingLeft: "calc(var(--space-xs) + 3px)",
              }
            : {}),
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700, // column heading weight
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {column.label}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 400, // metadata weight
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            flexShrink: 0,
          }}
          aria-label={`${column.cards.length} cards`}
        >
          {column.cards.length}
        </span>
      </div>

      {/* Card list — droppable area */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
          minHeight: "60px", // always a drop target even when empty
          padding: "var(--space-2xs)",
          borderRadius: "var(--radius-panel)",
          background: isOver
            ? "color-mix(in srgb, var(--color-primary) 5%, transparent)"
            : "transparent",
          border: isOver
            ? "1.5px dashed var(--color-primary)"
            : "1.5px dashed transparent",
          transition: "background 0.15s, border-color 0.15s",
          overflow: "visible",
        }}
        aria-label={`${column.label} column drop zone`}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.length === 0 ? (
            <p
              style={{
                fontSize: "12px",
                fontWeight: 400,
                color: "var(--color-muted)",
                fontFamily: "var(--font-body)",
                textAlign: "center",
                padding: "var(--space-md) 0",
                margin: 0,
              }}
            >
              No cards
            </p>
          ) : (
            column.cards.map((card) => (
              <KanbanCardComponent
                key={card.id}
                card={card}
                onClick={onCardClick}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Add card button */}
      <button
        onClick={() => onAddCard(column.id)}
        style={{
          width: "100%",
          padding: "var(--space-xs)",
          borderRadius: "var(--radius-control)",
          border: "none",
          background: "transparent",
          color: "var(--color-muted)",
          fontSize: "12px",
          fontWeight: 400,
          fontFamily: "var(--font-body)",
          cursor: "pointer",
          textAlign: "left",
          outline: "none",
          transition: "color 0.1s, background 0.1s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
          (e.currentTarget as HTMLElement).style.background =
            "color-mix(in srgb, var(--color-primary) 6%, transparent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-muted)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 0 0 2px var(--color-primary)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
        aria-label={`Add card to ${column.label}`}
      >
        + Add card
      </button>
    </div>
  );
}
```

---

## KanbanCard

The card face. Title at 700 weight is the dominant element. A single metadata row below carries priority dot, assignee avatar, due date, and the CommentIndicator pushed to the far right. All metadata uses `--color-text-secondary` at weight 400.

```tsx
// KanbanCard.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CommentIndicator } from "./CommentIndicator"; // existing primitive from §4
import type { KanbanCard } from "./types/kanban";

// CODE REVIEW NOTE: PRIORITY_COLORS from §A — amber for medium, sage for low.
// Never reuse these colors for categories, assignees, or column accents.
const PRIORITY_COLORS = {
  high:   "rgb(220 80 100)",
  medium: "rgb(245 168 80)",
  low:    "rgb(130 190 160)",
} as const;

interface KanbanCardProps {
  card: KanbanCard;
  onClick: (card: KanbanCard) => void;
}

export function KanbanCard({ card, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: "relative",
        overflow: "visible",
      }}
    >
      <button
        onClick={() => onClick(card)}
        {...attributes}
        {...listeners}
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
          padding: "var(--space-xs) var(--space-sm)",
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-border-muted)",
          borderRadius: "var(--radius-control)",
          cursor: isDragging ? "grabbing" : "pointer",
          textAlign: "left",
          outline: "none",
          transition: "border-color 0.15s, background 0.15s",
          boxShadow: isDragging ? "0 4px 16px rgb(0 0 0 / 0.25)" : "none",
          overflow: "visible",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 0 0 2px var(--color-primary)";
        }}
        onBlur={(e) => {
          if (!isDragging) {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            (e.currentTarget as HTMLElement).style.borderColor =
              "color-mix(in srgb, var(--color-primary) 40%, var(--color-border-muted))";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--color-border-muted)";
          }
        }}
        aria-label={`Open record: ${card.title}`}
      >
        {/* Card title — dominant element */}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700, // card title — the thing you look at first
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {card.title}
        </span>

        {/* Metadata row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
          }}
        >
          {/* Priority dot */}
          {card.priority && (
            <span
              aria-label={`Priority: ${card.priority}`}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: PRIORITY_COLORS[card.priority],
                flexShrink: 0,
                display: "inline-block",
              }}
            />
          )}

          {/* Assignee avatar */}
          {card.assignee && (
            <span
              aria-label={card.assignee.name}
              title={card.assignee.name}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border-muted)",
                overflow: "hidden",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 500,
                // CODE REVIEW NOTE: avatar background color is surface — never pink range
                color: "var(--color-muted)",
              }}
            >
              {card.assignee.avatarUrl ? (
                <img
                  src={card.assignee.avatarUrl}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                card.assignee.name.charAt(0).toUpperCase()
              )}
            </span>
          )}

          {/* Due date */}
          {card.dueDate && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 400, // metadata weight
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-body)",
                whiteSpace: "nowrap",
              }}
            >
              {card.dueDate}
            </span>
          )}

          {/* Comment indicator — pushed to far right */}
          {/* Reuses CommentIndicator from §4 exactly */}
          <div style={{ marginLeft: "auto" }}>
            <CommentIndicator
              commentCount={card.commentCount}
              hasUnread={card.hasUnreadComments}
              onOpen={(e) => {
                e.stopPropagation(); // prevent card click when opening comments
                // Parent should handle routing to CommentThread in Record Inspector
              }}
            />
          </div>
        </div>
      </button>
    </div>
  );
}
```

---

## Keyboard Move Flow

dnd-kit's `KeyboardSensor` handles the accessible move path. The flow is:

1. Tab to a card — card receives focus
2. Space to pick it up — screen reader announces "Picked up card [title]"
3. Arrow keys move it between positions within the column or across columns
4. Space to drop — screen reader announces "Dropped card [title] in [column] at position n"
5. Escape cancels — card returns to original position

This is the VoiceOver-compatible path. No `Cmd`/`Option` combos — arrow keys only, consistent with the keyboard rule established in the session hard rules.

---

## Accessibility Notes

- `DndContext` announcements handled by dnd-kit's built-in `Announcements` — customize the strings to include column name and position for screen reader clarity.
- Empty columns keep `minHeight: 60px` and remain as valid drop targets — never disappear.
- CommentIndicator on the card uses `e.stopPropagation()` so activating it doesn't also open the Record Inspector.
- Column add-card button is labeled by column name: `aria-label="Add card to [column name]"`.
- Lens badge communicates data scope to screen readers without requiring interaction.

---

*End of §14 — Kanban Module*

---

# §15 — Asset Library

Deferred to v2. Provider OAuth integration (Dropbox, Google Drive, Nextcloud) requires backend token management and provider-specific API wrappers that are not scoped for v1. The Files Module (§11) handles all project-attached file needs in v1. The Asset Library will be designed once the backend provider connection story is established.

---

# §16 — Automation Builder

## Overview

The Automation Builder lives in the Tools tab. It lets users create Activity Pieces automations with a fixed three-part structure: **trigger → field mapping → action**. This is not a pipeline builder or a flowchart — it is a structured form. One trigger, one action, optional field mapping in between.

**v1 scope boundary (locked):**
- Triggers: Hub record events only (created, updated, status changed, due date passed, field changed)
- Field mapping: pull field values from the triggered record and related records into the action
- Actions: send email, send Hub notification, create a Hub record
- One action per rule in v1
- Multi-step chaining, branching, loops, and external service calls (Zoom transcription etc.) are v2

---

## Data Types

```ts
// types/automation.ts

export type TriggerEvent =
  | "record.created"
  | "record.updated"
  | "record.status_changed"
  | "record.due_date_passed"
  | "record.field_changed";

export type ActionType =
  | "send_email"
  | "send_hub_notification"
  | "create_record";

export interface FieldMapping {
  id: string;
  label: string; // human-readable e.g. "Invoice recipient email"
  sourceField: string; // field path on the triggered record e.g. "client.email"
  targetSlot: string; // where it maps in the action e.g. "to_address"
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    event: TriggerEvent;
    recordType: string; // e.g. "invoice", "task", "student_session"
    fieldCondition?: { field: string; value: string }; // optional — "only when status = paid"
  };
  fieldMappings: FieldMapping[];
  action: {
    type: ActionType;
    config: Record<string, string>; // slots filled by field mappings or static values
  };
  lastRunAt?: string;
  runCount: number;
  lastRunStatus?: "success" | "failure";
}
```

---

## AutomationBuilder

Top-level component for the Tools tab automation section. Shows the list of existing rules and a button to create a new one. Creating or editing opens the `AutomationRuleEditor`.

```tsx
// AutomationBuilder.tsx
import { useState } from "react";
import { AutomationRuleRow } from "./AutomationRuleRow";
import { AutomationRuleEditor } from "./AutomationRuleEditor";
import type { AutomationRule } from "./types/automation";

interface AutomationBuilderProps {
  rules: AutomationRule[];
  onSave: (rule: AutomationRule) => void;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onDelete: (ruleId: string) => void;
  availableRecordTypes: string[];
  isLoading?: boolean;
}

export function AutomationBuilder({
  rules,
  onSave,
  onToggle,
  onDelete,
  availableRecordTypes,
  isLoading,
}: AutomationBuilderProps) {
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [creating, setCreating] = useState(false);

  if (editing || creating) {
    return (
      <AutomationRuleEditor
        rule={editing ?? undefined}
        availableRecordTypes={availableRecordTypes}
        onSave={(rule) => {
          onSave(rule);
          setEditing(null);
          setCreating(false);
        }}
        onCancel={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        padding: "var(--space-lg)",
        overflow: "visible",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-heading-3)",
              fontWeight: 700,
              color: "var(--color-text)",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Automations
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 400,
              color: "var(--color-muted)",
              margin: "var(--space-2xs) 0 0",
            }}
          >
            Rules run automatically when conditions are met in this project.
          </p>
        </div>

        <button
          onClick={() => setCreating(true)}
          style={{
            padding: "var(--space-xs) var(--space-md)",
            borderRadius: "var(--radius-control)",
            border: "none",
            background: "var(--color-primary)",
            color: "var(--color-on-primary)",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "var(--font-body)",
            cursor: "pointer",
            outline: "none",
            flexShrink: 0,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 2px var(--color-primary-strong)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          New rule
        </button>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <p
          style={{
            fontSize: "13px",
            fontWeight: 400,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          Loading…
        </p>
      ) : rules.length === 0 ? (
        <div
          style={{
            padding: "var(--space-xl) 0",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              fontWeight: 400,
              color: "var(--color-muted)",
              margin: 0,
            }}
          >
            No automations yet.
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 400,
              color: "var(--color-muted)",
              margin: "var(--space-xs) 0 0",
            }}
          >
            Rules run in the background — once created they just work.
          </p>
        </div>
      ) : (
        <div
          role="list"
          aria-label="Automation rules"
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}
        >
          {rules.map((rule) => (
            <div role="listitem" key={rule.id}>
              <AutomationRuleRow
                rule={rule}
                onEdit={() => setEditing(rule)}
                onToggle={(enabled) => onToggle(rule.id, enabled)}
                onDelete={() => onDelete(rule.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## AutomationRuleRow

One rule in the list. Shows the rule name, a human-readable summary of what it does, enabled/disabled toggle, run history, and edit/delete actions.

```tsx
// AutomationRuleRow.tsx
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog"; // existing primitive from §8
import type { AutomationRule } from "./types/automation";

const TRIGGER_LABELS: Record<string, string> = {
  "record.created": "created",
  "record.updated": "updated",
  "record.status_changed": "status changed",
  "record.due_date_passed": "due date passed",
  "record.field_changed": "field changed",
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "sends an email",
  send_hub_notification: "sends a Hub notification",
  create_record: "creates a record",
};

interface AutomationRuleRowProps {
  rule: AutomationRule;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}

export function AutomationRuleRow({
  rule,
  onEdit,
  onToggle,
  onDelete,
}: AutomationRuleRowProps) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const summary = `When a ${rule.trigger.recordType} is ${TRIGGER_LABELS[rule.trigger.event] ?? rule.trigger.event}, ${ACTION_LABELS[rule.action.type] ?? rule.action.type}.`;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          padding: "var(--space-sm) var(--space-md)",
          background: "var(--color-surface-elevated)",
          borderRadius: "var(--radius-panel)",
          border: "1px solid var(--color-border-muted)",
          opacity: rule.enabled ? 1 : 0.5,
          transition: "opacity 0.15s",
          overflow: "visible",
        }}
      >
        {/* Enabled toggle */}
        <button
          role="switch"
          aria-checked={rule.enabled}
          onClick={() => onToggle(!rule.enabled)}
          aria-label={`${rule.enabled ? "Disable" : "Enable"} rule: ${rule.name}`}
          style={{
            width: "32px",
            height: "18px",
            borderRadius: "9px",
            border: "none",
            background: rule.enabled
              ? "var(--color-primary)"
              : "var(--color-border-muted)",
            position: "relative",
            cursor: "pointer",
            flexShrink: 0,
            outline: "none",
            transition: "background 0.2s",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 2px var(--color-primary)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "2px",
              left: rule.enabled ? "16px" : "2px",
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              background: "var(--color-on-primary)",
              transition: "left 0.2s",
            }}
          />
        </button>

        {/* Rule name + summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 700, // rule name — dominant element
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {rule.name}
          </span>
          <span
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 400, // summary — supporting text
              color: "var(--color-text-secondary)",
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {summary}
          </span>
        </div>

        {/* Run history */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            flexShrink: 0,
            gap: "2px",
          }}
        >
          {rule.lastRunAt && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 400,
                color: rule.lastRunStatus === "failure"
                  ? "var(--color-danger)"
                  : "var(--color-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {rule.lastRunStatus === "failure" ? "Failed" : "Last run"} {rule.lastRunAt}
            </span>
          )}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 400,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            {rule.runCount} run{rule.runCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Actions — visible on hover */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2xs)",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.15s",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onEdit}
            tabIndex={hovered ? 0 : -1}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-muted)",
              background: "none",
              border: "1px solid var(--color-border-muted)",
              borderRadius: "var(--radius-control)",
              padding: "3px var(--space-xs)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 0 2px var(--color-primary)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            aria-label={`Edit rule: ${rule.name}`}
          >
            Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            tabIndex={hovered ? 0 : -1}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-danger)",
              background: "none",
              border: `1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)`,
              borderRadius: "var(--radius-control)",
              padding: "3px var(--space-xs)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 0 2px var(--color-primary)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            aria-label={`Delete rule: ${rule.name}`}
          >
            Delete
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          heading={`Delete "${rule.name}"?`}
          body="This rule will stop running immediately and cannot be recovered."
          confirmLabel="Delete rule"
          onConfirm={() => { onDelete(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
```

---

## AutomationRuleEditor

The three-part form. Structured as three stacked sections — Trigger, Field Mapping, Action — each clearly headed. Validation errors appear inline beneath the relevant field. Summary of errors shown at the top on failed submit attempt.

```tsx
// AutomationRuleEditor.tsx
import { useState } from "react";
import type {
  AutomationRule,
  TriggerEvent,
  ActionType,
  FieldMapping,
} from "./types/automation";

const TRIGGER_OPTIONS: { value: TriggerEvent; label: string }[] = [
  { value: "record.created", label: "Record is created" },
  { value: "record.updated", label: "Record is updated" },
  { value: "record.status_changed", label: "Record status changes" },
  { value: "record.due_date_passed", label: "Due date passes" },
  { value: "record.field_changed", label: "A field changes" },
];

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "send_email", label: "Send an email" },
  { value: "send_hub_notification", label: "Send a Hub notification" },
  { value: "create_record", label: "Create a record" },
];

interface AutomationRuleEditorProps {
  rule?: AutomationRule; // undefined = new rule
  availableRecordTypes: string[];
  onSave: (rule: AutomationRule) => void;
  onCancel: () => void;
}

export function AutomationRuleEditor({
  rule,
  availableRecordTypes,
  onSave,
  onCancel,
}: AutomationRuleEditorProps) {
  const [name, setName] = useState(rule?.name ?? "");
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>(
    rule?.trigger.event ?? "record.created"
  );
  const [recordType, setRecordType] = useState(
    rule?.trigger.recordType ?? availableRecordTypes[0] ?? ""
  );
  const [actionType, setActionType] = useState<ActionType>(
    rule?.action.type ?? "send_email"
  );
  const [errors, setErrors] = useState<string[]>([]);

  function validate(): string[] {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Rule name is required.");
    if (!recordType.trim()) errs.push("Record type is required.");
    return errs;
  }

  function handleSave() {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }

    onSave({
      id: rule?.id ?? `rule_${Date.now()}`,
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      trigger: { event: triggerEvent, recordType },
      fieldMappings: rule?.fieldMappings ?? [],
      action: { type: actionType, config: rule?.action.config ?? {} },
      runCount: rule?.runCount ?? 0,
      lastRunAt: rule?.lastRunAt,
      lastRunStatus: rule?.lastRunStatus,
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
        padding: "var(--space-lg)",
        maxWidth: "560px",
        overflow: "visible",
      }}
    >
      {/* Editor heading */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
        <button
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-muted)",
            fontSize: "18px",
            cursor: "pointer",
            padding: 0,
            outline: "none",
            lineHeight: 1,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 2px var(--color-primary)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
          aria-label="Back to automation list"
        >
          ‹
        </button>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-heading-3)",
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          {rule ? "Edit rule" : "New rule"}
        </h2>
      </div>

      {/* Validation error summary */}
      {errors.length > 0 && (
        <div
          role="alert"
          style={{
            padding: "var(--space-xs) var(--space-sm)",
            borderLeft: "4px solid var(--color-danger)",
            background: "var(--color-danger-subtle)",
            borderRadius: "0 var(--radius-control) var(--radius-control) 0",
          }}
        >
          {errors.map((err, i) => (
            <p
              key={i}
              style={{
                margin: i === 0 ? 0 : "var(--space-2xs) 0 0",
                fontSize: "13px",
                fontWeight: 700, // error message — high visibility
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
              }}
            >
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Rule name */}
      <EditorSection label="Rule name" htmlFor="rule-name">
        <input
          id="rule-name"
          type="text"
          placeholder="e.g. Send invoice on creation"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors([]); }}
          style={inputStyle}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 2px var(--color-primary)";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--color-border-muted)";
          }}
        />
      </EditorSection>

      {/* Trigger section */}
      <EditorSection label="Trigger" description="When does this rule run?">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <div style={{ display: "flex", gap: "var(--space-xs)" }}>
            <div style={{ flex: 1 }}>
              <label
                style={fieldLabelStyle}
                htmlFor="trigger-record-type"
              >
                Record type
              </label>
              <select
                id="trigger-record-type"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                style={selectStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 0 2px var(--color-primary)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {availableRecordTypes.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt.charAt(0).toUpperCase() + rt.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabelStyle} htmlFor="trigger-event">
                Event
              </label>
              <select
                id="trigger-event"
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value as TriggerEvent)}
                style={selectStyle}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 0 2px var(--color-primary)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {TRIGGER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Human-readable preview */}
          <p style={previewStyle}>
            When a <strong>{recordType || "record"}</strong> is{" "}
            <strong>
              {TRIGGER_OPTIONS.find((o) => o.value === triggerEvent)?.label.toLowerCase() ??
                triggerEvent}
            </strong>
            …
          </p>
        </div>
      </EditorSection>

      {/* Action section */}
      <EditorSection label="Action" description="What should happen?">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          <div>
            <label style={fieldLabelStyle} htmlFor="action-type">
              Action type
            </label>
            <select
              id="action-type"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
              style={selectStyle}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Human-readable preview */}
          <p style={previewStyle}>
            …{" "}
            <strong>
              {ACTION_OPTIONS.find((o) => o.value === actionType)?.label.toLowerCase() ??
                actionType}
            </strong>
            .
          </p>

          <p
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
              margin: 0,
            }}
          >
            Action configuration (recipient, message, etc.) is set up after saving.
          </p>
        </div>
      </EditorSection>

      {/* Save / Cancel */}
      <div style={{ display: "flex", gap: "var(--space-xs)", paddingTop: "var(--space-xs)" }}>
        <button
          onClick={handleSave}
          style={{
            padding: "var(--space-xs) var(--space-lg)",
            borderRadius: "var(--radius-control)",
            border: "none",
            background: "var(--color-primary)",
            color: "var(--color-on-primary)",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "var(--font-body)",
            cursor: "pointer",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 2px var(--color-primary-strong)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          {rule ? "Save changes" : "Create rule"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "var(--space-xs) var(--space-md)",
            borderRadius: "var(--radius-control)",
            border: "1px solid var(--color-border-muted)",
            background: "transparent",
            color: "var(--color-text)",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "var(--font-body)",
            cursor: "pointer",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 2px var(--color-primary)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Shared style objects for the editor form

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-xs) var(--space-sm)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border-muted)",
  borderRadius: "var(--radius-control)",
  color: "var(--color-text)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right var(--space-sm) center",
  paddingRight: "var(--space-xl)",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500, // field label weight
  color: "var(--color-muted)",
  fontFamily: "var(--font-body)",
  marginBottom: "var(--space-2xs)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const previewStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 400,
  color: "var(--color-text-secondary)",
  fontFamily: "var(--font-body)",
  margin: 0,
  padding: "var(--space-xs) var(--space-sm)",
  background: "var(--color-surface)",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--color-border-muted)",
};

// EditorSection — labeled section wrapper
function EditorSection({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        paddingTop: "var(--space-sm)",
        borderTop: "1px solid var(--color-border-muted)",
      }}
    >
      <div>
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              fontWeight: 700, // section heading weight
              color: "var(--color-text)",
              display: "block",
            }}
          >
            {label}
          </label>
        ) : (
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            {label}
          </p>
        )}
        {description && (
          <p
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
              margin: "var(--space-2xs) 0 0",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
```

---

## Accessibility Notes

- Enabled toggle uses `role="switch"` with `aria-checked` — correct semantic for an on/off control.
- Validation errors are in a `role="alert"` container so screen readers announce them immediately on failed submit.
- The human-readable preview sentences ("When a task is created… send an email") give non-technical users confidence about what they've built before saving. These are not editable — they are derived from the form state.
- Delete requires `ConfirmDialog` with `autoFocus` on the destructive button, consistent with the pattern from §8.
- Back button in the editor uses `aria-label="Back to automation list"` — not just "Back".
- Action configuration detail (recipient address, message body etc.) is a second step after saving the rule skeleton — this keeps the creation form simple and non-overwhelming. The configuration step is deferred to v2 detail design.

---

*End of §16 — Automation Builder*

---

# §8-A — Relations Section (Record Inspector Addendum)

## Overview

`RelationsSection` renders inside the Record Inspector (§8) and manages all relation editing end-to-end. It shows outgoing relations (links from this record to others) and incoming relations (links from other records to this one). Users can add and remove relations inline. No navigation side-effects — clicking a related record opens it in the same inspector panel using the existing back-button pattern from §8.

Three components: `RelationsSection` (orchestrator), `RelationPicker` (add flow), `RelationRow` (display + remove).

---

## RelationRow

Reusable row for displaying a single relation and its remove action. Used in both outgoing and incoming lists.

```tsx
// RelationRow.tsx
import { useState } from "react";

interface RelationRowProps {
  relationId: string;
  recordLabel: string; // display name of the related record
  fieldLabel: string;  // name of the relation field e.g. "Client", "Project"
  isRemoving: boolean; // true while this relation's remove is in flight
  onRemove: (relationId: string) => void;
  onOpenRecord?: () => void; // opens related record in inspector
}

export function RelationRow({
  relationId,
  recordLabel,
  fieldLabel,
  isRemoving,
  onRemove,
  onOpenRecord,
}: RelationRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        padding: "var(--space-xs) var(--space-sm)",
        borderRadius: "var(--radius-control)",
        background: hovered
          ? "color-mix(in srgb, var(--color-primary) 5%, transparent)"
          : "transparent",
        opacity: isRemoving ? 0.4 : 1,
        transition: "background 0.15s, opacity 0.15s",
        overflow: "visible",
      }}
    >
      {/* Field label badge */}
      <span
        style={{
          fontSize: "11px",
          fontWeight: 500, // chip label weight
          color: "var(--color-muted)",
          fontFamily: "var(--font-body)",
          padding: "2px var(--space-2xs)",
          border: "1px solid var(--color-border-muted)",
          borderRadius: "var(--radius-control)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {fieldLabel}
      </span>

      {/* Record name — clickable if onOpenRecord provided */}
      {onOpenRecord ? (
        <button
          onClick={onOpenRecord}
          style={{
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            fontWeight: 500, // label weight
            fontSize: "13px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 2px var(--color-primary)";
            (e.currentTarget as HTMLElement).style.borderRadius = "2px";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
          aria-label={`Open record: ${recordLabel}`}
        >
          {recordLabel}
        </button>
      ) : (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: "13px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {recordLabel}
        </span>
      )}

      {/* Remove button — visible on hover or when removing */}
      <button
        onClick={() => onRemove(relationId)}
        disabled={isRemoving}
        tabIndex={hovered ? 0 : -1}
        style={{
          opacity: hovered || isRemoving ? 1 : 0,
          transition: "opacity 0.15s",
          background: "none",
          border: "none",
          cursor: isRemoving ? "not-allowed" : "pointer",
          color: "var(--color-muted)",
          fontFamily: "var(--font-body)",
          fontSize: "11px",
          fontWeight: 400,
          padding: "2px var(--space-2xs)",
          borderRadius: "var(--radius-control)",
          outline: "none",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-danger)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--color-muted)";
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 0 0 2px var(--color-primary)";
          (e.currentTarget as HTMLElement).style.opacity = "1";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
        aria-label={`Remove relation to ${recordLabel}`}
      >
        {isRemoving ? "Removing…" : "Remove"}
      </button>
    </div>
  );
}
```

---

## RelationPicker

A two-step popover. Step 1: pick the relation field. Step 2: search for and select the target record. Confirm triggers `onConfirm`. ESC closes at any step and returns focus to the add button.

```tsx
// RelationPicker.tsx
import { useEffect, useRef, useState } from "react";

interface RelationField {
  field_id: string;
  name: string;
  target_collection_id: string | null;
}

interface RecordSearchResult {
  id: string;
  label: string;
  collection: string;
}

interface RelationPickerProps {
  relationFields: RelationField[];
  anchorRef: React.RefObject<HTMLElement>;
  onConfirm: (payload: { to_record_id: string; via_field_id: string }) => void;
  onClose: () => void;
  // Caller provides search — keeps picker decoupled from API
  onSearch: (query: string, collectionId: string | null) => Promise<RecordSearchResult[]>;
}

type Step = "pick-field" | "pick-record";

export function RelationPicker({
  relationFields,
  anchorRef,
  onConfirm,
  onClose,
  onSearch,
}: RelationPickerProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick-field");
  const [selectedField, setSelectedField] = useState<RelationField | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecordSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordSearchResult | null>(null);

  // Outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorRef, onClose]);

  // Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-focus search input when moving to step 2
  useEffect(() => {
    if (step === "pick-record") {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [step]);

  // Debounced search
  useEffect(() => {
    if (step !== "pick-record" || !selectedField) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await onSearch(query, selectedField.target_collection_id);
        setResults(res);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, step, selectedField, onSearch]);

  function handleSelectField(field: RelationField) {
    setSelectedField(field);
    setStep("pick-record");
  }

  function handleSelectRecord(record: RecordSearchResult) {
    setSelectedRecord(record);
  }

  function handleConfirm() {
    if (!selectedField || !selectedRecord) return;
    onConfirm({ to_record_id: selectedRecord.id, via_field_id: selectedField.field_id });
    onClose();
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={step === "pick-field" ? "Select relation field" : "Search for record"}
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 200,
        width: "280px",
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border-muted)",
        borderRadius: "var(--radius-panel)",
        boxShadow: "0 4px 16px rgb(0 0 0 / 0.2)",
        overflow: "visible",
      }}
    >
      {/* Step 1 — pick relation field */}
      {step === "pick-field" && (
        <div style={{ padding: "var(--space-xs)" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: "0 0 var(--space-xs)",
              padding: "0 var(--space-xs)",
            }}
          >
            Relation field
          </p>
          <ul
            role="listbox"
            aria-label="Relation fields"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {relationFields.map((field) => (
              <li key={field.field_id} role="option" aria-selected={false}>
                <button
                  onClick={() => handleSelectField(field)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "var(--space-xs) var(--space-sm)",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-control)",
                    color: "var(--color-text)",
                    fontFamily: "var(--font-body)",
                    fontWeight: 500, // label weight
                    fontSize: "13px",
                    cursor: "pointer",
                    outline: "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "color-mix(in srgb, var(--color-primary) 8%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 0 0 2px var(--color-primary)";
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  {field.name}
                  {field.target_collection_id && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 400,
                        color: "var(--color-muted)",
                        marginLeft: "var(--space-xs)",
                      }}
                    >
                      → {field.target_collection_id}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 2 — search for record */}
      {step === "pick-record" && selectedField && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              padding: "var(--space-xs) var(--space-sm)",
              borderBottom: "1px solid var(--color-border-muted)",
            }}
          >
            <button
              onClick={() => { setStep("pick-field"); setSelectedRecord(null); setQuery(""); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-muted)",
                fontSize: "16px",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
                outline: "none",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 0 2px var(--color-primary)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
              aria-label="Back to field selection"
            >
              ‹
            </button>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--color-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {selectedField.name}
            </span>
          </div>

          {/* Search input */}
          <div style={{ padding: "var(--space-xs)" }}>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search records…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedRecord(null); }}
              style={{
                width: "100%",
                padding: "var(--space-2xs) var(--space-xs)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border-muted)",
                borderRadius: "var(--radius-control)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 0 2px var(--color-primary)";
                (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--color-border-muted)";
              }}
              aria-label="Search for target record"
            />
          </div>

          {/* Results */}
          <ul
            role="listbox"
            aria-label="Record search results"
            style={{
              listStyle: "none",
              margin: 0,
              padding: "0 var(--space-xs)",
              maxHeight: "180px",
              overflowY: "auto",
            }}
          >
            {searching && (
              <li
                style={{
                  padding: "var(--space-xs) var(--space-sm)",
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "var(--color-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Searching…
              </li>
            )}
            {!searching && results.length === 0 && query.trim() && (
              <li
                style={{
                  padding: "var(--space-xs) var(--space-sm)",
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "var(--color-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                No records found
              </li>
            )}
            {results.map((record) => (
              <li key={record.id} role="option" aria-selected={selectedRecord?.id === record.id}>
                <button
                  onClick={() => handleSelectRecord(record)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "var(--space-xs) var(--space-sm)",
                    background:
                      selectedRecord?.id === record.id
                        ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                        : "transparent",
                    border: "none",
                    borderRadius: "var(--radius-control)",
                    cursor: "pointer",
                    outline: "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedRecord?.id !== record.id) {
                      (e.currentTarget as HTMLElement).style.background =
                        "color-mix(in srgb, var(--color-primary) 6%, transparent)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedRecord?.id !== record.id) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 0 0 2px var(--color-primary)";
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--color-text)",
                      fontFamily: "var(--font-body)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {record.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 400,
                      color: "var(--color-text-secondary)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {record.collection}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Confirm row */}
          <div
            style={{
              padding: "var(--space-xs)",
              borderTop: "1px solid var(--color-border-muted)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={handleConfirm}
              disabled={!selectedRecord}
              style={{
                padding: "var(--space-2xs) var(--space-sm)",
                borderRadius: "var(--radius-control)",
                border: "none",
                background: selectedRecord
                  ? "var(--color-primary)"
                  : "var(--color-border-muted)",
                color: selectedRecord ? "var(--color-on-primary)" : "var(--color-muted)",
                fontSize: "12px",
                fontWeight: 500,
                fontFamily: "var(--font-body)",
                cursor: selectedRecord ? "pointer" : "not-allowed",
                opacity: selectedRecord ? 1 : 0.4,
                outline: "none",
                transition: "background 0.15s, opacity 0.15s",
              }}
              onFocus={(e) => {
                if (selectedRecord) {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 0 2px var(--color-primary-strong)";
                }
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
              aria-disabled={!selectedRecord}
            >
              Add relation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## RelationsSection

Orchestrates the full section. Renders inside the Record Inspector below fields and above Comments.

```tsx
// RelationsSection.tsx
import { useRef, useState } from "react";
import { RelationRow } from "./RelationRow";
import { RelationPicker } from "./RelationPicker";

interface RelationField {
  field_id: string;
  name: string;
  target_collection_id: string | null;
}

interface OutgoingRelation {
  relation_id: string;
  to_record_id: string;
  via_field_id: string;
  to_record?: { id: string; label: string; collection: string };
}

interface IncomingRelation {
  relation_id: string;
  from_record_id: string;
  via_field_id: string;
  from_record?: { id: string; label: string; collection: string };
}

interface RecordSearchResult {
  id: string;
  label: string;
  collection: string;
}

interface RelationsSectionProps {
  accessToken: string;
  projectId: string;
  recordId: string;
  relationFields: RelationField[];
  outgoing: OutgoingRelation[];
  incoming: IncomingRelation[];
  removingRelationId: string | null;
  mutationError: string | null;
  onAddRelation: (payload: { to_record_id: string; via_field_id: string }) => Promise<void>;
  onRemoveRelation: (relationId: string) => Promise<void>;
  onOpenRecord?: (recordId: string) => void; // opens related record in inspector
  onSearch: (query: string, collectionId: string | null) => Promise<RecordSearchResult[]>;
}

export function RelationsSection({
  accessToken,
  projectId,
  recordId,
  relationFields,
  outgoing,
  incoming,
  removingRelationId,
  mutationError,
  onAddRelation,
  onRemoveRelation,
  onOpenRecord,
  onSearch,
}: RelationsSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const hasRelationFields = relationFields.length > 0;

  function handlePickerClose() {
    setPickerOpen(false);
    // Return focus to add button — §8 focus return pattern
    setTimeout(() => addButtonRef.current?.focus(), 50);
  }

  async function handleConfirm(payload: { to_record_id: string; via_field_id: string }) {
    await onAddRelation(payload);
    handlePickerClose();
  }

  function fieldLabelForId(fieldId: string) {
    return relationFields.find((f) => f.field_id === fieldId)?.name ?? fieldId;
  }

  return (
    <section
      aria-label="Relations"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        paddingTop: "var(--space-sm)",
        borderTop: "1px solid var(--color-border-muted)",
        overflow: "visible",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-xs)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "14px",
            fontWeight: 700, // section heading weight
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Relations
        </h3>

        {/* Add relation button */}
        <div style={{ position: "relative" }}>
          <button
            ref={addButtonRef}
            onClick={() => hasRelationFields && setPickerOpen((o) => !o)}
            disabled={!hasRelationFields}
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            style={{
              padding: "3px var(--space-xs)",
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--color-border-muted)",
              background: "transparent",
              color: hasRelationFields ? "var(--color-text)" : "var(--color-muted)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "12px",
              cursor: hasRelationFields ? "pointer" : "not-allowed",
              opacity: hasRelationFields ? 1 : 0.4,
              outline: "none",
              transition: "background 0.15s",
            }}
            onFocus={(e) => {
              if (hasRelationFields) {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 0 0 2px var(--color-primary)";
              }
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            + Add relation
          </button>

          {pickerOpen && (
            <RelationPicker
              relationFields={relationFields}
              anchorRef={addButtonRef}
              onConfirm={handleConfirm}
              onClose={handlePickerClose}
              onSearch={onSearch}
            />
          )}
        </div>
      </div>

      {/* No relation fields guidance */}
      {!hasRelationFields && (
        <p
          style={{
            fontSize: "12px",
            fontWeight: 400,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            margin: 0,
          }}
        >
          No relation fields are defined for this record type. Add a relation field to
          start linking records.
        </p>
      )}

      {/* Mutation error */}
      {mutationError && (
        <p
          role="alert"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--color-danger)",
            fontFamily: "var(--font-body)",
            margin: 0,
            padding: "var(--space-2xs) var(--space-xs)",
            borderLeft: "3px solid var(--color-danger)",
            background: "var(--color-danger-subtle)",
            borderRadius: "0 var(--radius-control) var(--radius-control) 0",
          }}
        >
          {mutationError}
        </p>
      )}

      {/* Outgoing — links from this record */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xs)" }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "0 var(--space-xs)",
          }}
        >
          Links from this record
        </span>

        <ul
          role="list"
          aria-label="Outgoing relations"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {outgoing.length === 0 ? (
            <li>
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "var(--color-muted)",
                  fontFamily: "var(--font-body)",
                  margin: 0,
                  padding: "var(--space-xs) var(--space-sm)",
                }}
              >
                No outgoing links yet.
              </p>
            </li>
          ) : (
            outgoing.map((rel) => (
              <li key={rel.relation_id}>
                <RelationRow
                  relationId={rel.relation_id}
                  recordLabel={rel.to_record?.label ?? rel.to_record_id}
                  fieldLabel={fieldLabelForId(rel.via_field_id)}
                  isRemoving={removingRelationId === rel.relation_id}
                  onRemove={onRemoveRelation}
                  onOpenRecord={
                    onOpenRecord
                      ? () => onOpenRecord(rel.to_record_id)
                      : undefined
                  }
                />
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Incoming — links to this record */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xs)" }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "0 var(--space-xs)",
          }}
        >
          Links to this record
        </span>

        <ul
          role="list"
          aria-label="Incoming relations"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {incoming.length === 0 ? (
            <li>
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "var(--color-muted)",
                  fontFamily: "var(--font-body)",
                  margin: 0,
                  padding: "var(--space-xs) var(--space-sm)",
                }}
              >
                No incoming links yet.
              </p>
            </li>
          ) : (
            incoming.map((rel) => (
              <li key={rel.relation_id}>
                <RelationRow
                  relationId={rel.relation_id}
                  recordLabel={rel.from_record?.label ?? rel.from_record_id}
                  fieldLabel={fieldLabelForId(rel.via_field_id)}
                  isRemoving={removingRelationId === rel.relation_id}
                  onRemove={onRemoveRelation}
                  onOpenRecord={
                    onOpenRecord
                      ? () => onOpenRecord(rel.from_record_id)
                      : undefined
                  }
                />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
```

---

## Behavior Notes

- `pickerOpen` state lives in `RelationsSection` — only one picker open at a time, no coordination needed.
- `removingRelationId` comes from the parent — the parent owns the async mutation state and passes it down. The row goes to `opacity: 0.4` while the remove is in flight.
- `mutationError` is cleared by the parent on the next successful mutation or on picker open — `RelationsSection` does not clear it itself.
- No navigation side-effects — `onOpenRecord` triggers the inspector's back-button pattern from §8. The current record stays in history, the related record loads into the same panel.
- Remove on incoming relations is fully supported. The parent handles whether removing an incoming relation is permitted by the backend.
- `onSearch` is injected from the parent — `RelationPicker` is decoupled from the API entirely. The parent passes the right fetcher scoped to `accessToken` and `projectId`.

---

## Accessibility Notes

- `<section aria-label="Relations">` gives screen readers a landmark for the section.
- Outgoing and incoming lists use `role="list"` and `aria-label` to distinguish them.
- Add button uses `aria-expanded` and `aria-haspopup="dialog"`.
- `RelationPicker` uses `role="dialog"` with a descriptive `aria-label` that updates per step.
- Focus returns to the add button on picker close — `setTimeout(() => addButtonRef.current?.focus(), 50)` after the popover unmounts.
- Remove buttons are `tabIndex={-1}` when not hovered, `tabIndex={0}` when hovered — same pattern as CaptureBar actions in §12. Keyboard users reach them by focusing the row and tabbing within.
- Disabled add button when no relation fields exist uses `opacity: 0.4` and `cursor: not-allowed` — consistent with the disabled state rule from the session hard rules.

---

*End of §8-A — Relations Section*

All six sections complete. Combined with sections 1–10 from the previous session, this file covers the full component library for Eshaan OS Hub v1.

- Mutation error uses `role="alert"` for immediate announcement.

# Designer Handoff — Master Component Rules
Date: 2026-03-04
System: Eshaan OS Hub — Project Space UI

---

## 1 — Pane Switcher *(reference only)*

Already fully designed in §3 of the UI Contracts. Integration rules only.

- Render below the Work tab, above the pane content area
- `role="toolbar"`, arrow key focus management, `Ctrl+Left/Right` reorder
- Inactive dot: 7px, `var(--color-muted)`
- Active dot: primary pink double ring via `box-shadow`
- Hover expansion: 0.35s `transition-delay` before pill expands — number superscript + label
- Reorder via dnd-kit `@dnd-kit/sortable`, horizontal strategy
- When pane is opened via pinned top-nav tab: hide switcher by default
- **Flag (implementation):** switcher hidden state must still be keyboard-discoverable via an explicit reveal affordance — a visually minimal but focusable button that restores the switcher

---

## 2 — Module Grid *(reference only)*

Already fully designed in §4 of the UI Contracts. Integration rules only.

- 12-column CSS grid, S=3col, M=6col, L=9col
- Hard max 6 modules per pane — `AddModuleButton` disappears at limit, show `n/6` count in muted text
- Card chrome: `var(--color-surface-elevated)`, subtle border, `shadow-soft` deepens on hover
- Minus button appears on card hover, opacity transition — triggers `DeleteConfirmDialog`
- `DeleteConfirmDialog`: fixed overlay, `autoFocus` on destructive button, focus trap required
- Ghost placeholder fills orphaned columns, `aria-hidden`
- No ancestor `overflow: hidden` — popovers depend on this
- **Flag (implementation):** module grid container must never set `overflow: hidden` at any nesting level — audit all wrapper divs before shipping

---

## 3 — Mention UI

```tsx
// MentionPopover.tsx

interface MentionResult {
  id: string;
  type: 'Person' | 'Task' | 'Event' | 'File';
  label: string;
}

interface MentionPopoverProps {
  results: MentionResult[];
  activeIndex: number;
  onSelect: (result: MentionResult) => void;
  anchorRect: DOMRect;
}

export function MentionPopover({
  results,
  activeIndex,
  onSelect,
  anchorRect,
}: MentionPopoverProps) {
  return (
    <div
      role="listbox"
      aria-label="Mention suggestions"
      style={{
        position: 'absolute',
        top: anchorRect.bottom + 12,
        left: anchorRect.left,
        minWidth: '220px',
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--color-border-muted)',
        boxShadow: 'var(--shadow-soft)',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {results.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-sm) var(--space-md)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'var(--color-muted)',
          }}
        >
          No matches
        </div>
      ) : (
        results.map((result, i) => (
          <div
            key={result.id}
            id={`mention-option-${result.id}`}
            role="option"
            aria-selected={i === activeIndex}
            onClick={() => onSelect(result)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-xs) var(--space-md)',
              cursor: 'pointer',
              background:
                i === activeIndex
                  ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                  : 'transparent',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                color: 'var(--color-muted)',
                minWidth: '40px',
              }}
            >
              {result.type}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
              }}
            >
              {result.label}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// MentionChip.tsx — inserted inline after selection
interface MentionChipProps {
  label: string;
  type: string;
}

export function MentionChip({ label, type }: MentionChipProps) {
  return (
    <span
      contentEditable={false}
      aria-label={`${type}: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.1rem 0.4rem',
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--color-border-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        color: 'var(--color-text)',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {label}
    </span>
  );
}
```

**Usage notes:**
- Trigger on `@` keydown in any text composer
- Popover is `position: absolute` — no ancestor `overflow: hidden`
- Parent owns `activeIndex` state and handles `ArrowUp/Down`, `Enter`, `Esc`, `Backspace` to empty string
- `aria-activedescendant` on the combobox input should point to `mention-option-${activeIndex id}`

---

## 4 — Comments UI

```tsx
// CommentIndicator.tsx — sits on entity rows/cards
interface CommentIndicatorProps {
  count: number;
  hasUnread: boolean;
  onClick: () => void;
}

export function CommentIndicator({ count, hasUnread, onClick }: CommentIndicatorProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      aria-label={hasUnread ? `${count} unread comments` : `${count} comments`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        background: 'none',
        border: 'none',
        borderRadius: 'var(--radius-control)',
        cursor: 'pointer',
        color: 'var(--color-muted)',
        outline: 'none',
      }}
      onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 2V3z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
      {hasUnread && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '3px',
            right: '3px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-primary)',
            boxShadow: '0 0 0 1.5px var(--color-surface), 0 0 0 3px var(--color-primary)',
          }}
        />
      )}
    </button>
  );
}

// CommentThread.tsx
interface Comment {
  id: string;
  authorName: string;
  authorColor: string;
  body: string;
  timestamp: string;
  timestampRelative: string;
}

interface Thread {
  id: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  comments: Comment[];
}

interface CommentThreadProps {
  thread: Thread;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onReply: (threadId: string, body: string) => void;
}

export function CommentThread({ thread, onResolve, onReopen, onReply }: CommentThreadProps) {
  const [repliesExpanded, setRepliesExpanded] = React.useState(false);
  const [composerValue, setComposerValue] = React.useState('');
  const first = thread.comments[0];
  const replies = thread.comments.slice(1);

  if (thread.resolved) {
    return (
      <div role="listitem" style={{ padding: 'var(--space-xs) 0' }}>
        <button
          onClick={() => onReopen(thread.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            color: 'var(--color-muted)',
            padding: 0,
            textAlign: 'left',
          }}
          aria-label={`Resolved by ${thread.resolvedBy}. Click to reopen.`}
        >
          {thread.resolvedBy} resolved · {thread.resolvedAt}
        </button>
      </div>
    );
  }

  return (
    <div role="listitem" style={{ padding: 'var(--space-xs) 0' }}>
      <CommentRow comment={first} onResolve={() => onResolve(thread.id)} showResolve />

      {replies.length > 0 && (
        <>
          <button
            onClick={() => setRepliesExpanded(v => !v)}
            aria-expanded={repliesExpanded}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8125rem',
              color: 'var(--color-muted)',
              padding: '0 0 0 32px',
              outline: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            {repliesExpanded ? 'Hide replies' : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
          </button>

          {repliesExpanded && (
            <div
              style={{
                borderLeft: '2px solid var(--color-border-muted)',
                marginLeft: '12px',
                paddingLeft: 'var(--space-md)',
              }}
            >
              {replies.map(reply => (
                <CommentRow key={reply.id} comment={reply} showResolve={false} />
              ))}
            </div>
          )}
        </>
      )}

      <textarea
        value={composerValue}
        onChange={e => setComposerValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (composerValue.trim()) {
              onReply(thread.id, composerValue.trim());
              setComposerValue('');
            }
          }
          if (e.key === 'Escape' && !composerValue) {
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        placeholder="Reply… (Enter to send, Shift+Enter for new line)"
        rows={1}
        style={{
          width: '100%',
          marginTop: 'var(--space-xs)',
          padding: 'var(--space-xs) var(--space-sm)',
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-muted)',
          borderRadius: 'var(--radius-control)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          color: 'var(--color-text)',
          resize: 'none',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
        onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
      />
    </div>
  );
}

function CommentRow({
  comment,
  onResolve,
  showResolve,
}: {
  comment: Comment;
  onResolve?: () => void;
  showResolve: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-xs) 0' }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '24px', height: '24px', borderRadius: '50%',
          background: comment.authorColor, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-surface)',
        }}
      >
        {comment.authorName[0]}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text)' }}>
            {comment.authorName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <span title={comment.timestamp} style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              {comment.timestampRelative}
            </span>
            {hovered && showResolve && onResolve && (
              <button
                onClick={onResolve}
                aria-label="Resolve thread"
                style={{
                  width: '28px', height: '28px', background: 'none', border: 'none',
                  borderRadius: 'var(--radius-control)', cursor: 'pointer',
                  color: 'var(--color-muted)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
                onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 'var(--leading-normal)' }}>
          {comment.body}
        </p>
      </div>
    </div>
  );
}
```

---

## 5 — Notifications Center

```tsx
// NotificationsBell.tsx — lives in AppShell toolbar
interface NotificationsBellProps {
  unreadCount: number;
  onClick: () => void;
}

export function NotificationsBell({ unreadCount, onClick }: NotificationsBellProps) {
  return (
    <button
      onClick={onClick}
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      style={{
        position: 'relative', width: '36px', height: '36px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: 'var(--radius-control)',
        cursor: 'pointer', color: 'var(--color-muted)', outline: 'none',
      }}
      onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 2a5 5 0 00-5 5v3l-1.5 2h13L14 10V7a5 5 0 00-5-5zM7 14a2 2 0 004 0"
          stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {unreadCount > 0 && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: '4px', right: '4px',
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--color-primary)',
          boxShadow: '0 0 0 1.5px var(--color-surface), 0 0 0 3px var(--color-primary)',
        }} />
      )}
    </button>
  );
}

// NotificationsPanel.tsx
type NotificationFilter = 'unread' | 'all';

interface Notification {
  id: string;
  avatarColor: string;
  authorInitial: string;
  summary: string;
  body: string;
  timestampRelative: string;
  timestamp: string;
  read: boolean;
  projectId?: string;
  href: string;
}

interface NotificationsPanelProps {
  notifications: Notification[];
  projects: { id: string; name: string }[];
  filter: NotificationFilter;
  projectFilter: string | null;
  onFilterChange: (f: NotificationFilter) => void;
  onProjectFilterChange: (id: string | null) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onAddToReminders: (id: string) => void;
  onNavigate: (href: string, id: string) => void;
  onClose: () => void;
}

export function NotificationsPanel({
  notifications, projects, filter, projectFilter,
  onFilterChange, onProjectFilterChange, onMarkRead,
  onMarkAllRead, onAddToReminders, onNavigate, onClose,
}: NotificationsPanelProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const visible = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (projectFilter && n.projectId !== projectFilter) return false;
    return true;
  });

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = document.getElementById('notifications-panel');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div
      id="notifications-panel"
      role="dialog"
      aria-label="Notifications"
      style={{
        position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
        width: '360px', background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-panel)', border: '1px solid var(--color-border-muted)',
        boxShadow: 'var(--shadow-soft)', zIndex: 100,
      }}
    >
      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)',
        borderBottom: '1px solid var(--color-border-muted)',
      }}>
        {(['unread', 'all'] as NotificationFilter[]).map(f => (
          <button key={f} onClick={() => onFilterChange(f)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.875rem',
            fontWeight: filter === f ? 500 : 400,
            color: filter === f ? 'var(--color-text)' : 'var(--color-muted)',
            padding: '0 0 2px',
            borderBottom: filter === f ? '2px solid var(--color-primary)' : '2px solid transparent',
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        <select
          value={projectFilter ?? ''}
          onChange={e => onProjectFilterChange(e.target.value || null)}
          aria-label="Filter by project"
          style={{
            marginLeft: 'auto', background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border-muted)', borderRadius: 'var(--radius-control)',
            fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
            color: projectFilter ? 'var(--color-text)' : 'var(--color-muted)',
            padding: '2px var(--space-xs)', outline: 'none', cursor: 'pointer',
          }}
          onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {unreadCount > 0 && (
          <button onClick={onMarkAllRead} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
            color: 'var(--color-muted)', padding: 0, outline: 'none', whiteSpace: 'nowrap',
          }}
          onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <ul role="list" style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: '420px', overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <li style={{
            padding: 'var(--space-xl)', textAlign: 'center',
            fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-muted)',
          }}>
            {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
          </li>
        ) : visible.map(n => (
          <NotificationRow
            key={n.id}
            notification={n}
            onMarkRead={() => onMarkRead(n.id)}
            onAddToReminders={() => onAddToReminders(n.id)}
            onNavigate={() => onNavigate(n.href, n.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function NotificationRow({ notification: n, onMarkRead, onAddToReminders, onNavigate }: {
  notification: Notification;
  onMarkRead: () => void;
  onAddToReminders: () => void;
  onNavigate: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <li
      role="listitem"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onNavigate}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)',
        padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer',
        background: !n.read ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
        borderBottom: '1px solid var(--color-border-muted)',
      }}
    >
      <div aria-hidden="true" style={{
        width: '32px', height: '32px', borderRadius: '50%', background: n.avatarColor,
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-surface)',
      }}>
        {n.authorInitial}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {n.summary}
        </div>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'var(--color-muted)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', marginTop: '2px',
        }}>
          {n.body}
        </div>
      </div>

      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-xs)', flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <span title={n.timestamp} style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          {n.timestampRelative}
        </span>
        {hovered && (
          <div style={{ display: 'flex', gap: '2px' }}>
            {/* Mark as read */}
            <button onClick={onMarkRead} aria-label="Mark as read" style={{
              width: '28px', height: '28px', background: 'none', border: 'none',
              borderRadius: 'var(--radius-control)', cursor: 'pointer', color: 'var(--color-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* Add to reminders — destination implementation deferred */}
            <button onClick={onAddToReminders} aria-label="Add to reminders" style={{
              width: '28px', height: '28px', background: 'none', border: 'none',
              borderRadius: 'var(--radius-control)', cursor: 'pointer', color: 'var(--color-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1v2M7 11v2M1 7h2m8 0h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
```

---

```

---

## 9 — Timeline Feed

```tsx
// TimelineFeed.tsx

type TimelineEventType = 'task' | 'event' | 'milestone' | 'file' | 'workspace';

interface TimelineItem {
  id: string;
  type: TimelineEventType;
  label: string;
  actor?: string;
  timestamp: string;
  timestampRelative: string;
  dotColor: string;         // PRIORITY_COLORS for tasks, category palette for others — never pink
  linkedRecordId?: string;  // if present, item is clickable and opens Record Inspector
  linkedRecordType?: string;
}

interface TimelineCluster {
  date: string;
  items: TimelineItem[];
}

interface TimelineFeedProps {
  clusters: TimelineCluster[];
  activeFilters: TimelineEventType[];
  isLoading: boolean;
  hasMore: boolean;
  onFilterToggle: (type: TimelineEventType) => void;
  onLoadMore: () => void;
  onItemClick: (recordId: string, recordType: string) => void;
}

const FILTER_LABELS: Record<TimelineEventType, string> = {
  task: 'Tasks',
  event: 'Events',
  milestone: 'Milestones',
  file: 'Files',
  workspace: 'Workspace',
};

export function TimelineFeed({
  clusters, activeFilters, isLoading, hasMore,
  onFilterToggle, onLoadMore, onItemClick,
}: TimelineFeedProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

      {/* Filter chips */}
      <div role="group" aria-label="Filter timeline" style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
        {(Object.keys(FILTER_LABELS) as TimelineEventType[]).map(type => {
          const active = activeFilters.includes(type);
          return (
            <button
              key={type}
              role="button"
              aria-pressed={active}
              onClick={() => onFilterToggle(type)}
              style={{
                padding: '3px var(--space-sm)',
                background: active
                  ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                  : 'transparent',
                border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border-muted)'}`,
                borderRadius: 'var(--radius-control)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: active ? 'var(--color-primary)' : 'var(--color-muted)',
                cursor: 'pointer',
                outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              {FILTER_LABELS[type]}
            </button>
          );
        })}
      </div>

      {/* Feed */}
      <div role="feed" aria-busy={isLoading}>
        {clusters.map((cluster, ci) => (
          <div key={cluster.date}>
            {/* Sticky date header */}
            <div
              role="heading"
              aria-level={3}
              style={{
                position: 'sticky',
                top: 0,
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'var(--color-surface)',
                padding: 'var(--space-xs) 0',
                zIndex: 1,
              }}
            >
              {cluster.date}
            </div>

            {/* Items */}
            {cluster.items.map((item, i) => {
              const isLast = i === cluster.items.length - 1;
              const isClickable = !!item.linkedRecordId;

              return (
                <div
                  key={item.id}
                  style={{ display: 'flex', gap: 'var(--space-sm)', position: 'relative' }}
                >
                  {/* Rail + dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: item.dotColor, flexShrink: 0, marginTop: '4px',
                    }} />
                    {!isLast && (
                      <div style={{
                        width: '1px', flex: 1, minHeight: '20px',
                        background: 'var(--color-border-muted)',
                        marginTop: '2px',
                      }} />
                    )}
                  </div>

                  {/* Content row */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      flex: 1, paddingBottom: isLast ? 'var(--space-md)' : 'var(--space-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                      {/* Type badge */}
                      <span style={{
                        fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-muted)',
                      }}>
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>

                      {/* Label — clickable if linked record exists */}
                      {isClickable ? (
                        <button
                          onClick={() => onItemClick(item.linkedRecordId!, item.linkedRecordType!)}
                          aria-label={`${item.actor ? item.actor + ' — ' : ''}${item.label}, ${item.timestampRelative}. Open ${item.linkedRecordType}`}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                            color: 'var(--color-text)', cursor: 'pointer', outline: 'none',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                          onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
                          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                        >
                          {item.label}
                        </button>
                      ) : (
                        // System-generated entry with no underlying record — plain text only
                        <span style={{
                          fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text)',
                        }}>
                          {item.label}
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span
                      title={item.timestamp}
                      style={{
                        fontFamily: 'var(--font-body)', fontSize: '0.75rem',
                        color: 'var(--color-muted)', flexShrink: 0, marginLeft: 'var(--space-sm)',
                      }}
                    >
                      {item.timestampRelative}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{
            height: '20px', borderRadius: 'var(--radius-control)',
            background: 'color-mix(in srgb, var(--color-muted) 20%, transparent)',
            margin: 'var(--space-sm) 0',
          }} />
        )}

        {/* Load more */}
        {hasMore && !isLoading && (
          <button
            onClick={onLoadMore}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
              color: 'var(--color-muted)', padding: 'var(--space-sm) 0', outline: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Load earlier
          </button>
        )}
      </div>
    </div>
  );
}
```

**Usage notes:**
- Every item with a `linkedRecordId` must render as a clickable button — plain text is reserved for system entries with no traceable source record (e.g. "Project created")
- `onItemClick` opens the Record Inspector from §8 with the linked record
- `dotColor` for tasks must come from `PRIORITY_COLORS` (shared import) — never use pink for non-task types
- Do not auto-refresh mid-read — reload only on mount or explicit "Load earlier" action
- Feed must never show events outside the §12 emission list

---

## 8 — Record Inspector

```tsx
// RecordInspector.tsx

interface RecordField {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
}

interface RelatedRecord {
  id: string;
  type: string;
  label: string;
}

interface RecordInspectorProps {
  record: {
    id: string;
    title: string;
    type: string;
    fields: RecordField[];
    relations: RelatedRecord[];
  } | null;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onFieldChange: (key: string, value: string) => void;
  onRelationClick: (related: RelatedRecord) => void;
}

export function RecordInspector({
  record, isOpen, isSaving, onClose, onFieldChange, onRelationClick,
}: RecordInspectorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [previousRecord, setPreviousRecord] = React.useState<typeof record>(null);
  const [fieldDrafts, setFieldDrafts] = React.useState<Record<string, string>>({});
  const [savedVisible, setSavedVisible] = React.useState(false);

  // Focus container on open — screen readers announce from top
  React.useEffect(() => {
    if (isOpen && containerRef.current) containerRef.current.focus();
  }, [isOpen, record?.id]);

  // Saved confirmation timer
  React.useEffect(() => {
    if (!isSaving && savedVisible) {
      const t = setTimeout(() => setSavedVisible(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isSaving]);

  // Escape to close
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleRelationClick = (related: RelatedRecord) => {
    setPreviousRecord(record);
    onRelationClick(related);
  };

  const handleBack = () => {
    if (previousRecord) {
      onRelationClick({ id: previousRecord.id, type: previousRecord.type, label: previousRecord.title });
      setPreviousRecord(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--color-overlay)',
          zIndex: 80,
        }}
      />

      {/* Panel — slides in from right */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={record?.title ?? 'Record details'}
        tabIndex={-1}
        style={{
          position: 'fixed', top: 0, right: 0,
          width: '400px', maxWidth: '100vw', height: '100vh',
          background: 'var(--color-surface-elevated)',
          borderLeft: '1px solid var(--color-border-muted)',
          boxShadow: '-4px 0 24px rgb(0 0 0 / 0.2)',
          zIndex: 90,
          display: 'flex', flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s ease-out',
          outline: 'none',
          // Never overflow: hidden — comment popovers depend on this
        }}
      >
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-sm) var(--space-md)',
          borderBottom: '1px solid var(--color-border-muted)',
          flexShrink: 0,
        }}>
          {/* Back button — only when a previous record exists */}
          {previousRecord ? (
            <button
              onClick={handleBack}
              aria-label="Back to previous record"
              style={{
                width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'none', border: 'none',
                borderRadius: 'var(--radius-control)', cursor: 'pointer',
                color: 'var(--color-muted)', outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : <div style={{ width: '28px' }} />}

          {/* Saving indicator */}
          <span aria-live="polite" style={{
            fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-muted)',
          }}>
            {isSaving ? 'Saving…' : savedVisible ? 'Saved' : ''}
          </span>

          {/* Close — first interactive element in tab order */}
          <button
            onClick={onClose}
            aria-label="Close inspector"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'none', border: 'none',
              borderRadius: 'var(--radius-control)', cursor: 'pointer',
              color: 'var(--color-muted)', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-md)' }}>
          {record && (
            <>
              {/* Title */}
              <InlineEditField
                value={record.title}
                placeholder="Untitled"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--text-heading-3)',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--space-2xs)',
                }}
                onConfirm={val => onFieldChange('title', val)}
              />

              {/* Type badge */}
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: '0.75rem',
                color: 'var(--color-muted)', display: 'block',
                marginBottom: 'var(--space-md)',
              }}>
                {record.type}
              </span>

              <div style={{ height: '1px', background: 'var(--color-border-muted)', marginBottom: 'var(--space-md)' }} />

              {/* Fields */}
              <section aria-label="Fields">
                {record.fields.map(field => (
                  <div key={field.key} style={{
                    display: 'flex', alignItems: 'flex-start',
                    gap: 'var(--space-md)', marginBottom: 'var(--space-sm)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
                      color: 'var(--color-muted)', minWidth: '100px', paddingTop: '2px',
                    }}>
                      {field.label}
                    </span>
                    <InlineEditField
                      value={fieldDrafts[field.key] ?? field.value}
                      placeholder="Empty"
                      multiline={field.multiline}
                      style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text)' }}
                      onConfirm={val => {
                        setFieldDrafts(d => ({ ...d, [field.key]: val }));
                        onFieldChange(field.key, val);
                        setSavedVisible(true);
                      }}
                    />
                  </div>
                ))}
              </section>

              <div style={{ height: '1px', background: 'var(--color-border-muted)', margin: 'var(--space-md) 0' }} />

              {/* Relations */}
              {record.relations.length > 0 && (
                <section aria-label="Related records">
                  <h3 style={{
                    fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 500,
                    color: 'var(--color-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.05em', marginBottom: 'var(--space-sm)',
                  }}>
                    Relations
                  </h3>
                  {record.relations.map(rel => (
                    <button
                      key={rel.id}
                      onClick={() => handleRelationClick(rel)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                        width: '100%', padding: 'var(--space-xs) var(--space-sm)',
                        background: 'none', border: 'none', borderRadius: 'var(--radius-control)',
                        cursor: 'pointer', textAlign: 'left', marginBottom: '2px', outline: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--color-primary) 8%, transparent)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
                      onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-muted)', minWidth: '36px' }}>
                        {rel.type}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                        {rel.label}
                      </span>
                    </button>
                  ))}
                </section>
              )}

              <div style={{ height: '1px', background: 'var(--color-border-muted)', margin: 'var(--space-md) 0' }} />

              {/* Comments — CommentThread from §4 */}
              <section aria-label="Comments">
                <h3 style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 500,
                  color: 'var(--color-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.05em', marginBottom: 'var(--space-sm)',
                }}>
                  Comments
                </h3>
                {/* CommentThread components rendered here per thread */}
              </section>

              <div style={{ height: '1px', background: 'var(--color-border-muted)', margin: 'var(--space-md) 0' }} />

              {/* Activity — read only, §12 emission rules */}
              <section aria-label="Activity">
                <h3 style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 500,
                  color: 'var(--color-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.05em', marginBottom: 'var(--space-sm)',
                }}>
                  Activity
                </h3>
                {/* Activity feed items rendered here */}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// InlineEditField.tsx — reusable click-to-edit primitive
function InlineEditField({
  value, placeholder, multiline, style, onConfirm,
}: {
  value: string;
  placeholder: string;
  multiline?: boolean;
  style?: React.CSSProperties;
  onConfirm: (val: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  React.useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const confirm = () => { onConfirm(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  const sharedStyle: React.CSSProperties = {
    ...style, width: '100%', background: 'transparent', border: 'none',
    borderRadius: 'var(--radius-control)', padding: '2px 4px', outline: 'none',
    cursor: editing ? 'text' : 'pointer',
  };

  if (editing) {
    const props = {
      ref: inputRef,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: confirm,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') cancel();
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); confirm(); }
        if (e.key === 'Enter' && multiline && !e.shiftKey) { e.preventDefault(); confirm(); }
      },
      style: {
        ...sharedStyle,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-muted)',
        boxShadow: '0 0 0 2px var(--color-primary)',
        resize: multiline ? 'vertical' as const : 'none' as const,
      },
    };
    return multiline ? <textarea {...props} rows={3} /> : <input type="text" {...props} />;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setEditing(true); }}
      onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
      aria-label={value || placeholder}
      style={{ ...sharedStyle, color: value ? style?.color ?? 'var(--color-text)' : 'var(--color-muted)' }}
    >
      {value || placeholder}
    </div>
  );
}
```

---

## 7 — ProjectSpace Header *(reference only)*

Already fully designed in §2 of the UI Contracts (`TopNavTabs`). Addenda only:

- Pinned pane shortcuts appear in the top rail between Work and Tools — same tab visual language, but with a pin indicator (small filled dot, `var(--color-muted)`, 4px) beneath the label to distinguish them from primary tabs
- "No pinned panes" state: rail renders Overview / Work / Tools only — no empty slot, no placeholder
- Active tab must carry `aria-current="page"` — not just visual active state
- Project title in the rail truncates at two lines maximum on narrow viewports, then ellipsis — full title exposed via `title` attribute

---

## 6 — AppShell

```tsx
// AppShell.tsx

interface AppShellProps {
  children: React.ReactNode;
  breadcrumb: string[];
  userAvatar: string;
  userName: string;
  userEmail: string;
  unreadNotifications: number;
  notifications: Notification[];
  projects: { id: string; name: string }[];
  currentContext: 'inbox' | 'doc' | 'calendar' | 'project' | 'other';
  onNavigateHome: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onAddToReminder: (id: string) => void;
  onNotificationNavigate: (href: string, id: string) => void;
  onQuickAdd: () => void;
  onQuickAddContextual: (type: string) => void;
  onOpenSettings: () => void;
  onLogOut: () => void;
}

const CONTEXTUAL_ACTIONS: Record<string, { label: string; type: string }[]> = {
  doc: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add reminder', type: 'reminder' },
    { label: 'Add task to this project', type: 'project-task' },
  ],
  calendar: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add event', type: 'event' },
    { label: 'Add reminder', type: 'reminder' },
  ],
  project: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add task to this project', type: 'project-task' },
    { label: 'Add reminder', type: 'reminder' },
  ],
  other: [
    { label: 'Capture to inbox', type: 'inbox' },
    { label: 'Add reminder', type: 'reminder' },
  ],
};

export function AppShell({
  children, breadcrumb, userAvatar, userName, userEmail,
  unreadNotifications, notifications, projects, currentContext,
  onNavigateHome, onMarkRead, onMarkAllRead, onAddToReminder,
  onNotificationNavigate, onQuickAdd, onQuickAddContextual,
  onOpenSettings, onLogOut,
}: AppShellProps) {
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [quickNavOpen, setQuickNavOpen] = React.useState(false);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const [contextMenuPos, setContextMenuPos] = React.useState({ x: 0, y: 0 });
  const [notifFilter, setNotifFilter] = React.useState<'unread' | 'all'>('unread');
  const [notifProjectFilter, setNotifProjectFilter] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');

  const handleQuickAddRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-surface)' }}>

      {/* Skip link */}
      <a
        href="#main-content"
        style={{
          position: 'absolute', width: '1px', height: '1px', padding: 0,
          margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap', border: 0, zIndex: 200,
        }}
        onFocus={e => Object.assign(e.currentTarget.style, {
          width: 'auto', height: 'auto', padding: 'var(--space-sm) var(--space-md)',
          margin: '8px', overflow: 'visible', clip: 'auto',
          background: 'var(--color-surface-elevated)', borderRadius: 'var(--radius-control)',
          boxShadow: '0 0 0 2px var(--color-primary)', color: 'var(--color-text)',
          fontFamily: 'var(--font-body)',
        })}
        onBlur={e => Object.assign(e.currentTarget.style, {
          width: '1px', height: '1px', padding: '0',
          margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)',
        })}
      >
        Skip to main content
      </a>

      {/* Main content — only scrolling region in the app */}
      <main id="main-content" style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>

      {/* Bottom toolbar */}
      <nav
        aria-label="App toolbar"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
          padding: '0 var(--space-md)', height: '48px', flexShrink: 0,
          background: 'var(--color-surface-elevated)',
          borderTop: '1px solid var(--color-border-muted)',
          position: 'relative',
          // Never overflow: hidden here
        }}
      >
        {/* Home + Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginRight: 'var(--space-sm)' }}>
          <button
            onClick={onNavigateHome}
            aria-label="Go home"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'none', border: 'none',
              borderRadius: 'var(--radius-control)', cursor: 'pointer',
              color: 'var(--color-muted)', flexShrink: 0, outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 7l6-5 6 5v7H10v-4H6v4H2V7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
            </svg>
          </button>

          {breadcrumb.length > 0 && (
            <span
              aria-label={`Current location: ${breadcrumb.join(' › ')}`}
              style={{
                fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-muted)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px',
              }}
            >
              {breadcrumb.join(' › ')}
            </span>
          )}
        </div>

        {/* Quick Nav */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setQuickNavOpen(v => !v)}
            aria-label="Quick navigation"
            aria-expanded={quickNavOpen}
            style={{
              height: '28px', padding: '0 var(--space-sm)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
              background: quickNavOpen
                ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
                : 'none',
              border: '1px solid var(--color-border-muted)',
              borderRadius: 'var(--radius-control)', cursor: 'pointer',
              color: 'var(--color-muted)', fontFamily: 'var(--font-body)',
              fontSize: '0.8125rem', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            Nav
          </button>
          {quickNavOpen && <QuickNavPopover onClose={() => setQuickNavOpen(false)} />}
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: '320px', margin: '0 auto' }}>
          <input
            type="search"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Search…"
            aria-label="Global search"
            style={{
              width: '100%', height: '28px', padding: '0 var(--space-sm)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border-muted)',
              borderRadius: 'var(--radius-control)', fontFamily: 'var(--font-body)',
              fontSize: '0.8125rem', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          />
        </div>

        {/* Contextual quick-add
            Flag (implementation): verify Safari does not intercept onContextMenu before shipping.
            If it does, replace right-click with a small chevron button beside this button
            that opens the same context menu on left click. */}
        <button
          onClick={onQuickAdd}
          onContextMenu={handleQuickAddRightClick}
          aria-label="Quick add to inbox (right-click for more options)"
          style={{
            width: '28px', height: '28px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'none',
            border: '1px solid var(--color-border-muted)', borderRadius: 'var(--radius-control)',
            cursor: 'pointer', color: 'var(--color-muted)', outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {contextMenuOpen && (
          <ContextMenu
            items={CONTEXTUAL_ACTIONS[currentContext] ?? CONTEXTUAL_ACTIONS.other}
            position={contextMenuPos}
            onSelect={type => { onQuickAddContextual(type); setContextMenuOpen(false); }}
            onClose={() => setContextMenuOpen(false)}
          />
        )}

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <NotificationsBell
            unreadCount={unreadNotifications}
            onClick={() => { setNotificationsOpen(v => !v); setProfileOpen(false); }}
          />
          {notificationsOpen && (
            <NotificationsPanel
              notifications={notifications} projects={projects}
              filter={notifFilter} projectFilter={notifProjectFilter}
              onFilterChange={setNotifFilter} onProjectFilterChange={setNotifProjectFilter}
              onMarkRead={onMarkRead} onMarkAllRead={onMarkAllRead}
              onAddToReminders={onAddToReminder} onNavigate={onNotificationNavigate}
              onClose={() => setNotificationsOpen(false)}
            />
          )}
        </div>

        {/* Profile avatar */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setProfileOpen(v => !v); setNotificationsOpen(false); }}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            style={{
              width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden',
              border: profileOpen ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer', padding: 0, background: 'var(--color-muted)', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            {userAvatar
              ? <img src={userAvatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%', fontFamily: 'var(--font-body)',
                  fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-surface)',
                }}>
                  {userName?.[0] ?? '?'}
                </span>
            }
          </button>
          {profileOpen && (
            <ProfileMenu
              userName={userName} userEmail={userEmail} userAvatar={userAvatar}
              onOpenSettings={() => { onOpenSettings(); setProfileOpen(false); }}
              onLogOut={() => { onLogOut(); setProfileOpen(false); }}
              onClose={() => setProfileOpen(false)}
            />
          )}
        </div>
      </nav>
    </div>
  );
}

// QuickNavPopover.tsx
// Key behaviour: typing anywhere while popover is open filters results
// without requiring the user to click the search input first.
// Document cursor in underlying content is preserved unless user explicitly clicks the input.
function QuickNavPopover({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key.length === 1 && document.activeElement !== inputRef.current) {
        setQuery(q => q + e.key);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = document.getElementById('quick-nav-popover');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  return (
    <div
      id="quick-nav-popover"
      role="dialog"
      aria-label="Quick navigation"
      style={{
        position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
        width: '280px', background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-panel)', border: '1px solid var(--color-border-muted)',
        boxShadow: 'var(--shadow-soft)', zIndex: 100, overflow: 'hidden',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Jump to…"
        aria-label="Navigate to a location"
        style={{
          width: '100%', padding: 'var(--space-sm) var(--space-md)',
          background: 'transparent', border: 'none',
          borderBottom: '1px solid var(--color-border-muted)',
          fontFamily: 'var(--font-body)', fontSize: '0.875rem',
          color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
        }}
      />
      {/* Nav items rendered here filtered by query.
          Each item: recent locations + pinned panes.
          Arrow keys move selection. Enter navigates. Escape closes. */}
    </div>
  );
}

// ContextMenu.tsx
function ContextMenu({ items, position, onSelect, onClose }: {
  items: { label: string; type: string }[];
  position: { x: number; y: number };
  onSelect: (type: string) => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = document.getElementById('context-menu');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div id="context-menu" role="menu" style={{
      position: 'fixed', top: position.y, left: position.x,
      background: 'var(--color-surface-elevated)', borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-muted)', boxShadow: 'var(--shadow-soft)',
      zIndex: 200, padding: 'var(--space-xs) 0', minWidth: '180px',
    }}>
      {items.map(item => (
        <button key={item.type} role="menuitem" onClick={() => onSelect(item.type)} style={{
          display: 'block', width: '100%', padding: 'var(--space-xs) var(--space-md)',
          background: 'none', border: 'none', textAlign: 'left',
          fontFamily: 'var(--font-body)', fontSize: '0.875rem',
          color: 'var(--color-text)', cursor: 'pointer', outline: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--color-primary) 10%, transparent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
        onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ProfileMenu.tsx
function ProfileMenu({ userName, userEmail, userAvatar, onOpenSettings, onLogOut, onClose }: {
  userName: string;
  userEmail: string;
  userAvatar: string;
  onOpenSettings: () => void;
  onLogOut: () => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = document.getElementById('profile-menu');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div id="profile-menu" role="menu" style={{
      position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
      width: '220px', background: 'var(--color-surface-elevated)',
      borderRadius: 'var(--radius-panel)', border: '1px solid var(--color-border-muted)',
      boxShadow: 'var(--shadow-soft)', zIndex: 100, overflow: 'hidden',
    }}>
      {/* Identity */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
        padding: 'var(--space-md)', borderBottom: '1px solid var(--color-border-muted)',
      }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-muted)', flexShrink: 0, overflow: 'hidden' }}>
          {userAvatar
            ? <img src={userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', fontFamily: 'var(--font-body)',
                fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-surface)',
              }}>
                {userName?.[0] ?? '?'}
              </span>
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500,
            color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {userName}
          </div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {userEmail}
          </div>
        </div>
      </div>

      {/* Actions */}
      {[
        { label: 'Settings', action: onOpenSettings, danger: false },
        { label: 'Log out', action: onLogOut, danger: true },
      ].map(item => (
        <button key={item.label} role="menuitem" onClick={item.action} style={{
          display: 'block', width: '100%', padding: 'var(--space-sm) var(--space-md)',
          background: 'none', border: 'none', textAlign: 'left',
          fontFamily: 'var(--font-body)', fontSize: '0.875rem',
          color: item.danger ? 'var(--color-danger)' : 'var(--color-text)',
          cursor: 'pointer', outline: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--color-primary) 10%, transparent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
        onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

---

## 10 — Calendar Module

```tsx
// CalendarModule.tsx

type CalendarView = 'month' | 'year' | 'week' | 'day';
type CalendarScope = 'relevant' | 'all';

interface CalendarEvent {
  id: string;
  label: string;
  date: string;           // ISO date string
  startTime?: string;     // e.g. "10:00" — undefined means all-day
  endTime?: string;
  categoryColor: string;  // never pink range
  collaboratorId: string;
  linkedRecordId: string;
  linkedRecordType: string;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;          // never pink range
}

interface Category {
  id: string;
  label: string;
  color: string;          // never pink range
}

interface CalendarModuleProps {
  events: CalendarEvent[];
  collaborators: Collaborator[];
  categories: Category[];
  today: string;
  scope: CalendarScope;
  view: CalendarView;
  activeCollaborators: string[];
  activeCategories: string[];
  displayTimezone: string;
  onScopeChange: (s: CalendarScope) => void;
  onViewChange: (v: CalendarView) => void;
  onCollaboratorToggle: (id: string) => void;
  onCategoryToggle: (id: string) => void;
  onEventClick: (recordId: string, recordType: string) => void;
  onTimezoneClick: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarModule({
  events, collaborators, categories, today,
  scope, view, activeCollaborators, activeCategories, displayTimezone,
  onScopeChange, onViewChange, onCollaboratorToggle, onCategoryToggle,
  onEventClick, onTimezoneClick,
}: CalendarModuleProps) {
  const [overflowDay, setOverflowDay] = React.useState<string | null>(null);

  const filteredEvents = events.filter(e => {
    if (activeCollaborators.length > 0 && !activeCollaborators.includes(e.collaboratorId)) return false;
    if (activeCategories.length > 0 && !activeCategories.includes(e.categoryColor)) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', height: '100%' }}>

      {/* Chip bar — horizontal scroll, never wraps */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
        overflowX: 'auto', flexShrink: 0, paddingBottom: '2px',
        msOverflowStyle: 'none', scrollbarWidth: 'none',
      }}>

        {/* Relevant / All toggle */}
        <div role="group" aria-label="Calendar scope" style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          {(['relevant', 'all'] as CalendarScope[]).map(s => (
            <button
              key={s}
              aria-pressed={scope === s}
              onClick={() => onScopeChange(s)}
              style={{
                padding: '3px var(--space-sm)', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
                fontWeight: scope === s ? 500 : 400,
                color: scope === s ? 'var(--color-text)' : 'var(--color-muted)',
                borderBottom: scope === s ? '2px solid var(--color-primary)' : '2px solid transparent',
                outline: 'none', flexShrink: 0,
              }}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <ChipDivider />

        {/* Time view chips */}
        {(['month', 'year', 'week', 'day'] as CalendarView[]).map(v => (
          <CalendarChip
            key={v}
            label={v.charAt(0).toUpperCase() + v.slice(1)}
            active={view === v}
            color="var(--color-primary)"
            onClick={() => onViewChange(v)}
          />
        ))}

        <ChipDivider />

        {/* Collaborator chips — never pink range */}
        {collaborators.map(c => (
          <CalendarChip
            key={c.id}
            label={c.name}
            active={activeCollaborators.includes(c.id)}
            color={c.color}
            onClick={() => onCollaboratorToggle(c.id)}
          />
        ))}

        <ChipDivider />

        {/* Category chips — never pink range */}
        {categories.map(cat => (
          <CalendarChip
            key={cat.id}
            label={cat.label}
            active={activeCategories.includes(cat.id)}
            color={cat.color}
            onClick={() => onCategoryToggle(cat.id)}
          />
        ))}

        {/* Timezone — always far right */}
        <button
          onClick={onTimezoneClick}
          style={{
            marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.75rem',
            color: 'var(--color-muted)', outline: 'none', padding: '0 var(--space-xs)',
          }}
          onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          {displayTimezone}
        </button>
      </div>

      {/* Grid area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {view === 'month' && (
          <MonthGrid
            events={filteredEvents}
            today={today}
            overflowDay={overflowDay}
            onOverflowClick={day => setOverflowDay(day === overflowDay ? null : day)}
            onEventClick={onEventClick}
          />
        )}
        {view === 'year' && (
          <YearGrid
            events={filteredEvents}
            today={today}
            onMonthClick={() => onViewChange('month')}
          />
        )}
        {(view === 'week' || view === 'day') && (
          <StubView label={`${view.charAt(0).toUpperCase() + view.slice(1)} view coming soon`} />
        )}
      </div>
    </div>
  );
}

// MonthGrid.tsx
function MonthGrid({ events, today, overflowDay, onOverflowClick, onEventClick }: {
  events: CalendarEvent[];
  today: string;
  overflowDay: string | null;
  onOverflowClick: (day: string) => void;
  onEventClick: (recordId: string, recordType: string) => void;
}) {
  const cells = buildMonthCells(today);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%' }}>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.75rem',
            fontWeight: 500, color: 'var(--color-muted)', textTransform: 'uppercase',
            letterSpacing: '0.05em', padding: 'var(--space-xs) 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells — 2px gap on var(--color-surface) base creates elevation separation */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        gap: '2px',
        flex: 1,
      }}>
        {cells.map(cell => {
          const isToday = cell.date === today;
          const isCurrentMonth = cell.currentMonth;
          const dayEvents = events.filter(e => e.date === cell.date);
          const visibleEvents = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - 3;

          return (
            <div
              key={cell.date}
              role="gridcell"
              aria-label={formatDateLabel(cell.date)}
              style={{
                background: isToday
                  ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-elevated))'
                  : 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-control)',
                border: isToday ? '1px solid var(--color-primary)' : '1px solid transparent',
                padding: 'var(--space-2xs)',
                minHeight: '100px',
                display: 'flex', flexDirection: 'column', gap: '2px',
                opacity: isCurrentMonth ? 1 : 0.3,
                position: 'relative',
              }}
            >
              {/* Day number */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
                  background: isToday ? 'var(--color-primary)' : 'transparent',
                  color: isToday ? 'var(--color-on-primary)' : 'var(--color-muted)',
                  fontWeight: isToday ? 700 : 400,
                }}>
                  {new Date(cell.date).getDate()}
                </span>
              </div>

              {/* Event chips */}
              {visibleEvents.map(event => (
                <EventChip
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event.linkedRecordId, event.linkedRecordType)}
                />
              ))}

              {/* Overflow */}
              {overflow > 0 && (
                <button
                  onClick={() => onOverflowClick(cell.date)}
                  aria-label={`${overflow} more events on ${formatDateLabel(cell.date)}. Show all.`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: '0.75rem',
                    color: 'var(--color-muted)', padding: '0 2px', textAlign: 'left', outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
                  onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  +{overflow} more
                </button>
              )}

              {/* Overflow popover — position absolute, no overflow hidden on ancestors */}
              {overflowDay === cell.date && (
                <OverflowPopover events={dayEvents} onEventClick={onEventClick} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// EventChip.tsx
// Border-radius right-side only so left category rail reads flush — consistent with InlineNotice rail language
// In Day/Week views (when built) this chip spans multiple hour-cell heights naturally — no special handling needed
function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${event.label}${event.startTime ? `, ${event.startTime}` : ', all day'}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        width: '100%', padding: '1px 4px',
        background: `color-mix(in srgb, ${event.categoryColor} 12%, transparent)`,
        borderLeft: `3px solid ${event.categoryColor}`,
        borderRadius: '0 var(--radius-control) var(--radius-control) 0',
        border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none',
      }}
      onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {event.startTime && (
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: '0.6875rem',
          color: 'var(--color-muted)', flexShrink: 0,
        }}>
          {event.startTime}
        </span>
      )}
      <span style={{
        fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-text)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {event.label}
      </span>
    </button>
  );
}

// OverflowPopover.tsx
function OverflowPopover({ events, onEventClick }: {
  events: CalendarEvent[];
  onEventClick: (recordId: string, recordType: string) => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="All events this day"
      style={{
        position: 'absolute', zIndex: 20,
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border-muted)',
        borderRadius: 'var(--radius-control)',
        boxShadow: 'var(--shadow-soft)',
        padding: 'var(--space-xs)',
        minWidth: '160px',
      }}
    >
      {events.map(event => (
        <EventChip
          key={event.id}
          event={event}
          onClick={() => onEventClick(event.linkedRecordId, event.linkedRecordType)}
        />
      ))}
    </div>
  );
}

// YearGrid.tsx — dots only, no labels, click drills to month view
function YearGrid({ events, today, onMonthClick }: {
  events: CalendarEvent[];
  today: string;
  onMonthClick: () => void;
}) {
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)' }}>
      {months.map(month => (
        <button
          key={month}
          onClick={onMonthClick}
          aria-label={`${getMonthName(month)} — click to view month`}
          style={{
            background: 'var(--color-surface-elevated)',
            borderRadius: 'var(--radius-control)',
            border: '1px solid transparent',
            padding: 'var(--space-sm)',
            cursor: 'pointer', outline: 'none', textAlign: 'left',
          }}
          onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
          onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 500,
            color: 'var(--color-muted)', marginBottom: 'var(--space-xs)',
          }}>
            {getMonthName(month)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
            {getDaysInMonth(month).map(day => {
              const dayEvents = events.filter(e => matchesMonthDay(e.date, month, day));
              return dayEvents.length > 0 ? (
                <span key={day} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: dayEvents[0].categoryColor,
                }} />
              ) : (
                <span key={day} style={{ width: '6px', height: '6px' }} />
              );
            })}
          </div>
        </button>
      ))}
    </div>
  );
}

// StubView.tsx — Week/Day placeholder until those layouts are built
function StubView({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
      fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-muted)',
    }}>
      {label}
    </div>
  );
}

// CalendarChip.tsx — shared chip primitive
function CalendarChip({ label, active, color, onClick }: {
  label: string; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      style={{
        padding: '3px var(--space-sm)', flexShrink: 0,
        background: active ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
        border: `1px solid ${active ? color : 'var(--color-border-muted)'}`,
        borderRadius: 'var(--radius-control)',
        fontFamily: 'var(--font-body)', fontSize: '0.8125rem',
        color: active ? color : 'var(--color-muted)',
        cursor: 'pointer', outline: 'none',
      }}
      onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary)')}
      onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {label}
    </button>
  );
}

// ChipDivider — thin vertical separator in chip bar
function ChipDivider() {
  return (
    <div style={{
      width: '1px', height: '16px', flexShrink: 0,
      background: 'var(--color-border-muted)', margin: '0 var(--space-2xs)',
    }} />
  );
}

// Helper stubs — implement at call site
function buildMonthCells(today: string): { date: string; currentMonth: boolean }[] { return []; }
function formatDateLabel(date: string): string { return date; }
function getMonthName(month: number): string { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]; }
function getDaysInMonth(month: number): number[] { return Array.from({ length: 30 }, (_, i) => i + 1); }
function matchesMonthDay(date: string, month: number, day: number): boolean { return false; }
```

**Usage notes:**
- Cell gap of `2px` on `var(--color-surface)` base provides day separation via elevation — no borders needed
- `EventChip` left-only border-radius keeps the category rail flush — consistent with InlineNotice rail language
- In Day/Week views (when built) event chips span multiple hour-cell heights naturally — the chip papers over the gap between hour slots, no special handling needed
- Overflow popover is `position: absolute` — no ancestor `overflow: hidden`
- Timezone popover implementation deferred — button affordance is present and must remain
- Never use pink range for `categoryColor` or collaborator `color` — add a code review note















