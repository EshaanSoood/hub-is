# Designer Handoff — Plain English Reference
Date: 2026-03-04
System: Eshaan OS Hub — Project Space UI

This document describes every component in plain language. For the actual code, see designer-handoff-master.md.

---

## 1 — Pane Switcher

This is the row of dots that sits just below the Work tab, letting you switch between your different work panes. Each pane is represented as a small dot. When a pane is inactive the dot is small and grey. When it's active it gets a pink double-ring glow. If you hover over a dot and hold for a third of a second, it expands to show the pane's number and name — the delay is intentional so accidental hovers don't constantly trigger it.

You can drag the dots to reorder your panes. Keyboard users can move between dots with arrow keys and reorder with Ctrl+Arrow.

If you opened a pane by clicking its pinned shortcut in the top navigation, the switcher hides itself by default since you already know which pane you're in. There's always a way to bring it back via keyboard even when hidden.

---

## 2 — Module Grid

This is the layout container that holds all the modules inside a pane. It's a 12-column grid. Modules come in three sizes: small (3 columns), medium (6 columns), and large (9 columns). You can have a maximum of six modules per pane — the add button disappears once you hit that limit and a small counter shows how full the pane is.

Each module sits in a card with a slightly elevated background. When you hover over a card a remove button appears. Clicking remove opens a confirmation dialog before anything is deleted. If a row of modules doesn't fill all 12 columns, ghost placeholders fill the remaining space invisibly so the grid doesn't look broken.

Nothing in this grid or any of its parents should ever clip its overflow — popovers that open inside modules need to be able to escape their container.

---

## 3 — Mention UI

When you type @ in any text area in the app — a document, a comment box, anywhere — a small dropdown appears just below your cursor. It shows a filtered list of people, tasks, events, and files you can mention. Each result shows what type of thing it is on the left and its name on the right.

You can keep typing to filter the list. Arrow keys move through the options, Enter inserts the mention, Escape closes the dropdown, and deleting back to nothing also closes it. The active option gets a faint pink background tint.

When you insert a mention it becomes a small inline chip — a non-editable tag that sits in your text. You can delete it as a single unit by pressing Backspace.

If nothing matches your search, the dropdown shows "No matches" and nothing else — no buttons, no suggestions.

---

## 4 — Comments UI

Comments can be attached to any record (a task, an event, a file) or anchored to a range of text inside a document.

**The indicator on the record:** A small speech bubble icon appears on any record that has comments. If there are unread comments, a bright pink dot with a double ring sits on the icon — the ring creates a gap between the dot and whatever background it sits on, making it visible in both light and dark mode regardless of what's behind it. Once you've read all comments the dot disappears and only the quiet grey icon remains. If there are no comments at all, the icon is hidden entirely and only appears when you hover.

**Opening a thread:** Clicking the icon opens the comment thread. Each comment shows the author's avatar, their name, the message, and a relative timestamp ("2h ago") with the exact time available on hover.

**Replies:** Replies are hidden by default. If a comment has replies, a small "x replies" text link appears beneath it. Clicking it expands all the replies inline, indented with a subtle left border. There's no nesting beyond one level.

**Resolving:** Hovering the first message in a thread reveals a resolve button. Resolving collapses the thread to a single summary line showing who resolved it and when. You can reopen a resolved thread by hovering it and clicking reopen.

**Writing a comment:** A single-line text input lives below each thread. It expands as you type. Press Enter to send, Shift+Enter for a new line, Escape to close if it's empty. You can use @ to mention people or records.

---

## 5 — Notifications Center

A panel that slides up from the bell icon in the bottom toolbar. It shows you activity from across the app — mentions, task assignments, project updates.

**Opening it:** Click the bell. If you have unread notifications the bell has the same double-ring pink dot as the comment indicator. Click anywhere outside the panel or press Escape to close it.

**Filtering:** Three ways to filter — Unread, All, and by a specific project. The project dropdown lets you focus on one project's activity. When there are unread notifications a quiet "Mark all read" button appears at the right of the filter bar.

**Each notification:** Shows an avatar or icon, a one-line summary, a short two-line body, and a relative timestamp. Unread notifications have a very faint pink background tint — just enough to distinguish them without being loud. Hovering reveals two action buttons: one to mark it as read, one to add it to your reminders (the destination for reminders is handled in code separately). Clicking anywhere else on the row navigates to the thing that triggered the notification.

**Empty states:** If Unread is empty it says "You're all caught up." If All is empty it says "No notifications yet." Both are quiet, centered, no buttons.

The panel only shows meaningful events — no noise from minor interactions.

---

## 6 — AppShell

The outer frame of the entire app. The only persistent element is a single toolbar fixed to the bottom of the screen. Everything else — every project, pane, module, document — renders above it.

**The toolbar contains five things, left to right:**

**Home button and breadcrumb:** A small house icon on the far left. Click it to go home. Beside it is a quiet trail of muted text showing where you are — "Projects › Eshaan OS › Work › Pane 1" — derived from the current route, not interactive.

**Quick Nav:** A compact button that opens a popover above the toolbar. Inside is a search input and a list of recent and pinned locations. The clever part: if you open Quick Nav but don't click into its search box, your cursor in whatever you were editing stays exactly where it was. You can just start typing and the list filters in real time — you never have to click the search box first. Arrow keys move through results, Enter navigates, Escape closes and returns focus exactly where you left off.

**Search:** A global search bar in the center of the toolbar. Searches across projects, tasks, files, and people. The scope can be configured contextually in code.

**Contextual quick-add:** A small plus button. Single click instantly drops a capture into your inbox — no friction, no options. Right-click reveals 2–4 context-sensitive options depending on where you are — on a document you might see "Add reminder" or "Add task to this project", on the calendar you might see "Add event". The default is always inbox. Note for implementation: check that Safari doesn't intercept the right-click before shipping — if it does, fall back to a small chevron beside the button.

**Notifications bell:** See section 5.

**Profile avatar:** Your profile picture on the far right. Clicking it opens a small popover showing your name, email, profile picture, a Settings option (deferred), and Log out.

The toolbar never scrolls away. The main content area above it is the only thing that scrolls. Nothing in the shell ever clips its overflow.

---

## 7 — ProjectSpace Header

Already fully built as TopNavTabs in the original contracts. A few additions:

When you have pinned panes, their shortcuts appear in the top navigation rail between the Work and Tools tabs. They look like regular tabs but have a small filled dot beneath their label to signal they're pinned shortcuts rather than primary tabs.

If you have no pinned panes, the rail just shows Overview, Work, and Tools — no placeholder, no empty space.

The active tab always has a proper accessibility marker so screen readers know which one is current. On narrow screens the project title can wrap to two lines before truncating — hovering it shows the full title.

---

## 8 — Record Inspector

The panel that slides in from the right when you click on any record anywhere in the app — a task, an event, a file, anything. The idea is Clippy-esque: a smart panel that peeks in from the side without taking you anywhere. You stay in context, the inspector layers on top.

**Opening and closing:** It slides in with a smooth animation. A semi-transparent overlay covers the rest of the screen — clicking it closes the inspector. Escape also closes it. When it opens, focus shifts immediately to the top of the panel so screen readers can navigate it naturally from the beginning.

**What's inside, top to bottom:**
A close button top-right, and if you navigated to a related record, a back button top-left. A saving indicator that shows "Saving…" and then "Saved" briefly when you make changes. The record title — click it to edit inline. A small type label beneath the title ("Task", "Event", "File") — not editable. Then the record's fields as label-value pairs — click any value to edit it, empty fields show a placeholder that becomes an input on click. Below that, related records you can click to navigate to, the full comment thread, and finally a read-only activity log at the bottom.

**Editing:** Everything is click-to-edit with no mode switching. Click a field, type, press Enter or Tab to confirm, Escape to cancel.

**Navigating relations:** Clicking a related record replaces the current inspector with that record and shows a back button. One level of back only — no deep navigation stack.

---

## 9 — Timeline Feed

A chronological read-only log of everything meaningful that's happened on a project. Lives in the Overview Timeline tab and optionally as a Work pane module.

**What it looks like:** A vertical thread with a continuous line running down the left side. Each event has a colored dot on the line — task dots use the priority color system, everything else uses the category color palette. The line between dots breaks after the last item in each date group.

**Date groups:** Events are clustered by date under sticky headers that stay pinned as you scroll through each day's events.

**Each event row:** A small type label on the left, the event description beside it, and a relative timestamp on the right. If the event is linked to a real record, the description is a clickable link that opens the Record Inspector. The only plain unclickable text entries are system-generated ones with no underlying record, like "Project created."

**Filters:** A row of chips above the feed lets you filter by type — Tasks, Events, Milestones, Files, Workspace.

**Can't be empty:** The first entry is always "Project started."

**Loading more:** Older events load via a quiet "Load earlier" link at the bottom. The feed never auto-refreshes while you're reading.

---

## 10 — Calendar Module

A project calendar showing events across collaborators. Lives in the Overview Calendar tab and as a Work pane module.

**The chip bar at the top:** Sits above the grid and scrolls horizontally if needed — never wraps. From left to right: a Relevant/All scope toggle, time view chips (Month/Year/Week/Day), collaborator chips in their respective colors, category chips in their respective colors, and a timezone indicator at the far right.

**Relevant vs All:** The most important control. Relevant shows only your events, All shows everyone's. The empty state message differs between modes.

**Month view (default):** A 7-column grid, one column per day of the week. Each day is a slightly elevated card — the small gap between cards is the base surface color showing through, which creates visual separation without any lines or borders. Today's card has a faint pink tint and pink border, with a filled pink circle behind the day number. Days from outside the current month are faded to near-invisible.

Events inside each cell are small chips with a colored left border and a subtle color tint fill. Timed events show the start time before the name. If more than 3 events exist in a cell, the rest collapse to a "+N more" link that opens a small popover.

**Year view:** 12 mini-month blocks. No labels — just small colored dots on days that have events. Clicking a month zooms in.

**Week and Day views:** Not built yet. Both show a centered placeholder message — intentionally stubbed. When they're built they'll use the same elevated-cell language. Event chips that span multiple hours will naturally cover the gaps between hour slots without any special handling needed.
