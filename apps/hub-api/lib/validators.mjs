// Ported from src/shared/api-types/validators.ts — keep in sync manually until build pipeline bridges TS→MJS.

const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'];
const TASK_STATUS_ALIASES = new Map([
  ['in-progress', 'in_progress'],
]);
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const REMINDER_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonEmptyString = (value, fieldName) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
};

const asOptionalString = (value, fieldName) => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string when provided.`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asIsoString = (value, fieldName) => {
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

const asOptionalIsoOrNull = (value, fieldName) => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return asIsoString(value, fieldName);
};

const asStringArray = (value, fieldName) => {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
  return value
    .map((item) => {
      if (typeof item !== 'string') {
        throw new Error(`${fieldName} must contain only strings.`);
      }
      return item.trim();
    })
    .filter(Boolean);
};

const validateTaskStatus = (value) => {
  const rawStatus = asNonEmptyString(value, 'status');
  const status = TASK_STATUS_ALIASES.get(rawStatus) ?? rawStatus;
  if (!TASK_STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${TASK_STATUSES.join(', ')}.`);
  }
  return status;
};

const validateTaskPriority = (value) => {
  const priority = asNonEmptyString(value, 'priority');
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new Error(`priority must be one of: ${TASK_PRIORITIES.join(', ')}.`);
  }
  return priority;
};

const validateReminderFrequency = (value) => {
  const frequency = asNonEmptyString(value, 'recurrence_json.frequency');
  if (!REMINDER_FREQUENCIES.includes(frequency)) {
    throw new Error(`recurrence_json.frequency must be one of: ${REMINDER_FREQUENCIES.join(', ')}.`);
  }
  return frequency;
};

const validateReminderRecurrence = (value) => {
  if (!isRecord(value)) {
    throw new Error('recurrence_json must be an object when provided.');
  }

  const recurrence = {};

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

const firstDefinedString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const validateEventReminders = (value) => {
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

const asOptionalObject = (value, fieldName) => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object when provided.`);
  }
  return value;
};

const validateEventNlpFields = (value) => {
  if (!isRecord(value)) {
    throw new Error('nlp_fields_json must be an object when provided.');
  }

  const normalized = {};

  const title = asOptionalString(value.title, 'nlp_fields_json.title');
  if (title) {
    normalized.title = title;
  }

  const start = asOptionalString(value.start, 'nlp_fields_json.start');
  if (start) {
    normalized.start = start;
  }

  const startDt = asOptionalString(value.start_dt, 'nlp_fields_json.start_dt');
  if (startDt) {
    normalized.start_dt = startDt;
  }

  const end = asOptionalString(value.end, 'nlp_fields_json.end');
  if (end) {
    normalized.end = end;
  }

  const endDt = asOptionalString(value.end_dt, 'nlp_fields_json.end_dt');
  if (endDt) {
    normalized.end_dt = endDt;
  }

  const timezone = asOptionalString(value.timezone, 'nlp_fields_json.timezone');
  if (timezone) {
    normalized.timezone = timezone;
  }

  const location = asOptionalString(value.location, 'nlp_fields_json.location');
  if (location) {
    normalized.location = location;
  }

  if (typeof value.participants_user_ids !== 'undefined') {
    normalized.participants_user_ids = asStringArray(value.participants_user_ids, 'nlp_fields_json.participants_user_ids');
  }

  if (typeof value.participant_user_ids !== 'undefined') {
    normalized.participant_user_ids = asStringArray(value.participant_user_ids, 'nlp_fields_json.participant_user_ids');
  }

  if (typeof value.reminders !== 'undefined') {
    normalized.reminders = validateEventReminders(value.reminders);
  }

  const recurrenceRule = asOptionalObject(value.recurrence_rule, 'nlp_fields_json.recurrence_rule');
  if (recurrenceRule) {
    normalized.recurrence_rule = recurrenceRule;
  }

  const ruleJson = asOptionalObject(value.rule_json, 'nlp_fields_json.rule_json');
  if (ruleJson) {
    normalized.rule_json = ruleJson;
  }

  return normalized;
};

export const validateCreateTaskRequest = (body) => {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const request = {
    title: asNonEmptyString(body.title, 'title'),
  };

  const projectId = asOptionalString(body.project_id, 'project_id');
  if (projectId) {
    request.project_id = projectId;
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

  if (typeof body.due_at !== 'undefined') {
    request.due_at = body.due_at === null ? null : asIsoString(body.due_at, 'due_at');
  }

  if (typeof body.category !== 'undefined') {
    if (body.category === null) {
      request.category = null;
    } else {
      request.category = asOptionalString(body.category, 'category') ?? null;
    }
  }

  if (typeof body.assignee_user_ids !== 'undefined') {
    request.assignee_user_ids = asStringArray(body.assignee_user_ids, 'assignee_user_ids');
  }

  if (typeof body.assignment_user_ids !== 'undefined') {
    request.assignment_user_ids = asStringArray(body.assignment_user_ids, 'assignment_user_ids');
  }

  return request;
};

export const validateCreateReminderRequest = (body) => {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const request = {
    title: asNonEmptyString(body.title, 'title'),
    remind_at: asIsoString(body.remind_at, 'remind_at'),
  };

  if (typeof body.recurrence_json !== 'undefined') {
    request.recurrence_json = body.recurrence_json === null ? null : validateReminderRecurrence(body.recurrence_json);
  }

  return request;
};

export const validateCreateEventRequest = (body) => {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object.');
  }

  const nlpFields = typeof body.nlp_fields_json === 'undefined'
    ? undefined
    : validateEventNlpFields(body.nlp_fields_json);
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

  const request = {
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

  if (nlpFields) {
    request.nlp_fields = nlpFields;
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
