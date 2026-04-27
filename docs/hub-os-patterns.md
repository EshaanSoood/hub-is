# Hub OS Patterns

## 1. Introduction
This guide explains how Hub OS is structured today for engineers who are new to the codebase. It is guidance, not lint-enforced policy: the goal is to help you make changes that fit the architecture. Hub OS is organized so state lives close to where it is used, components are small enough to read in one sitting, and DOM structure follows reading order for accessibility. This document was written after the 14-phase refactor (Phases 0-13), so examples point at the cleaned structure rather than legacy files.

## 2. Component Structure: Folder With `index.tsx` and Children
Before Phase 2, large UI surfaces had a tendency to accumulate into single files that crossed 1000 lines. The Phase 2 convention is to make each feature surface a folder where `index.tsx` is the composition entrypoint, and sibling files hold focused subviews, hooks, types, and utilities. This keeps imports local, responsibilities explicit, and review scope smaller when editing one behavior.

For an example of this pattern, see [src/components/project-space/CalendarWidgetSkin/index.tsx](../src/components/project-space/CalendarWidgetSkin/index.tsx).

## 3. Custom Hooks: Colocated vs Promoted
Hub OS uses two hook locations on purpose. Colocated hooks live inside a feature folder when the logic is tightly bound to one component surface and would not read clearly elsewhere. Promoted hooks live in `src/hooks/` when the runtime concern is shared across multiple pages/features or defines a cross-cutting data boundary (for example project-level data loading). Promote only when reuse or ownership boundaries are real; do not promote preemptively.

For an example of this pattern, see [src/components/project-space/CalendarWidgetSkin/hooks/useCalendarCreatePanel.ts](../src/components/project-space/CalendarWidgetSkin/hooks/useCalendarCreatePanel.ts) (colocated hook).

For an example of this pattern, see [src/hooks/useProjectTasksRuntime.ts](../src/hooks/useProjectTasksRuntime.ts) (promoted hook).

## 4. State Ownership: Hooks Own State, Parents Call Hooks
Phase 5 replaced the previous 800-line `AppShell` ownership model with hook-owned state domains. In the current pattern, parent components orchestrate by calling hooks and wiring outputs into presentational children. Each hook owns one domain (search, notifications, quick add, etc.), which reduces hidden coupling and keeps parent files readable even when UI behavior is rich.

For an example of this pattern, see [src/components/Sidebar/SidebarShell.tsx](../src/components/Sidebar/SidebarShell.tsx).

## 5. Per-Widget Contracts: Typed Props Per Widget Type
Phase 7 replaced generic context-driven widget insertion plumbing (including the deleted `WidgetInsertContext`) with explicit typed contracts per widget type. Each widget receives a contract that matches its own capabilities (`TableWidgetContract`, `KanbanWidgetContract`, etc.), so type checking catches cross-widget mismatches early and widget wrappers stay honest about what they need.

For an example of this pattern, see [src/components/project-space/widgetContracts/index.ts](../src/components/project-space/widgetContracts/index.ts).

## 6. Runtime Validation at Boundaries: Zod Schemas
Use runtime validation at trust boundaries, meaning places where data crosses from untrusted/external shape into app-owned assumptions. In Hub OS that includes network envelopes, route/search state, and other serialized inputs that can drift independently of TypeScript compile-time checks. The pattern is: parse first, then operate on validated data.

For an example of this pattern, see [src/services/hub/transport.ts](../src/services/hub/transport.ts).

## 7. Design Tokens Only, No Inline Styles
Use design tokens and token-backed utility classes for all application UI styling. Avoid ad hoc inline style objects for visual decisions that should stay in the design system. The one intentional exception is the email template at `apps/hub-api/emails/inviteTemplate.mjs`, because HTML email clients require inline/CSS-in-template compatibility patterns that do not map to the app token pipeline.

For an example of this pattern, see [src/components/project-space/WidgetShell.tsx](../src/components/project-space/WidgetShell.tsx).

## 8. DOM Order Matches Reading Order
DOM order is a rule, not just a style preference. Screen reader reading order and keyboard tab order both follow DOM structure, so visual rearrangement must not break semantic sequence. Build markup in the order you want assistive technology to read and focus it. For deeper accessibility implementation notes, see `docs/voiceover-accessibility-codex-reference.md`.

## 9. The Lexical Subsystem Exception
The lexical/collaboration subsystem is an intentional exception zone: `src/features/notes/`, `src/hooks/useWorkspaceDocRuntime.ts`, and Yjs/Hocuspocus lifecycle orchestration code absorb third-party complexity so the rest of the app does not have to. You will see cast chains, adapter shims, and lifecycle wrappers there by design. Treat this as a containment boundary, not a template for everyday feature code.

Counter-example (exception only, do not copy): `src/features/notes/collabSessionManager.ts`.

## 10. Codex Prompt Conventions
When writing Codex prompts for Hub OS work, treat them like concise engineering specs. End every prompt with `npm run typecheck && npm run lint && npm run validate && npm run build`, and only call work complete when all four pass. Describe bugs in plain English symptoms and expected behavior, without prescribing root causes up front. Use repository-relative paths only (never local absolute paths), and deliver prompts inline in conversation rather than as checked-in files. Before asking for custom logic, check whether an established npm package already fits the need. Keep CSS token-based, keep DOM order aligned with reading order, and run a quick pre-flight over `scripts/` for hardcoded paths before file moves/reorgs. If CodeRabbit flags issues outside the current scope, defer them into a tracker instead of fixing them inside the active PR.
