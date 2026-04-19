import type { ReactElement } from 'react';

interface FileRecordSummaryProps {
  name: string;
  ext: string;
  metaLabel: string;
  thumbnailUrl?: string | null;
  presentation?: 'row' | 'tile';
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);

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

export const FileRecordSummary = ({
  name,
  ext,
  metaLabel,
  thumbnailUrl = null,
  presentation = 'row',
}: FileRecordSummaryProps): ReactElement => {
  const useThumbnail = IMAGE_EXTS.has(ext.toLowerCase()) && Boolean(thumbnailUrl);

  if (presentation === 'tile') {
    return (
      <>
        <div
          className="flex h-24 items-center justify-center overflow-hidden"
          style={{
            background: useThumbnail ? undefined : 'var(--color-surface-elevated)',
            borderTopLeftRadius: 'var(--radius-panel)',
            borderTopRightRadius: 'var(--radius-panel)',
          }}
        >
          {useThumbnail ? (
            <img src={thumbnailUrl || undefined} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[32px]" aria-hidden="true">
              {iconForExt(ext)}
            </span>
          )}
        </div>
        <div className="p-xs">
          <span className="block truncate text-xs font-medium text-text">{name}</span>
          <span className="block text-[11px] font-normal text-text-secondary">{metaLabel}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <span className="shrink-0 text-base" aria-hidden="true">
        {iconForExt(ext)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-text">{name}</span>
        <span className="block text-[11px] font-normal text-text-secondary">{metaLabel}</span>
      </span>
    </>
  );
};
