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
          subtitle="Immediate provider-backed operations with deterministic invocation patterns."
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
                <p className="text-xs text-muted">Status: {tool.status}</p>
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
          subtitle="Automation scaffolding placeholder using project header client references for targeting logic."
          className="mb-3"
        />

        <div className="rounded-panel border border-subtle bg-surface p-4">
          <p className="text-sm text-text">Automation Builder Shell</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>Trigger selector placeholder</li>
            <li>Condition builder placeholder</li>
            <li>Action targets placeholder (clients/collaborators)</li>
          </ul>
          <Button type="button" size="sm" className="mt-3">
            Create Draft Automation
          </Button>
        </div>
      </Card>
    </section>
  );
};
