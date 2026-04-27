# E2E Workflow Test Results
Date: 2026-03-09
Environment: https://eshaansood.org
Project Target: `backend-pilot`
Harness: Playwright live workflow suite

## Summary
This report reflects the current Playwright workflow harness running against production with real smoke users and live Hub API assertions. No application code was changed. Only the Playwright workflow harness and helpers under `e2e/workflow/` were updated.

Accounts used:
- User A: `hub-smoke-a`
- User B: `hub-smoke-b`

Latest full-suite result:
- `5 passed`
- `1 skipped`
- Total runtime: about `19.6s`

Skipped test:
- `TEST 6 (Optional, gated) — Invite flow`
- Reason: `WORKFLOW_INVITES=false`

## Passing checks
### 1. Browser login and project overview
Status: PASS

Observed behavior:
- User A completed the real browser login flow through Keycloak.
- The harness reopened on a stable authenticated page and opened `Backend Pilot`.
- The production overview surface rendered `PROJECT SPACE`, `Backend Pilot`, and the `Overview`, `Work`, and `Tools` tabs.
- Backend membership verification confirmed both smoke users are project members.

### 2. Work project creation and persistence
Status: PASS

Observed behavior:
- User A opened the live Work surface through the real overview/work controls.
- The harness created a new project named `workflow-widgets-*`.
- A `Table` widget was added through the browser UI.
- The new project and widget count were verified through live Hub API project data.
- The project was reopened on a fresh authenticated page and the widget count still matched.

Conclusion:
- The browser flow and persisted backend state agree.

### 3. User B read-only access
Status: PASS

Observed behavior:
- User B opened the same project and the created project.
- The project appeared as a read-only project behind `Other projects`, which matches production UI behavior.
- The page showed read-only copy and disabled widget controls.
- Live collab authorization for User B against the created doc returned `403`.

Conclusion:
- The app is enforcing project read-only boundaries correctly for User B.

### 4. Collaborator surface and membership state
Status: PASS

Observed behavior:
- The overview collaborator UI rendered `Collaborator email` and `Add collaborator`.
- Live project-member data still showed User B as a member while the overview UI was visible.

### 5. Overview calendar capability
Status: PASS

Observed behavior:
- The harness switched the overview subview to `Calendar`.
- Production rendered `Project Calendar`.
- The empty-state copy was present: `No relevant events yet.`
- No `Create event` control was rendered.

Conclusion:
- The test now accurately reports the live product behavior: the overview calendar view exists, but create-event UI is absent in this build.

## Harness fixes made during this run
- Replaced brittle direct-route assumptions with real browser clicks where production uses visible project/work controls.
- Added a fresh authenticated page reopen step after browser login to avoid Keycloak callback race conditions contaminating later assertions.
- Added live Hub API assertions for membership, project persistence, and collab authorization so the suite verifies actual backend state.
- Updated read-only project selection to use the `Other projects` surface when production hides read-only projects there.
- Corrected the calendar test so it always clicks the overview `Calendar` control instead of conditionally skipping it due to a false negative `isVisible()` check.

## Bottom line
The Playwright workflow harness is now proving the live production path for:
- browser login
- project overview access
- work project creation
- widget persistence
- read-only project access for User B
- collaborator surface presence
- overview calendar capability reporting

The only remaining non-executed workflow item in the suite is the optional invite flow, which is currently gated off by `WORKFLOW_INVITES=false`.
