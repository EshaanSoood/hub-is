# Design System Split (Global)

This file defines the current global boundary between library-backed primitives, hybrids, and bespoke app DNA.

## Category 1 — Library-backed primitives (shadcn/Radix engines)

These are the contract-approved wrappers in `/src/components/primitives`, backed by engines in `/src/components/ui`.

| Primitive wrapper | Engine backing |
|---|---|
| `Dialog`, `AccessibleDialog` | `@radix-ui/react-dialog` via `src/components/ui/dialog.tsx` |
| `AlertDialog` | `@radix-ui/react-alert-dialog` via `src/components/ui/alert-dialog.tsx` |
| `Select` | `@radix-ui/react-select` via `src/components/ui/select.tsx` |
| `Tabs`, `TabsList`, `TabButton`, `TabsContent` | `@radix-ui/react-tabs` via `src/components/ui/tabs.tsx` |
| `Checkbox` | `@radix-ui/react-checkbox` via `src/components/ui/checkbox.tsx` |
| `DropdownMenu*` | `@radix-ui/react-dropdown-menu` via `src/components/ui/dropdown-menu.tsx` |
| `ContextMenu*` | `@radix-ui/react-context-menu` via `src/components/ui/context-menu.tsx` |
| `Popover*` | `@radix-ui/react-popover` via `src/components/ui/popover.tsx` |
| `Tooltip*` | `@radix-ui/react-tooltip` via `src/components/ui/tooltip.tsx` |
| `ToastProvider`, `toast` | `sonner` via `src/components/ui/sonner.tsx` |
| `CommandPalette` | `cmdk` + dialog shell via `src/components/ui/command.tsx` |
| `ScrollArea` | `@radix-ui/react-scroll-area` via `src/components/ui/scroll-area.tsx` |
| `ToggleGroup` internals | `@radix-ui/react-toggle-group` via `src/components/ui/toggle-group.tsx` |
| `ToggleButton` internals | `@radix-ui/react-toggle` via `src/components/ui/toggle.tsx` |

## Category 2 — Hybrids (library engine + bespoke layout/contract)

| Hybrid component | Library part | Bespoke part |
|---|---|---|
| `ToggleButton` | Radix toggle state | Existing button API (`pressed`, `onPressedChange`, variants/sizes), tokenized visuals |
| `FilterBar` + filter control rows | Radix-backed `Select` primitive | App-specific filter layout, chips, search placement |
| `ModuleLensControl` | Radix-backed `Select` primitive | Module-specific labeling and compact wireframe placement |
| `CheckboxGroup` compositions | Radix-backed checkbox primitive | `fieldset/legend` grouping and domain validation language |
| `TopNavTabs` / `SubViewSwitcher` | Radix-backed tabs semantics | Project-space-specific tab identity and route wiring |

## Category 3 — Bespoke app DNA

These remain intentionally custom:
- App-level shells and layout grammar (`AppShell`, `PageHeader`, `Panel`, `Grid`, `Stack`, `Cluster`, `DataTable`, `DataList`).
- Auth policy surfaces (`ProtectedRoute`, `ProjectRouteGuard`, `AccessDeniedView`, `ProfilePanel`).
- Hub feature panels (`ProjectCorePanel`, `SmartWakePanel`, `TasksPanel`, `NotificationsPanel`, `FilesPanel`, `NotesPanel`, `ActivityLogPanel`, `LessonsStudioPanel`, `MediaFlowsPanel`, `DevWorkPanel`, `BlockingInputsPanel`, `PersonalizedDashboardPanel`).
- Project Space contract behaviors (pane routing/pinning, focus mode, module grid grammar, Overview/Work/Tools shells).
- Lexical collaboration shelling (`EditorShell`, `CollaborativeLexicalEditor` integration layer).

## Rule enforcement: only primitives import `/ui`

Rule:
- Allowed: `src/components/primitives/** -> src/components/ui/**`
- Disallowed: any non-primitives file importing `src/components/ui/**`

Current state:
- PASS (no non-primitives imports from `/src/components/ui` found).

Observed non-blocking discrepancy:
- None currently open for the `/ui` import boundary after legacy duplicate removals.
