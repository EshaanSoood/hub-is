import { startTransition, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthz } from '../../../context/AuthzContext';
import { useProjects } from '../../../context/ProjectsContext';
import { createHubProject } from '../../../services/projectsService';
import { QuickAddProjectDialog } from '../../layout/QuickAddDialogs';
import { Icon } from '../../primitives/Icon';

export const NewProjectAction = () => {
  const navigate = useNavigate();
  const { accessToken } = useAuthz();
  const { refreshProjects, upsertProject } = useProjects();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      setError('An authenticated session is required.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Space name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createHubProject(accessToken, {
        name: trimmedName,
        summary: '',
      });
      if (created.error || !created.data) {
        setError(created.error || 'Space creation failed.');
        return;
      }

      const createdProject = created.data;
      upsertProject(createdProject);
      void refreshProjects().catch(() => undefined);
      setName('');
      setOpen(false);
      startTransition(() => {
        navigate(`/projects/${encodeURIComponent(createdProject.id)}/overview`);
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Space creation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="interactive interactive-subtle flex w-full items-center gap-2 rounded-control border border-dashed border-subtle px-3 py-2 text-left text-sm font-normal text-text-secondary hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="plus" size={14} />
        <span>New space</span>
      </button>

      <QuickAddProjectDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        triggerRef={triggerRef}
        name={name}
        onNameChange={setName}
        onSubmit={onSubmit}
        submitting={submitting}
        error={error}
        nameInputRef={nameInputRef}
      />
    </>
  );
};
