import type {
  ActivityEvent,
  HubFile,
  HubNote,
  Project,
  PullRequestItem,
  StudentProfile,
  TaskItem,
} from '../types/domain';

export const nowIso = (): string => new Date().toISOString();

export const mockNotes: HubNote[] = [
  {
    id: 'note-1',
    title: 'Q1 Launch Checklist',
    updatedAt: '2026-02-22T20:20:00.000Z',
    url: '/projects/backend-pilot',
  },
  {
    id: 'note-2',
    title: 'Automation Recovery Notes',
    updatedAt: '2026-02-22T18:00:00.000Z',
    url: '/projects/lessons-studio',
  },
];

export const mockFiles: HubFile[] = [
  {
    id: 'file-1',
    name: 'Architecture-Diagram.pdf',
    updatedAt: '2026-02-22T16:00:00.000Z',
    size: '2.8 MB',
  },
  {
    id: 'file-2',
    name: 'Students-Spring-2026.csv',
    updatedAt: '2026-02-21T22:00:00.000Z',
    size: '188 KB',
  },
];

export const mockProjects: Project[] = [
  {
    id: 'backend-pilot',
    name: 'Backend Pilot',
    status: 'active',
    summary: 'Core platform hardening and app orchestration.',
    metadata: {
      owner: 'Eshaan',
      priority: 'high',
      createdAt: '2026-02-10',
    },
    linkedExternalIds: {
      keycloakClientId: 'eshaan-os-web',
      openProjectProjectId: '42',
      invoiceClientId: 'C-1020',
    },
    notes: mockNotes,
    files: mockFiles,
    automations: ['wake-services', 'daily-health-report'],
  },
  {
    id: 'lessons-studio',
    name: 'Lessons Studio',
    status: 'active',
    summary: 'Students, notes, communications, and invoices.',
    metadata: {
      owner: 'Eshaan',
      priority: 'medium',
      createdAt: '2026-01-18',
    },
    linkedExternalIds: {
      keycloakClientId: 'eshaan-lessons',
      openProjectProjectId: '58',
      invoiceClientId: 'C-2040',
    },
    notes: mockNotes,
    files: mockFiles,
    automations: ['lesson-reminders', 'invoice-follow-up'],
  },
];

export const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'act-1',
    timestamp: '2026-02-23T01:05:00.000Z',
    category: 'wake',
    message: 'OpenProject health check changed to ready.',
    projectId: 'backend-pilot',
  },
  {
    id: 'act-2',
    timestamp: '2026-02-23T01:40:00.000Z',
    category: 'file',
    message: 'Downloaded incident bundle archive.',
    projectId: 'backend-pilot',
  },
  {
    id: 'act-3',
    timestamp: '2026-02-23T02:05:00.000Z',
    category: 'lesson',
    message: 'Invoice generated and sent for student: Jamie L.',
    projectId: 'lessons-studio',
  },
];

export const mockTasks: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Review ingress firewall temporary rules',
    assignee: 'Eshaan',
    dueAt: '2026-02-23T15:00:00.000Z',
    state: 'todo',
  },
  {
    id: 'task-2',
    title: 'Prepare hardening runbook',
    assignee: 'Eshaan',
    dueAt: '2026-02-25T15:00:00.000Z',
    state: 'in_progress',
  },
  {
    id: 'task-3',
    title: 'Close temporary ports after wiring complete',
    assignee: 'Eshaan',
    dueAt: '2026-02-20T15:00:00.000Z',
    state: 'todo',
  },
];

export const mockStudents: StudentProfile[] = [
  {
    id: 'student-1',
    name: 'Jamie Lin',
    instrument: 'Piano',
    parentEmail: 'jamie.parent@example.com',
    lessonStatus: 'scheduled',
  },
  {
    id: 'student-2',
    name: 'Noah Patel',
    instrument: 'Guitar',
    parentEmail: 'noah.parent@example.com',
    lessonStatus: 'follow_up',
  },
];

export const mockPullRequests: PullRequestItem[] = [
  {
    id: 'pr-110',
    title: 'Improve wake-state accessibility messaging',
    repository: 'eshaansood/eshaan-os',
    author: 'eshaansood',
    url: 'https://github.com/eshaansood/eshaan-os/pull/110',
    status: 'open',
  },
  {
    id: 'pr-109',
    title: 'Refactor task quick actions',
    repository: 'eshaansood/eshaan-os',
    author: 'dev-collab',
    url: 'https://github.com/eshaansood/eshaan-os/pull/109',
    status: 'draft',
  },
];
