import type { CreateEventRequest } from './events';
import type { CreateReminderRequest, ReminderFrequency, ReminderRecurrence, ReminderScope } from './reminders';
import type { CreateTaskRequest, TaskPriority, TaskStatus } from './tasks';

const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const REMINDER_FREQUENCIES: ReminderFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
};

const asOptionalString = (value: unknown, fieldName: string): string | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string when provided.`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asIsoString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty ISO 8601 datetime string.`);
  }
  const normalized = value.trim();
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldName} must be a valid ISO 8601 datetime string.`);
  }
  return new Date(timestamp).toISOString();
};

const asOptionalIsoOrNull = (value: unknown, fieldName: string): string | null | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return asIsoString(value, fieldName);
};

const asStringArray = (value: unknown, fieldName: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
  const normalized = value
    .map((item) => {
      if (typeof item !== 'string') {
        throw new Error(`${fieldName} must contain only strings.`);
      }
      return item.trim();
    })
    .filter(Boolean);
  return normalized;
};

const validateTaskStatus = (value: unknown): TaskStatus => {
  const status = asNonEmptyString(value, 'status') as TaskStatus;
  if (!TASK_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${TASK_STATUSES.join(', ')}.`);
  }
  return status;
};

const validateTaskPriority = (value: unknown): TaskPriority => {
  const priority = asNonEmptyString(value, 'priority') as TaskPriority;
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new Error(`priority must be one of: ${TASK_PRIORITIES.join(', ')}.`);
  }
  return priority;
};

const validateReminderFrequency = (value: unknown): ReminderFrequency => {
  const frequency = asNonEmptyString(value, 'recurrence_json.frequency') as ReminderFrequency;
  if (!REMINDER_FREQUENCIES.includes(frequency)) {
    throw new Error(`recurrence_json.frequency must be one of: ${REMINDER_FREQUENCIES.join(', ')}.`);
  }
  return frequency;
};

export const validateCreateTaskRequest = (body: unknown): CreateTaskRequest => {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const request: CreateTaskRequest = {
    title: asNonEmptyString(body.title, 'title'),
  };

  const projectId = asOptionalString(body.project_id, 'project_id');
  if (projectId) {
    request.project_id = projectId;
  }

  const sourcePaneId = asOptionalString(body.source_pane_id, 'source_pane_id');
  if (sourcePaneId) {
    request.source_pane_id = sourcePaneId;
  }

  if (typeof body.parent_record_id !== 'undefined') {
    request.parent_record_id = body.parent_record_id === null ? null : asNonEmptyString(body.parent_record_id, 'parent_record_id');
  }

  if (typeof body.status !== 'undefined') {
    request.status = validateTaskStatus(body.status);
  }

  if (typeof body.priority !== 'undefined') {
    request.priority = body.priority === null ? null : validateTaskPriority(body.priority);
  }

  if (typeof body.category !== 'undefined') {
    if (body.category === null) {
      request.category = null;
    } else {
      request.category = asOptionalString(body.category, 'category') ?? null;
    }
  }

  if (typeof body.due_at !== 'undefined') {
    request.due_at = asOptionalIsoOrNull(body.due_at, 'due_at');
  }

  if (typeof body.assignee_user_ids !== 'undefined') {
    request.assignee_user_ids = asStringArray(body.assignee_user_ids, 'assignee_user_ids');
  }

  if (typeof body.assignment_user_ids !== 'undefined') {
    request.assignment_user_ids = asStringArray(body.assignment_user_ids, 'assignment_user_ids');
  }

  return request;
};

const validateReminderRecurrence = (value: unknown): ReminderRecurrence => {
  if (!isRecord(value)) {
    throw new Error('recurrence_json must be an object when provided.');
  }

  const recurrence: ReminderRecurrence = {};

  const nextRemindAt = asOptionalIsoOrNull(value.next_remind_at, 'recurrence_json.next_remind_at');
  if (typeof nextRemindAt === 'string') {
    recurrence.next_remind_at = nextRemindAt;
  }

  const subsequentRemindAt = asOptionalIsoOrNull(value.subsequent_remind_at, 'recurrence_json.subsequent_remind_at');
  if (typeof subsequentRemindAt === 'string') {
    recurrence.subsequent_remind_at = subsequentRemindAt;
  }

  if (typeof value.frequency !== 'undefined') {
    recurrence.frequency = validateReminderFrequency(value.frequency);
  }

  if (typeof value.interval !== 'undefined') {
    if (!Number.isInteger(value.interval) || Number(value.interval) < 1) {
      throw new Error('recurrence_json.interval must be a positive integer when provided.');
    }
    recurrence.interval = Number(value.interval);
  }

  return recurrence;
};

const validateReminderScope = (value: unknown): ReminderScope => {
  if (value === 'personal' || value === 'project') {
    return value;
  }
  throw new Error('scope must be either "personal" or "project" when provided.');
};

export const validateCreateReminderRequest = (body: unknown): CreateReminderRequest => {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const request: CreateReminderRequest = {
    title: asNonEmptyString(body.title, 'title'),
    remind_at: asIsoString(body.remind_at, 'remind_at'),
  };

  if (typeof body.recurrence_json !== 'undefined') {
    request.recurrence_json = body.recurrence_json === null ? null : validateReminderRecurrence(body.recurrence_json);
  }

  if (typeof body.scope !== 'undefined') {
    request.scope = validateReminderScope(body.scope);
  }
  const effectiveScope = request.scope ?? 'personal';

  const projectId = asOptionalString(body.project_id, 'project_id');
  const paneId = asOptionalString(body.pane_id, 'pane_id');
  const hasSourceViewId = typeof body.source_view_id !== 'undefined';

  if (effectiveScope !== 'project' && (projectId || paneId || hasSourceViewId)) {
    throw new Error('project_id, pane_id, and source_view_id are only allowed when scope is "project".');
  }
  if (effectiveScope === 'project' && !projectId) {
    throw new Error('project_id is required when scope is "project".');
  }

  if (projectId) {
    request.project_id = projectId;
  }

  if (paneId) {
    request.pane_id = paneId;
  }

  if (hasSourceViewId) {
    request.source_view_id = body.source_view_id === null ? null : asOptionalString(body.source_view_id, 'source_view_id') ?? null;
  }

  return request;
};

const firstDefinedString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const validateEventReminders = (value: unknown): CreateEventRequest['reminders'] => {
  if (!Array.isArray(value)) {
    throw new Error('reminders must be an array when provided.');
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`reminders[${index}] must be an object.`);
    }
    const channels = Array.isArray(item.channels) ? asStringArray(item.channels, `reminders[${index}].channels`) : ['in_app'];
    return {
      remind_at: asIsoString(item.remind_at, `reminders[${index}].remind_at`),
      channels: channels.length > 0 ? channels : ['in_app'],
    };
  });
};

const asOptionalObject = (value: unknown, fieldName: string): Record<string, unknown> | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object when provided.`);
  }
  return value;
};

export const validateCreateEventRequest = (body: unknown): CreateEventRequest => {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const nlpFields = isRecord(body.nlp_fields_json) ? body.nlp_fields_json : undefined;
  const startCandidate = firstDefinedString(body.start_dt, body.start, nlpFields?.start_dt, nlpFields?.start);
  const endCandidate = firstDefinedString(body.end_dt, body.end, nlpFields?.end_dt, nlpFields?.end);

  if (!startCandidate || !endCandidate) {
    throw new Error('start_dt and end_dt are required (directly or via nlp_fields_json).');
  }

  const startDt = asIsoString(startCandidate, 'start_dt');
  const endDt = asIsoString(endCandidate, 'end_dt');
  if (Date.parse(endDt) < Date.parse(startDt)) {
    throw new Error('end_dt must be greater than or equal to start_dt.');
  }

  const request: CreateEventRequest = {
    start_dt: startDt,
    end_dt: endDt,
  };

  const paneId = asOptionalString(body.pane_id, 'pane_id');
  if (paneId) {
    request.pane_id = paneId;
  }

  const sourcePaneId = asOptionalString(body.source_pane_id, 'source_pane_id');
  if (sourcePaneId) {
    request.source_pane_id = sourcePaneId;
  }

  const sourceDocId = asOptionalString(body.source_doc_id, 'source_doc_id');
  if (sourceDocId) {
    request.source_doc_id = sourceDocId;
  }

  const sourceNodeKey = asOptionalString(body.source_node_key, 'source_node_key');
  if (sourceNodeKey) {
    request.source_node_key = sourceNodeKey;
  }

  const title = asOptionalString(body.title, 'title');
  if (title) {
    request.title = title;
  }

  const timezone = asOptionalString(body.timezone, 'timezone');
  if (timezone) {
    request.timezone = timezone;
  }

  const location = asOptionalString(body.location, 'location');
  if (location) {
    request.location = location;
  }

  const nlpFieldsJson = asOptionalObject(body.nlp_fields_json, 'nlp_fields_json');
  if (nlpFieldsJson) {
    request.nlp_fields_json = nlpFieldsJson;
  }

  if (typeof body.participants_user_ids !== 'undefined') {
    request.participants_user_ids = asStringArray(body.participants_user_ids, 'participants_user_ids');
  }

  if (typeof body.participant_user_ids !== 'undefined') {
    request.participant_user_ids = asStringArray(body.participant_user_ids, 'participant_user_ids');
  }

  if (typeof body.reminders !== 'undefined') {
    request.reminders = validateEventReminders(body.reminders);
  }

  const recurrenceRule = asOptionalObject(body.recurrence_rule, 'recurrence_rule');
  if (recurrenceRule) {
    request.recurrence_rule = recurrenceRule;
  }

  const ruleJson = asOptionalObject(body.rule_json, 'rule_json');
  if (ruleJson) {
    request.rule_json = ruleJson;
  }

  return request;
};
