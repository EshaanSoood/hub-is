import { useCallback, useEffect, useRef, useState } from 'react';

import type { CreateRoomRequest, Room } from '../../../shared/api-types';
import { archiveRoom, createRoom, listRooms } from '../../../services/hub/rooms';
import { requestRoomListRefresh, subscribeRoomListRefresh } from '../roomListRefresh';

interface UseRoomsParams {
  accessToken: string | null | undefined;
}

export const useRooms = ({ accessToken }: UseRoomsParams) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [archivingRoomId, setArchivingRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const refreshRooms = useCallback(async () => {
    if (!accessToken) {
      requestVersionRef.current += 1;
      setRooms([]);
      setError(null);
      setLoading(false);
      return [];
    }

    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    try {
      const nextRooms = await listRooms(accessToken);
      if (requestVersion !== requestVersionRef.current) {
        return nextRooms;
      }
      setRooms(nextRooms);
      setError(null);
      return nextRooms;
    } catch (loadError) {
      if (requestVersion === requestVersionRef.current) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load rooms.');
      }
      throw loadError;
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken]);

  const createOwnedRoom = useCallback(async (payload: CreateRoomRequest) => {
    if (!accessToken) {
      throw new Error('Authentication is required to create a room.');
    }

    setCreating(true);
    try {
      const room = await createRoom(accessToken, payload);
      setRooms((current) => [room, ...current.filter((entry) => entry.id !== room.id)]);
      setError(null);
      requestRoomListRefresh();
      return room;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to create room.');
      throw mutationError;
    } finally {
      setCreating(false);
    }
  }, [accessToken]);

  const archiveOwnedRoom = useCallback(async (roomId: string) => {
    if (!accessToken) {
      throw new Error('Authentication is required to archive a room.');
    }

    setArchivingRoomId(roomId);
    try {
      const room = await archiveRoom(accessToken, roomId);
      setRooms((current) => current.map((entry) => (entry.id === room.id ? room : entry)));
      setError(null);
      requestRoomListRefresh();
      return room;
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Failed to archive room.');
      throw mutationError;
    } finally {
      setArchivingRoomId((current) => (current === roomId ? null : current));
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      requestVersionRef.current += 1;
      setRooms([]);
      setLoading(false);
      setError(null);
      return;
    }

    void refreshRooms().catch(() => {});
  }, [accessToken, refreshRooms]);

  useEffect(() => subscribeRoomListRefresh(() => {
    void refreshRooms().catch(() => {});
  }), [refreshRooms]);

  return {
    archiveRoom: archiveOwnedRoom,
    archivingRoomId,
    createRoom: createOwnedRoom,
    creating,
    error,
    loading,
    refreshRooms,
    rooms,
  };
};
