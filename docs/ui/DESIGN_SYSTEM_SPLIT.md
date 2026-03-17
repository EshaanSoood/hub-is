# Design System Split - Shadcn/Radix vs Bespoke App DNA

This document reflects the current implementation after adopting shadcn/ui (Radix engine) behind `/src/components/primitives` while preserving Project Space contract behavior.

## A) Library-backed foundation

All components below are consumed through `/src/components/primitives` wrappers.

| Primitive export | Backing implementation |
|---|---|
| `Dialog` / `AccessibleDialog` | `@radix-ui/react-dialog` via shadcn-style `src/components/ui/dialog.tsx` |
| `AlertDialog` | `@radix-ui/react-alert-dialog` via shadcn-style `src/components/ui/alert-dialog.tsx` |
| `Tabs`, `TabsList`, `TabButton`, `TabsContent` | `@radix-ui/react-tabs` via shadcn-style `src/components/ui/tabs.tsx` |
| `Select` | `@radix-ui/react-select` via shadcn-style `src/components/ui/select.tsx` |
| `Checkbox` | `@radix-ui/react-checkbox` via shadcn-style `src/components/ui/checkbox.tsx` |
| `Popover` | `@radix-ui/react-popover` via shadcn-style `src/components/ui/popover.tsx` |
| `Tooltip` | `@radix-ui/react-tooltip` via shadcn-style `src/components/ui/tooltip.tsx` |
| `DropdownMenu` primitives | `@radix-ui/react-dropdown-menu` via shadcn-style `src/components/ui/dropdown-menu.tsx` |
| `ContextMenu` primitives | `@radix-ui/react-context-menu` via shadcn-style `src/components/ui/context-menu.tsx` |
| `toast`, `ToastProvider` | `sonner` via `src/components/ui/sonner.tsx` |
| `CommandPalette` | `cmdk` + Radix Dialog shell via `src/components/ui/command.tsx` |

## B) Hybrid components

| Component | Library-backed piece | Bespoke piece |
|---|---|---|
| `ToggleButton` | Radix Toggle state engine (`@radix-ui/react-toggle`) | Existing primitive API (`pressed`, `onPressedChange`, `variant`, `size`) and tokenized styling |
| `ToggleGroup`, `ToggleGroupItem` | Radix Toggle Group (`@radix-ui/react-toggle-group`) | Layout and tokenized visual treatment |
| `FilterBar` + filter controls | Radix Select via primitive `Select` | FilterBar structure, chip summary layout, search input shell |
| `CheckboxGroup` | Radix Checkbox for each control | `fieldset`/`legend` composition and contract-specific grouping rules |
| `ScrollArea` (available) | Radix Scroll Area | Project-specific optional usage and tokenized scrollbar appearance |

## C) Bespoke app DNA (intentionally custom)

These remain custom to preserve Project Space contract behavior and domain UX:

- Overview / Work / Tools route shells and their layout contracts
- Pane routing + pinning behavior (`/projects/:projectId/work/:paneId`, pinned query intent)
- Top-nav pinned shortcuts row logic and open-from-pinned behavior
- Pane switcher visibility/reorder behavior
- Focus mode toolbar behavior (icon row + module dialog entry)
- Module grid grammar (12-col layout, S/M/L sizing, max 6 modules)
- Workspace placeholder boundary (Lexical intentionally deferred)
- Domain shell content for Timeline, Tasks, and Calendar placeholders

## D) Designer handoff: bespoke visuals still needed

Use this as the design backlog for skinning bespoke product DNA. All items should define component tokens + interaction specs for listed states.

- [ ] `TopNav pinned shortcuts row`
  States: `default`, `hover`, `focus-visible`, `selected`, `disabled`
- [ ] `PaneSwitcher row` (row shell + reorder controls)
  States: `default`, `hover`, `focus-visible`, `selected`, `disabled`
- [ ] `PaneHeader controls layout` (rename input row, audience + members blocks)
  States: `default`, `hover`, `focus-visible`, `disabled`, `error`
- [ ] `ModuleCard chrome`
  States: `default`, `hover`, `focus-visible`, `selected`, `disabled`, `loading`
- [ ] `FocusModeToolbar icon buttons`
  States: `default`, `hover`, `focus-visible`, `active`, `disabled`
- [ ] `Calendar grid day cell`
  States: `default`, `hover`, `focus-visible`, `selected`, `disabled`
- [ ] `Calendar event chip`
  States: `default`, `hover`, `focus-visible`, `selected`, `disabled`
- [ ] `Task row`
  States: `default`, `hover`, `focus-visible`, `selected`, `disabled`, `loading`
- [ ] `Task status pill`
  States: `default`, `selected`, `disabled`, `error`
- [ ] `Timeline row`
  States: `default`, `hover`, `focus-visible`, `selected`
- [ ] `InlineNotice` visual system (`info/warning/danger/success`)
  States: `default`, `focus-visible`, `dismissed`
- [ ] `FilterBar` layout + spacing + responsive collapse
  States: `default`, `focus-within`, `disabled`, `error`, `loading`

## Guardrails preserved

- Project Space contracts remain unchanged (Overview/Work/Tools tabs, routes, panes, focus mode, pinning).
- App code outside `/src/components/primitives` does not import from `/src/components/ui`.
- Tokenized styling remains semantic (`bg-surface`, `bg-elevated`, `border-subtle`, `text-primary`, etc.), no hard-coded palette classes.
- Accessibility semantics are preserved through Radix engines and primitive wrappers (focus-visible, dialog trap/return, Esc close, tab/menu/select semantics).
