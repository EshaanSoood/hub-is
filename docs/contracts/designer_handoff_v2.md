# Designer Handoff v2 (Bespoke Components Only)

Date: 2026-03-04  
Audience: Product design (Figma component build)

## 1) AppShell + Global Navigation

Name: AppShell Navigation Frame  
Where it appears: Entire authenticated app shell  
What problem it solves: Provides consistent orientation, global route access, and account context

Required states:
- default
- hover (nav item)
- focus-visible (nav item)
- active route
- collapsed/narrow viewport
- loading auth

Key interactions:
- Mouse: click nav item to route
- Keyboard: Tab through nav items, Enter/Space activate, skip-link jumps to main

A11y requirements:
- Page landmarks (`header`, `nav`, `main`, `footer`)
- Visible skip link on focus
- `aria-current="page"` for active nav item
- Logical focus order from shell to page content

Content rules:
- Long user names truncate with ellipsis
- Keep nav labels single line
- Empty-role fallback copy must be deterministic

## 2) ProjectSpace Header + Top Navigation (Overview/Work/Tools)

Name: ProjectSpace Top Rail  
Where it appears: Project Space routes (`/projects/:projectId/*`)  
What problem it solves: Maintains project-level navigation context and mode switching

Required states:
- default
- tab hover
- tab focus-visible
- active tab
- with pinned-pane shortcuts
- no pinned panes

Key interactions:
- Mouse: click Overview/Work/Tools or pinned pane shortcut
- Keyboard: Arrow navigation across tabs, Enter/Space activate, wrap-around behavior

A11y requirements:
- Correct tab roles and tabpanel associations
- Keyboard wrap behavior announced and predictable
- Pinned shortcuts must have explicit labels

Content rules:
- Project title wraps to max two lines on small widths
- Pinned pane labels truncate but keep full label in tooltip/title text

## 3) Pane Switcher + Pinned Panes

Name: Work Pane Switcher System  
Where it appears: Work tab header area  
What problem it solves: Enables fast switching, ordering, and shortcut access for many panes

Required states:
- default compact dots
- hover expanded label
- active pane
- disabled pane
- pinned-open mode (switcher hidden by default)

Key interactions:
- Mouse: click pane chip to activate; drag/reorder affordance (future)
- Keyboard: Left/Right to move focus; Enter/Space activate; shortcut digits activate pane

A11y requirements:
- Each pane control requires an explicit `aria-label`
- Active pane conveyed by pressed/current state
- Hidden switcher in pinned mode must still be discoverable via explicit button

Content rules:
- Pane label max length with ellipsis
- Fallback label for untitled panes

## 4) Module Grid (12-Column Organization Area)

Name: Module Placement Grid  
Where it appears: Work pane Organization Area  
What problem it solves: Structured placement of pane modules with clear size semantics

Required states:
- empty
- partially filled
- full (6/6 modules)
- module hover controls visible
- delete-confirm flow

Key interactions:
- Mouse: add module tile, remove module, change module lens
- Keyboard: tab to module actions, activate add/remove/lens controls

A11y requirements:
- Module cards reachable in DOM order
- Action buttons named by module label
- Confirmation dialog focus trap and focus-return

Content rules:
- Show count `n/6`
- Module titles single line with truncation
- Empty tiles must have explicit instructional copy

## 5) Record Inspector (Slide-In / Expand Card)

Name: Record Inspector Panel  
Where it appears: Invoked from table rows, kanban cards, timeline items, calendar events, mentions  
What problem it solves: Rapid detail editing without full-page navigation

Required states:
- closed
- opening
- loading
- open-ready
- dirty/saving
- save-success
- error

Key interactions:
- Mouse: open from source entity, edit fields inline, close via close button/backdrop
- Keyboard: Enter from focused record opens; Esc closes; Tab cycles within panel

A11y requirements:
- Modal or non-modal behavior must be consistent per variant
- Focus placed on inspector heading when opened
- Focus returns to invoking element on close
- Readable section headings for fields, relations, attachments, comments, activity

Content rules:
- Long record titles wrap to two lines then truncate
- Empty subsections show explicit empty copy (no blank panes)
- Validation errors inline and summarized at top

## 6) Table Module Wrapper

Name: Record Table Module  
Where it appears: Work pane as table view instance  
What problem it solves: Spreadsheet-like browsing/editing of record datasets

Required states:
- loading
- empty
- populated
- filtered/no matches
- inline-edit mode
- error

Key interactions:
- Mouse: click cell to edit, sort headers, open record inspector
- Keyboard: arrow traversal, Enter edit, Esc cancel edit

A11y requirements:
- Header-cell association preserved
- Sort state announced for each sortable column
- Keyboard-only full operation path

Content rules:
- Column headers truncate with tooltip
- Cell overflow truncates with full content on focus/hover
- Empty table message includes next action

## 7) Kanban Module

Name: Record Kanban Module  
Where it appears: Work pane as kanban view instance  
What problem it solves: Status/group-driven visual workflow management

Required states:
- loading
- empty board
- populated board
- dragging card
- drop-confirmed
- error

Key interactions:
- Mouse: drag card between columns, click card opens inspector
- Keyboard: move card via command flow (select card, choose destination, confirm)

A11y requirements:
- Equivalent keyboard move path required
- Column headers and card counts exposed to screen readers
- Move result announcement after action

Content rules:
- Card title max two lines
- Show key metadata only (assignee/date/priority), no clutter
- Empty column copy prompts card creation

## 8) Calendar Module with Relevant/All Toggle

Name: Project Calendar Module  
Where it appears: Overview Calendar and Work Calendar module  
What problem it solves: Shared calendar view with participant relevance mode

Required states:
- loading
- mode `Relevant`
- mode `All`
- empty range
- populated
- error

Key interactions:
- Mouse: toggle mode, select event, create/edit event
- Keyboard: toggle mode control, navigate event cells/list, open event details

A11y requirements:
- Mode toggle announces selected state clearly
- Events are focusable with date/time labels
- No hidden-calendar behavior beyond explicit mode switch

Content rules:
- Display timezone context for event times
- Distinguish all-day vs timed events
- Empty state differs for Relevant vs All

## 9) Inbox Capture Module

Name: Capture Inbox Module  
Where it appears: Work pane modules  
What problem it solves: Quick thought capture and triage into structured records/doc references

Required states:
- empty
- drafting capture
- saved capture
- triage open
- converted
- archived
- error

Key interactions:
- Mouse: add capture, convert to record, attach to doc, archive
- Keyboard: submit capture with shortcut, navigate list, quick triage actions

A11y requirements:
- Input fields labeled with helper text
- Conversion result announced
- Capture list exposed as semantic list

Content rules:
- Capture preview truncates to first lines
- Conversion destinations use clear labels
- Empty copy encourages first capture action

## 10) Timeline Feed UI

Name: Timeline Feed Module  
Where it appears: Overview Timeline and optional Work timeline module  
What problem it solves: Coarse, meaningful project activity visibility

Required states:
- loading
- empty
- populated
- filtered
- pagination loading
- error

Key interactions:
- Mouse: filter chips, click item deep-link
- Keyboard: tab through filters/items, Enter opens linked object

A11y requirements:
- Timeline list with clear chronological headings
- Each item includes actor/action/time text summary
- Filter state must be screen-reader discoverable

Content rules:
- Prevent noisy micro-events in copy
- Relative time plus absolute timestamp available
- Long summaries clamp with expand affordance

## 11) Files Module UI

Name: Attachment Files Module  
Where it appears: Work pane modules and inspector attachment sections  
What problem it solves: Attach provider-backed assets to entities using reference links while Hub persists only provider metadata (no blob storage in Hub)

Required states:
- loading
- empty
- populated
- provider upload in progress
- provider upload success
- provider upload failure

Key interactions:
- Mouse: initiate provider upload flow, attach/detach asset references, open file action menu
- Keyboard: select file row, invoke actions, confirm destructive operations

A11y requirements:
- Upload progress updates in live region
- Action controls labeled by provider asset filename
- Error messages tied to related input controls

Content rules:
- Filename truncation keeps extension visible
- File size and type always visible in provider metadata row
- Empty state explains supported actions
- Hub surfaces persist only provider asset references and metadata

## 12) Asset Library UI Wrapper

Name: Asset Library Browser  
Where it appears: Tools and/or Work module embedding provider assets  
What problem it solves: Provider-backed folder/file operations inside Hub context

Required states:
- loading
- empty folder
- populated folder
- operation in progress (upload/move/rename/delete)
- permission/connection error

Key interactions:
- Mouse: open folder, upload file, rename/move/delete
- Keyboard: navigate breadcrumb/tree/list, trigger row actions

A11y requirements:
- Breadcrumb sequence readable and keyboard operable
- Folder/file rows expose item type and path context
- Connection errors announced and actionable

Content rules:
- Breadcrumb truncation preserves root and current node
- Show provider source and current root path
- Deterministic empty-state copy

## 13) Comments UI (Entity + Doc Node Anchors)

Name: Comments and Anchors System  
Where it appears: Record inspector, file detail, workspace doc anchors  
What problem it solves: Contextual discussion tied to objects or pinned doc nodes (with orphan handling when nodes are deleted)

Required states:
- loading
- empty
- open thread
- resolved thread
- reply composing
- error

Key interactions:
- Mouse: create comment, reply, resolve/reopen, jump to anchor
- Keyboard: open thread, move between comments, submit reply, resolve action

A11y requirements:
- Thread list semantics with author/time metadata
- Anchor target has descriptive jump text
- Resolve state announced immediately

Content rules:
- Preserve author attribution and timestamps
- Collapsed resolved threads show concise summary
- Empty thread prompt invites first comment

## 14) Mention UI (Autocomplete + Hover Details)

Name: Mention Composer  
Where it appears: Workspace doc and comment composer  
What problem it solves: Fast insertion of user/entity references with backlinking

Required states:
- idle
- trigger-detected
- searching
- results
- no results
- inserted

Key interactions:
- Mouse: click suggestion to insert mention
- Keyboard: ArrowUp/ArrowDown selection, Enter insert, Esc dismiss

A11y requirements:
- Combobox/listbox semantics
- Active option announcement
- Inserted mention rendered with readable accessible name

Content rules:
- Show entity type badge + primary label in results
- No-results message includes alternate action
- Mention chips truncate safely and keep unique identity

## 15) Notifications Center

Name: Notification Inbox Center  
Where it appears: Global/project notification panel  
What problem it solves: Actionable awareness of mentions, assignments, reminders, automation results

Required states:
- loading
- unread-filtered
- all notifications
- empty
- mark-read pending
- error

Key interactions:
- Mouse: open notification target, mark one/all read
- Keyboard: navigate list items, activate target, toggle read status

A11y requirements:
- Notification item exposes unread/read state textually
- Mark-read controls have explicit labels
- Focus remains stable after mutation

Content rules:
- Title + concise body + timestamp always visible
- Clamp long bodies but allow expansion in detail view
- Empty state differs by filter mode

## 16) Activity Pieces Automation Builder (UI Concept)

Name: Automation Rule Builder  
Where it appears: Tools tab automation section  
What problem it solves: Human-readable setup of trigger-condition-action automations

Required states:
- empty/no rules
- list existing rules
- create draft
- edit draft
- validation error
- disabled rule
- run history loading

Key interactions:
- Mouse: add rule, edit trigger/conditions/actions, enable/disable
- Keyboard: step through builder sections, submit/cancel, inspect run history rows

A11y requirements:
- Sectioned form with clear headings and field descriptions
- Validation errors linked to controls and summarized
- Rule status change announced

Content rules:
- Rule names required and unique per project
- Trigger/action descriptions human-readable (no raw JSON presentation by default)
- Empty history copy explains expected run behavior
