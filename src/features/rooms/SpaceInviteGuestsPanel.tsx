import { useId, useRef } from 'react';

import { useProjects } from '../../context/ProjectsContext';
import { Button, InlineNotice } from '../../components/primitives';
import { useRooms } from './hooks/useRooms';
import { CreateRoomDialog } from './CreateRoomDialog';

interface SpaceInviteGuestsPanelProps {
  accessToken: string;
  projectId: string;
}

export const SpaceInviteGuestsPanel = ({
  accessToken,
  projectId,
}: SpaceInviteGuestsPanelProps) => {
  const { projects } = useProjects();
  const { createRoom, error } = useRooms({ accessToken });
  const headingId = useId();
  const descriptionId = useId();
  const createTriggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="rounded-control border border-border-muted bg-surface px-3 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 id={headingId} className="text-sm font-semibold text-text">Invite guests</h3>
          <p id={descriptionId} className="text-sm text-muted">
            Use Rooms to invite collaborators not part of your team.
          </p>
        </div>
        <CreateRoomDialog
          accessToken={accessToken}
          onCreateRoom={createRoom}
          projectOptions={projects}
          triggerRef={createTriggerRef}
          initialSpaceId={projectId}
          renderTrigger={({ disabled, onOpen, triggerRef: nextTriggerRef }) => (
            <Button
              ref={nextTriggerRef}
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={onOpen}
              aria-label="Create guest room for this space"
            >
              Create room
            </Button>
          )}
        />
      </div>

      {error ? (
        <div className="mt-3">
          <InlineNotice variant="danger" title="Room creation unavailable">
            {error}
          </InlineNotice>
        </div>
      ) : null}
    </section>
  );
};
