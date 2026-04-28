import { useMemo, useState, type ReactElement } from 'react';
import type { RefObject } from 'react';
import { Button, CheckboxField, Dialog, InlineNotice } from '../primitives';
import type { HubProjectMember, HubProjectSummary } from '../../services/hub/types';
import type { SpaceInviteRole } from '../../hooks/useProjectMembers';

interface SpaceMembersManagementProps {
  spaceName: string;
  projects: HubProjectSummary[];
  members: HubProjectMember[];
  canInviteMembers: boolean;
  canManageMembers: boolean;
  inviteEmail: string;
  inviteRole: SpaceInviteRole;
  inviteProjectIds: string[];
  viewerInviteDays: number;
  inviteSubmitting: boolean;
  memberActionUserId: string | null;
  inviteError: string | null;
  inviteNotice: string | null;
  cooldownInviteError: boolean;
  inviteInputRef?: RefObject<HTMLInputElement | null>;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (role: SpaceInviteRole) => void;
  onToggleInviteProject: (projectId: string) => void;
  onViewerInviteDaysChange: (days: number) => void;
  onInviteSubmit: () => void;
  onDismissInviteFeedback: () => void;
  onUpgradeGuestToMember: (userId: string) => Promise<boolean>;
  onExtendGuestAccess: (member: HubProjectMember) => Promise<boolean>;
  onRemoveProjectMember: (userId: string) => Promise<boolean>;
  onGrantProjectAccess: (userId: string, projectIds: string[]) => Promise<boolean>;
}

const roleOptions: Array<{ value: SpaceInviteRole; label: string }> = [
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'guest', label: 'Guest' },
];

const roleLabel = (role: HubProjectMember['role']): string => {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'viewer':
      return 'Viewer';
    case 'guest':
      return 'Guest';
    case 'member':
    default:
      return 'Member';
  }
};

const daysUntil = (expiresAt: string | null | undefined): number | null => {
  if (!expiresAt) {
    return null;
  }
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) {
    return null;
  }
  return Math.max(0, Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000)));
};

const expiryWarningClass = (daysRemaining: number | null): string => {
  if (daysRemaining === null || daysRemaining > 7) {
    return 'border-border-muted bg-surface text-muted';
  }
  if (daysRemaining <= 1) {
    return 'border-danger bg-danger-subtle text-danger';
  }
  if (daysRemaining <= 3) {
    return 'border-danger bg-warning-subtle text-danger';
  }
  return 'border-subtle bg-warning-subtle text-text';
};

const projectAccessLabels = (member: HubProjectMember): string[] =>
  (member.project_access ?? []).map((project) => project.project_name || project.project_id);

export const SpaceMembersManagement = ({
  spaceName,
  projects,
  members,
  canInviteMembers,
  canManageMembers,
  inviteEmail,
  inviteRole,
  inviteProjectIds,
  viewerInviteDays,
  inviteSubmitting,
  memberActionUserId,
  inviteError,
  inviteNotice,
  cooldownInviteError,
  inviteInputRef,
  onInviteEmailChange,
  onInviteRoleChange,
  onToggleInviteProject,
  onViewerInviteDaysChange,
  onInviteSubmit,
  onDismissInviteFeedback,
  onUpgradeGuestToMember,
  onExtendGuestAccess,
  onRemoveProjectMember,
  onGrantProjectAccess,
}: SpaceMembersManagementProps): ReactElement => {
  const [removeTarget, setRemoveTarget] = useState<HubProjectMember | null>(null);
  const [projectAccessTarget, setProjectAccessTarget] = useState<HubProjectMember | null>(null);
  const [projectAccessSelection, setProjectAccessSelection] = useState<string[]>([]);

  const availableProjectAccessOptions = useMemo(() => {
    if (!projectAccessTarget) {
      return [];
    }
    const existingProjectIds = new Set((projectAccessTarget.project_access ?? []).map((access) => access.project_id));
    return projects.filter((project) => !existingProjectIds.has(project.project_id));
  }, [projectAccessTarget, projects]);

  const toggleProjectAccessSelection = (projectId: string) => {
    setProjectAccessSelection((current) =>
      current.includes(projectId)
        ? current.filter((selectedProjectId) => selectedProjectId !== projectId)
        : [...current, projectId],
    );
  };

  const closeProjectAccessDialog = () => {
    setProjectAccessTarget(null);
    setProjectAccessSelection([]);
  };

  const submitProjectAccess = async () => {
    if (!projectAccessTarget) {
      return;
    }
    const added = await onGrantProjectAccess(projectAccessTarget.user_id, projectAccessSelection);
    if (added) {
      closeProjectAccessDialog();
    }
  };

  return (
    <section className="space-y-4" aria-label="Space member management">
      <div className="space-y-4 border-b border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text">Invite members</h2>
            <p className="mt-1 text-sm text-muted">
              Add collaborators by email. They&apos;ll receive an invite to join this space.
            </p>
          </div>
        </div>

        {canInviteMembers ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onInviteSubmit();
            }}
          >
            <label htmlFor="space-member-invite-email" className="block text-xs font-semibold uppercase tracking-wide text-muted">
              Collaborator email
            </label>
            <input
              ref={inviteInputRef}
              id="space-member-invite-email"
              name="member-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={inviteEmail}
              onChange={(event) => onInviteEmailChange(event.target.value)}
              className="w-full rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              placeholder="name@example.com"
            />

            <div role="radiogroup" aria-label="Invite role" className="flex flex-wrap gap-2">
              {roleOptions.map((option) => (
                <label
                  key={option.value}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-focus-ring ${
                    inviteRole === option.value ? 'border-primary bg-primary text-on-primary' : 'border-border-muted bg-surface text-primary'
                  }`}
                >
                  <input
                    type="radio"
                    name="space-invite-role"
                    value={option.value}
                    checked={inviteRole === option.value}
                    onChange={() => onInviteRoleChange(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {inviteRole === 'viewer' || inviteRole === 'guest' ? (
              <fieldset className="rounded-panel border border-subtle bg-surface p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Project access</legend>
                <div className="mt-2 space-y-2">
                  {projects.map((project) => (
                    <CheckboxField
                      key={project.project_id}
                      id={`invite-project-${project.project_id}`}
                      label={project.name}
                      checked={inviteProjectIds.includes(project.project_id)}
                      onCheckedChange={() => onToggleInviteProject(project.project_id)}
                    />
                  ))}
                  {projects.length === 0 ? <p className="text-sm text-muted">No projects are available in this space.</p> : null}
                </div>
              </fieldset>
            ) : null}

            {inviteRole === 'viewer' ? (
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="viewer-invite-days">
                Duration in days
                <input
                  id="viewer-invite-days"
                  type="number"
                  min={1}
                  value={viewerInviteDays}
                  onChange={(event) => onViewerInviteDaysChange(event.currentTarget.valueAsNumber)}
                  className="mt-1 block w-32 rounded-panel border border-border-muted bg-surface px-3 py-2 text-sm font-normal text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                />
              </label>
            ) : null}

            {inviteRole === 'guest' ? (
              <InlineNotice variant="warning" title="Guest access rules">
                Guests have full access to selected projects for 30 days. After 30 days, they must be upgraded to a paid member or their access expires. The same person cannot be re-invited as a guest to this space for 90 days after their access ends.
              </InlineNotice>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                loading={inviteSubmitting}
                loadingLabel="Sending invite"
                disabled={inviteEmail.trim().length === 0 || ((inviteRole === 'viewer' || inviteRole === 'guest') && inviteProjectIds.length === 0)}
              >
                Invite {roleOptions.find((option) => option.value === inviteRole)?.label ?? 'Member'}
              </Button>
              {cooldownInviteError ? (
                <Button type="button" variant="secondary" onClick={() => onInviteRoleChange('member')}>
                  Invite as member instead
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">Personal spaces do not support member invites.</p>
        )}

        {inviteError ? (
          <InlineNotice variant="danger" title="Member update failed" onDismiss={onDismissInviteFeedback}>
            {inviteError}
          </InlineNotice>
        ) : null}
        {inviteNotice ? (
          <InlineNotice variant="success" title="Member update saved" onDismiss={onDismissInviteFeedback}>
            {inviteNotice}
          </InlineNotice>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text">Members</h2>
        <ul className="space-y-2">
          {members.map((member) => {
            const apiExpiryDays = typeof member.expiry_days_remaining === 'number' ? member.expiry_days_remaining : null;
            const expiryDays = apiExpiryDays ?? daysUntil(member.expires_at);
            const reminderWindow = typeof member.expiry_reminder_window === 'number' ? member.expiry_reminder_window : null;
            const isScopedRole = member.role === 'viewer' || member.role === 'guest';
            const isGuestApproachingExpiry = member.role === 'guest' && expiryDays !== null && (
              reminderWindow !== null ? expiryDays <= reminderWindow : expiryDays <= 7
            );
            const accessLabels = projectAccessLabels(member);
            return (
              <li key={member.user_id} className="rounded-panel border border-border-muted bg-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
                      <span>{member.display_name}</span>
                      <span className="rounded-control border border-border-muted bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-muted">
                        {roleLabel(member.role)}
                      </span>
                      {isScopedRole && expiryDays !== null ? (
                        <span
                          className={`rounded-control border px-2 py-0.5 text-xs font-semibold ${member.role === 'guest' ? expiryWarningClass(expiryDays) : 'border-border-muted bg-surface text-muted'}`}
                          aria-label={`${roleLabel(member.role)} access expires in ${expiryDays} ${expiryDays === 1 ? 'day' : 'days'}`}
                        >
                          {expiryDays} {expiryDays === 1 ? 'day' : 'days'} left
                        </span>
                      ) : null}
                    </p>
                    {member.email ? <p className="mt-1 text-xs text-muted">{member.email}</p> : null}
                    {isGuestApproachingExpiry ? (
                      <p className="mt-2 text-xs font-semibold text-danger" role="status">
                        Guest access expires soon.
                      </p>
                    ) : null}
                    {isScopedRole ? (
                      <p className="mt-2 text-xs text-muted">
                        Project access: {accessLabels.length > 0 ? accessLabels.join(', ') : 'No projects selected'}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {member.role === 'guest' && isGuestApproachingExpiry ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={memberActionUserId === member.user_id}
                          onClick={() => {
                            void onUpgradeGuestToMember(member.user_id);
                          }}
                        >
                          Upgrade to member
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={memberActionUserId === member.user_id}
                          onClick={() => {
                            void onExtendGuestAccess(member);
                          }}
                        >
                          Extend access
                        </Button>
                      </>
                    ) : null}
                    {isScopedRole && canManageMembers ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setProjectAccessTarget(member);
                          setProjectAccessSelection([]);
                        }}
                      >
                        Add project
                      </Button>
                    ) : null}
                    {canManageMembers ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRemoveTarget(member)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog
        open={Boolean(removeTarget)}
        title={removeTarget ? `Remove ${removeTarget.display_name}?` : 'Remove member?'}
        description="Confirm space member removal."
        onClose={() => setRemoveTarget(null)}
        panelClassName="dialog-panel-compact-size rounded-panel bg-surface-elevated p-6 shadow-soft"
      >
        {removeTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-text">
              Remove {removeTarget.display_name} from {spaceName}? Their content will remain in the space but will no longer link to their profile.
            </p>
            {removeTarget.role === 'guest' ? (
              <p className="text-sm text-danger">This person cannot be re-invited as a guest for 90 days.</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRemoveTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={memberActionUserId === removeTarget.user_id}
                onClick={() => {
                  void onRemoveProjectMember(removeTarget.user_id).then((removed) => {
                    if (removed) {
                      setRemoveTarget(null);
                    }
                  });
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(projectAccessTarget)}
        title={projectAccessTarget ? `Add project access for ${projectAccessTarget.display_name}` : 'Add project access'}
        description="Choose projects to grant to this member."
        onClose={closeProjectAccessDialog}
        panelClassName="dialog-panel-compact-size rounded-panel bg-surface-elevated p-6 shadow-soft"
      >
        <div className="space-y-4">
          <fieldset className="rounded-panel border border-subtle bg-surface p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Projects</legend>
            <div className="mt-2 space-y-2">
              {availableProjectAccessOptions.map((project) => (
                <CheckboxField
                  key={project.project_id}
                  id={`member-project-access-${project.project_id}`}
                  label={project.name}
                  checked={projectAccessSelection.includes(project.project_id)}
                  onCheckedChange={() => toggleProjectAccessSelection(project.project_id)}
                />
              ))}
              {availableProjectAccessOptions.length === 0 ? <p className="text-sm text-muted">All projects are already available.</p> : null}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeProjectAccessDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={projectAccessSelection.length === 0 || memberActionUserId === projectAccessTarget?.user_id}
              onClick={() => {
                void submitProjectAccess();
              }}
            >
              Add project
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
};
