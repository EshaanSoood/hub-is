import { useCallback, useId, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { AccessibleDialog, Button, Icon, InlineNotice } from '../../components/primitives';
import { buildAccountAvatarUrl, sessionInitials } from '../../components/layout/appShellUtils';
import type { SessionSummary } from '../../types/domain';

type ProfileSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  sessionSummary: SessionSummary;
  profileImageUrl: string | null;
  onSaveProfileImage: (imageUrl: string) => void;
  triggerRef?: RefObject<HTMLElement | null>;
};

const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const readImageFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Image preview could not be loaded.'));
    });
    reader.addEventListener('error', () => reject(new Error('Image preview could not be loaded.')));
    reader.readAsDataURL(file);
  });

export const ProfileSettingsDialog = ({
  open,
  onClose,
  sessionSummary,
  profileImageUrl,
  onSaveProfileImage,
  triggerRef,
}: ProfileSettingsDialogProps) => {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const initials = useMemo(
    () => sessionInitials(sessionSummary.name, sessionSummary.email, sessionSummary.userId),
    [sessionSummary.email, sessionSummary.name, sessionSummary.userId],
  );
  const fallbackAvatarUrl = useMemo(
    () => buildAccountAvatarUrl(initials, sessionSummary.userId || sessionSummary.email || sessionSummary.name),
    [initials, sessionSummary.email, sessionSummary.name, sessionSummary.userId],
  );
  const previewUrl = selectedImageUrl ?? profileImageUrl ?? fallbackAvatarUrl;
  const hasPendingSelection = Boolean(selectedImageUrl);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    setUploadError(null);
    if (!file) {
      return;
    }
    if (!acceptedImageTypes.includes(file.type)) {
      setSelectedImageUrl(null);
      setUploadError('Choose a PNG, JPG, GIF, or WebP image.');
      return;
    }
    try {
      const imageUrl = await readImageFileAsDataUrl(file);
      setSelectedImageUrl(imageUrl);
    } catch (error) {
      setSelectedImageUrl(null);
      setUploadError(error instanceof Error ? error.message : 'Image preview could not be loaded.');
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedImageUrl) {
      return;
    }
    onSaveProfileImage(selectedImageUrl);
    setSelectedImageUrl(null);
    setUploadError(null);
  }, [onSaveProfileImage, selectedImageUrl]);

  const handleCancelSelection = useCallback(() => {
    setSelectedImageUrl(null);
    setUploadError(null);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedImageUrl(null);
    setUploadError(null);
    onClose();
  }, [onClose]);

  return (
    <AccessibleDialog
      open={open}
      title="Settings"
      description="Manage profile settings."
      onClose={handleClose}
      triggerRef={triggerRef}
      hideHeader
      panelClassName="dialog-panel-compact-size"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="heading-2 text-primary">Settings</h2>
        <button
          type="button"
          aria-label="Close settings"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-low hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={handleClose}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <section className="mt-5 space-y-4" aria-labelledby={`${fileInputId}-heading`}>
        <h3 id={`${fileInputId}-heading`} className="text-sm font-semibold text-text">
          Profile image
        </h3>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <img
            src={previewUrl}
            alt="Profile preview"
            className="h-20 w-20 rounded-full border border-border-muted bg-surface-highest object-cover"
          />
          <div className="min-w-0 space-y-3">
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
              className="sr-only"
              aria-label="Choose profile image"
              onChange={(event) => {
                void handleFileChange(event);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload image
            </Button>
            {hasPendingSelection ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="primary" onClick={handleSave}>
                  Save
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancelSelection}>
                  Cancel
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {uploadError ? (
          <InlineNotice variant="danger" title="Upload failed">
            {uploadError}
          </InlineNotice>
        ) : null}
      </section>
    </AccessibleDialog>
  );
};
