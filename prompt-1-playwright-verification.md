# Codex Prompt: Playwright Project Space Verification Suite

## Context

We need an automated verification pipeline that walks every surface of the Hub OS project space, checks element presence and interaction basics, and captures screenshots at three viewports. This is pre-pilot verification — the goal is to produce a structured pass/fail report and a folder of screenshots for visual review.

The existing E2E infrastructure lives in `e2e/`. Key files to read before starting:

- `e2e/auth.setup.ts` — shows the full seed pattern: token minting, space/project/collection/field/view/record creation via API helpers
- `e2e/utils/tokenMint.ts` — `resolveLinkedTestAccounts()` and `mintTokensForAccounts()` for PKCE auth
- `e2e/support/audit.ts` — all the API helper functions for spaces, projects, collections, records, views, fields, event creation, session summaries, Hub home, base URLs, and auth state files.
- `playwright.config.ts` — base Playwright config at repo root

Read all four files before writing any code to understand the existing patterns, type signatures, and conventions.

## File Structure to Create

All files go in `e2e/project-verification/`:

```
e2e/project-verification/
  playwright.config.ts        — standalone Playwright config for this suite
  seed.ts                     — standalone data seeding (not shared with audit suite)
  verify-project-space.spec.ts — the test suite
  screenshots/                — created at runtime, screenshots land here
  report.json                 — created at runtime, structured pass/fail results
```

## Playwright Config (`playwright.config.ts`)

Create a standalone Playwright config for this verification suite:

- Test directory: the current folder (`e2e/project-verification/`)
- No `webServer` — tests run against the live deployed app
- Three named Playwright projects corresponding to viewports:
  - `desktop`: 1280×800
  - `tablet`: 768×1024
  - `mobile`: 375×812
- All Playwright projects use Chromium
- Global setup: runs `seed.ts` (use Playwright's `globalSetup` option)
- Output screenshots to `e2e/project-verification/screenshots/`
- Timeout: 60 seconds per test, 120 seconds for the global setup
- Retries: 0 (we want accurate pass/fail, not flaky retries)

## Seed (`seed.ts`)

This creates all the test data needed via API calls (no browser). Import and reuse the helper functions from `e2e/support/audit.ts` and `e2e/utils/tokenMint.ts`. Do NOT modify those files.

The seed must create a space with enough data to exercise every project workspace surface:

1. **Mint tokens** using `resolveLinkedTestAccounts()` and `mintTokensForAccounts()`.

2. **Create a space** named `Verify Space ${runId}` where `runId` is a short timestamp-based ID.

3. **Create a collection** with these fields:
   - `Status` (select: `todo`, `in-progress`, `done`)
   - `Priority` (select: `low`, `medium`, `high`)
   - `Notes` (text)
   - `Due Date` (text — used for display, actual due is in task_state)

4. **Create views**:
   - A `table` view bound to the collection (all fields visible)
   - A `kanban` view grouped by Status field

5. **Create two work projects**:

   **Work project A — "Verify Main Project"**: `widgets_enabled: true`, `workspace_enabled: true`. Widgets:
   - `table` widget, size tier `L`, lens `project`, bound to the table view
   - `kanban` widget, size tier `L`, lens `project`, bound to the kanban view
   - `calendar` widget, size tier `M`, lens `project`
   - `tasks` widget, size tier `M`, lens `project`
   - `reminders` widget, size tier `S`, lens `project`
   - `files` widget, size tier `M`, lens `project`
   - `quick-thoughts` widget, size tier `S`, lens `project`

   **Work project B — "Verify Private Project"**: `widgets_enabled: true`, `workspace_enabled: true`. Widgets:
   - `table` widget, size tier `M`, lens `project`, bound to table view
   - `tasks` widget, size tier `L`, lens `project`

6. **Create records** (at least 5) with varied statuses, priorities, due dates, and assignments. At least one in each status (todo, in-progress, done). At least one with high priority and a due date today. At least one with an assignment to the owner user.

7. **Create a calendar event** using `createEventFromNlp` — start 2 hours from now, end 3 hours from now, with a location and title.

8. **Write auth state files** using `writeAuthStateFiles` so Playwright can inject browser auth.

9. **Write a fixture JSON file** to `e2e/project-verification/fixture.json` containing all created IDs (space ID, work project IDs, collection ID, field IDs, view IDs, record titles, event title) so the test spec can read them.

10. After creating everything, poll `getHubHome` in a retry loop (up to 10 attempts, 750ms apart) until at least one of the seeded task titles appears in the home feed — confirming the data has propagated.

## Test Suite (`verify-project-space.spec.ts`)

Read the fixture JSON at the top of the file. Use `storageState` from `writeAuthStateFiles` output for browser auth (follow the same pattern as existing E2E tests in the repo).

The test suite has 7 `test.describe` blocks, one per phase. Each phase has individual `test()` cases. Every test:
- Logs what it's checking
- Uses `expect()` assertions for pass/fail
- Captures a screenshot after the check, saved to `e2e/project-verification/screenshots/` with a descriptive filename: `{phase}-{check}-{viewport}.png` (e.g., `01-shell-topnav-tabs-desktop.png`)

The viewport name comes from `test.info().project.name` (which will be `desktop`, `tablet`, or `mobile`).

### Phase 1 — Shell & Navigation

Navigate to the space overview URL (`/projects/{spaceId}/overview`).

Checks:
- Page loads without "Loading project space..." text persisting beyond 10 seconds
- `TopNavTabs` are visible — look for tab elements or links labeled "Overview", "Work", "Tools"
- Project name appears somewhere in the header area
- The work project switcher is accessible and lists work project names
- Clicking the "Work" tab navigates to the work view (URL changes to include `/work` or the space ID)
- No console errors during navigation (attach a console listener, collect errors, assert empty at end)

### Phase 2 — Overview Tab

Navigate to the project's overview URL.

Checks:
- `OverviewHeader` renders — look for the project name as a heading
- Timeline feed section is present (look for a region, list, or container related to timeline/activity)
- Member list or member avatars are visible
- The overview is not empty — at least some content renders below the header

### Phase 3 — Widget Grid

Navigate to the project's work view, selecting Project A (the main project with 7 widgets).

Checks:
- `WidgetGrid` container is present
- Count the number of rendered widget containers — expect 7
- Each widget has a visible header or label identifying its type
- Widgets at different size tiers render at visually different sizes (check that L-tier widgets have a larger bounding box than S-tier widgets by comparing `offsetWidth` or `offsetHeight`)
- No widgets show an error/fallback state (look for `WidgetFeedback` error indicators)

### Phase 4 — Individual Widget Skins

Stay on the work view with Project A. For each widget type, locate it and verify its content:

**Table widget:**
- Table element or grid role is present
- Column headers are visible (at least Status, Priority, Notes)
- Row count matches expected record count (at least 5 rows)

**Kanban widget:**
- Kanban board container is present
- At least 3 columns/lanes are visible (todo, in-progress, done)
- Cards are present in the lanes

**Calendar widget:**
- Calendar container is present
- Month/week/day toggle or view selector is visible
- The seeded event title appears somewhere in the calendar

**Tasks widget:**
- Tasks container is present
- At least one task title from the seeded data is visible

**Reminders widget:**
- Reminders container is present
- NLP input field is visible (an input or textarea for adding reminders)

**Files widget:**
- Files container is present
- An empty state or file list is visible (we didn't seed files, so empty state is expected and OK)

**Quick Thoughts (Inbox Capture) widget:**
- Container is present
- Input area for capturing quick thoughts is visible

### Phase 5 — Lexical Editor

Navigate to the work view, Project A. The editor should be present if `workspace_enabled: true` on the project.

Checks:
- Lexical editor container is present (look for the `EditorShell` wrapper or a `contenteditable` element)
- Editor is focusable (click into it, verify it receives focus)
- Can type text into the editor (type "Verification test note", then verify the text appears in the editor content)
- Editor toolbar or formatting controls are accessible (look for any toolbar elements)

### Phase 6 — Record Inspector

From the work view, click on one of the seeded records in the table widget to open it.

Checks:
- Record inspector/detail panel opens (look for a panel, dialog, or sidebar with the record title)
- Record title is displayed
- Field values are visible (Status and Notes fields)
- Relations section is present (even if empty)
- Comment composer is present (an input or textarea for adding comments)

### Phase 7 — File Operations

Navigate to the work view, Project A, and locate the Files widget.

Checks:
- Files widget is present and shows empty state or file listing
- Upload affordance is visible (a button, dropzone, or upload trigger)
- If there's an action bar, verify it renders (the `FileInspectorActionBar`)

Note: Do NOT actually upload a file (we don't want to leave test artifacts). Just verify the upload UI is present.

### Report Generation

After all tests complete, write a summary JSON report to `e2e/project-verification/report.json` with this structure:

```json
{
  "timestamp": "ISO datetime",
  "viewport": "desktop|tablet|mobile",
  "phases": [
    {
      "phase": 1,
      "name": "Shell & Navigation",
      "checks": [
        { "name": "page-loads", "status": "pass|fail", "detail": "optional detail" },
        ...
      ]
    },
    ...
  ]
}
```

Use a Playwright `reporter` or an `afterAll` hook to write this file. If using a custom reporter, register it in the Playwright config.

## Important Constraints

- Do NOT modify any existing files. All new files go in `e2e/project-verification/`.
- Import from `e2e/support/audit.ts` and `e2e/utils/tokenMint.ts` using relative paths — do NOT use absolute paths.
- The seed runs as `globalSetup` (pure Node, no browser). The tests run in browser context with injected auth.
- Screenshots must be organized with descriptive filenames including phase number, check name, and viewport.
- All selectors should be resilient — prefer `role`, `aria-label`, `data-testid`, text content, or semantic HTML over brittle CSS class selectors.

## Verification

```
npm run typecheck
npm run lint
npm run validate
npm run build
```
