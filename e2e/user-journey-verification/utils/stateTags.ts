import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const suiteRoot = path.resolve(__dirname, '..');

export type JourneyScenario = 'baseline' | 'stress';

export interface JourneySeedContext {
  scenario: JourneyScenario;
  runId: string;
  createdAtIso: string;
  baseUrl: string;
  apiBaseUrl: string;
  project: {
    id: string;
    name: string;
  };
  panes: {
    primaryId: string;
    secondaryId: string;
    primaryName: string;
    secondaryName: string;
  };
  collection: {
    id: string;
    statusFieldId: string;
    notesFieldId: string;
    tableViewId: string;
    kanbanViewId: string;
  };
  tags: {
    cleanupTag: string;
    titlePrefix: string;
  };
}

export const resolveSuiteRoot = (): string => suiteRoot;

export const resolveJourneyContextPath = (): string => {
  return path.resolve(
    process.cwd(),
    process.env.JOURNEY_CONTEXT_FILE || path.join('e2e', 'user-journey-verification', '.seed-context.json'),
  );
};

export const resolveScenario = (): JourneyScenario => {
  const raw = String(process.env.JOURNEY_SCENARIO || 'baseline').trim().toLowerCase();
  return raw === 'stress' ? 'stress' : 'baseline';
};

export const createRunId = (scenario: JourneyScenario): string => {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `journey-${scenario}-${stamp}`;
};

export const withRunTag = (context: Pick<JourneySeedContext, 'tags'>, label: string): string => {
  return `${context.tags.titlePrefix} ${label}`.trim();
};

export const futureIsoFromNow = (minutesFromNow: number): string => {
  const next = new Date();
  next.setMinutes(next.getMinutes() + minutesFromNow);
  return next.toISOString();
};

export const toDateTimeLocalInput = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const writeJourneyContext = async (context: JourneySeedContext): Promise<void> => {
  const outputPath = resolveJourneyContextPath();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
};

export const readJourneyContext = async (): Promise<JourneySeedContext> => {
  const contextPath = resolveJourneyContextPath();
  const raw = await readFile(contextPath, 'utf8');
  return JSON.parse(raw) as JourneySeedContext;
};
