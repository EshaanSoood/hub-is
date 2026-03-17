import { Button, Card, SectionHeader } from '../primitives';

const liveTools = [
  { id: 'live-1', name: 'Provider Health Check', status: 'Ready' },
  { id: 'live-2', name: 'Sync Trigger', status: 'Idle' },
  { id: 'live-3', name: 'Notification Test', status: 'Ready' },
];

export const ToolsView = () => {
  return (
    <section id="project-panel-tools" role="tabpanel" aria-labelledby="project-tab-tools" className="space-y-4">
      <Card aria-label="Live tools section">
        <SectionHeader
          title="Live Tools"
          subtitle="Run one-off diagnostics and operational checks."
          className="mb-3"
        />

        <ul className="space-y-2">
          {liveTools.map((tool) => (
            <li
              key={tool.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-subtle bg-surface px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-primary">{tool.name}</p>
                <p className="text-xs text-muted">{tool.status}</p>
              </div>
              <Button type="button" size="sm">
                Run
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card aria-label="Automation builder section">
        <SectionHeader
          title="Automation Builder"
          subtitle="Draft project automations without leaving the tools panel."
          className="mb-3"
        />

        <div className="rounded-panel border border-subtle bg-surface p-4">
          <p className="text-sm text-text">Start from a draft and tune the trigger before publishing.</p>
          <Button type="button" size="sm" className="mt-3">
            Create Draft Automation
          </Button>
        </div>
      </Card>
    </section>
  );
};
