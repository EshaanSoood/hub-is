# Open Issues Code Snippets

This file captures the code snippets that still appear relevant for the remaining open issues after items 1-4 were resolved.

Closed by your latest changes:

1. Collab WebSocket auth failing
2. Hub live WebSocket 503
3. Workspace document text not persisting across navigation
4. Owner appearing in pane editor list

The sections below only cover issues 5-15.

## 5. Invite flow does direct-add instead of pending approval

The project-space UI still posts directly to `addProjectMember(...)` from the Overview screen. There is no pending invite state or approval step in this path.

From `src/pages/ProjectSpacePage.tsx`:

```ts
const onCreateProjectMember = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.elements.namedItem('member-email') as HTMLInputElement | null;
  if (!input) {
    return;
  }
  const email = input?.value.trim() || '';
  if (!email) {
    return;
  }

  await addProjectMember(accessToken, project.project_id, {
    email,
    display_name: email.split('@')[0] || 'Member',
    role: 'member',
  });

  input.value = '';
  await refreshProjectData();
};
```

From `src/services/hubContractApi.ts`:

```ts
export const addProjectMember = async (
  accessToken: string,
  projectId: string,
  payload: { user_id?: string; email?: string; display_name?: string; role?: string },
): Promise<{ project_id: string; user_id: string; role: string }> => {
  return hubRequest<{ project_id: string; user_id: string; role: string }>(
    accessToken,
    `/api/hub/projects/${encodeURIComponent(projectId)}/members`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};
```

### Server-side answer for issue 5

The server currently supports **both** patterns:

- `POST /api/hub/projects/:id/members` = direct add into `project_members`
- `POST /api/hub/projects/:id/invites` = create a pending invite in `pending_project_invites`
- `POST /api/hub/projects/:id/invites/:inviteRequestId` = approve or reject the pending invite

That means issue 5 is not just a UI mismatch. The UI is choosing the direct-add contract, while the server also still exposes a bypass route that skips the approval flow entirely.

From `apps/hub-api/hub-api.mjs`:

```js
const insertProjectMemberStmt = db.prepare(`
  INSERT OR REPLACE INTO project_members (project_id, user_id, role, joined_at)
  VALUES (?, ?, ?, ?)
`);
```

```js
if (projectMembersMatch && request.method === 'POST') {
  const auth = await withAuth(request);
  // ...
  let targetUserId = asText(body.user_id);
  const role = asText(body.role) === 'owner' ? 'owner' : 'member';

  if (!targetUserId) {
    const email = asText(body.email).toLowerCase();
    const displayName = asText(body.display_name) || email || 'Project Member';
    if (!email) {
      send(response, jsonResponse(400, errorEnvelope('invalid_input', 'user_id or email is required.')));
      return;
    }

    targetUserId = ensureUserForEmail({ email, displayName })?.user_id || '';
  }

  if (!targetUserId) {
    send(response, jsonResponse(400, errorEnvelope('invalid_input', 'Unable to resolve target project member.')));
    return;
  }

  if (projectMembershipExistsStmt.get(projectId, targetUserId)?.ok) {
    send(response, jsonResponse(409, errorEnvelope('conflict', 'Project member already exists.')));
    return;
  }

  insertProjectMemberStmt.run(projectId, targetUserId, role, nowIso());
```

The pending-invite path is separate and already implemented:

```js
CREATE TABLE IF NOT EXISTS pending_project_invites (
  invite_request_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  target_user_id TEXT,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```js
const projectInvitesMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/invites$/);
if (projectInvitesMatch && request.method === 'POST') {
  // ...
  const existingInvite = activePendingInviteByProjectAndEmailStmt.get(projectId, email);
  if (existingInvite) {
    send(response, jsonResponse(409, errorEnvelope('conflict', 'A pending invite request already exists for this email.')));
    return;
  }

  const inviteRequestId = newId('pinv');
  const timestamp = nowIso();
  insertPendingInviteStmt.run(
    inviteRequestId,
    projectId,
    email,
    'member',
    auth.user.user_id,
    'pending',
    existingUser?.user_id || null,
    timestamp,
    timestamp,
  );

  send(response, jsonResponse(201, okEnvelope({ pending_invite: pendingInviteRecord(pendingInviteByIdStmt.get(inviteRequestId)) })));
  return;
}
```

```js
const projectInviteItemMatch = pathMatch(pathname, /^\/api\/hub\/projects\/([^/]+)\/invites\/([^/]+)$/);
if (projectInviteItemMatch && request.method === 'POST') {
  // ...
  const decision = asText(body.decision).toLowerCase();
  if (decision !== 'approve' && decision !== 'reject') {
    send(response, jsonResponse(400, errorEnvelope('invalid_input', 'decision must be approve or reject.')));
    return;
  }

  const timestamp = nowIso();
  let targetUserId = invite.target_user_id || null;
  if (decision === 'approve') {
    const resolvedUser = ensureUserForEmail({
      email: invite.email,
      displayName: invite.email.split('@')[0] || 'Project Member',
    });
    targetUserId = resolvedUser?.user_id || null;
    if (!projectMembershipExistsStmt.get(projectId, targetUserId)?.ok) {
      insertProjectMemberStmt.run(projectId, targetUserId, 'member', timestamp);
    }
  }
```

### Triage note for issue 5

This is currently a **client-side and server-side contract problem**:

- client-side because the Overview UI uses `/members`
- server-side because `/members` still performs a real membership insert and bypasses the invite workflow

## 6. Quick add failing with "No collection available for quick capture in this project"

The project-side quick capture path hard-fails if the project has no collections, or if `selectCaptureCollection(...)` cannot resolve a destination.

From `src/pages/ProjectSpacePage.tsx`:

```ts
const createAndOpenCaptureRecord = useCallback(
  async (intent: string | null, seedText?: string) => {
    if (quickCaptureInFlightRef.current) {
      return false;
    }
    const shouldUsePaneContext = activeTab === 'work';
    if (shouldUsePaneContext && !activePane) {
      setPaneMutationError('Open a pane before creating pane-local structured work.');
      return false;
    }
    if (shouldUsePaneContext && !activePaneCanEdit) {
      setPaneMutationError('Read-only pane. Only pane editors can create pane-originated structured work.');
      return false;
    }
    if (collections.length === 0) {
      setPaneMutationError('No collection available for quick capture in this project.');
      return false;
    }

    quickCaptureInFlightRef.current = true;
    const targetCollection = selectCaptureCollection(collections, intent);
    if (!targetCollection) {
      setPaneMutationError('No collection available for quick capture in this project.');
      quickCaptureInFlightRef.current = false;
      return false;
    }
```

### Triage note for issue 6

The current code proves the failure condition, but not yet the root cause. The remaining diagnostic question is:

- does `collections` load successfully and come back empty, especially on newly created projects?
- or is the collections fetch failing and the UI state collapses to the same empty-path behavior?

The fix depends on that answer:

- if successful-but-empty, new projects need a default collection bootstrap path
- if fetch failure, the bug is in project initialization or collection loading

## 7. Hub personal calendar capture misroutes into project work and then fails

On the Hub page, non-task captures are explicitly forwarded into a project Work route. That includes `calendar`, which becomes `intent=event`.

From `src/pages/ProjectsPage.tsx`:

```ts
const onSaveCapture = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  const trimmed = captureText.trim();
  if (!trimmed) {
    setCaptureError('Capture text is required.');
    return;
  }

  if (!accessToken) {
    setCaptureError('An authenticated session is required.');
    return;
  }

  const intent = captureDestination === 'calendar' ? 'event' : captureDestination === 'tasks' ? 'project-task' : 'reminder';

  if (captureDestination === 'tasks') {
    // creates a true Hub task
    return;
  }

  const targetProject = lastOpenedProject ?? projects[0] ?? null;
  if (!targetProject) {
    setCaptureError('Open or create a project first so this capture has somewhere to go.');
    return;
  }

  window.sessionStorage.setItem(
    PENDING_CAPTURE_DRAFT_KEY,
    JSON.stringify({
      intent,
      seedText: trimmed,
    }),
  );
  navigate(`/projects/${targetProject.id}/work?capture=1&intent=${encodeURIComponent(intent)}`);
};
```

### Triage note for issue 7

This one is structurally straightforward:

- Hub `calendar` capture is converted to `intent=event`
- non-task captures are forwarded into a project Work route
- issue 14 says there is still no true Hub calendar surface

The safer pilot behavior is likely:

- either block/hide the `Calendar` destination in Hub capture until a real Hub calendar surface exists
- or reroute it intentionally to a project calendar surface instead of Work

For a pre-merge decision, blocking the Hub calendar destination is the lower-risk option.

## 8. Task creation UI in Overview Tasks view is not built

The Overview Tasks panel renders existing tasks and an empty state, but there is no create button or input in this section.

From `src/pages/ProjectSpacePage.tsx`:

```ts
{overviewView === 'tasks' ? (
  <section className="rounded-panel border border-subtle bg-elevated p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="heading-3 text-primary">Project Tasks</h2>
      <span className="text-xs text-muted">
        {projectTasksLoading && tasksOverviewRows.length === 0
          ? 'Loading...'
          : `${tasksOverviewRows.length}${projectTasks.next_cursor ? '+' : ''} loaded`}
      </span>
    </div>
    {tasksOverviewRows.length === 0 && projectTasksLoading ? (
      <p className="mt-2 text-sm text-muted">Loading structured tasks...</p>
    ) : tasksOverviewRows.length === 0 ? (
      <p className="mt-2 text-sm text-muted">No structured tasks yet. Create a task record from Work or quick capture.</p>
    ) : (
      <div className="mt-2 space-y-2">
        <ul className="space-y-2">
          {tasksOverviewRows.map((task) => (
            <li key={task.record_id} className="rounded-panel border border-border-muted p-2">
```

## 9. Calendar event creation UI in Overview Calendar view is not built

The Overview Calendar view mounts `CalendarModuleSkin` in read/display mode. The props only support viewing, scope switching, and opening existing records.

From `src/pages/ProjectSpacePage.tsx`:

```ts
{overviewView === 'calendar' ? (
  <section className="rounded-panel border border-subtle bg-elevated p-4">
    <h2 className="heading-3 text-primary">Project Calendar</h2>
    <div className="mt-3">
      <Suspense fallback={<ModuleLoadingState label="Loading calendar module" rows={5} />}>
        <CalendarModuleSkin
          events={calendarEvents}
          loading={calendarLoading}
          scope={calendarMode}
          onScopeChange={setCalendarMode}
          onOpenRecord={(recordId) => {
            void openInspector(recordId);
          }}
        />
      </Suspense>
    </div>
  </section>
) : null}
```

## 10. Tasks module is missing from the pane module picker

The pane module catalog does not include a `tasks` entry.

From `src/components/project-space/ModuleGrid.tsx`:

```ts
const MODULE_CATALOG = [
  { type: 'table', label: 'Table', lensConfigurable: true },
  { type: 'kanban', label: 'Kanban', lensConfigurable: true },
  { type: 'calendar', label: 'Calendar', lensConfigurable: true },
  { type: 'timeline', label: 'Timeline', lensConfigurable: true },
  { type: 'files', label: 'Files', lensConfigurable: true },
  { type: 'quick_thoughts', label: 'Quick Thoughts', lensConfigurable: false },
] as const;
```

## 11. Calendar module is display-only

The calendar module renders empty states, scope/view toggles, and existing event chips, but there is no `onCreateEvent`-style prop or creation control in the module surface.

From `src/components/project-space/CalendarModuleSkin.tsx`:

```ts
interface CalendarModuleSkinProps {
  events: CalendarEventSummary[];
  loading: boolean;
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  onOpenRecord: (recordId: string) => void;
}
```

```ts
if (events.length === 0) {
  return (
    <ModuleEmptyState
      title={scope === 'relevant' ? 'No relevant events yet.' : 'No project events yet.'}
      description={
        scope === 'relevant'
          ? 'Relevant is showing only your events right now. Switch to All to see the wider project calendar.'
          : 'Create an event to populate this calendar.'
      }
    />
  );
}
```

```ts
return (
  <div className="space-y-3">
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
      <div role="group" aria-label="Calendar scope" className="flex items-center gap-0.5">
        {(['relevant', 'all'] as CalendarScope[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={scope === item}
            onClick={() => onScopeChange(item)}
```

## 12. Project deletion UI is not built

The Hub project cards currently expose only `Overview`, `Work`, and `Tools`.

From `src/pages/ProjectsPage.tsx`:

```ts
<ul className="mt-3 grid gap-3 md:grid-cols-2" aria-label="Project list">
  {projects.map((project) => (
    <li key={project.id} className="rounded-panel border border-border-muted bg-surface p-3">
      <p className="text-sm font-bold text-text">{project.name}</p>
      <p className="mt-1 text-xs text-text-secondary">Role: {project.membershipRole}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/projects/${project.id}/overview`}>Overview</Link>
        <Link to={`/projects/${project.id}/work`}>Work</Link>
        <Link to={`/projects/${project.id}/tools`}>Tools</Link>
      </div>
    </li>
  ))}
</ul>
```

## 13. Global search is wired but disabled

The toolbar search input is rendered with `disabled` and a tooltip saying it is not wired yet.

From `src/components/layout/AppShell.tsx`:

```ts
<input
  type="search"
  value={toolbarSearchValue}
  onChange={(event) => setToolbarSearchValue(event.target.value)}
  placeholder="Search..."
  aria-label="Global search"
  disabled
  title="Global search is not wired yet."
  className="h-7 w-full rounded-control border border-border-muted bg-surface px-sm text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
/>
```

## 14. Personal Hub calendar surface is not built

The Hub dashboard only exposes three views: `Daily Brief`, `Project Lens`, and `Stream`. There is no dedicated Hub calendar surface in the view model.

From `src/features/PersonalizedDashboardPanel.tsx`:

```ts
const VIEW_ORDER: HubDashboardView[] = ['daily-brief', 'project-lens', 'stream'];

const viewLabels: Record<HubDashboardView, string> = {
  'daily-brief': 'Daily Brief',
  'project-lens': 'Project Lens',
  stream: 'Stream',
};
```

Related routing behavior from `src/pages/ProjectsPage.tsx`:

```ts
const intent = captureDestination === 'calendar' ? 'event' : captureDestination === 'tasks' ? 'project-task' : 'reminder';
// non-task captures are forwarded into a project work route
navigate(`/projects/${targetProject.id}/work?capture=1&intent=${encodeURIComponent(intent)}`);
```

## 15. Notification items are not being generated for collaboration/member-add flows

The toolbar only consumes live notifications if a `notification.new` message is received. The member-add UI path does not call any invite/notify API; it just adds the member and refreshes project data. There is also a notify API in `projectsService.ts`, but it appears to be defined separately rather than used by the project-space handlers shown here.

From `src/components/layout/AppShell.tsx`:

```ts
useEffect(() => {
  if (!accessToken) {
    return;
  }
  return subscribeHubLive(accessToken, (message) => {
    if (message.type !== 'notification.new') {
      return;
    }
    const nextNotification = toToolbarNotification(message.notification);
    setNotifications((current) => {
```

From `src/pages/ProjectSpacePage.tsx`:

```ts
await addProjectMember(accessToken, project.project_id, {
  email,
  display_name: email.split('@')[0] || 'Member',
  role: 'member',
});

input.value = '';
await refreshProjectData();
```

From `src/pages/ProjectSpacePage.tsx`:

```ts
docSnapshotSaveTimerRef.current = window.setTimeout(() => {
  const docMentions = extractDocMentionsFromLexicalState(payload.lexicalState);
  void saveDocSnapshot(accessToken, activePaneDocId, {
    snapshot_payload: snapshotPayload,
  })
    .then((result) => {
      docSnapshotVersionRef.current = result.snapshot_version;
      return materializeMentions(accessToken, {
        project_id: project.project_id,
        source_entity_type: 'doc',
        source_entity_id: activePaneDocId,
        mentions: docMentions,
        replace_source: true,
      });
    })
```

From `src/services/projectsService.ts`:

```ts
export const notifyProjectNoteUpdated = async (
  accessToken: string,
  projectId: string,
  noteId: string,
  payload?: { message?: string },
): Promise<IntegrationOutcome<HubNoteUpdateEvent>> => {
  try {
    const response = await fetch(
      `/api/hub/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}/notify`,
      {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify(payload || {}),
      },
```

This combination suggests the toolbar is ready to consume notifications, but the project-space flows above are not obviously emitting them from the UI path.
