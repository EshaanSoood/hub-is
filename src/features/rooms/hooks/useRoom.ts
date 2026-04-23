import { useCallback, useEffect, useRef, useState } from 'react';

import type { Room } from '../../../shared/api-types';
import { archiveRoom, getRoom } from '../../../services/hub/rooms';
import { requestRoomListRefresh } from '../roomListRefresh';

interface UseRoomParams {
  accessToken: string | null | undefined;
  roomId: string | null | undefined;
}

export const useRoom = ({ accessToken, roomId }: UseRoomParams) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const refreshRoom = useCallback(async () => {
    if (!accessToken || !roomId) {
      requestVersionRef.current += 1;
      setRoom(null);
      setLoading(false);
      setError(null);
      return null;
    }

    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    try {
      const nextRoom = await getRoom(accessToken, roomId);
      if (requestVersion !== requestVersionRef.current) {
        return nextRoom;
      }
      setRoom(nextRoom);
      setError(null);
      return nextRoom;
    } catch (loadError) {
      if (requestVersion === requestVersionRef.current) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load room.');
      }
      throw loadError;
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken, roomId]);

  const archiveOwnedRoom = useCallback(async () => {
    if (!accessToken || !roomId) {
      throw new Error('Authentication and room id are required to archive a room.');
    }

    setArchiving(true);
    try {
      const nextRoom = await archiveRoom(accessToken, roomId);
      setRoom(nextRoom);
      setError(null);
      requestRoomListRefresh();
      return nextRoom;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to archive room.');
      throw mutationError;
    } finally {
      setArchiving(false);
    }
  }, [accessToken, roomId]);

  useEffect(() => {
    if (!accessToken || !roomId) {
      requestVersionRef.current += 1;
      setRoom(null);
      setLoading(false);
      setError(null);
      return;
    }

    void refreshRoom().catch(() => {});
  }, [accessToken, roomId, refreshRoom]);

  return {
    archiveRoom: archiveOwnedRoom,
    archiving,
    error,
    loading,
    refreshRoom,
    room,
  };
};
