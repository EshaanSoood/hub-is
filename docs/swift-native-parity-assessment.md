# Swift Native Parity Assessment

## Purpose

This document assesses what it would take to recreate the current Hub OS application in Swift while preserving existing behavior.

Constraint for this assessment:

- The app must continue to work as it does now.
- Server-side behavior is assumed to live locally with the app.
- The target is a native Swift implementation of the full product, not a partial wrapper, thin client, or selective rewrite.

This is therefore a parity assessment, not a recommendation about whether the migration should happen.

## Executive Summary

Under a full-parity Swift requirement, this is a full product rewrite across three layers:

1. Native application shell and UX
2. Local application/service runtime
3. Realtime collaboration runtime

The current repository is not just a web frontend. It contains:

- A React/Vite browser app with substantial client-side orchestration
- A local HTTP + SQLite application server
- A separate realtime collaboration service for document sync/presence

The cleanest assets to carry forward are the data contracts, schema, policy semantics, validation logic, and NLP/parser logic. The least portable parts are the browser-coupled auth/session layer, the app shell, the project workspace runtime, and the collaborative editor stack.

## Current System Shape

### Frontend application

The web app is a routed SPA built around global providers and large feature modules.

Relevant files:

- `src/main.tsx`
- `src/App.tsx`
- `src/components/layout/AppShell.tsx`
- `src/pages/ProjectSpacePage.tsx`

Key observations:

- Global runtime depends on React context providers for auth, projects, smart wake, and activity.
- Routing is browser-native and path-based.
- The app shell owns major cross-cutting behavior: navigation, search, quick add, notifications, personal reminders/calendar, dialogs, focus restoration.
- The project-space surface is large and state-dense, with overview/work/tools tabs and many runtime hooks.

### Local server/runtime

The app includes a custom local server implemented in Node with SQLite-backed domain behavior.

Relevant files:

- `apps/hub-api/hub-api.mjs`
- `apps/hub-api/db/schema.mjs`
- `apps/hub-api/db/statements.mjs`
- `apps/hub-api/routes/*.mjs`

Key observations:

- The server is not incidental infrastructure; it contains core product logic.
- There are route modules for projects, panes, docs, collections, records, views, tasks, reminders, files, search, chat, notifications, automations, and users.
- The SQLite schema is substantial and normalized.
- Permission gating, validation, notifications, reminders, and timeline emission live here.

### Realtime collaboration runtime

The app includes a separate collaboration server for shared docs.

Relevant files:

- `apps/hub-collab/collab-server.mjs`
- `src/features/notes/CollaborativeLexicalEditor.tsx`
- `src/hooks/useWorkspaceDocRuntime.ts`
- `src/services/hub/docs.ts`

Key observations:

- Shared docs use Lexical + Yjs + websocket sync + awareness + local persistence.
- The editor supports presence, embedded view references, mention insertion, asset embedding, snapshot persistence, and focus-to-node behavior.
- This subsystem is materially more complex than the rest of the product.

## Codebase Scale Indicators

Approximate size indicators from the current repository:

- `src` TypeScript/TSX LOC: about `45.7k`
- `apps` MJS LOC: about `13.6k`
- Non-artifact E2E LOC: about `5.8k`
- Explicit route handlers in `apps/hub-api/routes`: about `60`

Platform-coupling indicators in `src`:

- `window` references: `167`
- `document` references: `45`
- `localStorage` references: `9`
- Lexical-related references: `40`
- Yjs-related references: `18`
- WebSocket-related references across `src`/`apps`: `47`

These numbers matter because they show this is not a mostly-portable domain application with a thin UI layer. A large amount of current behavior is bound to browser runtime assumptions.

## What Carries Forward Cleanly

These areas are comparatively strong migration inputs because their behavior is explicit and portable even if the code itself is not directly reusable.

### 1. Data contracts and model semantics

Best current source:

- `src/shared/api-types`

Why this helps:

- Session, task, record, event, home, reminder, and project contracts are already typed.
- These can be translated into Swift `Codable` types and domain models.
- They provide a better starting point than reverse-engineering UI state.

Limit:

- Model duplication still exists across:
  - `src/shared/api-types`
  - `src/services/hub/types.ts`
  - `src/types/domain.ts`

### 2. Database schema and persistence rules

Best current source:

- `apps/hub-api/db/schema.mjs`
- `apps/hub-api/db/statements.mjs`

Why this helps:

- The schema already defines the product’s structural contract.
- Tables, indexes, and constraints capture a large part of the runtime behavior.
- Prepared statement catalog gives a usable map of domain operations.

What this means for Swift:

- Schema semantics can be ported to SQLite in Swift.
- Query behavior can be recreated through a Swift persistence layer.
- This is a translation problem, not a product-design problem.

### 3. Validation and policy behavior

Relevant files:

- `src/shared/api-types/validators.ts`
- `src/lib/policy.ts`
- route policy gates in `apps/hub-api/routes`

Why this helps:

- Input validation rules and capability semantics are already spelled out.
- This logic should be recreated as pure Swift domain/services code with matching tests.

### 4. NLP and parser logic

Relevant files:

- `src/lib/nlp`
- `src/lib/calendar-nlp`

Why this helps:

- This logic is algorithmic, testable, and less UI-bound than the rest of the app.
- It is substantial, but it is portable by behavior.

What this means:

- The parser code should be treated as a domain port with regression parity tests, not a redesign.

## What Can Be Refactored During Rewrite

These areas should not be transliterated literally. Their behavior should be preserved, but their implementation should be reorganized in Swift.

### 1. Frontend runtime hooks into native feature stores/services

Relevant files:

- `src/hooks/useProjectBootstrap.ts`
- `src/hooks/useProjectViewsRuntime.ts`
- `src/hooks/useProjectFilesRuntime.ts`
- `src/hooks/useProjectTasksRuntime.ts`
- `src/hooks/useAutomationRuntime.ts`
- `src/hooks/useWorkspaceDocRuntime.ts`

Current issue:

- Product behavior is often embedded in React hook orchestration rather than isolated domain services.

Swift implication:

- Preserve behavior, but re-express it as structured native feature stores, coordinators, and service layers.
- The logic is reusable conceptually, not structurally.

### 2. Route-centric backend logic into domain services

Relevant files:

- `apps/hub-api/routes/collections.mjs`
- `apps/hub-api/routes/docs.mjs`
- `apps/hub-api/routes/files.mjs`
- `apps/hub-api/routes/projects.mjs`
- `apps/hub-api/routes/tasks.mjs`
- `apps/hub-api/routes/views.mjs`

Current issue:

- Much of the domain behavior is organized around HTTP handlers.

Swift implication:

- Under a local native runtime, HTTP boundaries may disappear or become internal IPC boundaries.
- The correct migration is to factor the current route behavior into Swift domain/application services while preserving response semantics.

### 3. Model consolidation

Relevant files:

- `src/shared/api-types`
- `src/services/hub/types.ts`
- `src/types/domain.ts`

Current issue:

- Similar concepts exist in multiple layers with slightly different shapes.

Swift implication:

- A parity rewrite should establish one canonical model system and mapping boundaries.

## What Must Be Rewritten Entirely

These systems are functionally important but structurally tied to the web stack or current JS ecosystem.

### 1. Authentication/session bootstrap

Relevant files:

- `src/context/AuthzContext.tsx`
- `src/lib/keycloak.ts`

Why this is a rewrite:

- Depends on `keycloak-js`
- Depends on browser redirects and `window.location.origin`
- Uses browser timers and local storage semantics
- Is designed around SPA auth lifecycle

Swift consequence:

- Session establishment, token refresh, secure storage, and auth callbacks must all be reauthored natively.

### 2. Global application shell

Relevant file:

- `src/components/layout/AppShell.tsx`

Why this is a rewrite:

- This file concentrates too much browser-specific interaction logic to port directly.
- It manages search, command behavior, quick add, notifications, focus restoration, dialogs, route awareness, and live refresh behavior.

Swift consequence:

- This becomes a new native shell architecture, not a translation.

### 3. Project workspace surface

Relevant file:

- `src/pages/ProjectSpacePage.tsx`

Why this is a rewrite:

- This is one of the densest orchestration files in the codebase.
- It ties routing, pane selection, search params, editor wiring, files, comments, relations, views, and workspace behavior together.

Swift consequence:

- The behavior must be decomposed and recreated feature-by-feature.

### 4. Advanced modules and interaction-heavy views

Relevant files:

- `src/components/project-space/TableModuleSkin.tsx`
- `src/components/project-space/KanbanModuleSkin.tsx`
- `src/components/project-space/CalendarModuleSkin.tsx`
- `src/components/project-space/CalendarDayView.tsx`
- `src/components/project-space/FilesModuleSkin.tsx`
- `src/components/project-space/TasksModuleSkin.tsx`

Why this is a rewrite:

- These rely on current React rendering patterns, Radix UI assumptions, drag/drop libraries, virtualization, browser focus behavior, and CSS/Tailwind layout rules.

Swift consequence:

- The UX may be reproducible, but the implementation will be entirely new.

### 5. Collaborative editor stack

Relevant files:

- `src/features/notes/CollaborativeLexicalEditor.tsx`
- `src/hooks/useWorkspaceDocRuntime.ts`
- `apps/hub-collab/collab-server.mjs`

Why this is the hardest rewrite:

- Lexical editor state and plugins
- Yjs CRDT document sync
- IndexedDB local persistence
- awareness/presence protocol
- websocket auth ticket flow
- embedded nodes and custom insertion behavior

Swift consequence:

- This is not just a native UI rewrite.
- It requires a new editor and collaboration architecture with format and behavior parity constraints.

## Major Challenge Areas

### 1. Browser-runtime coupling

The current app assumes a browser environment throughout:

- focus restoration with DOM access
- `window` timers
- `sessionStorage` / `localStorage`
- route-driven search params
- clipboard and popup behaviors
- websocket reconnect logic

This means parity depends on replacing the runtime model, not just replacing components.

### 2. Desktop-style interaction density

The app behaves more like a desktop workspace than a simple content app.

Examples:

- multi-pane navigation
- large command/search surfaces
- dense tables and kanban boards
- nested dialogs/popovers
- quick capture and quick add workflows
- contextual inspector behaviors

This is achievable in Swift, but the implementation must be native-first and interaction-tested.

### 3. Collaboration and editor parity

This is the largest technical risk in the migration.

Key parity requirements include:

- live multi-user editing
- connection status
- awareness/presence
- persisted snapshots
- node targeting/focus
- mention extraction/materialization
- asset embeds
- custom embedded view nodes

Any mismatch here risks loss of functional parity, not just UX polish.

### 4. Local service/runtime rewrite

Because server-side behavior is assumed to live locally in the Swift app, the current Node server behavior has to be reimplemented as native local services.

That includes:

- auth/session enforcement
- SQLite access
- migrations
- search
- reminders
- notifications
- automation execution records
- files/assets behavior
- chat provisioning logic
- timeline emission

This is closer to rebuilding an application platform than rebuilding a frontend.

### 5. Contract drift and parity verification

There is evidence that the contract inventory needs tightening before migration. For example:

- `apps/hub-api/hub-api.mjs` contains `REGISTERED_ROUTE_COUNT = 79`
- `apps/hub-api/api-snapshot.json` records `route_count = 72`

This does not necessarily mean the app is wrong, but it does mean a Swift parity rewrite needs a single verified contract source first.

## Roadmap For Full Swift Parity

### Phase 1. Behavioral freeze and inventory

Goal:

- Treat the current repository as the functional spec.

Work:

- Enumerate all route behaviors, websocket payloads, DB invariants, and major UI workflows.
- Build a parity matrix from:
  - `apps/hub-api/api-snapshot.json`
  - `apps/hub-api/db/schema.mjs`
  - `apps/hub-api/routes`
  - `e2e/tests`
  - parser tests under `src/lib`

Deliverables:

- canonical behavior inventory
- subsystem ownership map
- parity test plan

### Phase 2. Canonical contract extraction

Goal:

- Establish one source of truth for models, commands, events, and permissions.

Work:

- Normalize model definitions across frontend/service/shared layers.
- Freeze live event payloads and collab session payloads.
- Define persistence and service boundaries as Swift domain/application contracts.

Deliverables:

- canonical DTO/domain spec
- event schema inventory
- permission and validation matrix

### Phase 3. Local runtime rewrite in Swift

Goal:

- Rebuild the current hub-api behavior natively.

Work:

- Port schema, migrations, and persistence behavior.
- Port route behavior into native application services.
- Rebuild search, reminders, notifications, file metadata, mentions, automations, and timeline logic.

Deliverables:

- local application runtime
- persistence layer
- domain services with parity tests

### Phase 4. Realtime/runtime rewrite

Goal:

- Rebuild live updates and collaborative docs.

Work:

- Recreate live notification/event transport.
- Recreate collab auth ticket flow.
- Recreate shared-doc synchronization, persistence, and presence behavior.

Deliverables:

- live event runtime
- collaboration runtime
- sync/presence parity tests

### Phase 5. Native app shell and session architecture

Goal:

- Replace browser bootstrapping with native app structure.

Work:

- Native session/auth lifecycle
- native navigation model
- global shell behaviors
- notifications/search/quick-add architecture
- native design token system derived from current token intent

Deliverables:

- native application shell
- session/store/navigation infrastructure

### Phase 6. Feature-area migration by domain

Recommended order under a parity requirement:

1. home/search/notifications
2. projects and pane bootstrap
3. tasks/reminders/calendar
4. files/assets
5. views/tables/kanban
6. comments/mentions/backlinks
7. tools/automations/chat
8. collaborative docs

Rationale:

- This order moves from strong contract-driven domains toward the highest-interaction and highest-risk surfaces.

### Phase 7. Full parity verification

Goal:

- Prove behavioral equivalence.

Work:

- Recreate golden tests for:
  - parser output
  - validation
  - DB invariants
  - local runtime service behavior
  - websocket/live payloads
  - collaboration semantics where feasible
- Use current E2E/API tests as parity references, not just smoke checks.

Deliverables:

- parity suite
- migration verification report

## Port / Refactor / Rewrite Summary

### Port by behavior

- `src/shared/api-types`
- `apps/hub-api/db/schema.mjs`
- `apps/hub-api/db/statements.mjs`
- `src/shared/api-types/validators.ts`
- `src/lib/policy.ts`
- `src/lib/nlp`
- `src/lib/calendar-nlp`

### Refactor while preserving behavior

- `src/hooks/useProjectBootstrap.ts`
- `src/hooks/useProjectViewsRuntime.ts`
- `src/hooks/useProjectFilesRuntime.ts`
- `src/hooks/useProjectTasksRuntime.ts`
- `src/hooks/useAutomationRuntime.ts`
- `apps/hub-api/routes/*.mjs`
- model duplication across shared/service/domain layers

### Rewrite entirely

- `src/context/AuthzContext.tsx`
- `src/lib/keycloak.ts`
- `src/components/layout/AppShell.tsx`
- `src/pages/ProjectSpacePage.tsx`
- advanced interactive module skins/components
- `src/features/notes/CollaborativeLexicalEditor.tsx`
- `src/hooks/useWorkspaceDocRuntime.ts`
- `apps/hub-collab/collab-server.mjs`

## Bottom Line

If everything about this app has to work as it does now, but in Swift, the work is best understood as a full-system parity rewrite.

The easiest things to carry forward are:

- contracts
- schema
- validation
- policy semantics
- parser logic
- tested behavioral rules

The parts that should be treated as major rewrites are:

- auth/session lifecycle
- app shell
- workspace orchestration
- advanced interactive UI modules
- collaborative editing and sync

The correct roadmap is therefore:

1. freeze and inventory current behavior
2. formalize canonical contracts
3. rewrite the local runtime
4. rewrite realtime/collaboration runtime
5. rebuild the native shell
6. migrate features by domain and risk
7. verify parity with tests and behavior baselines

This assessment is based on the current repository state and is intended as a migration-scoping document, not a recommendation for or against the migration.
