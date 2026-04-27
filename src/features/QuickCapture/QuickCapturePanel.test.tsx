import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { QuickCapturePanel } from './index';
import type { HubCollection, HubHomeCapture } from '../../services/hub/types';
import type { ProjectRecord } from '../../types/domain';

const mockNavigate = vi.fn();
const mockListCollections = vi.fn<(accessToken: string, projectId: string) => Promise<HubCollection[]>>();
const mockCreateRecord = vi.fn();
const mockCreatePersonalTask = vi.fn();
const mockConvertRecord = vi.fn();
const mockRequestHubHomeRefresh = vi.fn();
const mockFocusWhenReady = vi.fn((resolveElement: () => HTMLElement | null) => {
  resolveElement()?.focus();
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../components/primitives', () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
  IconButton: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Select: ({
    id,
    value,
    onValueChange,
    options,
    ariaLabel,
    disabled,
  }: {
    id?: string;
    value: string;
    onValueChange: (value: string) => void;
    options: Array<{ value: string; label: string; disabled?: boolean }>;
    ariaLabel?: string;
    disabled?: boolean;
  }) => (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../../lib/focusWhenReady', () => ({
  focusWhenReady: (resolveElement: () => HTMLElement | null) => mockFocusWhenReady(resolveElement),
}));

vi.mock('../../lib/hubHomeRefresh', () => ({
  requestHubHomeRefresh: () => mockRequestHubHomeRefresh(),
}));

vi.mock('../../services/hub/collections', () => ({
  listCollections: (accessToken: string, projectId: string) => mockListCollections(accessToken, projectId),
}));

vi.mock('../../services/hub/records', () => ({
  createRecord: (...args: unknown[]) => mockCreateRecord(...args),
  createPersonalTask: (...args: unknown[]) => mockCreatePersonalTask(...args),
  convertRecord: (...args: unknown[]) => mockConvertRecord(...args),
}));

const personalProject: ProjectRecord = {
  id: 'personal-project',
  name: 'Home',
  status: 'active',
  summary: '',
  openProjectProjectId: null,
  nextcloudFolder: null,
  isPersonal: true,
  membershipRole: 'owner',
  position: null,
};

const projectAlpha: ProjectRecord = {
  id: 'project-alpha',
  name: 'Alpha',
  status: 'active',
  summary: '',
  openProjectProjectId: null,
  nextcloudFolder: null,
  isPersonal: false,
  membershipRole: 'owner',
  position: 1,
};

const personalCollections: HubCollection[] = [
  {
    collection_id: 'collection-inbox',
    space_id: personalProject.id,
    name: 'Inbox',
    icon: null,
    color: null,
    created_at: '2026-04-19T10:00:00.000Z',
    updated_at: '2026-04-19T10:00:00.000Z',
  },
];

const projectTaskCollections: HubCollection[] = [
  {
    collection_id: 'collection-task',
    space_id: projectAlpha.id,
    name: 'Task Queue',
    icon: null,
    color: null,
    created_at: '2026-04-19T10:00:00.000Z',
    updated_at: '2026-04-19T10:00:00.000Z',
  },
];

const baseCaptures: HubHomeCapture[] = [
  {
    record_id: 'capture-new',
    space_id: personalProject.id,
    collection_id: 'collection-inbox',
    title: 'Newest capture',
    created_at: '2026-04-19T11:00:00.000Z',
  },
  {
    record_id: 'capture-old',
    space_id: personalProject.id,
    collection_id: 'collection-inbox',
    title: 'Older capture',
    created_at: '2026-04-18T11:00:00.000Z',
  },
];

const renderQuickCapture = ({
  projects = [personalProject, projectAlpha],
  captures = baseCaptures,
  initialIntent = null,
  activationKey = 0,
  preferredProjectId = null,
}: {
  projects?: ProjectRecord[];
  captures?: HubHomeCapture[];
  initialIntent?: string | null;
  activationKey?: number;
  preferredProjectId?: string | null;
} = {}) => {
  const onCaptureComplete = vi.fn().mockResolvedValue(undefined);
  const onRequestClose = vi.fn();

  const view = render(
    <QuickCapturePanel
      accessToken="access-token"
      projects={projects}
      personalProjectId={personalProject.id}
      captures={captures}
      onCaptureComplete={onCaptureComplete}
      preferredProjectId={preferredProjectId}
      initialIntent={initialIntent}
      activationKey={activationKey}
      onRequestClose={onRequestClose}
    />,
  );

  return {
    ...view,
    onCaptureComplete,
    onRequestClose,
  };
};

const submitCaptureForm = () => {
  const input = screen.getByRole('textbox', { name: 'Capture text' });
  const form = input.closest('form');
  if (!form) {
    throw new Error('Capture form not found.');
  }
  fireEvent.submit(form);
};

const openCaptureOptions = async (user: ReturnType<typeof userEvent.setup>) => {
  const toggleButton = screen.queryByRole('button', { name: 'Show capture options' })
    ?? screen.queryByRole('button', { name: 'Hide capture options' });
  if (!toggleButton) {
    throw new Error('Capture options toggle not found.');
  }
  if (toggleButton.getAttribute('aria-expanded') === 'true') {
    return;
  }
  await user.click(toggleButton);
};

const openAssignmentOptions = async (
  user: ReturnType<typeof userEvent.setup>,
  captureTitle: string,
  captureRecordId: string,
) => {
  const row = screen.getByTestId(`capture-row-${captureRecordId}`);
  if (!row) {
    throw new Error(`Capture row not found for ${captureTitle}.`);
  }
  await user.click(within(row).getByRole('button', { name: 'Show capture assignment options' }));
  return row;
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockListCollections.mockReset();
  mockCreateRecord.mockReset();
  mockCreatePersonalTask.mockReset();
  mockConvertRecord.mockReset();
  mockRequestHubHomeRefresh.mockReset();
  mockFocusWhenReady.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();

  mockListCollections.mockImplementation(async (_accessToken, projectId) => {
    if (projectId === personalProject.id) {
      return personalCollections;
    }
    if (projectId === projectAlpha.id) {
      return projectTaskCollections;
    }
    return [];
  });
  mockCreateRecord.mockResolvedValue({ record_id: 'record-1' });
  mockCreatePersonalTask.mockResolvedValue({ task: { id: 'task-1' } });
  mockConvertRecord.mockResolvedValue({ target_record_id: 'target-1', source_record_id: 'capture-old' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('QuickCapturePanel characterization', () => {
  it.each([
    { intent: null, expectedMode: 'thought', projectVisible: false },
    { intent: 'project-task', expectedMode: 'task', projectVisible: true },
    { intent: 'reminder', expectedMode: 'reminder', projectVisible: true },
    { intent: 'event', expectedMode: 'calendar', projectVisible: true },
  ])('maps initial intent $intent to $expectedMode mode', async ({ intent, expectedMode, projectVisible }) => {
    const user = userEvent.setup();
    renderQuickCapture({ initialIntent: intent, activationKey: 1 });
    await openCaptureOptions(user);

    const modeSelect = screen.getByRole('combobox', { name: 'Capture type' });
    expect(modeSelect).toHaveValue(expectedMode);

    if (projectVisible) {
      expect(screen.getByRole('combobox', { name: 'Capture space' })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('combobox', { name: 'Capture space' })).not.toBeInTheDocument();
    }
  });

  it('saves a thought to Home via createRecord', async () => {
    const user = userEvent.setup();
    const { onCaptureComplete } = renderQuickCapture();

    await user.type(screen.getByRole('textbox', { name: 'Capture text' }), 'Capture this thought');
    submitCaptureForm();

    await waitFor(() => {
      expect(mockCreateRecord).toHaveBeenCalledWith('access-token', personalProject.id, {
        collection_id: 'collection-inbox',
        title: 'Capture this thought',
      });
    });
    expect(onCaptureComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Capture text' })).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('saves a personal task via createPersonalTask', async () => {
    const user = userEvent.setup();
    const { onCaptureComplete } = renderQuickCapture();

    await openCaptureOptions(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture type' }), 'task');
    await user.type(screen.getByRole('textbox', { name: 'Capture text' }), 'Buy coffee');
    submitCaptureForm();

    await waitFor(() => {
      expect(mockCreatePersonalTask).toHaveBeenCalledWith('access-token', {
        space_id: personalProject.id,
        title: 'Buy coffee',
      });
    });
    expect(mockRequestHubHomeRefresh).toHaveBeenCalledTimes(1);
    expect(onCaptureComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Capture text' })).toHaveValue('');
  });

  it.each([
    { mode: 'reminder', label: 'Reminder' },
    { mode: 'calendar', label: 'Calendar' },
  ])('requires a project for $mode captures', async ({ mode }) => {
    const user = userEvent.setup();
    renderQuickCapture({ projects: [personalProject] });

    await openCaptureOptions(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture type' }), mode);
    await user.type(screen.getByRole('textbox', { name: 'Capture text' }), `Needs ${mode}`);
    submitCaptureForm();

    expect(await screen.findByText('Choose a space to categorize this capture.')).toBeInTheDocument();
    expect(mockCreateRecord).not.toHaveBeenCalled();
    expect(mockCreatePersonalTask).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'reminder', intent: 'reminder' },
    { mode: 'calendar', intent: 'event' },
  ])('hands off project $mode captures through pending draft navigation', async ({ mode, intent }) => {
    const user = userEvent.setup();
    const { onRequestClose } = renderQuickCapture();

    await openCaptureOptions(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture type' }), mode);
    await user.type(screen.getByRole('textbox', { name: 'Capture text' }), `${mode} capture`);
    submitCaptureForm();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectAlpha.id)}/work?capture=1&intent=${encodeURIComponent(intent)}`);
    });
    expect(onRequestClose).toHaveBeenCalledWith({ restoreFocus: false });
    expect(JSON.parse(window.sessionStorage.getItem('hub:pending-project-capture') || '{}')).toEqual({
      intent,
      seedText: `${mode} capture`,
    });
  });

  it('converts an assignment via convertRecord', async () => {
    const user = userEvent.setup();
    const { onCaptureComplete } = renderQuickCapture();

    await openAssignmentOptions(user, 'Older capture', 'capture-old');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture assignment type' }), 'task');

    await waitFor(() => {
      expect(mockConvertRecord).toHaveBeenCalledWith('access-token', 'capture-old', {
        mode: 'task',
        target_project_id: personalProject.id,
      });
    });
    expect(onCaptureComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Assigning...')).not.toBeInTheDocument();
  });

  it('toggles recent capture sort order', async () => {
    const user = userEvent.setup();
    renderQuickCapture();

    const titleTexts = () => screen.getAllByTestId(/capture-title-/).map((node) => node.textContent ?? '');

    expect(titleTexts()).toEqual(['Newest capture', 'Older capture']);

    await user.click(screen.getByRole('button', { name: 'Sort oldest first' }));

    expect(titleTexts()).toEqual(['Older capture', 'Newest capture']);
  });

  it('resets composer state when closed', async () => {
    const user = userEvent.setup();
    const { onRequestClose } = renderQuickCapture();

    await openCaptureOptions(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture type' }), 'task');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture space' }), projectAlpha.id);
    await user.type(screen.getByRole('textbox', { name: 'Capture text' }), 'Unsaved capture');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onRequestClose).toHaveBeenCalledWith();
    expect(screen.getByRole('textbox', { name: 'Capture text' })).toHaveValue('');
    expect(screen.queryByRole('combobox', { name: 'Capture space' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show capture options' })).toBeInTheDocument();
  });

  it('expands assignment controls on demand', async () => {
    const user = userEvent.setup();
    await renderQuickCapture();

    const row = await openAssignmentOptions(user, 'Older capture', 'capture-old');
    expect(within(row).getByRole('combobox', { name: 'Capture assignment type' })).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Hide capture assignment options' }));
    expect(within(row).queryByRole('combobox', { name: 'Capture assignment type' })).not.toBeInTheDocument();
  });

  it('expands long capture titles on hover after the delay', async () => {
    vi.useFakeTimers();
    const longTitle = `${'Long capture title '.repeat(20)}tail`;

    renderQuickCapture({
      captures: [
        {
          record_id: 'capture-long',
          space_id: personalProject.id,
          collection_id: 'collection-inbox',
          title: longTitle,
          created_at: '2026-04-19T11:00:00.000Z',
        },
      ],
    });

    const title = screen.getByTestId('capture-title-capture-long');
    expect(title).toHaveTextContent(longTitle);
    expect(title).toHaveClass('whitespace-nowrap');

    const hoverTarget = screen.getByTestId('capture-hover-target-capture-long');
    if (!hoverTarget) {
      throw new Error('Hover target not found.');
    }

    fireEvent.mouseEnter(hoverTarget);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(title).toHaveClass('break-words');
    expect(title).not.toHaveClass('whitespace-nowrap');

    fireEvent.mouseLeave(hoverTarget);

    expect(title).toHaveClass('whitespace-nowrap');
  });

  it('does not show project-required reminder guidance for personal tasks', async () => {
    const user = userEvent.setup();
    renderQuickCapture();

    await openCaptureOptions(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture type' }), 'task');

    expect(screen.queryByText('Reminders and calendar items need a space.')).not.toBeInTheDocument();
    expect(screen.queryByText('Create a space to route reminders or calendar captures.')).not.toBeInTheDocument();
  });

  it('disables assignment controls while a conversion is in flight', async () => {
    const user = userEvent.setup();
    let resolveConvert: (() => void) | undefined;
    mockConvertRecord.mockImplementation(
      () => new Promise((resolve) => {
        resolveConvert = () => {
          resolve({ target_record_id: 'target-1', source_record_id: 'capture-old' });
        };
      }),
    );

    await renderQuickCapture();
    const row = await openAssignmentOptions(user, 'Older capture', 'capture-old');

    await user.selectOptions(within(row).getByRole('combobox', { name: 'Capture assignment type' }), 'task');

    expect(within(row).getByRole('button', { name: 'Hide capture assignment options' })).toBeDisabled();
    expect(within(row).getByRole('combobox', { name: 'Capture assignment type' })).toBeDisabled();

    if (!resolveConvert) {
      throw new Error('Expected convert resolver to be set.');
    }
    resolveConvert();
    await waitFor(() => {
      expect(screen.queryByText('Assigning...')).not.toBeInTheDocument();
    });
  });

  it('continues project handoff when session storage is unavailable', async () => {
    const user = userEvent.setup();
    const sessionStorageSetItem = vi.spyOn(window.sessionStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'QuotaExceededError');
    });

    renderQuickCapture();

    await openCaptureOptions(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capture type' }), 'reminder');
    await user.type(screen.getByRole('textbox', { name: 'Capture text' }), 'reminder capture');
    submitCaptureForm();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectAlpha.id)}/work?capture=1&intent=reminder`);
    });

    sessionStorageSetItem.mockRestore();
  });
});
