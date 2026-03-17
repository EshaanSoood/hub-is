## Project Space UI Contracts — v1 (Codex Reference Spec)

**Scope:** This document defines the *UI-facing contracts* for Project Spaces in Eshaan OS Hub. It is the single reference for implementing the UI shell, Overview, Work Panes, pinning, modules, and future-proof hooks.
**Non-goal:** This is not an aesthetic spec. It is a behavior + identity + state contract.

---

# 0) Definitions

### Project Space

A project-scoped UI surface with exactly three primary tabs:

* **Overview**
* **Work**
* **Tools**

### Work Pane

A “working environment” inside Work (and optionally pinned as a top-level tab). Panes are switchable, reorderable, and can be audience-scoped.

### Module

A workflow tool view placed in a pane’s organization grid (e.g., Tasks module, Calendar module). Modules are not freeform content containers.

### Workspace Doc

The creative collaborative document surface in a pane (Lexical/Yjs). In v1: one doc per pane (owned).

---

# 1) Navigation & Routing Contract

## 1.1 Top-level project routes

A Project Space has exactly three top-level tabs:

* `/projects/:projectId/overview`
* `/projects/:projectId/work/:paneId`
* `/projects/:projectId/tools`

**Notes**

* There is no global “project header” outside these tabs.
* **Pinned panes** appear in the top navigation but resolve to the same Work route:
  `/projects/:projectId/work/:paneId` (with pane-switcher hidden; see §4.3)

## 1.2 Overview sub-views (fixed)

Overview has exactly three views, all within `/projects/:projectId/overview`:

* **Timeline** (default)
* **Calendar**
* **Tasks**

Implementation may use:

* internal view state (`?view=timeline|calendar|tasks`)
* or subroutes (`/overview/timeline`, etc.)

**Contract requirement:** exactly these three views exist and are always available.

## 1.3 Tab ordering & keyboard switching

* Top navigation items are reorderable by the user.
* Keyboard “next tab / previous tab” navigation cycles through all visible top-nav items.
* Navigation wraps: last → Overview, first → last.

---

# 2) Overview Tab Contract

## 2.1 Overview-only Project Header

The “Project Header” exists **only inside Overview**, always at the top.

**Contains**

* Project name
* Collaborators list (project membership)
* Optional clients list (references for automations)
* Project-level quick actions (optional)

**Hard rule**

* **No pane may include people not in the Project Header collaborator list.**
  Pane membership must be a subset of project collaborators.

## 2.2 Overview views behavior

### A) Timeline (default)

Project-wide append-only activity feed showing:

* contributions (“who did what”)
* meetings / future meetings (events)
* task updates
* file attachments
* workspace-related events (coarse, not noisy)

Timeline items link to underlying objects when applicable.

### B) Calendar

Project-wide calendar showing overlapping collaborator calendars:

* filter/sort by **category** (task association / type)
* filter/sort by **user**

### C) Tasks

Project-wide tasks view:

* filter/sort by category and/or user
* tasks can reference calendar items and vice versa (association)

---

# 3) Work Tab Contract

## 3.1 Pane model (core)

Work contains **multiple panes**:

* starts with one pane
* unlimited panes
* panes are reorderable
* each pane is a distinct environment

## 3.2 Pane audience modes (v1)

Each pane has exactly one of three audience modes:

1. `project` — visible to **all** project collaborators
2. `personal` — visible to **only the current user**
3. `custom` — visible to a **subset** of project collaborators

**Membership constraints**

* For `custom`, pane members must be chosen from Project Header collaborators.
* For `project`, members are implicitly “all collaborators.”
* In v1, if a pane has multiple members, **they see the same pane state**, including:

  * same module layout/config
  * same workspace doc contents (because doc is pane-owned)
* (Future hook) v2 may allow per-user differences in the module grid only; not in v1.

## 3.3 Pane structure (two regions, both optional)

Each pane can contain up to two stacked regions:

### Region A — Organization Area (top)

* 12-column layout container
* max **6** modules per pane (hard limit v1)
* module size tiers: **S / M / L**
* modules are placed into the 12-column grid (no freeform overlap)

### Region B — Creative Workspace (bottom)

* collaborative document area (Lexical + Yjs eventually)
* typed object embeds only (no raw opaque HTML blobs)
* deterministic serialization

**Optionality rules**

* Pane may be **modules-only** (no creative workspace)
* Pane may be **workspace-only** (no modules)

---

# 4) Pinning Contract

## 4.1 Pinning is per-user

* Pins are personal preferences.
* Pinning does not affect what other collaborators see.

## 4.2 Pin = live shortcut (not a snapshot)

Pinning a pane creates a top-nav item that points to the same pane:

* Editing the pane edits the pinned pane (identical entity).
* The pinned tab never “forks” state.

## 4.3 Pinned pane UX behavior

When a pane is opened via its pinned top-nav tab:

* the user is effectively in `/projects/:projectId/work/:paneId`
* the pane-switcher UI is **hidden by default**
* the user is not shown “other panes” navigation unless they explicitly reveal it (optional UI affordance)

**Goal:** `login → project → pinned pane` is 1 step shorter than `login → project → work → pick pane`.

---

# 5) Focus Mode Contract (Doc-first utility modules)

**Definition (locked)**
Focus mode collapses the module grid into a compact icon toolbar:

* Up to 6 module icons displayed.
* Clicking an icon opens the module in a **dialog** over the workspace.
* The dialog supports quick actions (inspect, drag references, etc.)
* **Esc closes** the dialog.
* Primary surface remains the creative workspace.

Focus mode is not “maximize module.” It is “modules become quick tools.”

---

# 6) Modules Contract

## 6.1 Module instance identity

Each module on a pane is an *instance* with its own config.

**ModuleInstance fields (conceptual)**

* `module_instance_id` (stable within pane)
* `module_type` (enum)
* `size_tier` (S/M/L)
* `grid_placement` (12-col placement metadata)
* `config` (typed, versioned, module-specific)

## 6.2 Config scope

* Module config is owned by the **pane** (v1).
* Users may copy/import module configs via:

  * “templates”
  * “recently used”
  * “import from another pane”
    These are UX features; they do not change the ownership rule.

## 6.3 Module types (initial canonical set)

Not exhaustive, but supported module taxonomy includes:

* Tasks
* Calendar
* Timeline
* Files
* Workspaces list
* People
* Notifications
* (additional deterministic workflow tools as needed)

## 6.4 Module data source boundary (Overview vs Work)

Timeline/Tasks/Calendar exist in two surfaces:

* **Overview**: fixed project-wide truth
* **Work module**: can be either:

  * a project-wide lens (same as Overview)
  * or a local/scratch lens (pane-scoped planning view)

**Contract:**
Work modules must declare which lens they are:

* `lens = "project"` or `lens = "pane_scratch"` (names flexible; concept locked)

---

# 7) Workspace Doc Contract (Lexical boundary)

## 7.1 Doc ownership (v1)

In v1:

* each pane owns exactly one workspace doc
* no shared doc across panes

## 7.2 Future-proof hook: doc binding mode

Pane model must include a reserved field:

* `doc_binding_mode = "owned"` (only allowed value in v1)
* reserve `"linked"` for v2 (multiple panes binding to one shared doc)

This allows v2 expansion without schema redesign.

## 7.3 Typed embed rules (determinism)

Within the workspace doc:

* all non-text insertions must be typed nodes
* embeds must reference either:

  * Hub objects (TaskRef, EventRef, FileRef, PersonRef, etc.)
  * Provider bindings (e.g., Nextcloud file/folder binding)
* no anonymous embed blobs
* schemas must be versionable and replayable

---

# 8) TaskRef Interaction Contract (avoid navigation traps)

When a TaskRef is interacted with inside the workspace:

### 8.1 Lightweight interaction (default click)

* Inline action such as:

  * toggle/check
  * expand subtasks (if present)
    This keeps the user in-context.

### 8.2 Full task detail

Opening full task detail must be an **explicit** action:

* “Open details” command
* Enter on focused TaskRef
* contextual menu action
  …and it opens a dedicated task view surface (exact UI form may be chosen later):
* modal or right-side inspector are both acceptable in v1

**Contract:** quick inline ≠ full details; full details requires an explicit action.

---

# 9) Tools Tab Contract

Tools has exactly two sections:

1. **Live Tools**

* immediate provider-backed operations
* deterministic invocation (keyboard and screen reader compatible)

2. **Automation Builder**

* create/configure automations
* uses client references from Overview header as conditions/targets

Tools has:

* no panes
* no workspace doc
* no creative canvas behavior

---

# 10) Clients Contract (v1)

Clients in the Overview header are:

* **references/fields** used for automation (email targets, labels, etc.)
* not full-fledged objects with timeline/files/messaging in v1

**Future direction (non-binding):**
v2 may add client-facing panes or client-accessible views.

---

# 11) Permissions & Visibility (UI assumptions)

While the backend enforces authorization, the UI must assume:

* Pane membership is derived from project collaborators only.
* Users can only view panes they are members of:

  * all users can view `project` panes
  * only owner can view `personal` panes (current user)
  * only listed members can view `custom` panes
* Editing a pane requires appropriate project permissions (exact permission strings may be implemented later; behavior contract is what matters).

---

# 12) Event Emission Guidance (timeline noise control)

Timeline should record meaningful objects/actions, not every keystroke.

Examples that should emit timeline entries:

* pane created / deleted / audience changed
* module added/removed
* module lens changed (project ↔ scratch)
* task created/completed (object-level)
* calendar event created/updated (object-level)
* file attached/bound (object-level)
* workspace created/renamed
* workspace “major change” events (coarse, e.g., published snapshot), not raw typing

---

# 13) V1 Acceptance Checklist (for Codex QA)

A v1 implementation is considered conformant if:

* Project Space has exactly Overview/Work/Tools tabs.
* Overview contains the project header and exactly three views (timeline/calendar/tasks).
* Work supports multiple panes with audience modes and membership rules.
* Panes render the two-region model (modules grid + workspace), with either region optional.
* Module grid enforces max 6 modules, uses 12-col layout, sizes S/M/L.
* Focus mode collapses modules into icon toolbar; modules open in dialogs; Esc closes.
* Pinning is per-user and creates a top-nav shortcut to the same pane; hides pane switcher by default.
* Pane routing is `/projects/:id/work/:paneId`.
* Workspace docs are pane-owned in v1; schema reserves doc binding mode for v2.
* TaskRef behavior splits lightweight inline vs explicit “open details.”

---

## End of Contract (v1)

This is the canonical reference for UI implementation. Any additions must preserve:

* determinism
* accessibility-first navigation clarity
* pane audience constraints
* module limit and structured layout
* workspace typed-node rules and future-proof doc binding hook
