# Design System Handoff: Hub Global

Audience: product design + frontend engineering

Objective: define one coherent global UI language across Hub surfaces while keeping Radix/shadcn primitives as the accessibility and interaction baseline.

## Foundation rules (non-negotiable)

- Interaction baseline must come from primitives in `src/components/primitives/*` (which compose `src/components/ui/*` Radix wrappers).
- New feature code must not import from `src/components/ui/*` outside `src/components/primitives/*`.
- Styling remains Tailwind + token classes from `tokens.css`.
- Avoid hard-coded Tailwind palette colors (`*-sky-*`, `*-rose-*`, etc.) in product surfaces.
- Prefer semantic variants over one-off class stacks.

## Global layout scaffolds

### 1) App shell (signed-in baseline)

Canonical file: `src/components/layout/AppShell.tsx`

- Keep as the single global frame for authenticated routes.
- Required regions:
  - skip link
  - global header
  - main content container
  - footer
- Container width baseline: `max-w-7xl`
- Horizontal rhythm baseline: `px-4`
- Vertical rhythm baseline: header `py-4`, main `py-6`, footer `py-4`

### 2) Hub header (non-project)

Current source: AppShell header + page-level `PageHeader` (`src/components/layout/PageHeader.tsx`)

Canonical language:
- Row 1: product identity + user role context + primary nav + profile trigger.
- Row 2 (page-local): title + description + optional top-right action slot.

Do not:
- invent alternative top bars per non-project route.
- bypass `PageHeader` for routed content pages.

### 3) Project header (project-scoped)

Current source: `src/components/project-space/TopNavTabs.tsx` + `OverviewHeader.tsx`

Canonical language target:
- Header Layer A: project identity + project-level tab navigation (Overview/Work/Tools).
- Header Layer B: contextual controls for active tab (pinned panes, refs, filters, etc.).

Required alignment changes:
- Replace placeholder copy (`Hub Project Space Wireframe`) with project-aware title/subtitle contract.
- Align project header spacing and density with non-project `PageHeader` metrics.

### 4) Page title rows

Current canonical: `PageHeader`.

Rules:
- Always include `h1` title.
- Description optional but should exist for major pages.
- Use `action` slot for top-right CTA cluster.

### 5) Content container widths and spacing

- Global default: `max-w-7xl` in app shell.
- Page section spacing: prefer `Stack gap="lg"` for major blocks.
- Card internal padding baseline: `p-4` or `p-5` only.
- Avoid per-screen arbitrary min-heights and pixel font sizes except for tightly bounded micro UI (document each exception).

## Navigation patterns

### Primary app navigation

- Source: `appTabs` in `src/lib/policy.ts`, rendered by `AppShell`.
- Pattern: route-based top nav, capability-gated, visible across signed-in pages.

### Project top tabs

- Source: `TopNavTabs` with primitives `Tabs`, `TabsList`, `TabButton`.
- Pattern: route-driven segmented top tabs; URL is source of truth.

### Sub-tabs

- Source: `OverviewView` Timeline/Calendar/Tasks tabs.
- Pattern: local state/query-driven tabs with consistent tab trigger visual treatment.

### Sidebars

- None currently canonical.
- If introduced, sidebar must be a scaffold-level component, not page-local ad hoc markup.

## Component styling rules

### Buttons

Canonical source: `src/components/primitives/Button.tsx` + `buttonStyles.ts`

Variants:
- `primary`: single dominant CTA per section.
- `secondary`: default for standard actions.
- `ghost`: low-emphasis contextual action.
- `danger`: destructive actions only.

Rules:
- Prefer primitive `Button`/`IconButton` over raw `<button>` class stacks.
- Do not introduce custom button colors outside variant model.

### Inputs / selects / textareas

- Use tokenized border/background text classes.
- Prefer primitive `Select` (Radix) over raw `<select>` unless there is a documented reason.
- Every input needs visible label text and programmatic association.

### Cards / panels

Current split:
- `layout/Panel` for feature panels.
- `primitives/Card` for project-space cards.

Handoff rule:
- unify to a small set of card variants (`surface`, `elevated`, `danger`, `empty`) with one API.

### Lists / feeds

- Define one reusable row contract (title, meta, status, trailing actions).
- Apply across tasks, files, tools, timeline/activity items.

### Badges / tags

- Use `Chip`/`FilterChip` primitives.
- Replace ad hoc inline badge spans in feature files.

### Empty states

- Define a shared `EmptyState` component with:
  - title
  - description
  - optional icon
  - primary CTA
  - optional secondary action

### Loading skeletons / spinners

- Introduce standard skeleton placeholders for table/list/card loading.
- Replace plain “Loading ...” text-only blocks where users wait >500ms.

### Toasts / banners

- Keep `ToastProvider` + `toast` helpers as baseline.
- Remove hardcoded dark theme in sonner wrapper; align with token mode.

### Tables

Current source: `layout/DataTable.tsx`

Rules:
- Must support explicit empty row state.
- Keep column header text hierarchy and row hover behavior consistent.
- Avoid embedding divergent action-button styles per table.

## Interaction rules (Radix-first)

### Dialogs

- All modals/confirmations use primitives `AccessibleDialog` or `AlertDialog`.
- Use `triggerRef` for focus restoration.
- Custom overlay/modal implementations are disallowed where a primitive exists.

### Popovers

- Use primitives `Popover`/`PopoverContent` for floating contextual settings.
- Avoid hand-built absolute/fixed overlay popups for filter panels.

### Menus / dropdowns / context menus

- Use primitives from `Menu.tsx` exports only.
- No page-local custom menu semantics.

### Tabs

- Use primitives `Tabs` + `TabButton`.
- Keep `aria-controls`/`tabpanel` pairs consistent.
- Prefer primitive tab content wrappers or one standardized manual panel pattern.

### Keyboard shortcuts (current + target)

Current:
- Pane switcher supports arrow nav and digit shortcuts.

Target:
- Publish a shortcut map and enforce tested behaviors (including `Ctrl+Arrow` reorder semantics).

## Typography + density scale

### Typography

- Headings: `heading-1` through `heading-4` utilities only.
- Body copy: `text-sm` default.
- Metadata/supporting labels: `text-xs`.
- Avoid arbitrary `text-[10px]`/`text-[11px]` unless component spec explicitly allows micro text.

### Density presets

- `comfortable` (default): current `p-4/p-5`, `py-2` controls.
- `compact`: analytics-heavy rows/panels, smaller vertical spacing but no micro text unless necessary.
- `expanded`: onboarding/empty states.

## Icon usage rules

- Icon-only controls must have non-empty `aria-label` (already enforced in `IconButton`).
- Keep icon style set consistent (stroke weight + sizing).
- Reserve emoji/glyph-only controls for internal placeholders; replace in shipped surfaces.

## Do / Don’t

### Do

- Do compose dialogs/popovers/selects/tabs from `src/components/primitives`.
- Do keep route pages on one scaffold: app shell + page header + section stack.
- Do enforce label associations for every form control.
- Do normalize task/calendar/timeline/file rows into shared surface patterns.

### Don’t

- Don’t import `src/components/ui/*` directly from feature/page files.
- Don’t use ad hoc raw `<button>` styles when `Button`/`IconButton` exists.
- Don’t add new hard-coded color palettes for domain semantics.
- Don’t ship placeholder copy in top-level headers.

## Canonical component map (current)

| Concern | Current canonical | Notes |
|---|---|---|
| App frame | `components/layout/AppShell.tsx` | Keep as root authenticated scaffold. |
| Page title row | `components/layout/PageHeader.tsx` | Use on all non-project routed pages. |
| Button styles | `components/primitives/Button.tsx` | Needs wider adoption in feature panels. |
| Dialogs | `components/primitives/Dialog.tsx` | Good focus restore support. |
| Tabs | `components/primitives/Tabs.tsx` | Used in project top nav + overview. |
| Data table | `components/layout/DataTable.tsx` | Needs empty-state support. |
| Project top nav | `components/project-space/TopNavTabs.tsx` | Should become canonical project-header variant, not one-off wireframe. |

