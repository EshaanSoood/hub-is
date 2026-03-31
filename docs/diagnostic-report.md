# Section 1: Login Flow

## Splash/login component
- **Component:** `src/pages/LoginPage.tsx`
- **What it renders:** centered sign-in panel with heading `Hub OS` and CTA button `Continue with Keycloak`.
- **Button click behavior:** calls `signIn()` from `AuthzContext`.

```tsx
// src/pages/LoginPage.tsx
<button
  disabled={!keycloakConfigured}
  onClick={() => {
    void signIn();
  }}
>
  Continue with Keycloak
</button>
```

Note: current UI text is `Hub OS` + `Continue with Keycloak` (not literal `Welcome to Hub OS / Login with Keycloak`).

## Auth redirect flow
- **Library/adapter used:** `keycloak-js` (`src/lib/keycloak.ts`).
- **Redirect trigger:** `signIn()` in `src/context/AuthzContext.tsx` calls `keycloak.login(...)`.
- **Redirect URI configuration (frontend):** hardcoded to `window.location.origin` in three places:
  - `keycloak.init({ redirectUri: window.location.origin })`
  - `keycloak.login({ redirectUri: window.location.origin })`
  - `keycloak.logout({ redirectUri: window.location.origin })`
- **IdP base URL source:** `env.keycloakUrl` (`VITE_KEYCLOAK_URL` in `src/lib/env.ts`).
  - Redirect to `auth.eshaansood.org` occurs only when deployment sets `VITE_KEYCLOAK_URL=https://auth.eshaansood.org`.
  - `.env.example` uses placeholder `https://auth.example.com`.
- **Related but not auth-flow-critical:** `src/lib/serviceRegistry.ts` references `https://auth.eshaansood.org` for SmartWake service metadata, not for login routing.

## Authenticated vs unauthenticated route gating
- **Primary gate:** `src/App.tsx`
  - `!authReady` => "Initializing secure session..."
  - `!signedIn` => catch-all route renders `<LoginPage />`
  - `signedIn` => app shell + protected project routes
- **Secondary route guard:** `src/components/auth/ProtectedRoute.tsx`
  - Blocks route with `AccessDeniedView` if `!signedIn` or missing capability.

# Section 2: Project Space Loading

## Loading states in `ProjectRouteGuard.tsx` and `ProjectSpacePage.tsx`

### `src/components/auth/ProjectRouteGuard.tsx`
- Pulls `{ projects, loading, initialized }` from `useProjects()`.
- Shows `Loading project...` when `loading || !initialized`.
- Redirects personal projects to `/projects`.
- Denies access when missing `project.view` capability.

### `src/pages/ProjectSpacePage.tsx`
- Uses `useProjectBootstrap({ accessToken, projectId })`.
- Shows `Loading project space...` when `loading` from bootstrap hook is true.
- Shows auth error when `accessToken` missing.
- Shows `Project load failed` when `error || !project`.

## Hooks that fetch project data (metadata, panes, members)

### 1) `useProjectBootstrap`
- **File:** `src/hooks/useProjectBootstrap.ts`
- **Primary fetch function:** `refreshProjectData` (useCallback deps: `[accessToken, projectId]`)
- **What it fetches (parallel):**
  - `getProject(...)` (project metadata)
  - `listPanes(...)` (panes)
  - `listTimeline(...)`
  - `listProjectMembers(...)` (members; errors converted to warning + empty members)
- **Load trigger effect:** `useEffect` deps `[accessToken, projectId, refreshProjectData, refreshProjects]`
- **What sets `loading=false`:**
  - Early no-token/no-project branch sets `setLoading(false)`.
  - Main load path sets `setLoading(false)` in `finally`.

### 2) `ProjectsContext` (drives `ProjectRouteGuard` loading)
- **File:** `src/context/ProjectsContext.tsx`
- **Fetch function:** `refreshProjects` (useCallback deps `[accessToken, signedIn]`)
- **Load trigger effect:** `useEffect` deps `[refreshProjects]`
- **What sets loading flags done:** `finally` sets `loading=false`, `initialized=true`.

### 3) `useProjectMembers`
- **File:** `src/hooks/useProjectMembers.ts`
- **Behavior:** does not independently fetch members on mount; it consumes `projectMembers` from bootstrap.
- **Fetch trigger path:** owner add-member action calls `refreshProjectData()` after mutation.

## Conditions that can keep “Loading project...” visible
- `ProjectRouteGuard` keeps showing loading while `ProjectsContext` has `loading=true` or `initialized=false`.
- `ProjectsContext.refreshProjects()` explicitly sets `initialized=false` before each refresh; this can re-show loading during refresh windows.
- `useProjectBootstrap` always clears `loading` on handled success/error paths, so no obvious code-path where loading remains true indefinitely.

## Permanent-loading risk audit
- **Circular dependency arrays:** none found in these loading hooks.
- **Missing error-to-loaded transitions:** not found in `useProjectBootstrap` or `ProjectsContext` (both have `finally` with loaded transitions).
- **Race conditions:** stale-response guard exists in `useProjectBootstrap` (`latestRefreshRequestRef` + token/project refs), reducing stale overwrite risk.
- **Remaining practical risk:** unresolved network promises can still keep UI in loading states externally (not a local state-machine bug).

# Section 3: Refresh Loop Audit

No strict infinite self-trigger loop was found (no clear `useEffect` that repeatedly updates one of its own changing dependencies without a guard). Most risk is **refetch amplification** and a few **timer cleanup gaps**.

## Findings

1. **Live task events trigger full view reload repeatedly**
- **File/lines:** `src/hooks/useProjectViewsRuntime.ts:375-385`
- **Dependency array:** `[accessToken, projectId, refreshViewsAndRecords]`
- **Pattern:** subscription callback runs `refreshViewsAndRecords()` on every `task.changed` for the project.
- **Risk:** frequent task events can cause repeated full collections/views/records refetch bursts.

```tsx
return subscribeHubLive(accessToken, (message) => {
  if (message.type !== 'task.changed' || message.task.project_id !== projectId) return;
  void refreshViewsAndRecords();
});
```

2. **Projects dashboard refetches Hub Home on every `task.changed`**
- **File/lines:** `src/pages/ProjectsPage.tsx:185-198`
- **Dependency array:** `[accessToken, refreshHome, refreshSelectedRecord]`
- **Pattern:** live callback always calls `refreshHome()` and conditionally `refreshSelectedRecord(...)`.
- **Risk:** broad refresh on each task event can cause unnecessary network churn, especially during high activity.

3. **Reminders runtime has two independent refresh subscriptions**
- **File/lines:** `src/hooks/useRemindersRuntime.ts:84-91` and `src/hooks/useRemindersRuntime.ts:93-103`
- **Dependency arrays:**
  - `[refresh, subscribeToHomeRefresh]`
  - `[accessToken, refresh, subscribeToLive]`
- **Pattern:** both channels call `refresh()` directly.
- **Risk:** the same underlying reminder change can trigger duplicated refreshes back-to-back.

4. **Pane file refetch tied to full `activePane` object identity**
- **File/lines:** `src/hooks/useProjectFilesRuntime.ts:167-172`
- **Dependency array:** `[activePane, refreshTrackedPaneFiles]`
- **Pattern:** effect refetches pane files whenever `activePane` reference changes.
- **Risk:** if parent recreates pane objects during unrelated updates, this refires unnecessary pane file fetches.

5. **`setTimeout` inside effect without timeout cleanup (focus)**
- **File/lines:** `src/components/project-space/RelationPicker.tsx:102-110`
- **Dependency array:** `[open]`
- **Pattern:** focus timer scheduled but not cleared in cleanup.
- **Risk:** stale focus callback may fire after rapid close/unmount transitions.

6. **Focus-restore timers in effects without explicit timeout cancellation**
- **File/lines:** `src/components/project-space/FileInspectorActionBar.tsx:133-145` and `src/components/project-space/FileInspectorActionBar.tsx:147-159`
- **Dependency arrays:** `[moveOpen]`, `[renameOpen]`
- **Pattern:** `window.setTimeout(...focus...)` in effects, no stored timer id + cleanup.
- **Risk:** delayed focus jumps when state changes quickly.

7. **Search-param synchronization writes URL state whenever overview tab/view changes**
- **File/lines:** `src/pages/ProjectSpacePage.tsx:698-707`
- **Dependency array:** `[activeTab, overviewView, setSearchParams]`
- **Pattern:** effect always writes `view` when on overview tab.
- **Risk:** generally bounded (not infinite), but can still cause extra navigation/state churn if value is unchanged.

# Section 4: NLP Parser Structure

## Parser files and roles

### Intent classifier
- `src/lib/nlp/intent/index.ts` - pipeline orchestration (`keyword -> pattern -> structure -> confidence`).
- `src/lib/nlp/intent/types.ts` - intent result/context types.
- `src/lib/nlp/intent/constants.ts` - thresholds, verb/event keyword sets.
- `src/lib/nlp/intent/utils.ts` - normalization, tokenization, fuzzy matching, date/time signal regexes.
- `src/lib/nlp/intent/passes/keywordPass.ts` - reminder keyword signals.
- `src/lib/nlp/intent/passes/patternPass.ts` - task/event scoring heuristics.
- `src/lib/nlp/intent/passes/structurePass.ts` - clause/order-based bias adjustments.
- `src/lib/nlp/intent/passes/confidencePass.ts` - ambiguity and final intent decision.

### Task parser
- `src/lib/nlp/task-parser/index.ts` - task parsing pipeline and warnings.
- `src/lib/nlp/task-parser/types.ts` - task parse types.
- `src/lib/nlp/task-parser/constants.ts` - priority/date typo/title normalization constants.
- `src/lib/nlp/task-parser/utils.ts` - assignee extraction, due-date extraction, title building.
- `src/lib/nlp/task-parser/passes/priorityPass.ts` - priority extraction + immediacy flag.
- `src/lib/nlp/task-parser/passes/assigneePass.ts` - assignee hint extraction.
- `src/lib/nlp/task-parser/passes/dateTypoCorrectionPass.ts` - typo normalization before date parse.
- `src/lib/nlp/task-parser/passes/dueDatePass.ts` - due date extraction.
- `src/lib/nlp/task-parser/passes/titlePass.ts` - title finalization.

### Reminder parser
- `src/lib/nlp/reminder-parser/index.ts` - reminder parsing pipeline and warnings.
- `src/lib/nlp/reminder-parser/types.ts` - reminder parse types.
- `src/lib/nlp/reminder-parser/constants.ts` - prefix/time preprocessing/recurrence/title constants.
- `src/lib/nlp/reminder-parser/utils.ts` - recurrence, relative/absolute/named date rules, chrono fallback, title extraction.
- `src/lib/nlp/reminder-parser/passes/prefixPass.ts` - strips “remind me…” style prefixes.
- `src/lib/nlp/reminder-parser/passes/recurrencePass.ts` - recurrence extraction.
- `src/lib/nlp/reminder-parser/passes/relativeTimePass.ts` - relative-time extraction.
- `src/lib/nlp/reminder-parser/passes/absoluteTimePass.ts` - explicit clock-time extraction.
- `src/lib/nlp/reminder-parser/passes/namedDatePass.ts` - named date extraction.
- `src/lib/nlp/reminder-parser/passes/chronoFallbackPass.ts` - chrono fallback.
- `src/lib/nlp/reminder-parser/passes/titlePass.ts` - title finalization.

### Calendar event NLP parser
- `src/lib/calendar-nlp/index.ts` - event parser pipeline orchestration.
- `src/lib/calendar-nlp/types.ts` - event parser data model.
- `src/lib/calendar-nlp/constants.ts` - recurrence/title glue/date constants.
- `src/lib/calendar-nlp/utils.ts` - masking, timezone/date utilities, span/confidence helpers.
- `src/lib/calendar-nlp/passes/chronoPass.ts` - date/time extraction via chrono + custom scoring.
- `src/lib/calendar-nlp/passes/titlePass.ts` - leftover-title derivation from masked input.

## Relative time coverage (date/time parser)

### Covered
- **Reminder relative rules (`applyRelativeTimeRules`):**
  - `in 2 hours`, `in 15 minutes`, `in half an hour`
  - `in a fortnight`
  - contextual phrases: `first thing`, `after lunch`, `this afternoon`, `end of day/eod`, `this weekend`, `tonight`, `[day] morning`
- **Task due-date special rules (`extractDueDate`):**
  - `next week`, `this weekend`, `end of week`, `end of month`, `end of day`
  - plus chrono parsing fallback for general natural-language dates.

### Missing / weakly explicit
- **No explicit dedicated rule for `next month`** in custom relative-rule branches (relies on chrono behavior instead).
- **Reminder relative regex handles only minutes/hours for `in N ...`** (`in (\d+) (minutes|hours)`), not explicit `in 2 days/weeks/months` in the custom branch.
- Recurrence extraction has known current gaps (from tests):
  - mid-sentence `daily` / `monthly` not extracted
  - `every other week` not extracted

## Title extraction behavior and leakage risk

### Task title extraction
- Flow: remove priority/assignee/due-date from `working` text, then normalize/title-case (`buildTaskTitle`).
- Leakage pattern observed in test: trailing preposition can survive after assignee removal.
  - Example expected by test: `"urgent fix the login bug by friday for @mark" -> "Fix the Login Bug for"`.

### Reminder title extraction
- Flow: title built from residual `ctx.working` in final pass (`extractTitle`), with cleanup for time tokens and filler.
- Leakage risk: if earlier time/date passes fail to strip temporal phrase, tokens can remain in title (no broad strip of words like `next`, `month`, etc. in `extractTitle` itself).

### Calendar title extraction
- Uses masked residual input (`ctx.maskedInput`) and strips broad temporal noise before final title.
- Lower leakage risk than reminder/task path when masking succeeds; unresolved temporal tokens can still bleed through if they were never masked.

# Section 5: File Index

.env.example
README.md
src/App.tsx
src/main.tsx
src/components/auth/ProjectRouteGuard.tsx
src/components/auth/ProjectRouteRedirect.tsx
src/components/auth/ProtectedRoute.tsx
src/components/layout/AppShell.tsx
src/components/project-space/FileInspectorActionBar.tsx
src/components/project-space/FileMovePopover.tsx
src/components/project-space/RelationPicker.tsx
src/context/AuthzContext.tsx
src/context/ProjectsContext.tsx
src/context/SmartWakeContext.tsx
src/hooks/useCalendarRuntime.ts
src/hooks/useProjectBootstrap.ts
src/hooks/useProjectFilesRuntime.ts
src/hooks/useProjectMembers.ts
src/hooks/useProjectTasksRuntime.ts
src/hooks/useProjectViewsRuntime.ts
src/hooks/useRecordInspector.ts
src/hooks/useRemindersRuntime.ts
src/hooks/useWorkspaceDocRuntime.ts
src/lib/env.ts
src/lib/keycloak.ts
src/lib/serviceRegistry.ts
src/lib/calendar-nlp/constants.ts
src/lib/calendar-nlp/index.ts
src/lib/calendar-nlp/types.ts
src/lib/calendar-nlp/utils.ts
src/lib/calendar-nlp/passes/chronoPass.ts
src/lib/calendar-nlp/passes/titlePass.ts
src/lib/nlp/intent/constants.ts
src/lib/nlp/intent/index.ts
src/lib/nlp/intent/types.ts
src/lib/nlp/intent/utils.ts
src/lib/nlp/intent/passes/confidencePass.ts
src/lib/nlp/intent/passes/keywordPass.ts
src/lib/nlp/intent/passes/patternPass.ts
src/lib/nlp/intent/passes/structurePass.ts
src/lib/nlp/reminder-parser/constants.ts
src/lib/nlp/reminder-parser/index.ts
src/lib/nlp/reminder-parser/types.ts
src/lib/nlp/reminder-parser/utils.ts
src/lib/nlp/reminder-parser/passes/absoluteTimePass.ts
src/lib/nlp/reminder-parser/passes/chronoFallbackPass.ts
src/lib/nlp/reminder-parser/passes/namedDatePass.ts
src/lib/nlp/reminder-parser/passes/prefixPass.ts
src/lib/nlp/reminder-parser/passes/recurrencePass.ts
src/lib/nlp/reminder-parser/passes/relativeTimePass.ts
src/lib/nlp/reminder-parser/passes/titlePass.ts
src/lib/nlp/reminder-parser/__tests__/recurrence.test.ts
src/lib/nlp/reminder-parser/__tests__/reminder-parser-passes.test.ts
src/lib/nlp/reminder-parser/__tests__/reminder-parser.test.ts
src/lib/nlp/reminder-parser/__tests__/time-extraction.test.ts
src/lib/nlp/task-parser/constants.ts
src/lib/nlp/task-parser/index.ts
src/lib/nlp/task-parser/types.ts
src/lib/nlp/task-parser/utils.ts
src/lib/nlp/task-parser/passes/assigneePass.ts
src/lib/nlp/task-parser/passes/dateTypoCorrectionPass.ts
src/lib/nlp/task-parser/passes/dueDatePass.ts
src/lib/nlp/task-parser/passes/priorityPass.ts
src/lib/nlp/task-parser/passes/titlePass.ts
src/lib/nlp/task-parser/__tests__/due-date-extraction.test.ts
src/lib/nlp/task-parser/__tests__/title-cleanup.test.ts
src/pages/LoginPage.tsx
src/pages/ProjectSpacePage.tsx
src/pages/ProjectsPage.tsx
src/services/authService.ts
src/services/sessionService.ts
