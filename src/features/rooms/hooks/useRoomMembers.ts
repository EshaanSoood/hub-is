import { useCallback, useEffect, useRef, useState } from 'react';

import type { RoomMembership } from '../../../shared/api-types';
import { addRoomMember, listRoomMembers } from '../../../services/hub/rooms';

interface UseRoomMembersParams {
  accessToken: string | null | undefined;
  roomId: string | null | undefined;
}

export const useRoomMembers = ({ accessToken, roomId }: UseRoomMembersParams) => {
  const [members, setMembers] = useState<RoomMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const refreshRoomMembers = useCallback(async () => {
    if (!accessToken || !roomId) {
      requestVersionRef.current += 1;
      setMembers([]);
      setLoading(false);
      setError(null);
      return [];
    }

    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    try {
      const nextMembers = await listRoomMembers(accessToken, roomId);
      if (requestVersion !== requestVersionRef.current) {
        return nextMembers;
      }
      setMembers(nextMembers);
      setError(null);
      return nextMembers;
    } catch (loadError) {
      if (requestVersion === requestVersionRef.current) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load room members.');
      }
      return [];
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [accessToken, roomId]);

  useEffect(() => {
    if (!accessToken || !roomId) {
      requestVersionRef.current += 1;
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    void refreshRoomMembers().catch(() => {});
  }, [accessToken, roomId, refreshRoomMembers]);

  const onInviteEmailChange = useCallback((value: string) => {
    setInviteEmail(value);
    setInviteNotice(null);
    setError(null);
  }, []);

  const inviteParticipant = useCallback(async () => {
    if (!accessToken || !roomId) {
      throw new Error('Authentication and room id are required to add a participant.');
    }

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setError('Enter an email address to add a participant.');
      setInviteNotice(null);
      return false;
    }

    setInviting(true);
    try {
      const nextMembers = await addRoomMember(accessToken, roomId, { email });
      setMembers(nextMembers);
      setInviteEmail('');
      setInviteNotice(`Added ${email} to the room.`);
      setError(null);
      return true;
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Failed to add participant.');
      setInviteNotice(null);
      return false;
    } finally {
      setInviting(false);
    }
  }, [accessToken, inviteEmail, roomId]);

  return {
    error,
    inviteEmail,
    inviteNotice,
    inviteParticipant,
    inviting,
    loading,
    members,
    onInviteEmailChange,
    refreshRoomMembers,
  };
};
