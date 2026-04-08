# VoiceOver & Screen Reader Accessibility — Codex Reference

**Purpose:** Drop this file into any Codex, Claude, or Gemini session as context so the model knows *exactly* how to code accessible UI for both Hub OS (React/web) and Living Score (SwiftUI/macOS). Every section includes the pattern name, when to use it, the correct code, and what the screen reader should announce.

---

## Table of Contents

1. [Core Principles — Read This First](#1-core-principles)
2. [WEB: ARIA Roles Reference (Hub OS)](#2-aria-roles-reference)
3. [WEB: ARIA States & Properties (Hub OS)](#3-aria-states--properties)
4. [WEB: Landmark Regions (Hub OS)](#4-landmark-regions)
5. [WEB: Live Regions & Announcements (Hub OS)](#5-live-regions--announcements)
6. [WEB: Focus Management (Hub OS)](#6-focus-management)
7. [WEB: Modal & Dialog Patterns (Hub OS)](#7-modal--dialog-patterns)
8. [WEB: Interactive Widget Patterns (Hub OS)](#8-interactive-widget-patterns)
9. [WEB: Keyboard Navigation (Hub OS)](#9-keyboard-navigation)
10. [WEB: Dynamic Content & State Changes (Hub OS)](#10-dynamic-content--state-changes)
11. [WEB: Forms & Input Patterns (Hub OS)](#11-forms--input-patterns)
12. [WEB: Heading Structure & Document Outline (Hub OS)](#12-heading-structure--document-outline)
13. [WEB: Screen-Reader-Only Utility CSS (Hub OS)](#13-screen-reader-only-utility-css)
14. [SWIFT: SwiftUI Accessibility Modifiers (Living Score)](#14-swiftui-accessibility-modifiers)
15. [SWIFT: Traits (Living Score)](#15-swiftui-traits)
16. [SWIFT: Focus Management (Living Score)](#16-swiftui-focus-management)
17. [SWIFT: Custom Rotors (Living Score)](#17-swiftui-custom-rotors)
18. [SWIFT: Custom Actions (Living Score)](#18-swiftui-custom-actions)
19. [SWIFT: Custom Content (Living Score)](#19-swiftui-custom-content)
20. [SWIFT: Grouping & Containers (Living Score)](#20-swiftui-grouping--containers)
21. [SWIFT: Announcements & Notifications (Living Score)](#21-swiftui-announcements--notifications)
22. [SWIFT: macOS-Specific Patterns (Living Score)](#22-macos-specific-patterns)
23. [Hub OS Specific Patterns](#23-hub-os-specific-patterns)
24. [Living Score Specific Patterns](#24-living-score-specific-patterns)
25. [Anti-Patterns — Never Do This](#25-anti-patterns)
26. [Testing Checklist](#26-testing-checklist)

---

## 1. Core Principles

These apply to EVERY component in both apps. AI agents must follow these before writing any UI code.

**First rule of ARIA: Don't use ARIA if a native HTML element or SwiftUI view does the job.** A `<button>` is always better than `<div role="button">`. A SwiftUI `Button` is always better than a `Text` with `.onTapGesture` and manually added traits.

**Second rule: Every interactive element must be keyboard-operable.** If you can click/tap it, you must be able to reach it with Tab/arrow keys and activate it with Enter/Space (web) or VoiceOver gestures (native).

**Third rule: Every visible state must be programmatically exposed.** If it looks selected, expanded, checked, disabled, busy, or has a count — the screen reader must know that state. Visual-only indicators are invisible to blind users.

**Fourth rule: Focus must never get lost.** When content appears, disappears, or changes, focus must land somewhere logical. Never leave focus on a removed element. Never dump focus back to the top of the page.

**Fifth rule: Reading order must match visual order.** DOM order = tab order = screen reader navigation order. CSS `order`, `position: absolute`, or SwiftUI `.zIndex` does NOT change reading order. Use actual DOM/view ordering.

---

## 2. ARIA Roles Reference

Use roles ONLY when no native HTML element has the semantics you need.

### Widget Roles (interactive)

| Role | Use When | Native Equivalent | Required Properties |
|------|----------|-------------------|---------------------|
| `button` | Clickable non-`<button>` | `<button>` | `tabindex="0"`, Enter/Space handler |
| `link` | Navigable non-`<a>` | `<a href>` | `tabindex="0"`, Enter handler |
| `checkbox` | Custom checkbox | `<input type="checkbox">` | `aria-checked` (true/false/mixed) |
| `radio` | Custom radio | `<input type="radio">` | `aria-checked`, inside `radiogroup` |
| `switch` | Toggle on/off | None | `aria-checked` |
| `slider` | Range input | `<input type="range">` | `aria-valuemin`, `aria-valuemax`, `aria-valuenow` |
| `spinbutton` | Numeric stepper | `<input type="number">` | `aria-valuemin`, `aria-valuemax`, `aria-valuenow` |
| `textbox` | Custom text input | `<input>` / `<textarea>` | Labelling via `aria-label` or `aria-labelledby` |
| `combobox` | Autocomplete/dropdown input | None | `aria-expanded`, `aria-controls`, `aria-activedescendant` |
| `listbox` | Selection list | `<select>` | Contains `option` children |
| `option` | Item inside `listbox`/`combobox` | `<option>` | `aria-selected` |
| `tab` | Tab in tablist | None | `aria-selected`, `aria-controls` |
| `tablist` | Container for tabs | None | Contains `tab` children |
| `tabpanel` | Content for a tab | None | `aria-labelledby` pointing to its `tab` |
| `menu` | Action menu (not navigation) | None | Contains `menuitem` children |
| `menuitem` | Action inside `menu` | None | In `menu` or `menubar` |
| `menuitemcheckbox` | Toggleable menu item | None | `aria-checked` |
| `menuitemradio` | Exclusive menu item | None | `aria-checked` |
| `tree` | Hierarchical list | None | Contains `treeitem` children |
| `treeitem` | Item inside `tree` | None | `aria-expanded` if has children |
| `grid` | Interactive data grid | `<table>` if non-interactive | `gridcell` children |
| `gridcell` | Cell inside `grid` | `<td>` | — |
| `progressbar` | Progress indicator | `<progress>` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| `scrollbar` | Custom scrollbar | None | `aria-valuenow`, `aria-controls` |
| `separator` | If interactive/draggable | `<hr>` if non-interactive | `aria-valuenow` if focusable |
| `toolbar` | Group of action buttons | None | Contains buttons/controls |

### Composite Roles (manage focus across children)

| Role | Pattern | Focus Behavior |
|------|---------|----------------|
| `combobox` | Input + popup list | Focus stays on input, `aria-activedescendant` tracks highlighted option |
| `grid` | 2D navigation | Arrow keys move between cells |
| `listbox` | Single/multi select list | Arrow keys move between options |
| `menu` / `menubar` | Action/navigation menus | Arrow keys navigate items |
| `radiogroup` | Exclusive selection group | Arrow keys cycle options |
| `tablist` | Tab switching | Arrow keys cycle tabs |
| `tree` | Hierarchical navigation | Arrow keys navigate + expand/collapse |
| `treegrid` | Tree + grid combo | Both arrow patterns |

### Document Structure Roles

| Role | Use When | Native Equivalent |
|------|----------|-------------------|
| `heading` | Custom heading | `<h1>` through `<h6>` (always prefer these) |
| `list` | Custom list | `<ul>` / `<ol>` |
| `listitem` | Item in custom list | `<li>` |
| `table` | Data table | `<table>` |
| `row` | Table row | `<tr>` |
| `cell` | Table cell | `<td>` |
| `rowheader` | Row header cell | `<th scope="row">` |
| `columnheader` | Column header cell | `<th scope="col">` |
| `img` | Meaningful image | `<img alt="...">` |
| `figure` | Figure with caption | `<figure>` |
| `article` | Self-contained content | `<article>` |
| `definition` | Term definition | `<dd>` |
| `term` | Defined term | `<dt>` |
| `group` | Generic grouping | `<fieldset>` for forms |
| `note` | Advisory info | `<aside>` in some contexts |
| `presentation` / `none` | Remove semantics | — |
| `tooltip` | Hover/focus tip | None |

---

## 3. ARIA States & Properties

### Global States (work on any element)

| Attribute | Values | Purpose | Hub OS Use Case |
|-----------|--------|---------|-----------------|
| `aria-label` | string | Provides accessible name | Icon-only buttons, sections needing names |
| `aria-labelledby` | ID ref(s) | Names element using visible text | Dialog titles, complex labels built from multiple elements |
| `aria-describedby` | ID ref(s) | Adds supplementary description | Form field help text, error messages |
| `aria-hidden="true"` | true/false | Hides from screen readers | Decorative icons, background visuals, inactive content behind modals |
| `aria-disabled="true"` | true/false | Marks as non-interactive | Disabled controls (use with actual disabled state for full effect) |
| `aria-live` | off/polite/assertive | Announces dynamic changes | Task completion toasts, error messages, notification badges |
| `aria-atomic` | true/false | Announce whole region or just changes | Badge counts, status messages |
| `aria-busy` | true/false | Content is loading/updating | Loading states, data fetches |
| `aria-relevant` | additions/removals/text/all | What changes trigger announcements | Chat messages (additions), notification lists |
| `aria-roledescription` | string | Custom role name | Rarely needed — overrides default role announcement |
| `aria-keyshortcuts` | string | Documents keyboard shortcut | Quick Capture shortcut |
| `aria-current` | page/step/location/date/time/true | Marks current item in a set | Current page in nav, today in calendar |
| `aria-details` | ID ref | Links to extended description | Complex charts, diagrams |
| `aria-braillelabel` | string | Braille-specific label | Use when braille output needs different text than speech |
| `aria-brailleroledescription` | string | Braille-specific role desc | Very rarely needed |

### Widget States

| Attribute | Values | Purpose | Hub OS Use Case |
|-----------|--------|---------|-----------------|
| `aria-checked` | true/false/mixed | Checkbox/radio/switch state | Task completion toggles, filter checkboxes |
| `aria-selected` | true/false | Selection state | Selected tab, selected list item, selected date |
| `aria-expanded` | true/false | Expandable section state | Subtask expansion, dropdown menus, accordion sections |
| `aria-pressed` | true/false/mixed | Toggle button state | View mode toggles (list/board), filter toggles |
| `aria-invalid` | true/false/grammar/spelling | Validation state | Form validation errors |
| `aria-required` | true/false | Required field | Required form fields |
| `aria-readonly` | true/false | Read-only state | Display-only fields |
| `aria-haspopup` | true/menu/listbox/tree/grid/dialog | Has popup | Dropdown triggers, context menus |
| `aria-activedescendant` | ID | Currently active child | Combobox highlight, listbox focus |
| `aria-controls` | ID ref(s) | What this element controls | Tab controls panel, button controls menu |
| `aria-owns` | ID ref(s) | Establishes parent-child when not in DOM tree | Portal'd dropdown lists |
| `aria-autocomplete` | none/inline/list/both | Input completion behavior | NLP command input, search |
| `aria-multiselectable` | true/false | Allows multiple selection | Multi-select lists |
| `aria-orientation` | horizontal/vertical | Widget orientation | Toolbar, slider, separator |
| `aria-sort` | ascending/descending/none/other | Column sort state | Sortable table columns |
| `aria-colcount` | integer | Total columns (when not all in DOM) | Virtual grid |
| `aria-rowcount` | integer | Total rows (when not all in DOM) | Virtual list/grid |
| `aria-colindex` | integer | Column position | Virtual grid cells |
| `aria-rowindex` | integer | Row position | Virtual list items |
| `aria-colspan` | integer | Column span | Merged cells |
| `aria-rowspan` | integer | Row span | Merged cells |
| `aria-posinset` | integer | Position in set | Item 3 of 10 |
| `aria-setsize` | integer | Total set size | 10 total items |
| `aria-valuemin` | number | Minimum value | Slider, progressbar, spinbutton |
| `aria-valuemax` | number | Maximum value | Slider, progressbar, spinbutton |
| `aria-valuenow` | number | Current value | Slider, progressbar, spinbutton |
| `aria-valuetext` | string | Human-readable value text | "3 of 5 stars", "50%" |
| `aria-errormessage` | ID ref | Points to error message element | Form field error |
| `aria-modal` | true/false | Content behind is inert | Modal dialogs |
| `aria-placeholder` | string | Placeholder text for custom inputs | Custom text inputs |

---

## 4. Landmark Regions

Landmarks let VoiceOver/NVDA users jump between major page sections. Hub OS must use these to structure its single-page app.

### HTML5 Landmark Elements (preferred over ARIA roles)

```html
<!-- Hub OS page structure -->
<header> <!-- role="banner" implied — app logo, global nav -->
  <nav aria-label="Main navigation"> <!-- must have unique label if multiple navs -->
    ...
  </nav>
</header>

<aside aria-label="Sidebar navigation"> <!-- role="complementary" -->
  <nav aria-label="Hub sections">
    ...
  </nav>
</aside>

<main> <!-- role="main" — only ONE per page -->
  <section aria-labelledby="section-heading-id"> <!-- role="region" when labelled -->
    <h2 id="section-heading-id">My Tasks</h2>
    ...
  </section>
</main>

<footer> <!-- role="contentinfo" implied -->
  ...
</footer>
```

### Rules

- Only ONE `<main>` per page.
- If you have multiple `<nav>` elements, each MUST have a unique `aria-label` (e.g., "Main navigation", "Hub sections", "Breadcrumb").
- `<section>` only becomes a landmark (`region`) when it has an accessible name via `aria-label` or `aria-labelledby`.
- `<form>` only becomes a landmark when it has an accessible name.
- Use `<aside>` for complementary content (sidebar). Must have `aria-label` if there are multiple.
- **Hub OS specifics:** The sidebar nav, main content area, Quick Capture area, and any persistent notification area should each be a distinct landmark.

---

## 5. Live Regions & Announcements

Live regions tell screen readers about dynamic content changes WITHOUT moving focus. This is critical for Hub OS because of real-time sync, task updates, reminders, and Hub Live broadcasts.

### When to Use Which Level

| Situation | `aria-live` value | Example |
|-----------|-------------------|---------|
| Non-urgent status update | `polite` | "Task saved", "3 new tasks synced" |
| Error that blocks progress | `assertive` | "Connection lost", form validation errors |
| Chat message received | `polite` | New message in Tuwunel chat |
| Reminder firing | `assertive` | "Reminder: Team standup in 5 minutes" |
| Progress update | `polite` with `aria-busy` | File upload progress |
| Content loading | `polite` with `aria-busy="true"` | Loading spinner |
| Real-time collaboration update | `polite` | "Alex completed task: Fix header" |

### The Global Announcer Pattern (Recommended for Hub OS)

Mount TWO persistent, hidden live regions at the app root. Never unmount them. Push messages into them as needed.

```tsx
// src/components/LiveAnnouncer.tsx
import { createContext, useContext, useCallback, useRef, useState } from 'react';

interface AnnouncerContextType {
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

export function LiveAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const politeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const assertiveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Toggle pattern: clear then set, so the same message announces again
  const announcePolite = useCallback((message: string) => {
    clearTimeout(politeTimeoutRef.current);
    setPoliteMessage('');
    politeTimeoutRef.current = setTimeout(() => setPoliteMessage(message), 100);
  }, []);

  const announceAssertive = useCallback((message: string) => {
    clearTimeout(assertiveTimeoutRef.current);
    setAssertiveMessage('');
    assertiveTimeoutRef.current = setTimeout(() => setAssertiveMessage(message), 100);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announcePolite, announceAssertive }}>
      {children}
      {/* These divs must NEVER be conditionally rendered. They stay mounted forever. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce() {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) throw new Error('useAnnounce must be inside LiveAnnouncerProvider');
  return ctx;
}
```

**Usage in any component:**

```tsx
function TaskItem({ task }) {
  const { announcePolite } = useAnnounce();

  const handleComplete = async () => {
    await completeTask(task.id);
    announcePolite(`Task completed: ${task.title}`);
  };

  return (
    <li>
      <button
        onClick={handleComplete}
        aria-label={`Complete task: ${task.title}`}
      >
        <span aria-hidden="true">✓</span>
      </button>
      <span>{task.title}</span>
    </li>
  );
}
```

### Local Live Regions (for component-scoped updates)

```tsx
// Inline error that appears on validation
function TaskInput() {
  const [error, setError] = useState('');

  return (
    <div>
      <label htmlFor="task-title">Task title</label>
      <input
        id="task-title"
        aria-invalid={!!error}
        aria-describedby={error ? 'task-error' : undefined}
        aria-errormessage={error ? 'task-error' : undefined}
      />
      {/* This div is always in the DOM — content changes trigger announcement */}
      <div id="task-error" role="alert" aria-live="assertive">
        {error}
      </div>
    </div>
  );
}
```

### aria-busy for Loading States

```tsx
function TaskList({ isLoading, tasks }) {
  return (
    <section
      aria-label="Your tasks"
      aria-busy={isLoading}
    >
      {isLoading ? (
        <div role="status">
          <span className="sr-only">Loading tasks…</span>
          <Spinner aria-hidden="true" />
        </div>
      ) : (
        <ul role="list">
          {tasks.map(t => <TaskItem key={t.id} task={t} />)}
        </ul>
      )}
    </section>
  );
}
```

### aria-relevant for Chat/Notification Lists

```tsx
// Chat: announce new messages (additions) but not when old ones scroll off
<div
  role="log"
  aria-label="Chat messages"
  aria-live="polite"
  aria-relevant="additions"
>
  {messages.map(msg => (
    <div key={msg.id} role="article" aria-label={`${msg.sender}: ${msg.text}`}>
      ...
    </div>
  ))}
</div>

// Notification list: announce both additions and removals
<ul
  role="list"
  aria-label="Notifications"
  aria-live="polite"
  aria-relevant="additions removals"
  aria-atomic="false"
>
  {notifications.map(n => <li key={n.id}>{n.text}</li>)}
</ul>
```

---

## 6. Focus Management

Focus management is the #1 source of screen reader accessibility bugs in SPAs. Every view transition, modal open/close, content insertion/removal, and route change must manage focus explicitly.

### Rule: When content changes, focus must go somewhere intentional

| Scenario | Where Focus Goes | How |
|----------|-----------------|-----|
| Route change / view switch | Heading of new content OR the new content container | `ref.current.focus()` on a heading with `tabindex="-1"` |
| Modal opens | First focusable element inside modal, OR the modal title | `autoFocus` on first input, or `ref.focus()` on title |
| Modal closes | Element that triggered the modal | Store `document.activeElement` before opening |
| Dropdown opens | First item in dropdown | `aria-activedescendant` or direct focus |
| Dropdown closes | The trigger button | Restore focus to trigger |
| Item deleted from list | Next item in list (or previous if last) | Calculate next sibling, focus it |
| Inline editing starts | The input field | `ref.current.focus()` |
| Inline editing ends | The element that was edited | Ref to the display element |
| Toast/notification appears | Do NOT move focus | Use `aria-live` announcement instead |
| Error appears on form submission | First invalid field | `firstInvalidField.focus()` |
| Content loads asynchronously | Do NOT move focus | Use `aria-live` + `aria-busy` |
| Tab panel switches | The tab panel content | Focus the panel with `tabindex="-1"` |
| Accordion expands | The expanded content | Focus the content area |

### Focus Trap (for modals, dialogs, drawers)

Focus must be TRAPPED inside modal dialogs. Users must not be able to Tab to content behind the modal.

```tsx
import { useRef, useEffect } from 'react';

function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
}
```

### Focus Restoration (save + return)

```tsx
function useModalFocus(isOpen: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Save whatever had focus before modal opened
      triggerRef.current = document.activeElement as HTMLElement;
      // Move focus into the modal
      contentRef.current?.focus();
    } else if (triggerRef.current) {
      // Restore focus when modal closes
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  return contentRef;
}
```

### Route Change Focus (Hub OS SPA)

```tsx
// After route change, focus the main heading
function useRouteFocus() {
  const location = useLocation();

  useEffect(() => {
    // Wait for render
    requestAnimationFrame(() => {
      const heading = document.querySelector('main h1, main h2');
      if (heading instanceof HTMLElement) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
        // Clean up tabindex after blur so it doesn't stay in tab order
        heading.addEventListener('blur', () => {
          heading.removeAttribute('tabindex');
        }, { once: true });
      }
    });
  }, [location.pathname]);
}
```

### Skip Link

```html
<!-- First element in the body, before any other content -->
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-2 focus:border">
  Skip to main content
</a>

<!-- ... header, nav, sidebar ... -->

<main id="main-content" tabindex="-1">
  ...
</main>
```

---

## 7. Modal & Dialog Patterns

### Accessible Modal Dialog (Hub OS)

```tsx
function AccessibleDialog({
  isOpen,
  onClose,
  title,
  description,
  children
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useFocusTrap(isOpen);
  const contentRef = useModalFocus(isOpen);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — clicking closes dialog */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        ref={(node) => {
          // Merge refs
          (dialogRef as any).current = node;
          (contentRef as any).current = node;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="fixed z-50 ..."
      >
        <h2 id={titleId}>{title}</h2>
        {description && <p id={descId}>{description}</p>}
        {children}
        <button onClick={onClose} aria-label="Close dialog">
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </>
  );
}
```

### Required Behaviors Checklist

- `role="dialog"` and `aria-modal="true"` on the dialog container.
- `aria-labelledby` pointing to the visible title.
- `aria-describedby` pointing to description text if present.
- Focus moves INTO dialog when it opens (first focusable element, or the dialog container with `tabindex="-1"`).
- Focus is TRAPPED inside dialog (Tab wraps around).
- Escape key closes dialog.
- Focus RETURNS to the trigger element when dialog closes.
- Content behind dialog is inert (not reachable by Tab or screen reader virtual cursor). `aria-modal="true"` handles this in modern screen readers. For older ones, add `aria-hidden="true"` to the main app container while dialog is open.
- If the dialog is a confirmation/alert dialog that requires acknowledgment, use `role="alertdialog"` instead of `role="dialog"`.

---

## 8. Interactive Widget Patterns

### Tabs (Hub OS view mode, project tabs)

```tsx
function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div>
      <div role="tablist" aria-label="View options">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              // Arrow key navigation between tabs
              if (e.key === 'ArrowRight') {
                const next = tabs[(i + 1) % tabs.length];
                document.getElementById(`tab-${next.id}`)?.focus();
                onChange(next.id);
              }
              if (e.key === 'ArrowLeft') {
                const prev = tabs[(i - 1 + tabs.length) % tabs.length];
                document.getElementById(`tab-${prev.id}`)?.focus();
                onChange(prev.id);
              }
              if (e.key === 'Home') {
                document.getElementById(`tab-${tabs[0].id}`)?.focus();
                onChange(tabs[0].id);
              }
              if (e.key === 'End') {
                document.getElementById(`tab-${tabs[tabs.length - 1].id}`)?.focus();
                onChange(tabs[tabs.length - 1].id);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          tabIndex={0}
          hidden={activeTab !== tab.id}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

**Keyboard:** Arrow Left/Right between tabs. Home/End to first/last. Tab moves to panel content. Only the active tab is in the Tab order (`tabIndex={0}`), others are `tabIndex={-1}`.

### Accordion / Expandable Sections (subtasks, collapsible groups)

```tsx
function Accordion({ items }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  return (
    <div>
      {items.map(item => {
        const isExpanded = expanded.has(item.id);
        return (
          <div key={item.id}>
            <h3>
              <button
                aria-expanded={isExpanded}
                aria-controls={`content-${item.id}`}
                onClick={() => {
                  const next = new Set(expanded);
                  isExpanded ? next.delete(item.id) : next.add(item.id);
                  setExpanded(next);
                }}
              >
                {item.title}
              </button>
            </h3>
            <div
              id={`content-${item.id}`}
              role="region"
              aria-labelledby={`heading-${item.id}`}
              hidden={!isExpanded}
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### Combobox / Autocomplete (NLP command input, search)

```tsx
function SearchCombobox({ suggestions, onSelect }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();

  return (
    <div>
      <label htmlFor="search-input">Search tasks</label>
      <div role="combobox" aria-expanded={isOpen} aria-owns={listboxId} aria-haspopup="listbox">
        <input
          id="search-input"
          type="text"
          role="searchbox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `option-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.length > 0);
            setActiveIndex(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(prev => Math.max(prev - 1, -1));
            }
            if (e.key === 'Enter' && activeIndex >= 0) {
              onSelect(suggestions[activeIndex]);
              setIsOpen(false);
            }
            if (e.key === 'Escape') {
              setIsOpen(false);
              setActiveIndex(-1);
            }
          }}
        />
      </div>
      {isOpen && (
        <ul id={listboxId} role="listbox" aria-label="Search suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onClick={() => onSelect(s)}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Key points:** Focus STAYS on the input. `aria-activedescendant` tells the screen reader which option is "focused" visually. Arrow keys move the highlight. Enter selects. Escape closes.

### Toggle Button (view mode, filters)

```tsx
<button
  aria-pressed={isListView}
  onClick={() => setIsListView(v => !v)}
>
  List view
</button>
```

VoiceOver announces: "List view, toggle button, pressed" or "List view, toggle button, not pressed."

### Tree View (project hierarchy, nested tasks)

```tsx
function TreeItem({ item, level = 1 }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-level={level}
      aria-setsize={item.siblings}
      aria-posinset={item.position}
    >
      <span
        tabIndex={0}
        onClick={() => hasChildren && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && hasChildren && !expanded) setExpanded(true);
          if (e.key === 'ArrowLeft' && expanded) setExpanded(false);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            hasChildren && setExpanded(!expanded);
          }
        }}
      >
        {item.label}
      </span>
      {hasChildren && expanded && (
        <ul role="group">
          {item.children.map(child => (
            <TreeItem key={child.id} item={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Container:
<ul role="tree" aria-label="Project tasks">
  {items.map(item => <TreeItem key={item.id} item={item} />)}
</ul>
```

---

## 9. Keyboard Navigation

### Roving Tabindex Pattern

For composite widgets (toolbars, tab lists, menu bars, grids): only ONE child is in the tab order at a time. Arrow keys move between children.

```tsx
function Toolbar({ items }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div
      role="toolbar"
      aria-label="Task actions"
      onKeyDown={(e) => {
        let next = activeIndex;
        if (e.key === 'ArrowRight') next = (activeIndex + 1) % items.length;
        if (e.key === 'ArrowLeft') next = (activeIndex - 1 + items.length) % items.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = items.length - 1;

        if (next !== activeIndex) {
          e.preventDefault();
          setActiveIndex(next);
          refs.current[next]?.focus();
        }
      }}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={el => refs.current[i] = el}
          tabIndex={i === activeIndex ? 0 : -1}
          onClick={item.action}
          aria-label={item.label}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
```

### Expected Keyboard Interactions by Widget

| Widget | Tab | Arrow Keys | Enter/Space | Escape | Home/End |
|--------|-----|------------|-------------|--------|----------|
| Button | Focuses button | — | Activates | — | — |
| Link | Focuses link | — | Enter navigates | — | — |
| Checkbox | Focuses | — | Space toggles | — | — |
| Radio group | Focuses selected | Cycles options + selects | — | — | First/last |
| Tab list | Focuses active tab | Cycles tabs | — | — | First/last tab |
| Menu | Focuses first item | Up/Down cycles | Activates item | Closes menu | First/last item |
| Combobox | Focuses input | Up/Down in listbox | Selects option | Closes listbox | — |
| Dialog | First focusable | — | — | Closes dialog | — |
| Tree | Focuses first item | Up/Down: prev/next visible. Right: expand. Left: collapse/parent | Activates | — | First/last |
| Accordion | Focuses header | Up/Down between headers | Toggles section | — | First/last header |
| Slider | Focuses thumb | Left/Right or Up/Down changes value | — | — | Min/Max |
| Grid | Focuses first cell | Arrow keys move between cells | Activates cell | — | — |

---

## 10. Dynamic Content & State Changes

### Task State Changes (Hub OS)

```tsx
function TaskRow({ task }) {
  return (
    <li
      role="listitem"
      aria-label={`${task.title}, ${task.isComplete ? 'completed' : 'pending'}, priority ${task.priority}`}
    >
      <button
        role="checkbox"
        aria-checked={task.isComplete}
        aria-label={`Mark ${task.title} as ${task.isComplete ? 'incomplete' : 'complete'}`}
        onClick={handleToggle}
      >
        <span aria-hidden="true">{task.isComplete ? '✓' : '○'}</span>
      </button>

      <span>{task.title}</span>

      {task.dueDate && (
        <time
          dateTime={task.dueDate}
          aria-label={`Due ${formatDate(task.dueDate)}`}
        >
          {formatDate(task.dueDate)}
        </time>
      )}

      {task.subtaskCount > 0 && (
        <span aria-label={`${task.completedSubtasks} of ${task.subtaskCount} subtasks complete`}>
          <span aria-hidden="true">{task.completedSubtasks}/{task.subtaskCount}</span>
        </span>
      )}
    </li>
  );
}
```

### Badge Counts and Notifications

```tsx
// Notification badge on a nav item
<a href="/notifications" aria-label={`Notifications, ${count} unread`}>
  <BellIcon aria-hidden="true" />
  {count > 0 && (
    <span aria-hidden="true" className="badge">{count}</span>
  )}
</a>

// The count is announced via the aria-label, the visual badge is aria-hidden
// to avoid double-reading.
```

### Inline Editing (Hub OS task titles)

```tsx
function InlineEdit({ value, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label="Edit task title"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(draft);
          setIsEditing(false);
          // Focus returns to display element after editing
          requestAnimationFrame(() => displayRef.current?.focus());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave(draft);
            setIsEditing(false);
            requestAnimationFrame(() => displayRef.current?.focus());
          }
          if (e.key === 'Escape') {
            setDraft(value);
            setIsEditing(false);
            requestAnimationFrame(() => displayRef.current?.focus());
          }
        }}
      />
    );
  }

  return (
    <span
      ref={displayRef}
      tabIndex={0}
      role="button"
      aria-label={`${value}, activate to edit`}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {value}
    </span>
  );
}
```

---

## 11. Forms & Input Patterns

### Label Association (always required)

```tsx
// Method 1: htmlFor (preferred)
<label htmlFor="task-name">Task name</label>
<input id="task-name" type="text" />

// Method 2: aria-label (icon-only inputs)
<input type="search" aria-label="Search tasks" />

// Method 3: aria-labelledby (complex labels from multiple elements)
<span id="prefix">Due date for</span>
<span id="task-ref">Fix Header Bug</span>
<input aria-labelledby="prefix task-ref" type="date" />
```

### Error Handling

```tsx
function FormField({ label, error, id, children }) {
  const errorId = `${id}-error`;
  const descId = `${id}-desc`;

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, {
        id,
        'aria-invalid': !!error,
        'aria-describedby': [error && errorId, descId].filter(Boolean).join(' ') || undefined,
        'aria-errormessage': error ? errorId : undefined,
      })}
      <span id={descId} className="help-text">Optional description</span>
      {/* Always in DOM; content appears/disappears */}
      <div id={errorId} role="alert" aria-live="assertive">
        {error || ''}
      </div>
    </div>
  );
}
```

### Required Fields

```tsx
<label htmlFor="email">
  Email
  <span aria-hidden="true">*</span>
</label>
<input id="email" type="email" aria-required="true" required />
```

### Fieldset Grouping (related fields)

```tsx
<fieldset>
  <legend>Priority</legend>
  <label><input type="radio" name="priority" value="high" /> High</label>
  <label><input type="radio" name="priority" value="medium" /> Medium</label>
  <label><input type="radio" name="priority" value="low" /> Low</label>
</fieldset>
```

---

## 12. Heading Structure & Document Outline

Hub OS must maintain a logical heading hierarchy on every view. VoiceOver users navigate by headings constantly.
The examples below are target semantics for view-level headings (`myHub` naming), while the current app shell keeps a separate visually hidden global `<h1>Hub workspace</h1>`.

```
h1: myHub (or current view name — ONE per page)
  h2: Today's Tasks
    h3: Project: Hub OS
    h3: Project: Living Score
  h2: Upcoming
    h3: This Week
    h3: Next Week
  h2: Completed
```

**Rules:**
- ONE `<h1>` per page/view. It's the page title.
- Never skip levels (h1 → h3 without h2).
- Heading level reflects nesting depth, NOT visual size. Use CSS for sizing.
- Every distinct section should have a heading.
- If a heading is visually hidden but structurally needed, use `sr-only` class.

---

## 13. Screen-Reader-Only Utility CSS

```css
/* Visually hidden but accessible to screen readers */
.sr-only:not(:focus):not(:active) {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

/* Use on skip links — hidden until focused */
.sr-only-focusable:focus,
.sr-only-focusable:active {
  clip: auto;
  clip-path: none;
  height: auto;
  overflow: visible;
  position: static;
  white-space: normal;
  width: auto;
}
```

**Never use `display: none` or `visibility: hidden` for content that should be read by screen readers.** Those hide from screen readers too.

---

## 14. SwiftUI Accessibility Modifiers

Complete reference for Living Score (macOS app in Swift/SwiftUI).

### Core Modifiers

| Modifier | Purpose | Example |
|----------|---------|---------|
| `.accessibilityLabel(_:)` | Sets the primary label VoiceOver reads | `.accessibilityLabel("Play button")` |
| `.accessibilityLabel(content:)` | Closure to customize/prepend to default label (iOS 18+) | `.accessibilityLabel { label in Text("Warning:"); label }` |
| `.accessibilityLabel(_:isEnabled:)` | Conditional label override | `.accessibilityLabel("Super Favorite", isEnabled: isSuperFavorite)` |
| `.accessibilityValue(_:)` | Current value of interactive element | `.accessibilityValue("\(Int(volume)) percent")` |
| `.accessibilityHint(_:)` | Describes what happens on activation (read after delay) | `.accessibilityHint("Double tap to mark as complete")` |
| `.accessibilityIdentifier(_:)` | For UI testing only (never read by VoiceOver) | `.accessibilityIdentifier("play_button")` |
| `.accessibilityHidden(_:)` | Hides from VoiceOver | `.accessibilityHidden(true)` for decorative elements |
| `.accessibilityInputLabels(_:)` | Alternative labels for Voice Control | `.accessibilityInputLabels(["Play", "Start", "Go"])` |
| `.accessibilitySortPriority(_:)` | Custom reading order (higher = read first) | `.accessibilitySortPriority(1)` |

### Element Modifiers

| Modifier | Purpose |
|----------|---------|
| `.accessibilityElement(children: .combine)` | Merges children into one VoiceOver element |
| `.accessibilityElement(children: .contain)` | Children stay separate but grouped |
| `.accessibilityElement(children: .ignore)` | Ignores children; parent is the element |

### Custom Content (AXCustomContent)

For data-rich views where you want progressive disclosure:

```swift
import Accessibility

struct NoteView: View {
    let note: Note

    var body: some View {
        VStack {
            Text(note.title)
            Text(note.subtitle)
        }
        .accessibilityLabel("\(note.title)")
        .accessibilityCustomContent("Key", note.key, importance: .high)
        .accessibilityCustomContent("Time Signature", note.timeSignature)
        .accessibilityCustomContent("Tempo", "\(note.bpm) BPM")
    }
}
```

VoiceOver reads: "Note title. Key: C Major. More content available." User can use the More Content rotor to hear time signature and tempo.

---

## 15. SwiftUI Traits

Traits tell VoiceOver what KIND of element something is and how to interact with it.

### Available Traits

| Trait | Purpose | When to Use |
|-------|---------|-------------|
| `.isButton` | Marks as a button | Custom tappable views that aren't SwiftUI `Button` |
| `.isLink` | Marks as a navigable link | Custom navigation elements |
| `.isHeader` | Marks as a section header | Dividers between content sections. VoiceOver users navigate by headers. |
| `.isSearchField` | Marks as a search field | Custom search inputs |
| `.isImage` | Marks as an image | Non-decorative images (remove for decorative) |
| `.isSelected` | Marks as currently selected | Selected tab, selected list item, active tool |
| `.isStaticText` | Marks as non-interactive text | Default for `Text` views |
| `.isSummaryElement` | Provides launch summary | Shows on app launch (like weather conditions) |
| `.isKeyboardKey` | Marks as a keyboard key | Custom keyboard/piano keys in Living Score |
| `.isToggle` | Marks as a toggle (iOS 17+) | Custom toggle controls |
| `.startsMediaSession` | Pauses VoiceOver during media | Play buttons (VoiceOver pauses so audio can play) |
| `.allowsDirectInteraction` | Bypasses VoiceOver for direct touch | Piano keys, drawing canvas — user touches directly |
| `.updatesFrequently` | Updates in real-time | Live playback position, waveform |
| `.playsSound` | Element plays a sound on activation | Sound-producing buttons |
| `.causesPageTurn` | Triggers page turn | Page navigation buttons |
| `.tabBar` | Marks as tab bar element | Custom tab bars |

### Adding and Removing Traits

```swift
// Make a tappable image behave like a button for VoiceOver
Image(systemName: isPlaying ? "pause.fill" : "play.fill")
    .onTapGesture { isPlaying.toggle() }
    .accessibilityRemoveTraits(.isImage)
    .accessibilityAddTraits(.isButton)
    .accessibilityAddTraits(isPlaying ? .startsMediaSession : [])
    .accessibilityLabel(isPlaying ? "Pause" : "Play")
    .accessibilityHint("Double tap to \(isPlaying ? "pause" : "start") playback")
    .accessibilityAction { isPlaying.toggle() }

// Mark a divider text as a header
Text("Measures 1–16")
    .accessibilityAddTraits(.isHeader)
```

---

## 16. SwiftUI Focus Management

### @AccessibilityFocusState

Controls where VoiceOver focus goes programmatically.

```swift
struct ScoreEditorView: View {
    @AccessibilityFocusState private var isMeasureFocused: Bool
    @State private var currentMeasure: Measure?

    var body: some View {
        VStack {
            MeasureView(measure: currentMeasure)
                .accessibilityFocused($isMeasureFocused)

            Button("Next Measure") {
                currentMeasure = nextMeasure()
                // Move VoiceOver focus to the new measure
                isMeasureFocused = true
            }
        }
    }
}
```

### @AccessibilityFocusState with Enum (multiple focus targets)

```swift
enum FocusTarget: Hashable {
    case title
    case key
    case tempo
    case firstMeasure
}

struct ScoreView: View {
    @AccessibilityFocusState private var focus: FocusTarget?

    var body: some View {
        VStack {
            TextField("Score title", text: $title)
                .accessibilityFocused($focus, equals: .title)

            KeyPicker(key: $key)
                .accessibilityFocused($focus, equals: .key)

            TempoSlider(bpm: $tempo)
                .accessibilityFocused($focus, equals: .tempo)

            MeasureGrid(measures: measures)
                .accessibilityFocused($focus, equals: .firstMeasure)
        }
        .onChange(of: errorField) { newValue in
            // Jump focus to the field with an error
            if let field = newValue {
                focus = field
            }
        }
    }
}
```

### Limiting to Specific Assistive Technologies

```swift
// Only activate for VoiceOver (not Switch Control)
@AccessibilityFocusState(for: .voiceOver)
private var isVoiceOverFocused: Bool

// Only activate for Switch Control
@AccessibilityFocusState(for: .switchControl)
private var isSwitchFocused: Bool
```

---

## 17. SwiftUI Custom Rotors

Rotors let VoiceOver users jump between specific elements quickly. Critical for Living Score to navigate between measures, notes, or annotations.

### Basic Rotor

```swift
struct ScoreView: View {
    let measures: [Measure]

    var body: some View {
        ScrollView {
            LazyVStack {
                ForEach(measures) { measure in
                    MeasureView(measure: measure)
                }
            }
        }
        .accessibilityRotor("Measures with errors") {
            ForEach(measures) { measure in
                if measure.hasError {
                    AccessibilityRotorEntry(
                        "Measure \(measure.number): \(measure.errorDescription)",
                        id: measure.id
                    )
                }
            }
        }
        .accessibilityRotor("Key changes") {
            ForEach(measures) { measure in
                if measure.hasKeyChange {
                    AccessibilityRotorEntry(
                        "Key change to \(measure.newKey) at measure \(measure.number)",
                        id: measure.id
                    )
                }
            }
        }
    }
}
```

### Rotor with Explicit Namespace (when items aren't in ForEach)

```swift
struct ScoreView: View {
    @Namespace private var rotorNamespace

    var body: some View {
        VStack {
            HeaderView()
            MeasureView(measure: firstMeasure)
                .accessibilityRotorEntry(id: firstMeasure.id, in: rotorNamespace)
            Divider()
            MeasureView(measure: secondMeasure)
                .accessibilityRotorEntry(id: secondMeasure.id, in: rotorNamespace)
        }
        .accessibilityRotor("Measures") {
            ForEach(allMeasures) { measure in
                AccessibilityRotorEntry(
                    "Measure \(measure.number)",
                    measure.id,
                    in: rotorNamespace
                )
            }
        }
    }
}
```

### Text Range Rotor (for text content)

```swift
TextEditor(text: $scoreNotes)
    .accessibilityRotor("Dynamics", textRanges: dynamicMarkingRanges)
    .accessibilityRotor("Tempo Changes", textRanges: tempoChangeRanges)
```

---

## 18. SwiftUI Custom Actions

Custom actions add VoiceOver-specific interaction options that appear in the Actions rotor.

```swift
struct MeasureView: View {
    let measure: Measure
    @Binding var isPlaying: Bool

    var body: some View {
        MeasureContent(measure: measure)
            .accessibilityLabel("Measure \(measure.number), \(measure.noteCount) notes, \(measure.key)")
            .accessibilityAction(named: "Play from here") {
                playFromMeasure(measure)
            }
            .accessibilityAction(named: "Insert measure before") {
                insertMeasureBefore(measure)
            }
            .accessibilityAction(named: "Delete measure") {
                deleteMeasure(measure)
            }
            .accessibilityAction(named: "Copy measure") {
                copyMeasure(measure)
            }
    }
}
```

VoiceOver users access these by swiping up/down with the Actions rotor selected.

### Drag and Drop via Custom Actions

Instead of requiring gesture-based drag and drop:

```swift
struct NoteView: View {
    let note: Note

    var body: some View {
        NoteContent(note: note)
            .accessibilityAction(named: "Move up") {
                moveNote(note, direction: .up)
            }
            .accessibilityAction(named: "Move down") {
                moveNote(note, direction: .down)
            }
            .accessibilityAction(named: "Move to measure \(note.measure + 1)") {
                moveNoteToNextMeasure(note)
            }
    }
}
```

### Drop Points (iOS 16+ / macOS 13+)

```swift
MeasureView(measure: measure)
    .onDrop(of: [.audio], delegate: delegate)
    .accessibilityDropPoint(.leading, description: "Insert before beat 1")
    .accessibilityDropPoint(.center, description: "Replace measure content")
    .accessibilityDropPoint(.trailing, description: "Insert after last beat")
```

---

## 19. SwiftUI Custom Content

For data-rich elements where not all info should be announced immediately.

```swift
import Accessibility

struct MeasureDetailView: View {
    let measure: Measure

    var body: some View {
        MeasureContent(measure: measure)
            .accessibilityLabel("Measure \(measure.number)")
            // High importance: always read with the label
            .accessibilityCustomContent("Key", measure.key, importance: .high)
            // Default importance: available via More Content rotor
            .accessibilityCustomContent("Time Signature", measure.timeSignature)
            .accessibilityCustomContent("Note Count", "\(measure.noteCount) notes")
            .accessibilityCustomContent("Dynamics", measure.dynamicMarking)
            .accessibilityCustomContent("Tempo", "\(measure.bpm) BPM")
    }
}
```

VoiceOver reads: "Measure 4. Key: G Major. More content available." Then the user can cycle through remaining properties via the More Content rotor.

---

## 20. SwiftUI Grouping & Containers

### Combining Children

```swift
// Multiple views become ONE VoiceOver element
HStack {
    Image(systemName: "music.note")
    Text("C Major")
    Text("4/4")
}
.accessibilityElement(children: .combine)
// VoiceOver reads: "music note, C Major, 4/4" as one element
```

### Containing Children (grouped but individually focusable)

```swift
VStack {
    Text("Measure 1")
    NoteView(note: note1)
    NoteView(note: note2)
}
.accessibilityElement(children: .contain)
.accessibilityLabel("Measure 1")
// VoiceOver: Focuses "Measure 1" container, then user can navigate into children
```

### Ignoring Children (replacing with custom description)

```swift
// Custom canvas drawing — children have no meaningful accessibility
Canvas { context, size in
    // ... custom drawing code ...
}
.accessibilityElement(children: .ignore)
.accessibilityLabel("Score visualization, measures 1 through 8")
.accessibilityAddTraits(.isImage)
```

---

## 21. SwiftUI Announcements & Notifications

### Post Accessibility Notification (non-focus-moving announcements)

```swift
// Announce a status change without moving focus
func announceCompletion() {
    AccessibilityNotification.Announcement("Score saved successfully")
        .post()
}

// Announce with a specific priority
func announceError() {
    AccessibilityNotification.Announcement("Error: Invalid time signature")
        .post()
}
```

### Screen Changed / Layout Changed

```swift
// Tell VoiceOver the entire screen content changed
AccessibilityNotification.ScreenChanged(newView)
    .post()

// Tell VoiceOver part of the layout changed (re-reads current area)
AccessibilityNotification.LayoutChanged(updatedElement)
    .post()
```

Use `ScreenChanged` when navigating to a completely new view. Use `LayoutChanged` when content within the current view updates (like expanding a section).

---

## 22. macOS-Specific Patterns

Living Score runs on macOS. These patterns are specific to macOS VoiceOver.

### Keyboard Shortcuts Discoverability

```swift
Button("Play") { play() }
    .keyboardShortcut(.space, modifiers: [])
    .accessibilityLabel("Play")
    .accessibilityHint("Press Space to play from current position")
    .accessibilityKeyShortcuts([.init(.space)])
```

### performEscape for dismissing views

```swift
struct SheetView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack { /* ... */ }
            .accessibilityAction(.escape) {
                dismiss()
            }
    }
}
```

### NSAccessibility Protocol (for custom AppKit views if needed)

If Living Score has any AppKit views embedded via `NSViewRepresentable`:

```swift
class CustomScoreView: NSView {
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilityLabel() -> String? { "Score editor" }
    override func accessibilityChildren() -> [Any]? {
        // Return child accessibility elements
        return measures.map { $0.accessibilityElement }
    }
    override func accessibilityPerformPress() -> Bool {
        // Handle VoiceOver activation
        return true
    }
}
```

---

## 23. Hub OS Specific Patterns

Patterns mapped to actual Hub OS features.

### Quick Capture

```tsx
<section aria-label="Quick Capture">
  <form
    role="search"
    onSubmit={handleCapture}
    aria-label="Capture new task"
  >
    <label htmlFor="quick-capture" className="sr-only">Quick capture</label>
    <input
      id="quick-capture"
      type="text"
      aria-label="Type a task, reminder, or command"
      aria-autocomplete="list"
      aria-describedby="capture-hint"
      autoFocus
    />
    <span id="capture-hint" className="sr-only">
      Press Enter to save. Natural language dates and priorities are parsed automatically.
    </span>
    <button type="submit" aria-label="Save capture">
      <SaveIcon aria-hidden="true" />
    </button>
  </form>
</section>
```

### myHub Date Bands (stream layout)

> Note: This snippet is aspirational for view-level semantics. Current implementation keeps `<main id="main-content">` plus a separate sr-only global app heading in `AppShell`.

```tsx
<main aria-label="myHub">
  <h1>myHub</h1>

  <section aria-labelledby="today-heading">
    <h2 id="today-heading">Today — March 26, 2026</h2>
    <ul role="list" aria-label="Today's tasks">
      {todayTasks.map(task => (
        <TaskRow key={task.id} task={task} />
      ))}
    </ul>
  </section>

  <section aria-labelledby="tomorrow-heading">
    <h2 id="tomorrow-heading">Tomorrow — March 27, 2026</h2>
    <ul role="list" aria-label="Tomorrow's tasks">
      ...
    </ul>
  </section>
</main>
```

### Project Lens Filter

```tsx
<div role="group" aria-label="Project filter">
  <label htmlFor="project-lens" className="sr-only">Filter by project</label>
  <select
    id="project-lens"
    aria-label="Project Lens: filter tasks by project"
    value={selectedProject}
    onChange={(e) => setSelectedProject(e.target.value)}
  >
    <option value="all">All projects</option>
    {projects.map(p => (
      <option key={p.id} value={p.id}>{p.name}</option>
    ))}
  </select>
</div>
```

### Calendar Day/Week Views

```tsx
// Day view
<div role="grid" aria-label="Thursday, March 26 schedule">
  <div role="row" aria-label="9:00 AM">
    <div role="gridcell" aria-label="9:00 AM to 10:00 AM: Team standup">
      Team standup
    </div>
  </div>
  ...
</div>

// Week view
<table role="grid" aria-label="Week of March 23–29">
  <thead>
    <tr>
      <th scope="col" aria-label="Monday, March 23">Mon 23</th>
      <th scope="col" aria-label="Tuesday, March 24" aria-current="date">Tue 24</th>
      ...
    </tr>
  </thead>
  <tbody>
    <tr aria-label="9:00 AM">
      <td role="gridcell" aria-label="Monday 9 AM: empty">...</td>
      <td role="gridcell" aria-label="Tuesday 9 AM: Team standup">...</td>
    </tr>
  </tbody>
</table>
```

### Tuwunel Chat

```tsx
<section aria-label="Chat: General">
  <h2>General</h2>

  {/* Message list */}
  <div
    role="log"
    aria-label="Chat messages"
    aria-live="polite"
    aria-relevant="additions"
    tabIndex={0}
  >
    {messages.map(msg => (
      <article
        key={msg.id}
        aria-label={`${msg.sender} said: ${msg.text}, ${formatTime(msg.timestamp)}`}
      >
        <span aria-hidden="true">{msg.sender}</span>
        <p>{msg.text}</p>
        <time aria-hidden="true" dateTime={msg.timestamp}>{formatTime(msg.timestamp)}</time>
      </article>
    ))}
  </div>

  {/* Compose */}
  <form aria-label="Send message">
    <label htmlFor="chat-input" className="sr-only">Type a message</label>
    <input id="chat-input" type="text" aria-label="Message" />
    <button type="submit" aria-label="Send">
      <SendIcon aria-hidden="true" />
    </button>
  </form>
</section>
```

### Notification / Reminder Firing

```tsx
// When a reminder fires, use the global announcer
function ReminderHandler() {
  const { announceAssertive } = useAnnounce();

  useEffect(() => {
    const unsub = onReminderFire((reminder) => {
      announceAssertive(`Reminder: ${reminder.title}`);
      // Also trigger Browser Notification API
    });
    return unsub;
  }, []);

  return null; // This component only handles announcements
}
```

### DayStrip Navigation

```tsx
<nav aria-label="Day navigation">
  <button
    aria-label="Previous day"
    onClick={goToPrevDay}
  >
    <ChevronLeft aria-hidden="true" />
  </button>

  <h2 aria-live="polite" aria-atomic="true">
    {formatDate(currentDay)}
  </h2>

  <button
    aria-label="Next day"
    onClick={goToNextDay}
  >
    <ChevronRight aria-hidden="true" />
  </button>

  <button
    aria-label="Go to today"
    aria-current={isToday ? "date" : undefined}
    onClick={goToToday}
  >
    Today
  </button>
</nav>
```

---

## 24. Living Score Specific Patterns

Patterns mapped to music notation features.

### Score Navigation

```swift
struct ScoreNavigationView: View {
    @State private var currentMeasure: Int = 1
    @AccessibilityFocusState private var focusedMeasure: Int?

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack {
                ForEach(measures) { measure in
                    MeasureView(measure: measure)
                        .accessibilityFocused($focusedMeasure, equals: measure.number)
                }
            }
        }
        .accessibilityRotor("Measures") {
            ForEach(measures) { measure in
                AccessibilityRotorEntry(
                    "Measure \(measure.number), \(measure.notesSummary)",
                    id: measure.id
                )
            }
        }
        .accessibilityRotor("Rehearsal marks") {
            ForEach(rehearsalMarks) { mark in
                AccessibilityRotorEntry(mark.label, id: mark.measureId)
            }
        }
        .accessibilityAction(named: "Go to measure") {
            // Present measure number input
        }
    }
}
```

### Note Input

```swift
struct NoteInputView: View {
    var body: some View {
        VStack {
            // Note duration selector
            HStack {
                ForEach(NoteDuration.allCases) { duration in
                    Button(action: { selectDuration(duration) }) {
                        Image(systemName: duration.iconName)
                    }
                    .accessibilityLabel(duration.accessibleName) // "Quarter note", "Half note", etc.
                    .accessibilityAddTraits(selectedDuration == duration ? .isSelected : [])
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Note duration")

            // Pitch entry — direct interaction for piano keyboard
            PianoKeyboardView()
                .accessibilityAddTraits(.allowsDirectInteraction)
                .accessibilityLabel("Piano keyboard for pitch entry")
                .accessibilityHint("Touch keys directly to enter notes")
        }
    }
}
```

### Playback Controls

```swift
struct PlaybackControls: View {
    @Binding var isPlaying: Bool
    @Binding var tempo: Int

    var body: some View {
        HStack {
            Button(action: { isPlaying.toggle() }) {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
            }
            .accessibilityLabel(isPlaying ? "Pause" : "Play")
            .accessibilityAddTraits(.startsMediaSession)

            Slider(value: Binding(
                get: { Double(tempo) },
                set: { tempo = Int($0) }
            ), in: 40...240, step: 1)
            .accessibilityLabel("Tempo")
            .accessibilityValue("\(tempo) beats per minute")
        }
    }
}
```

---

## 25. Anti-Patterns

**NEVER do any of these. AI coding agents must reject these patterns.**

### Web (Hub OS)

- NEVER use `<div>` or `<span>` as a clickable element without `role="button"`, `tabindex="0"`, and keyboard handlers. Use `<button>` instead.
- NEVER use `onClick` on a `<div>` without also handling `onKeyDown` for Enter and Space.
- NEVER use `display: none` to hide content that should still be read by screen readers. Use the `sr-only` class.
- NEVER use `outline: none` without providing an alternative visible focus indicator.
- NEVER use `tabindex` values greater than 0. Only use `0` (in tab order) or `-1` (programmatically focusable but not in tab order).
- NEVER use `aria-label` on a `<div>` or `<span>` that has no role. It's ignored by screen readers in that case.
- NEVER remove focus styles globally. Every focusable element MUST have a visible focus indicator.
- NEVER use `aria-hidden="true"` on a focusable element. It creates a confusing ghost focus.
- NEVER use a placeholder as the only label for an input.
- NEVER rely on color alone to convey information (red = error, green = success).
- NEVER auto-play audio or video without a way to pause.
- NEVER use `role="presentation"` or `role="none"` on interactive elements.
- NEVER put interactive elements inside other interactive elements (button inside a link, etc.).
- NEVER use `title` attribute as the primary accessible name — it's unreliable across screen readers.
- NEVER create custom scrolling that isn't keyboard-accessible.
- NEVER put meaningful text inside a CSS `::before` or `::after` pseudo-element — screen readers may not read it.
- NEVER use `onMouseOver` / `onMouseOut` for functionality without keyboard equivalents.
- NEVER dynamically inject content (like errors or notifications) without using `aria-live` or moving focus to it.

### Swift (Living Score)

- NEVER use `.onTapGesture` without also adding `.accessibilityAddTraits(.isButton)` and `.accessibilityAction`.
- NEVER leave an interactive `Image` with only the default `.isImage` trait.
- NEVER use `.accessibilityHidden(true)` on content that has information not available elsewhere.
- NEVER forget to add `.accessibilityLabel` to icon-only buttons and controls.
- NEVER use Canvas or custom drawing without providing accessibility elements for its content.
- NEVER change a visual state (selected, expanded, playing) without updating the corresponding accessibility trait or value.
- NEVER assume VoiceOver users can see animations or visual transitions — announce the result.
- NEVER put critical info only in `.accessibilityHint` — hints are optional and may be turned off. Put essential info in `.accessibilityLabel`.

---

## 26. Testing Checklist

Run through this for EVERY new component or view.

### Web (Hub OS) — VoiceOver on Mac

1. Turn on VoiceOver (Cmd+F5).
2. Navigate to the component using VO+Right Arrow (VO = Ctrl+Option).
3. Verify the label is read correctly and makes sense out of context.
4. Verify the role is announced (button, heading, list, etc.).
5. Verify state is announced (expanded, selected, checked, pressed, disabled, etc.).
6. Interact with the component using VO+Space (activate) or appropriate keys.
7. Verify the result is announced (state change, navigation, content update).
8. Tab through all interactive elements — verify order is logical.
9. Verify no focus traps exist (except intentional ones like modals).
10. Open the Rotor (VO+U) — verify headings, landmarks, links, and form controls are listed.
11. Navigate by landmarks — verify all major sections are reachable.
12. Navigate by headings — verify hierarchy is correct (no skipped levels).
13. Test with keyboard only (no VoiceOver) — verify everything is operable.
14. Verify focus indicators are visible on every focusable element.
15. Verify `aria-live` regions announce dynamic changes.

### macOS (Living Score) — VoiceOver

1. Turn on VoiceOver (Cmd+F5).
2. Use VO+Right/Left to navigate through all elements.
3. Verify every element has a meaningful label.
4. Verify traits match the element's behavior (button, header, etc.).
5. Use the Rotor (VO+U) — verify custom rotors appear and work.
6. Test all custom actions (VO+Cmd+\ to see actions).
7. Test keyboard shortcuts still work with VoiceOver on.
8. Verify focus management when views change.
9. Test `.accessibilityPerformEscape()` on dismissable views.
10. Verify `AccessibilityNotification` announcements fire correctly.

### Automated Testing

For Hub OS, add to CI pipeline:

```bash
# axe-core for automated ARIA validation
npx @axe-core/cli http://localhost:3000

# Or in tests:
npm install --save-dev jest-axe
```

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('TaskList has no accessibility violations', async () => {
  const { container } = render(<TaskList tasks={mockTasks} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

For Living Score, use Xcode Accessibility Inspector and the Accessibility Audit feature.

---

## Quick Reference Card

### Before Writing Any UI Code, Verify:

1. Is there a native HTML element / SwiftUI view that does this? USE IT.
2. Does every interactive element have a visible focus indicator?
3. Does every interactive element have an accessible name (label)?
4. Does every state change update ARIA attributes / SwiftUI traits?
5. When content changes dynamically, does focus go somewhere logical?
6. When content changes dynamically, is there a live region announcement?
7. Is heading structure logical and complete?
8. Can the entire UI be operated without a mouse/trackpad?

---

*Generated: 2026-03-26. Sources: Apple Developer Documentation (VoiceOver, SwiftUI Accessibility Modifiers, AccessibilityTraits, WWDC21/24 sessions), W3C WAI-ARIA 1.2, MDN Web Docs (ARIA Roles, States, Properties, Live Regions), ARIA Authoring Practices Guide, React Accessibility documentation.*
