
# Creator Studio Hub Plan — SQLite-First Providers + Stable Hub API

## Purpose

Build a simple, creator-focused “project + tasks + calendar + timeline + notifications” layer inside the Hub that:

* Works **out of the box** with a lightweight SQLite provider (default).
* Supports **collaborators + invites** with **simple permissions** (everyone in a project is effectively an editor).
* Creates a **paper trail** (who did what) for every mutation.
* Powers “**My Tasks**” vs “**Project Tasks**” cleanly.
* Includes **calendar view** + **ICS export**.
* Keeps **Nextcloud for files** (still required in v1).
* Keeps the Hub API contract stable so OpenProject (and others) can be plugged in later.

Non-goals:

* Jira/enterprise workflows, complex permission matrices, revision histories, heavy CRM features.

---

## Core Product Requirements

### Project creation & collaborators

* Create a project with:

  * name
  * summary (“what is this about”)
* Add collaborators:

  * pick from existing Hub users
  * or invite via email → invited user signs up → becomes collaborator
* All collaborators have the **same project permission level** (editor-like).
* Hub owner/admin still exists globally; project creator is not a special role for day-to-day use (but can be recorded as `created_by`).

### Tasks

* Tasks can belong to:

  * a project (project tasks)
  * no project (personal tasks)
* Tasks can be assigned to a collaborator (single assignee for v1).
* Tasks should support:

  * title
  * description
  * status (open/done)
  * category (lightweight)
  * due date/time (optional)
  * start date/time (optional)
* “My Tasks” view:

  * tasks assigned to me across all projects
  * plus my personal tasks
* “Project Tasks” view:

  * tasks for the project across all collaborators

### Time tracking (simple)

* Optional time tracking per task:

  * start timer / stop timer
  * store sessions as time entries
* No cost/budget v1.

### Timeline (activity feed / paper trail)

* Project timeline shows a vertical feed:

  * newest at top
  * deep linkable entries
  * shows who did what:

    * task created/assigned/completed
    * note created/updated
    * file uploaded/deleted
    * event created/updated
* The timeline is the canonical “paper trail.”

### Notifications (day one)

* In-app notifications for:

  * task completed
  * task assigned to you
  * file uploaded
  * note updated (configurable later)
  * calendar event created/changed (optional v1)
* Notifications are sent to relevant project members (excluding actor).
* Email notifications: optional later (not required v1).

### Calendar (day one)

* Calendar view exists in the Hub:

  * project events
  * personal events
  * task due dates can optionally appear on calendar (configurable)
* Export:

  * generate ICS feed/file for:

    * a project calendar
    * a personal calendar
* No CalDAV server v1.

### Notes

* Notes remain Lexical + Yjs as implemented.
* Ensure all note mutations create timeline entries and notifications (for project members).

### Files

* Files remain Nextcloud-backed as implemented.
* Ensure file operations create timeline entries and notifications.

---

## Architecture Overview

### Stable Hub API Contract

The UI only talks to Hub endpoints like:

* `/api/hub/me`
* `/api/hub/projects/:projectId`
* `/api/hub/projects/:projectId/members`
* `/api/hub/projects/:projectId/tasks`
* `/api/hub/tasks` (for “my tasks” across all projects + personal)
* `/api/hub/projects/:projectId/calendar`
* `/api/hub/calendar` (personal calendar)
* `/api/hub/projects/:projectId/timeline`
* `/api/hub/projects/:projectId/notes/*` (existing)
* `/api/hub/projects/:projectId/files/*` (existing or normalized wrapper)

### Provider boundary

Inside the Hub backend, each domain is implemented behind a provider interface:

* Tasks provider (default: SQLite)
* Calendar provider (default: SQLite)
* Files provider (default: Nextcloud)
* Notes provider (already Hub-native, but treated as a stable contract)
* Timeline + Notifications are Hub-owned (always SQLite append-only)

Future: OpenProject provider can implement the Tasks provider interface without UI changes.

### Configuration (global first)

Start with global env switches:

* `TASKS_PROVIDER=sqlite` (default)
* `CALENDAR_PROVIDER=sqlite` (default)
* `FILES_PROVIDER=nextcloud` (default)
  Later: allow per-project provider selection if needed.

---

## Data Model (SQLite Hub DB)

### Projects & membership (existing, confirm + extend)

* `projects`

  * id
  * name
  * summary
  * created_by
  * created_at / updated_at
  * (future) provider config fields

* `project_members`

  * project_id
  * user_id
  * role (v1: fixed “editor” for all non-admin)
  * created_at

* `invites`

  * email
  * token
  * status
  * expires_at
  * project_id (if invite is project-scoped)
  * created_by
  * created_at

### Users (already enhanced in JWKS phase)

* `users`

  * keycloak_sub (or canonical identity)
  * email (NOT NULL)
  * first_name (NOT NULL)
  * last_name (NOT NULL)
  * display_name

### Tasks (SQLite provider)

* `tasks`

  * id
  * project_id (nullable; null = personal)
  * title
  * description (nullable)
  * status (open/done)
  * category (nullable; simple string)
  * starts_at (nullable)
  * due_at (nullable)
  * created_by
  * updated_by
  * created_at / updated_at
  * completed_at (nullable)

* `task_assignees`

  * task_id
  * assignee_user_id
  * assigned_by
  * assigned_at

(Using a join table keeps you future-proof if you ever support multiple assignees.)

### Time tracking (simple)

* `task_time_entries`

  * id
  * task_id
  * user_id
  * started_at
  * ended_at (nullable while running)
  * duration_seconds (nullable until ended)
  * note (nullable)

### Calendar (SQLite provider)

* `calendar_events`

  * id
  * project_id (nullable; null = personal)
  * title
  * description (nullable)
  * starts_at
  * ends_at (nullable)
  * all_day (boolean)
  * location (nullable)
  * created_by
  * updated_by
  * created_at / updated_at

### Timeline (Hub-owned, append-only)

* `activity_log`

  * id
  * project_id (nullable for personal activity if desired)
  * actor_user_id
  * type (enum-like string, e.g. `task.created`, `file.uploaded`)
  * entity_type (task/note/file/event)
  * entity_id
  * summary (human-readable)
  * payload_json (small extra details)
  * created_at

### Notifications (Hub-owned)

* `notifications`

  * id
  * user_id (recipient)
  * project_id (nullable)
  * type (e.g. `task.assigned`, `task.completed`, `file.uploaded`)
  * title
  * body (nullable)
  * link_json (deep link target)
  * created_at
  * read_at (nullable)

---

## API Contracts (Backend Surface for UI)

### Identity

* `GET /api/hub/me`

  * returns user identity + global role (already exists)

### Projects

* `POST /api/hub/projects`

  * create project (name, summary)
* `GET /api/hub/projects/:projectId`

  * project details + my membership + integrations status
* `GET /api/hub/projects/:projectId/members`

  * list project collaborators
* `POST /api/hub/projects/:projectId/members`

  * add member by existing user id
* `POST /api/hub/projects/:projectId/invites`

  * invite by email
* Invite acceptance flow remains as-is (but must result in membership creation).

### Tasks (project-scoped)

* `GET /api/hub/projects/:projectId/tasks`

  * list tasks for project
  * support filters: status, assignee, category, due range (keep minimal v1)
* `POST /api/hub/projects/:projectId/tasks`

  * create task (title, description, due, starts, category, assignee)
* `PATCH /api/hub/projects/:projectId/tasks/:taskId`

  * update allowed fields
* `POST /api/hub/projects/:projectId/tasks/:taskId/complete`

  * mark done
* `POST /api/hub/projects/:projectId/tasks/:taskId/reopen`

  * mark open again (optional v1)
* `DELETE /api/hub/projects/:projectId/tasks/:taskId`

  * delete (optional; you can prefer “archive” later)

### Tasks (my tasks + personal tasks)

* `GET /api/hub/tasks`

  * returns:

    * tasks assigned to me (across projects)
    * personal tasks (project_id null)
  * allow filter: status

* `POST /api/hub/tasks`

  * create personal task

### Time tracking

* `POST /api/hub/tasks/:taskId/timer/start`
* `POST /api/hub/tasks/:taskId/timer/stop`
* `GET /api/hub/tasks/:taskId/time-entries` (optional for UI)

### Calendar

* `GET /api/hub/projects/:projectId/calendar?start=...&end=...`

* `POST /api/hub/projects/:projectId/calendar`

* `PATCH /api/hub/projects/:projectId/calendar/:eventId`

* `DELETE /api/hub/projects/:projectId/calendar/:eventId`

* `GET /api/hub/calendar?start=...&end=...` (personal)

* `POST /api/hub/calendar` (personal create)

### ICS export

* `GET /api/hub/projects/:projectId/calendar.ics`
* `GET /api/hub/calendar.ics`

### Timeline

* `GET /api/hub/projects/:projectId/timeline?limit=...&cursor=...`

### Notifications

* `GET /api/hub/notifications`
* `POST /api/hub/notifications/:id/read`

### Notes & Files

* Notes: keep existing endpoints; ensure they emit timeline/notification records.
* Files: keep Nextcloud endpoints; optionally introduce normalized wrappers so UI never touches Nextcloud-shaped routes directly.

---

## Audit Trail & Notification Rules

### Activity log rules (non-negotiable)

Every mutation must write an activity entry, including:

* actor_user_id
* entity type/id
* summary string suitable for timeline
* minimal payload for UI badges

Examples:

* Task created / assigned / completed
* Note created / updated
* File uploaded / deleted
* Calendar event created / changed

### Notification fan-out (v1 rules)

* When task assigned → notify assignee
* When task completed → notify project members (excluding actor)
* When file uploaded → notify project members (excluding actor)
* When note updated → notify project members (excluding actor) *(optional toggle later)*

---

## Phased Implementation Plan

## Phase 1 — Contracts + DB foundations

* Lock stable domain shapes for:

  * tasks, events, timeline entries, notifications
* Add DB migrations for:

  * tasks, task_assignees, task_time_entries
  * calendar_events
  * activity_log
  * notifications
* Add a “mutation helper” convention:

  * every create/update completes by writing activity + notifications

Exit criteria:

* migrations apply cleanly
* basic CRUD endpoints return stable shapes
* activity log is appended for each mutation

---

## Phase 2 — SQLite Tasks provider (default)

* Implement all tasks endpoints with SQLite:

  * project tasks
  * personal tasks
  * “my tasks” query across projects
* Implement time tracking start/stop
* Ensure every task mutation emits:

  * activity log record
  * notifications (where applicable)

Exit criteria:

* “My Tasks” list works
* “Project Tasks” list works
* assignment and completion generate notifications + timeline entries
* tests pass (see Validation section)

---

## Phase 3 — Calendar provider (SQLite) + ICS export

* Implement calendar event CRUD
* Implement range queries for calendar view
* Implement ICS export endpoints
* Optional: show task due dates in calendar by synthesizing “virtual” events (recommended later; keep v1 simple)

Exit criteria:

* calendar view can render from API
* ICS export downloads valid ICS and imports into Apple/Google

---

## Phase 4 — Timeline + Notifications surfaces

* Timeline endpoint returns activity_log records with deep links
* Notifications endpoint returns unread/read notifications
* Ensure notes/files already emit timeline/notifications

Exit criteria:

* timeline shows tasks/files/notes/events
* notifications list updates with task/file activity

---

## Phase 5 — Provider abstraction layer (internal)

* Introduce a provider interface for tasks/calendar:

  * SQLite is the default implementation
* Hub routes call provider methods rather than inline DB logic
* Provider selection uses env var (global)

Exit criteria:

* switching providers is a single config flip (even if only sqlite exists today)
* no UI contract changes required

---

## Phase 6 — Optional OpenProject tasks provider (later)

* Implement OpenProject provider that satisfies the same internal interface
* Add mapping strategy as needed (but not required for SQLite-first launch)
* Keep timeline + notifications hub-owned even for OpenProject-backed tasks

Exit criteria:

* `TASKS_PROVIDER=openproject` works without UI changes

---

## Validation Plan

### Automated checks (must exist)

* AuthZ runtime harness continues to pass
* New regression scripts:

  * tasks CRUD tests
  * calendar CRUD + ICS export smoke
  * timeline entries created on mutations
  * notifications fan-out rules

### Manual acceptance checks (must pass)

* Create project → invite collaborator → collaborator joins
* Create project task → assign collaborator → collaborator sees it in “My Tasks”
* Complete task → project members notified + timeline entry visible
* Upload file → notified + timeline entry visible
* Create calendar event → appears in calendar tab
* Export ICS → imports successfully into Apple/Google Calendar
* Notes editing still works + timeline entry created

---

## “Simple Permissions” Policy

* v1 project permissions are intentionally minimal:

  * If you are a member of the project, you can create/edit tasks, notes, events, upload files.
* Hub owner/admin retains global management abilities.
* The only strict enforcement:

  * non-members cannot access project data
  * invite-only remains enforced

---

## Open Source & Local App Trajectory

This plan is deliberately “local-app friendly”:

* SQLite is the default provider → minimal dependencies.
* Nextcloud remains optional later by adding a local-files provider.
* Keycloak remains optional later by adding a local-auth provider.
* Providers allow alternative backends without changing UI.

---

## Decisions Locked by This Plan

* Default tasks/calendar are **Hub-native SQLite**.
* Timeline + notifications are **Hub-owned** and **append-only**.
* Project permissions stay **simple** for creators (no complex matrix).
* OpenProject becomes a **module**, not core infrastructure.

---

