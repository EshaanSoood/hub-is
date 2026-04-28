import { useCallback, useState } from 'react';

import { addSpaceMemberProjectAccess, createSpaceInvite, removeSpaceMember, updateSpaceMember } from '../services/hub/spaces';
import { HubRequestError } from '../services/hub/transport';
import type { HubProjectMember } from '../services/hub/types';

interface UseProjectMembersParams {
  accessToken: string;
  spaceId: string;
  projectMembers: HubProjectMember[];
  refreshProjectData: () => Promise<void>;
}

export type SpaceInviteRole = 'member' | 'viewer' | 'guest';

const addDaysIso = (baseIso: string | null | undefined, days: number): string => {
  const baseMs = baseIso ? Date.parse(baseIso) : Number.NaN;
  const baseDate = Number.isFinite(baseMs) ? new Date(baseMs) : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString();
};

export const useProjectMembers = ({
  accessToken,
  spaceId,
  projectMembers,
  refreshProjectData,
}: UseProjectMembersParams) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<SpaceInviteRole>('member');
  const [inviteProjectIds, setInviteProjectIds] = useState<string[]>([]);
  const [viewerInviteDays, setViewerInviteDays] = useState(7);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const [projectMemberMutationError, setProjectMemberMutationError] = useState<string | null>(null);
  const [projectMemberMutationNotice, setProjectMemberMutationNotice] = useState<string | null>(null);
  const [cooldownInviteError, setCooldownInviteError] = useState(false);

  const onInviteEmailChange = useCallback((value: string) => {
    setInviteEmail(value);
    setCooldownInviteError(false);
    if (projectMemberMutationError) {
      setProjectMemberMutationError(null);
    }
    if (projectMemberMutationNotice) {
      setProjectMemberMutationNotice(null);
    }
  }, [projectMemberMutationError, projectMemberMutationNotice]);

  const clearProjectMemberFeedback = useCallback(() => {
    setProjectMemberMutationError(null);
    setProjectMemberMutationNotice(null);
    setCooldownInviteError(false);
  }, []);

  const onInviteRoleChange = useCallback((role: SpaceInviteRole) => {
    setInviteRole(role);
    setCooldownInviteError(false);
    setProjectMemberMutationError(null);
    setProjectMemberMutationNotice(null);
    if (role === 'member') {
      setInviteProjectIds([]);
    }
  }, []);

  const onToggleInviteProject = useCallback((workProjectId: string) => {
    setInviteProjectIds((current) =>
      current.includes(workProjectId)
        ? current.filter((selectedWorkProjectId) => selectedWorkProjectId !== workProjectId)
        : [...current, workProjectId],
    );
    setProjectMemberMutationError(null);
    setCooldownInviteError(false);
  }, []);

  const onViewerInviteDaysChange = useCallback((days: number) => {
    setViewerInviteDays(Number.isFinite(days) && days > 0 ? Math.floor(days) : 7);
    setProjectMemberMutationError(null);
  }, []);

  const onCreateProjectMember = useCallback(
    async () => {
      const email = inviteEmail.trim().toLowerCase();
      if (!email) {
        setProjectMemberMutationError('Enter an email address to invite a collaborator.');
        setProjectMemberMutationNotice(null);
        return false;
      }
      if ((inviteRole === 'viewer' || inviteRole === 'guest') && inviteProjectIds.length === 0) {
        setProjectMemberMutationError('Select at least one project for this invite.');
        setProjectMemberMutationNotice(null);
        return false;
      }
      setProjectMemberMutationError(null);
      setProjectMemberMutationNotice(null);
      setCooldownInviteError(false);
      setIsSubmittingInvite(true);

      try {
        await createSpaceInvite(accessToken, spaceId, {
          email,
          role: inviteRole,
          ...(inviteRole === 'member' ? {} : { project_ids: inviteProjectIds }),
          ...(inviteRole === 'viewer' ? { expires_after_days: viewerInviteDays } : {}),
        });
        setInviteEmail('');
        setInviteProjectIds([]);
        setViewerInviteDays(7);
        setInviteRole('member');
        setProjectMemberMutationNotice(`Invite sent to ${email}.`);
        try {
          await refreshProjectData();
        } catch (refreshError) {
          console.warn('Project data refresh failed after invite creation.', refreshError);
        }
        return true;
      } catch (error) {
        if (
          error instanceof HubRequestError &&
          error.status === 409 &&
          inviteRole === 'guest' &&
          error.message.toLowerCase().includes('guest cooldown')
        ) {
          setCooldownInviteError(true);
        }
        setProjectMemberMutationError(error instanceof Error ? error.message : 'Failed to add collaborator.');
        return false;
      } finally {
        setIsSubmittingInvite(false);
      }
    },
    [accessToken, inviteEmail, inviteProjectIds, inviteRole, refreshProjectData, spaceId, viewerInviteDays],
  );

  const refreshAfterMemberAction = useCallback(async () => {
    try {
      await refreshProjectData();
    } catch (refreshError) {
      console.warn('Project data refresh failed after member update.', refreshError);
    }
  }, [refreshProjectData]);

  const onUpgradeGuestToMember = useCallback(async (userId: string) => {
    setMemberActionUserId(userId);
    setProjectMemberMutationError(null);
    setProjectMemberMutationNotice(null);
    try {
      await updateSpaceMember(accessToken, spaceId, userId, { role: 'member', expires_at: null });
      setProjectMemberMutationNotice('Guest upgraded to member.');
      await refreshAfterMemberAction();
      return true;
    } catch (error) {
      setProjectMemberMutationError(error instanceof Error ? error.message : 'Failed to upgrade member.');
      return false;
    } finally {
      setMemberActionUserId(null);
    }
  }, [accessToken, refreshAfterMemberAction, spaceId]);

  const onExtendGuestAccess = useCallback(async (member: HubProjectMember) => {
    setMemberActionUserId(member.user_id);
    setProjectMemberMutationError(null);
    setProjectMemberMutationNotice(null);
    try {
      await updateSpaceMember(accessToken, spaceId, member.user_id, { expires_at: addDaysIso(member.expires_at, 30) });
      setProjectMemberMutationNotice('Guest access extended by 30 days.');
      await refreshAfterMemberAction();
      return true;
    } catch (error) {
      setProjectMemberMutationError(error instanceof Error ? error.message : 'Failed to extend access.');
      return false;
    } finally {
      setMemberActionUserId(null);
    }
  }, [accessToken, refreshAfterMemberAction, spaceId]);

  const onRemoveProjectMember = useCallback(async (userId: string) => {
    setMemberActionUserId(userId);
    setProjectMemberMutationError(null);
    setProjectMemberMutationNotice(null);
    try {
      await removeSpaceMember(accessToken, spaceId, userId);
      setProjectMemberMutationNotice('Member removed from the space.');
      await refreshAfterMemberAction();
      return true;
    } catch (error) {
      setProjectMemberMutationError(error instanceof Error ? error.message : 'Failed to remove member.');
      return false;
    } finally {
      setMemberActionUserId(null);
    }
  }, [accessToken, refreshAfterMemberAction, spaceId]);

  const onGrantProjectAccess = useCallback(async (userId: string, workProjectIds: string[]) => {
    if (workProjectIds.length === 0) {
      setProjectMemberMutationError('Select at least one project to add.');
      return false;
    }
    setMemberActionUserId(userId);
    setProjectMemberMutationError(null);
    setProjectMemberMutationNotice(null);
    const uniqueWorkProjectIds = [...new Set(workProjectIds)];
    try {
      const results = await Promise.allSettled(
        uniqueWorkProjectIds.map((workProjectId) => addSpaceMemberProjectAccess(accessToken, spaceId, userId, workProjectId)),
      );
      const failedWorkProjectIds = results
        .map((result, index) => (result.status === 'rejected' ? uniqueWorkProjectIds[index] : null))
        .filter((workProjectId): workProjectId is string => Boolean(workProjectId));
      if (failedWorkProjectIds.length > 0) {
        const successCount = uniqueWorkProjectIds.length - failedWorkProjectIds.length;
        setProjectMemberMutationError(
          successCount > 0
            ? `Added access to ${successCount} of ${uniqueWorkProjectIds.length} projects. Failed project IDs: ${failedWorkProjectIds.join(', ')}.`
            : 'Failed to add project access.',
        );
        return false;
      }
      setProjectMemberMutationNotice(uniqueWorkProjectIds.length === 1 ? 'Project access added.' : 'Project access added to selected projects.');
      return true;
    } catch (error) {
      setProjectMemberMutationError(error instanceof Error ? error.message : 'Failed to add project access.');
      return false;
    } finally {
      await refreshAfterMemberAction();
      setMemberActionUserId(null);
    }
  }, [accessToken, refreshAfterMemberAction, spaceId]);

  return {
    // passthrough: projectMembers is owned by the bootstrap fetch, not this hook
    projectMembers,
    inviteEmail,
    inviteRole,
    inviteProjectIds,
    viewerInviteDays,
    isSubmittingInvite,
    memberActionUserId,
    projectMemberMutationError,
    projectMemberMutationNotice,
    cooldownInviteError,
    clearProjectMemberFeedback,
    onInviteEmailChange,
    onInviteRoleChange,
    onToggleInviteProject,
    onViewerInviteDaysChange,
    onCreateProjectMember,
    onUpgradeGuestToMember,
    onExtendGuestAccess,
    onRemoveProjectMember,
    onGrantProjectAccess,
  };
};
