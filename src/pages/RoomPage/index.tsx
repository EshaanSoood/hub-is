import type { ReactElement } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { InlineNotice } from '../../components/primitives';
import { useAuthz } from '../../context/AuthzContext';
import { RoomWorkspace } from '../../features/rooms/RoomWorkspace';
import { parseRoomIdParam } from '../../features/rooms/navigation';

export const RoomPage = (): ReactElement => {
  const { accessToken, sessionSummary } = useAuthz();
  const { paneId, roomId: rawRoomId } = useParams();
  const roomId = parseRoomIdParam(rawRoomId);

  if (!roomId) {
    return <Navigate to="/projects" replace />;
  }

  if (!accessToken) {
    return (
      <InlineNotice variant="danger" title="Authentication required">
        Authentication token is missing. Re-authenticate and retry.
      </InlineNotice>
    );
  }

  return (
    <RoomWorkspace
      accessToken={accessToken}
      roomId={roomId}
      roomProjectPaneId={paneId}
      sessionUserId={sessionSummary.userId}
    />
  );
};
