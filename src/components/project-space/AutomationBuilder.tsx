import { useMemo, useState } from 'react';
import { AlertDialog, Icon } from '../primitives';

type TriggerEvent =
  | 'record.created'
  | 'record.updated'
  | 'record.status_changed'
  | 'record.due_date_passed'
  | 'record.field_changed';

type ActionType = 'send_email' | 'send_hub_notification' | 'create_record';

interface AutomationRuleItem {
  automation_rule_id: string;
  name: string;
  enabled: boolean;
  trigger_json: Record<string, unknown>;
  actions_json: unknown[];
}

interface AutomationRunItem {
  automation_run_id: string;
  automation_rule_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
}

interface AutomationSavePayload {
  name: string;
  enabled: boolean;
  trigger_json: Record<string, unknown>;
  actions_json: unknown[];
}

interface AutomationBuilderProps {
  rules: AutomationRuleItem[];
  runs: AutomationRunItem[];
  availableRecordTypes: string[];
  onCreateRule: (payload: AutomationSavePayload) => Promise<void>;
  onUpdateRule: (ruleId: string, payload: AutomationSavePayload) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
  onToggleRule: (ruleId: string, enabled: boolean) => Promise<void>;
}

const TRIGGER_OPTIONS: Array<{ value: TriggerEvent; label: string }> = [
  { value: 'record.created', label: 'Record is created' },
  { value: 'record.updated', label: 'Record is updated' },
  { value: 'record.status_changed', label: 'Record status changes' },
  { value: 'record.due_date_passed', label: 'Due date passes' },
  { value: 'record.field_changed', label: 'A field changes' },
];

const ACTION_OPTIONS: Array<{ value: ActionType; label: string }> = [
  { value: 'send_email', label: 'Send an email' },
  { value: 'send_hub_notification', label: 'Send a Hub notification' },
  { value: 'create_record', label: 'Create a record' },
];

const triggerLabel = (eventType: string): string =>
  TRIGGER_OPTIONS.find((option) => option.value === eventType)?.label.toLowerCase() || eventType;

const actionLabel = (actionType: string): string =>
  ACTION_OPTIONS.find((option) => option.value === actionType)?.label.toLowerCase() || actionType;

const normalizeTriggerEvent = (value: string | undefined): TriggerEvent =>
  TRIGGER_OPTIONS.find((option) => option.value === value)?.value ?? 'record.created';

const normalizeActionType = (value: string | undefined): ActionType =>
  ACTION_OPTIONS.find((option) => option.value === value)?.value ?? 'send_hub_notification';

const buildActionConfig = (name: string, actionType: ActionType): Record<string, string> => {
  if (actionType === 'send_email') {
    return {
      to_address: '{{record.owner_email}}',
      subject: `Automation: ${name}`,
      body: 'Automated email from Hub rule.',
    };
  }
  if (actionType === 'create_record') {
    return {
      title: `Created by rule: ${name}`,
    };
  }
  return {
    message: `Automation "${name}" fired.`,
  };
};

const statusTone = (status: string): string => (/fail|error/i.test(status) ? 'text-danger' : 'text-muted');

export const AutomationBuilder = ({
  rules,
  runs,
  availableRecordTypes,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onToggleRule,
}: AutomationBuilderProps) => {
  const recordTypeOptions = useMemo(() => (availableRecordTypes.length > 0 ? availableRecordTypes : ['record']), [availableRecordTypes]);
  const [creating, setCreating] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRuleItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [recordType, setRecordType] = useState(recordTypeOptions[0] || 'record');
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>('record.created');
  const [actionType, setActionType] = useState<ActionType>('send_hub_notification');
  const [fieldConditionField, setFieldConditionField] = useState('');
  const [fieldConditionValue, setFieldConditionValue] = useState('');

  const editingRule = useMemo(
    () => (editingRuleId ? rules.find((rule) => rule.automation_rule_id === editingRuleId) ?? null : null),
    [editingRuleId, rules],
  );

  const runsByRuleId = useMemo(() => {
    const output = new Map<string, AutomationRunItem[]>();
    for (const run of runs) {
      output.set(run.automation_rule_id, [...(output.get(run.automation_rule_id) ?? []), run]);
    }
    return output;
  }, [runs]);

  const resetEditor = () => {
    setName('');
    setRecordType(recordTypeOptions[0] || 'record');
    setTriggerEvent('record.created');
    setActionType('send_hub_notification');
    setFieldConditionField('');
    setFieldConditionValue('');
    setError(null);
  };

  const seedEditorFromRule = (rule: AutomationRuleItem) => {
    const nextTriggerJson = rule.trigger_json ?? {};
    const nextFieldCondition =
      nextTriggerJson.field_condition && typeof nextTriggerJson.field_condition === 'object'
        ? (nextTriggerJson.field_condition as Record<string, unknown>)
        : null;
    const nextAction =
      Array.isArray(rule.actions_json) && rule.actions_json.length > 0 && typeof rule.actions_json[0] === 'object'
        ? (rule.actions_json[0] as Record<string, unknown>)
        : null;

    setName(rule.name);
    setRecordType(typeof nextTriggerJson.record_type === 'string' ? nextTriggerJson.record_type : recordTypeOptions[0] || 'record');
    setTriggerEvent(normalizeTriggerEvent(typeof nextTriggerJson.event === 'string' ? nextTriggerJson.event : undefined));
    setActionType(normalizeActionType(typeof nextAction?.type === 'string' ? nextAction.type : undefined));
    setFieldConditionField(typeof nextFieldCondition?.field === 'string' ? nextFieldCondition.field : '');
    setFieldConditionValue(typeof nextFieldCondition?.value === 'string' ? nextFieldCondition.value : '');
    setError(null);
  };

  const openCreateEditor = () => {
    setCreating(true);
    setEditingRuleId(null);
    resetEditor();
  };

  const openEditEditor = (rule: AutomationRuleItem) => {
    setCreating(false);
    setEditingRuleId(rule.automation_rule_id);
    seedEditorFromRule(rule);
  };

  const closeEditor = () => {
    setCreating(false);
    setEditingRuleId(null);
    resetEditor();
  };

  const buildPayload = (): AutomationSavePayload | null => {
    const trimmedName = name.trim();
    const trimmedRecordType = recordType.trim();
    const trimmedField = fieldConditionField.trim();
    const trimmedValue = fieldConditionValue.trim();

    if (!trimmedName) {
      setError('Rule name is required.');
      return null;
    }
    if (!trimmedRecordType) {
      setError('Record type is required.');
      return null;
    }

    const trigger_json: Record<string, unknown> = {
      event: triggerEvent,
      record_type: trimmedRecordType,
    };
    if (trimmedField && trimmedValue) {
      trigger_json.field_condition = {
        field: trimmedField,
        value: trimmedValue,
      };
    }

    return {
      name: trimmedName,
      enabled: editingRule?.enabled ?? true,
      trigger_json,
      actions_json: [
        {
          type: actionType,
          config: buildActionConfig(trimmedName, actionType),
        },
      ],
    };
  };

  const saveRule = async () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (editingRule) {
        await onUpdateRule(editingRule.automation_rule_id, payload);
      } else {
        await onCreateRule(payload);
      }
      closeEditor();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save automation rule.');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerPreview = fieldConditionField.trim() && fieldConditionValue.trim()
    ? `When a ${recordType} is ${triggerLabel(triggerEvent)} and ${fieldConditionField.trim()} is ${fieldConditionValue.trim()}.`
    : `When a ${recordType} is ${triggerLabel(triggerEvent)}.`;
  const actionPreview = `This rule will ${actionLabel(actionType)}.`;
  const fullPreview = `When a ${recordType} is ${triggerLabel(triggerEvent)}, this rule will ${actionLabel(actionType)}.`;

  if (creating || editingRule) {
    return (
      <section className="rounded-panel border border-subtle bg-elevated p-4">
        <div className="flex items-center gap-xs">
          <button
            type="button"
            onClick={closeEditor}
            className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1 text-sm text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Back to automation list"
          >
            <Icon name="back" className="text-[12px]" />
          </button>
          <h2 className="heading-3 text-primary">{editingRule ? 'Edit rule' : 'New rule'}</h2>
        </div>

        {error ? (
          <p className="mt-2 rounded-control border-l-4 border-danger bg-danger/10 px-sm py-xs text-sm text-text" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-3 space-y-4">
          <label className="block text-sm text-muted">
            Rule name
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              className="mt-1 w-full rounded-control border border-border-muted bg-surface px-sm py-xs text-sm text-text"
              placeholder="e.g. Notify on status change"
            />
          </label>

          <section className="border-t border-border-muted pt-sm">
            <h3 className="text-sm font-bold text-text">Trigger</h3>
            <p className="text-xs text-muted">When does this rule run?</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="text-xs uppercase tracking-wide text-muted">
                Record type
                <select
                  value={recordType}
                  onChange={(event) => setRecordType(event.target.value)}
                  className="mt-1 w-full rounded-control border border-border-muted bg-surface px-sm py-xs text-sm normal-case tracking-normal text-text"
                >
                  {recordTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-wide text-muted">
                Event
                <select
                  value={triggerEvent}
                  onChange={(event) => setTriggerEvent(event.target.value as TriggerEvent)}
                  className="mt-1 w-full rounded-control border border-border-muted bg-surface px-sm py-xs text-sm normal-case tracking-normal text-text"
                >
                  {TRIGGER_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="text-xs uppercase tracking-wide text-muted">
                Condition field (optional)
                <input
                  type="text"
                  value={fieldConditionField}
                  onChange={(event) => setFieldConditionField(event.target.value)}
                  placeholder="status"
                  className="mt-1 w-full rounded-control border border-border-muted bg-surface px-sm py-xs text-sm normal-case tracking-normal text-text"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-muted">
                Condition value (optional)
                <input
                  type="text"
                  value={fieldConditionValue}
                  onChange={(event) => setFieldConditionValue(event.target.value)}
                  placeholder="done"
                  className="mt-1 w-full rounded-control border border-border-muted bg-surface px-sm py-xs text-sm normal-case tracking-normal text-text"
                />
              </label>
            </div>
            <p className="mt-3 rounded-control border border-border-muted bg-surface px-sm py-xs text-sm text-text-secondary">{triggerPreview}</p>
          </section>

          <section className="border-t border-border-muted pt-sm">
            <h3 className="text-sm font-bold text-text">Action</h3>
            <p className="text-xs text-muted">What should happen?</p>
            <label className="mt-2 block text-xs uppercase tracking-wide text-muted">
              Action type
              <select
                value={actionType}
                onChange={(event) => setActionType(event.target.value as ActionType)}
                className="mt-1 w-full rounded-control border border-border-muted bg-surface px-sm py-xs text-sm normal-case tracking-normal text-text"
              >
                {ACTION_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 rounded-control border border-border-muted bg-surface px-sm py-xs text-sm text-text-secondary">{actionPreview}</p>
          </section>

          <section className="border-t border-border-muted pt-sm">
            <h3 className="text-sm font-bold text-text">Preview</h3>
            <p className="text-xs text-muted">Plain-English summary before you save.</p>
            <p className="mt-3 rounded-control border border-border-muted bg-surface px-sm py-xs text-sm text-text-secondary">{fullPreview}</p>
          </section>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={closeEditor}
            className="rounded-control border border-border-muted px-md py-xs text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              void saveRule();
            }}
            className="rounded-control bg-primary px-md py-xs text-sm font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
          >
            {submitting ? 'Saving...' : editingRule ? 'Save changes' : 'Create rule'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-panel border border-subtle bg-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <h2 className="heading-3 text-primary">Automations</h2>
          <button
            type="button"
            onClick={openCreateEditor}
            className="rounded-control bg-primary px-sm py-xs text-sm font-medium text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            New rule
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-control border-l-4 border-danger bg-danger/10 px-sm py-xs text-sm text-text" role="alert">
            {error}
          </p>
        ) : null}

        {rules.length === 0 ? (
          <div className="mt-4 py-6 text-center">
            <p className="font-heading text-sm text-muted">No automations yet.</p>
            <p className="mt-1 text-sm text-muted">Rules run in the background once they are created.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2" aria-label="Automation rules">
            {rules.map((rule) => {
              const action = Array.isArray(rule.actions_json) && rule.actions_json.length > 0 ? (rule.actions_json[0] as Record<string, unknown>) : null;
              const nextActionType = typeof action?.type === 'string' ? action.type : 'unknown';
              const nextTriggerEvent = typeof rule.trigger_json?.event === 'string' ? rule.trigger_json.event : 'unknown';
              const nextRecordType = typeof rule.trigger_json?.record_type === 'string' ? rule.trigger_json.record_type : 'record';
              const ruleRuns = runsByRuleId.get(rule.automation_rule_id) ?? [];
              const sortedRuns = [...ruleRuns].sort((left, right) => {
                const leftTime = Number(new Date(left.started_at));
                const rightTime = Number(new Date(right.started_at));
                const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
                const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
                return safeRight - safeLeft;
              });
              const latestRun = sortedRuns[0] || null;
              const summary = `When a ${nextRecordType} is ${triggerLabel(nextTriggerEvent)}, ${actionLabel(nextActionType)}.`;
              const isBusy = pendingRuleId === rule.automation_rule_id;

              return (
                <li key={rule.automation_rule_id} className="group rounded-panel border border-border-muted bg-surface p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-label={`Toggle automation rule ${rule.name}`}
                        aria-checked={rule.enabled}
                        disabled={isBusy}
                        onClick={() => {
                          setError(null);
                          setPendingRuleId(rule.automation_rule_id);
                          void onToggleRule(rule.automation_rule_id, !rule.enabled)
                            .catch((toggleError) => {
                              setError(toggleError instanceof Error ? toggleError.message : 'Failed to update automation rule.');
                            })
                            .finally(() => {
                              setPendingRuleId((current) => (current === rule.automation_rule_id ? null : current));
                            });
                        }}
                        className="mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border-muted bg-surface px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
                      >
                        <span
                          className={`h-4 w-4 rounded-full transition-transform ${rule.enabled ? 'translate-x-5 bg-primary' : 'translate-x-0 bg-muted'}`}
                          aria-hidden="true"
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-text">{rule.name}</p>
                        <p className="truncate text-xs text-text-secondary">{summary}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted">
                          {ruleRuns.length} run{ruleRuns.length === 1 ? '' : 's'}
                        </p>
                        {latestRun ? (
                          <p className={`mt-1 text-xs ${statusTone(latestRun.status)}`}>
                            Last: {latestRun.status} at {new Date(latestRun.started_at).toLocaleString()}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openEditEditor(rule)}
                          className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
                        >
                          <Icon name="edit" className="text-[12px]" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTarget(rule)}
                          className="inline-flex items-center gap-1 rounded-control border border-border-muted px-2 py-1 text-xs text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
                        >
                          <Icon name="trash" className="text-[12px]" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : 'Delete rule?'}
        description="This automation rule will stop running immediately."
        confirmLabel="Delete rule"
        onConfirm={async () => {
          if (!deleteTarget) {
            return;
          }
          const targetId = deleteTarget.automation_rule_id;
          setError(null);
          setPendingRuleId(targetId);
          try {
            await onDeleteRule(targetId);
          } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete automation rule.');
          } finally {
            setPendingRuleId((current) => (current === targetId ? null : current));
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
};
