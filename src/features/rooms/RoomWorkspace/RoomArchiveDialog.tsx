import { useRef, useState } from 'react';

import { Button, Dialog } from '../../../components/primitives';

interface RoomArchiveDialogProps {
  archiving: boolean;
  roomName: string;
  onArchive: () => Promise<void>;
}

export const RoomArchiveDialog = ({
  archiving,
  roomName,
  onArchive,
}: RoomArchiveDialogProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeDialog = () => {
    if (archiving) {
      return;
    }
    setOpen(false);
    setError(null);
  };

  const confirmArchive = async () => {
    setError(null);
    try {
      await onArchive();
      setOpen(false);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Failed to archive room.');
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="primary"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Archive Room
      </Button>

      <Dialog
        open={open}
        onClose={closeDialog}
        triggerRef={triggerRef}
        title="Archive Room"
        description={`Archive ${roomName} and make its content read-only.`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Archiving removes this room from the sidebar and turns it into a read-only snapshot for everyone who can still open it directly.
          </p>
          <p className="text-sm text-muted">
            Documents, tasks, and room membership changes will be locked after this confirmation.
          </p>

          {error ? <p role="alert" aria-live="assertive" className="text-sm text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={closeDialog} disabled={archiving}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => void confirmArchive()} loading={archiving} loadingLabel="Archiving">
              Archive Room
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};
