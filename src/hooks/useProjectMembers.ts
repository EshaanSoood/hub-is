import { useCallback, useState } from 'react';

import { createSpaceInvite } from '../services/hub/spaces';
import type { HubProjectMember } from '../services/hub/types';

interface UseProjectMembersParams {
  accessToken: string;
  projectId: string;
  projectMembers: HubProjectMember[];
  refreshProjectData: () => Promise<void>;
}

export const useProjectMembers = ({
  accessToken,
  projectId,
  projectMembers,
  refreshProjectData,
}: UseProjectMembersParams) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [projectMemberMutationError, setProjectMemberMutationError] = useState<string | null>(null);
  const [projectMemberMutationNotice, setProjectMemberMutationNotice] = useState<string | null>(null);

  const onInviteEmailChange = useCallback((value: string) => {
    setInviteEmail(value);
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
  }, []);

  const onCreateProjectMember = useCallback(
    async () => {
      const email = inviteEmail.trim().toLowerCase();
      if (!email) {
        setProjectMemberMutationError('Enter an email address to invite a collaborator.');
        setProjectMemberMutationNotice(null);
        return false;
      }
      setProjectMemberMutationError(null);
      setProjectMemberMutationNotice(null);
      setIsSubmittingInvite(true);

      try {
        await createSpaceInvite(accessToken, projectId, {
          email,
          role: 'member',
        });
        setInviteEmail('');
        setProjectMemberMutationNotice(`Invite sent to ${email}.`);
        try {
          await refreshProjectData();
        } catch (refreshError) {
          console.warn('Project data refresh failed after invite creation.', refreshError);
        }
        return true;
      } catch (error) {
        setProjectMemberMutationError(error instanceof Error ? error.message : 'Failed to add collaborator.');
        return false;
      } finally {
        setIsSubmittingInvite(false);
      }
    },
    [accessToken, inviteEmail, projectId, refreshProjectData],
  );

  return {
    // passthrough: projectMembers is owned by the bootstrap fetch, not this hook
    projectMembers,
    inviteEmail,
    isSubmittingInvite,
    projectMemberMutationError,
    projectMemberMutationNotice,
    clearProjectMemberFeedback,
    onInviteEmailChange,
    onCreateProjectMember,
  };
};
