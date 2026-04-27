
const parseBoolean = (value, defaultValue) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const calendarModeRaw = String(process.env.WORKFLOW_CALENDAR_MODE || 'project').trim().toLowerCase();
const calendarMode = ['project', 'hub', 'both'].includes(calendarModeRaw) ? calendarModeRaw : 'project';

export const workflowConfig = Object.freeze({
  baseUrl: String(process.env.BASE_URL || process.env.HUB_BASE_URL || 'http://127.0.0.1:5173').trim(),
  projectId: String(process.env.PROJECT_ID || '').trim(),
  workProjectId: String(process.env.WORK_PROJECT_ID || '').trim(),
  privateProjectId: String(process.env.PRIVATE_PROJECT_ID || '').trim(),
  calendarMode,
  modulesEnabled: parseBoolean(process.env.WORKFLOW_MODULES, true),
  invitesEnabled: parseBoolean(process.env.WORKFLOW_INVITES, false),
  accountA: Object.freeze({
    email: String(process.env.TEST_EMAIL_A || '').trim(),
    password: String(process.env.TEST_PASSWORD_A || ''),
  }),
  accountB: Object.freeze({
    email: String(process.env.TEST_EMAIL_B || '').trim(),
    password: String(process.env.TEST_PASSWORD_B || ''),
  }),
});

export const supportsProjectCalendar = workflowConfig.calendarMode === 'project' || workflowConfig.calendarMode === 'both';

export const requireWorkflowAccounts = () => {
  const missing = [];
  if (!workflowConfig.accountA.email) {
    missing.push('TEST_EMAIL_A');
  }
  if (!workflowConfig.accountA.password) {
    missing.push('TEST_PASSWORD_A');
  }
  if (!workflowConfig.accountB.email) {
    missing.push('TEST_EMAIL_B');
  }
  if (!workflowConfig.accountB.password) {
    missing.push('TEST_PASSWORD_B');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required workflow auth env vars: ${missing.join(', ')}`);
  }
};
