import type { ProjectRecord } from '../../types/domain';
import type {
  Collaborator,
  ClientReference,
  ModuleTemplate,
  PaneModule,
  WorkPane,
  AudienceMode,
  ModuleLens,
  ModuleSize,
  ModuleType,
} from './types';

export const moduleTemplates: ModuleTemplate[] = [
  { type: 'tasks', label: 'Tasks', defaultSize: 'M', defaultLens: 'project' },
  { type: 'calendar', label: 'Calendar', defaultSize: 'L', defaultLens: 'project' },
  { type: 'timeline', label: 'Timeline', defaultSize: 'M', defaultLens: 'project' },
  { type: 'files', label: 'Files', defaultSize: 'S', defaultLens: 'pane_scratch' },
  { type: 'workspaces', label: 'Workspaces', defaultSize: 'S', defaultLens: 'pane_scratch' },
  { type: 'people', label: 'People', defaultSize: 'S', defaultLens: 'project' },
  { type: 'notifications', label: 'Notifications', defaultSize: 'S', defaultLens: 'pane_scratch' },
];

const collaboratorPool: Array<Pick<Collaborator, 'id' | 'name'>> = [
  { id: 'ava-chen', name: 'Ava Chen' },
  { id: 'liam-johnson', name: 'Liam Johnson' },
  { id: 'noah-patel', name: 'Noah Patel' },
  { id: 'mia-lee', name: 'Mia Lee' },
  { id: 'zoe-singh', name: 'Zoe Singh' },
];

const hashProjectId = (projectId: string): number =>
  projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

export const buildCollaborators = (project: ProjectRecord, currentUserName: string): Collaborator[] => {
  const offset = hashProjectId(project.id) % collaboratorPool.length;
  const orderedPool = collaboratorPool.slice(offset).concat(collaboratorPool.slice(0, offset));

  return [
    { id: 'current-user', name: currentUserName || 'Current User', role: 'owner' },
    { id: orderedPool[0].id, name: orderedPool[0].name, role: 'editor' },
    { id: orderedPool[1].id, name: orderedPool[1].name, role: 'editor' },
    { id: orderedPool[2].id, name: orderedPool[2].name, role: 'viewer' },
  ];
};

export const buildClientReferences = (project: ProjectRecord): ClientReference[] => [
  {
    id: `${project.id}-client-a`,
    name: `${project.name} Primary Client`,
    contact: `ops+${project.id}@client.example.com`,
  },
  {
    id: `${project.id}-client-b`,
    name: `${project.name} Stakeholder Group`,
    contact: `stakeholders+${project.id}@client.example.com`,
  },
];

const createModule = (
  id: string,
  label: string,
  size: ModuleSize,
  lens: ModuleLens,
  type: PaneModule['type'],
): PaneModule => ({
  id,
  label,
  size,
  lens,
  type,
});

export const createSeedPanes = (projectId: string, collaboratorIds: string[]): WorkPane[] => {
  const customSubset = collaboratorIds.filter((id) => id !== 'current-user').slice(0, 2);

  return [
    {
      id: 'strategy-desk',
      title: 'Strategy Desk',
      audienceMode: 'project',
      customMemberIds: [],
      modulesEnabled: true,
      workspaceEnabled: true,
      docBindingMode: 'owned',
      modules: [
        createModule('mod-strategy-timeline', 'Timeline', 'M', 'project', 'timeline'),
        createModule('mod-strategy-tasks', 'Tasks', 'M', 'project', 'tasks'),
        createModule('mod-strategy-files', 'Files', 'S', 'pane_scratch', 'files'),
      ],
    },
    {
      id: 'personal-sprint',
      title: 'Personal Sprint',
      audienceMode: 'personal',
      customMemberIds: ['current-user'],
      modulesEnabled: false,
      workspaceEnabled: true,
      docBindingMode: 'owned',
      modules: [],
    },
    {
      id: 'client-sync',
      title: 'Client Sync',
      audienceMode: 'custom',
      customMemberIds: customSubset,
      modulesEnabled: true,
      workspaceEnabled: false,
      docBindingMode: 'owned',
      modules: [],
    },
    {
      id: `${projectId}-automation`,
      title: 'Automation Lab',
      audienceMode: 'project',
      customMemberIds: [],
      modulesEnabled: true,
      workspaceEnabled: true,
      docBindingMode: 'owned',
      modules: [
        createModule('mod-auto-notifications', 'Notifications', 'S', 'pane_scratch', 'notifications'),
        createModule('mod-auto-calendar', 'Calendar', 'L', 'project', 'calendar'),
      ],
    },
  ];
};

export const getModuleColumnSpan = (size: ModuleSize): string => {
  if (size === 'S') {
    return 'md:col-span-3';
  }
  if (size === 'M') {
    return 'md:col-span-6';
  }
  return 'md:col-span-12';
};

const validAudienceModes = new Set<AudienceMode>(['project', 'personal', 'custom']);
const validSizes = new Set<ModuleSize>(['S', 'M', 'L']);
const validLenses = new Set<ModuleLens>(['project', 'pane_scratch']);
const validTypes = new Set<ModuleType>([
  'tasks',
  'calendar',
  'timeline',
  'files',
  'workspaces',
  'people',
  'notifications',
]);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const parseModule = (value: unknown): PaneModule | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.label !== 'string' ||
    typeof candidate.type !== 'string' ||
    !validTypes.has(candidate.type as ModuleType) ||
    !validSizes.has(candidate.size as ModuleSize) ||
    !validLenses.has(candidate.lens as ModuleLens)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    label: candidate.label,
    type: candidate.type as PaneModule['type'],
    size: candidate.size as ModuleSize,
    lens: candidate.lens as ModuleLens,
  };
};

export const parseStoredPanes = (raw: string | null, collaboratorIds: string[]): WorkPane[] | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const panes = parsed
      .map((value): WorkPane | null => {
        if (!value || typeof value !== 'object') {
          return null;
        }

        const candidate = value as Record<string, unknown>;
        if (
          typeof candidate.id !== 'string' ||
          typeof candidate.title !== 'string' ||
          !(
            validAudienceModes.has(candidate.audienceMode as AudienceMode) ||
            candidate.audienceMode === 'custom-subset'
          ) ||
          typeof candidate.modulesEnabled !== 'boolean' ||
          typeof candidate.workspaceEnabled !== 'boolean' ||
          candidate.docBindingMode !== 'owned' ||
          !isStringArray(candidate.customMemberIds) ||
          !Array.isArray(candidate.modules)
        ) {
          return null;
        }

        const modules = candidate.modules
          .map((moduleValue) => parseModule(moduleValue))
          .filter((moduleValue): moduleValue is PaneModule => moduleValue !== null);

        const safeMembers = candidate.customMemberIds.filter((memberId) => collaboratorIds.includes(memberId));

        return {
          id: candidate.id,
          title: candidate.title,
          audienceMode: candidate.audienceMode === 'custom-subset' ? 'custom' : (candidate.audienceMode as AudienceMode),
          customMemberIds: safeMembers,
          modulesEnabled: candidate.modulesEnabled,
          workspaceEnabled: candidate.workspaceEnabled,
          docBindingMode: 'owned',
          modules,
        };
      })
      .filter((paneValue): paneValue is WorkPane => paneValue !== null);

    return panes.length > 0 ? panes : null;
  } catch {
    return null;
  }
};

export const createPaneId = (title: string, count: number): string => {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  if (!base) {
    return `pane-${count}`;
  }

  return `${base}-${count}`;
};

export const createModuleId = (paneId: string, moduleType: PaneModule['type'], count: number): string =>
  `${paneId}-${moduleType}-${count}`;

export const createUniquePaneId = (title: string, existingPaneIds: Set<string>): string => {
  let suffix = existingPaneIds.size + 1;
  let candidate = createPaneId(title, suffix);

  while (existingPaneIds.has(candidate)) {
    suffix += 1;
    candidate = createPaneId(title, suffix);
  }

  return candidate;
};

export const getNextModuleSequence = (pane: WorkPane, moduleType: PaneModule['type']): number => {
  const prefix = `${pane.id}-${moduleType}-`;
  let maxSuffix = 0;

  for (const module of pane.modules) {
    if (!module.id.startsWith(prefix)) {
      continue;
    }

    const suffixText = module.id.slice(prefix.length);
    const suffix = Number.parseInt(suffixText, 10);
    if (Number.isFinite(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  return maxSuffix + 1;
};
