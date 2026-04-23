import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, Dialog } from '../../../components/primitives';
import { buildProjectWorkHref } from '../../../lib/hubRoutes';
import type { HubPaneSummary } from '../../../services/hub/types';
import { useRoomProjectMigration } from '../hooks/useRoomProjectMigration';

interface RoomMigrationDialogProps {
  accessToken: string;
  roomId: string;
  pane: HubPaneSummary;
  parentSpaceId: string;
  parentSpaceName: string;
  onMigrated?: () => Promise<void> | void;
}

const projectCopyLabel = (count: number): string =>
  `${count} task${count === 1 ? '' : 's'} copied`;

export const RoomMigrationDialog = ({
  accessToken,
  roomId,
  pane,
  parentSpaceId,
  parentSpaceName,
  onMigrated,
}: RoomMigrationDialogProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const migration = useRoomProjectMigration({
    accessToken,
    roomId,
  });

  const resetState = () => {
    migration.reset();
  };

  const openDialog = () => {
    resetState();
    setOpen(true);
  };

  const closeDialog = () => {
    if (migration.migrating) {
      return;
    }
    setOpen(false);
    resetState();
  };

  const onSubmit = async () => {
    await migration.migrate([
      {
        sourcePaneId: pane.pane_id,
        destinationName: pane.name,
      },
    ]);
    await onMigrated?.();
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size="sm"
        onClick={openDialog}
      >
        Migrate to Space
      </Button>

      <Dialog
        open={open}
        onClose={closeDialog}
        triggerRef={triggerRef}
        title={migration.results ? 'Migration Complete' : `Migrate ${pane.name}`}
        description={migration.results
          ? 'A new project was created in the parent space and the room content was copied into it.'
          : `Create a new project in ${parentSpaceName} and copy this room project's document and tasks into it.`}
        panelClassName="overflow-visible"
        contentClassName="overflow-visible"
      >
        {migration.results ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <p className="text-sm text-muted">
              {pane.name} was copied into a new project in {parentSpaceName}. The original room content is still available here.
            </p>
            <ul className="space-y-2" aria-label="Migrated room projects">
              {migration.results.map((result) => (
                <li key={result.targetPaneId} className="rounded-panel border border-border-muted bg-surface px-3 py-3">
                  <p className="text-sm font-semibold text-text">{result.sourcePaneName} → {result.targetPaneName}</p>
                  <p className="mt-1 text-xs text-muted">
                    {projectCopyLabel(result.migratedTaskCount)}{result.migratedDocument ? ' and 1 document copied.' : '.'}
                  </p>
                  <Link
                    to={buildProjectWorkHref(migration.targetProjectId || parentSpaceId, result.targetPaneId)}
                    className="mt-2 inline-flex text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Open {result.targetPaneName}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={closeDialog} disabled={migration.migrating}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-panel border border-border-muted bg-surface px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Destination space</p>
              <p className="mt-1 text-sm text-text">{parentSpaceName}</p>
            </div>
            <div className="rounded-panel border border-border-muted bg-surface px-3 py-3">
              <p className="text-sm font-semibold text-text">{pane.name}</p>
              <p className="mt-1 text-sm text-muted">
                This creates a new project in {parentSpaceName} with the same name and copies the current room project's
                document and tasks into it.
              </p>
            </div>
            <p className="text-sm text-muted">
              The Room stays intact. This migration copies content into the parent space without removing anything from the Room.
            </p>

            {migration.error ? (
              <p role="alert" aria-live="assertive" className="text-sm text-danger">{migration.error}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={closeDialog} disabled={migration.migrating}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={migration.migrating}
                loadingLabel="Migrating"
                onClick={() => {
                  void onSubmit();
                }}
              >
                Confirm migration
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
};
