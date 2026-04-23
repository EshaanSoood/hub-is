import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import type { CreateRoomRequest, Room } from '../../shared/api-types';
import type { ProjectRecord } from '../../types/domain';
import { Button, Dialog } from '../../components/primitives';

interface CreateRoomDialogProps {
  accessToken: string | null | undefined;
  onCreateRoom: (payload: CreateRoomRequest) => Promise<Room>;
  projectOptions: ProjectRecord[];
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  initialSpaceId?: string | null;
  renderTrigger?: (props: {
    disabled: boolean;
    onOpen: () => void;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
  }) => ReactNode;
}

const parseParticipantIdentifiers = (value: string): string[] =>
  [...new Set(
    value
      .split(/[\n,]+/g)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => (entry.includes('@') ? entry.toLowerCase() : entry)),
  )];

const firstSpaceId = (projectOptions: ProjectRecord[]): string =>
  projectOptions[0]?.id ?? '';

const DEFAULT_ROOM_PROJECT_NAMES = {
  primary: 'Project 1',
  secondary: 'Project 2',
} as const;

export const CreateRoomDialog = ({
  accessToken,
  onCreateRoom,
  projectOptions,
  triggerRef,
  initialSpaceId = null,
  renderTrigger,
}: CreateRoomDialogProps) => {
  const navigate = useNavigate();
  const internalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const roomNameInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(true);
  const [open, setOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [projectOneName, setProjectOneName] = useState<string>(DEFAULT_ROOM_PROJECT_NAMES.primary);
  const [projectTwoName, setProjectTwoName] = useState<string>(DEFAULT_ROOM_PROJECT_NAMES.secondary);
  const [participantInput, setParticipantInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveTriggerRef = triggerRef ?? internalTriggerRef;
  const availableSpaces = useMemo(
    () => projectOptions.filter((project) => !project.isPersonal),
    [projectOptions],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const defaultSpaceId = useMemo(() => {
    const nextInitialSpaceId = initialSpaceId?.trim() ?? '';
    if (nextInitialSpaceId && availableSpaces.some((project) => project.id === nextInitialSpaceId)) {
      return nextInitialSpaceId;
    }
    return firstSpaceId(availableSpaces);
  }, [availableSpaces, initialSpaceId]);
  const selectedSpaceId = availableSpaces.some((project) => project.id === spaceId)
    ? spaceId
    : defaultSpaceId;

  const resetForm = () => {
    setRoomName('');
    setSpaceId(defaultSpaceId);
    setProjectOneName(DEFAULT_ROOM_PROJECT_NAMES.primary);
    setProjectTwoName(DEFAULT_ROOM_PROJECT_NAMES.secondary);
    setParticipantInput('');
    setSubmitting(false);
    setError(null);
  };

  const openDialog = () => {
    resetForm();
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setError(null);
  };

  const requestCloseDialog = () => {
    if (submitting) {
      return;
    }
    closeDialog();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      setError('An authenticated session is required.');
      return;
    }

    const displayName = roomName.trim();
    const firstProjectName = projectOneName.trim();
    const secondProjectName = projectTwoName.trim();
    const participantIdentifiers = parseParticipantIdentifiers(participantInput);
    if (!selectedSpaceId) {
      setError('Select a space for this room.');
      return;
    }
    if (!displayName) {
      setError('Room name is required.');
      return;
    }
    if (!firstProjectName || !secondProjectName) {
      setError('Provide names for both room projects.');
      return;
    }
    if (participantIdentifiers.length === 0) {
      setError('Invite at least one participant by email address or user identifier.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const room = await onCreateRoom({
        displayName,
        spaceId: selectedSpaceId,
        projectNames: [firstProjectName, secondProjectName],
        participantIdentifiers,
      });
      if (!isMountedRef.current) {
        return;
      }
      closeDialog();
      resetForm();
      startTransition(() => {
        navigate(`/rooms/${encodeURIComponent(room.id)}`);
      });
    } catch (submissionError) {
      if (!isMountedRef.current) {
        return;
      }
      setError(submissionError instanceof Error ? submissionError.message : 'Room creation failed.');
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const createDisabled = availableSpaces.length === 0;

  return (
    <>
      {renderTrigger ? renderTrigger({
        disabled: createDisabled,
        onOpen: openDialog,
        triggerRef: effectiveTriggerRef,
      }) : (
        <button
          ref={effectiveTriggerRef}
          type="button"
          disabled={createDisabled}
          className="interactive interactive-subtle flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-highest hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          onClick={openDialog}
        >
          <span className="sr-only">New room</span>
          <span aria-hidden="true">+</span>
        </button>
      )}

      <Dialog
        open={open}
        onClose={requestCloseDialog}
        triggerRef={effectiveTriggerRef}
        title="Create Room"
        description="Create a room with two fixed projects and invited participants."
        panelClassName="overflow-visible"
        contentClassName="overflow-visible"
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          {availableSpaces.length === 0 ? (
            <p role="alert" className="rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-muted">
              Join a space before creating a room.
            </p>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="room-create-space">
              Space
            </label>
            <select
              id="room-create-space"
              value={selectedSpaceId}
              onChange={(event) => setSpaceId(event.target.value)}
              disabled={availableSpaces.length === 0}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
            >
              {availableSpaces.length === 0 ? (
                <option value="">No spaces available</option>
              ) : availableSpaces.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="room-create-name">
              Room name
            </label>
            <input
              id="room-create-name"
              ref={roomNameInputRef}
              type="text"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
              placeholder="Sprint room"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              What projects live in this room?
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="room-create-project-one">
                  Project one
                </label>
                <input
                  id="room-create-project-one"
                  type="text"
                  value={projectOneName}
                  onChange={(event) => setProjectOneName(event.target.value)}
                  className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  placeholder={DEFAULT_ROOM_PROJECT_NAMES.primary}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="room-create-project-two">
                  Project two
                </label>
                <input
                  id="room-create-project-two"
                  type="text"
                  value={projectTwoName}
                  onChange={(event) => setProjectTwoName(event.target.value)}
                  className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
                  placeholder={DEFAULT_ROOM_PROJECT_NAMES.secondary}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted" htmlFor="room-create-participants">
              Participants
            </label>
            <textarea
              id="room-create-participants"
              value={participantInput}
              onChange={(event) => setParticipantInput(event.target.value)}
              rows={4}
              className="w-full rounded-control border border-border-muted bg-surface px-3 py-2 text-sm text-text"
              placeholder={'one@example.com\nuser_123'}
            />
            <p className="text-xs text-muted">
              Enter one email address or user identifier per line. Participants must already belong to the selected space.
            </p>
          </div>

          {error ? <p role="alert" aria-live="assertive" className="text-sm text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={requestCloseDialog}
              variant="secondary"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDisabled}
              loading={submitting}
              loadingLabel="Creating"
            >
              Create room
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
