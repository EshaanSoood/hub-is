import { useRef, useState } from 'react';
import { useAuthz } from '../../context/AuthzContext';
import { useProjects } from '../../context/ProjectsContext';
import { AccessibleDialog, Icon } from '../primitives';

const projectToneClasses = [
  'bg-info-subtle text-primary-strong',
  'bg-muted-subtle text-text',
  'bg-success-subtle text-text',
] as const;

export const ProfilePanel = () => {
  const { sessionSummary, signOut } = useAuthz();
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const avatarSeed = encodeURIComponent(sessionSummary.name || sessionSummary.email || sessionSummary.userId);
  const avatarUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${avatarSeed}`;
  const avatarBroken = brokenAvatarUrl === avatarUrl;
  const projectNames =
    projects.length > 0
      ? projects.map((project) => project.name)
      : sessionSummary.projectMemberships.map((membership) => membership.projectId);

  const onSignOut = () => {
    void signOut();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open profile panel"
        onClick={() => setOpen(true)}
        className="rounded-panel border border-border-muted px-3 py-2 text-sm font-semibold text-primary"
      >
        Profile
      </button>

      <AccessibleDialog
        open={open}
        title={`${sessionSummary.name} profile`}
        description="Account details, current projects, and sign out action."
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        hideHeader
        panelClassName="w-full max-w-sm rounded-panel bg-surface-elevated p-6 shadow-soft"
      >
        <div className="flex flex-col items-center">
          {avatarBroken ? (
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface bg-surface text-text">
              <Icon name="user" className="text-[40px]" />
            </span>
          ) : (
            <img
              src={avatarUrl}
              alt={`${sessionSummary.name} profile`}
              className="h-24 w-24 rounded-full border-4 border-surface object-cover"
              onError={() => setBrokenAvatarUrl(avatarUrl)}
            />
          )}
          <h2 className="heading-2 mt-4 text-primary-strong">{sessionSummary.name}</h2>
          <p className="mt-1 text-sm text-muted">{sessionSummary.role}</p>
        </div>

        <hr className="my-6 border-border-muted opacity-50" />

        <div>
          <h3 className="heading-3 mb-3 text-primary-strong">Projects</h3>
          <ul className="space-y-2">
            {projectNames.length > 0 ? (
              projectNames.map((projectName, index) => (
                <li
                  key={`profile-project-${projectName}-${index}`}
                  className={`rounded-panel px-4 py-3 text-sm font-medium ${
                    projectToneClasses[index % projectToneClasses.length]
                  }`}
                >
                  {projectName}
                </li>
              ))
            ) : (
              <li className="rounded-panel bg-muted-subtle px-4 py-3 text-sm font-medium text-muted">
                No projects assigned
              </li>
            )}
          </ul>
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-panel bg-danger py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-danger-subtle hover:text-danger"
          >
            Log Out
          </button>
        </div>
      </AccessibleDialog>
    </>
  );
};
