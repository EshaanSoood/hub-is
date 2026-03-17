import { type FormEvent, useCallback, useState } from 'react';

import { addProjectMember, createProjectInvite } from '../services/hub/projects';
import type { HubProjectMember } from '../services/hub/types';

interface UseProjectMembersParams {
  accessToken: string;
  projectId: string;
  membershipRole: string | null;
  projectMembers: HubProjectMember[];
  refreshProjectData: () => Promise<void>;
}

export const useProjectMembers = ({
  accessToken,
  projectId,
  membershipRole,
  projectMembers,
  refreshProjectData,
}: UseProjectMembersParams) => {
  const [projectMemberMutationError, setProjectMemberMutationError] = useState<string | null>(null);
  const [projectMemberMutationNotice, setProjectMemberMutationNotice] = useState<string | null>(null);

  const onCreateProjectMember = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const input = form.elements.namedItem('member-email') as HTMLInputElement | null;
      if (!input) {
        return;
      }
      const email = input.value.trim() || '';
      if (!email) {
        return;
      }
      setProjectMemberMutationError(null);
      setProjectMemberMutationNotice(null);

      try {
        if (membershipRole === 'owner') {
          await addProjectMember(accessToken, projectId, {
            email,
            display_name: email.split('@')[0] || 'Member',
            role: 'member',
          });

          input.value = '';
          await refreshProjectData();
          return;
        }

        await createProjectInvite(accessToken, projectId, {
          email,
          role: 'member',
        });
        input.value = '';
        setProjectMemberMutationNotice('Invite sent - pending owner approval.');
      } catch (error) {
        setProjectMemberMutationError(error instanceof Error ? error.message : 'Failed to add collaborator.');
      }
    },
    [accessToken, membershipRole, projectId, refreshProjectData],
  );

  return {
    // passthrough: projectMembers is owned by the bootstrap fetch, not this hook
    projectMembers,
    projectMemberMutationError,
    projectMemberMutationNotice,
    onCreateProjectMember,
  };
};
