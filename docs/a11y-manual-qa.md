# Manual a11y QA Checklist

Use this runbook for lightweight manual verification. Capture pass/fail notes with browser, OS, and screen reader used.

## Keyboard-Only Flows

- Login flow: tab through username/password/sign-in controls, submit, and verify focus lands on the first meaningful element on the projects page.
- Projects page: move through project cards/rows and open a project without using a mouse.
- Project page: tab through top-level actions, tabs, and panel controls; verify each interactive element is reachable and activatable with Enter/Space.
- Notes editor flow: open a note, move into editor, type, save, and return to navigation controls without focus traps.

## Focus Management

- Modal open: opening any dialog moves focus into the dialog heading or first actionable control.
- Modal close: closing by Escape and close button returns focus to the trigger element.
- Toasts/inline alerts: appearance of success/error toasts does not steal keyboard focus from active work unless it is a blocking error state.

## Live Announcements (ARIA)

- Error events announce an understandable message once (no duplicate chatter).
- Save completion announces a short success state (for example, "saved").
- Copy actions announce a short success state (for example, "copied").
- Announcements should be timely and not require manual focus movement to be heard.

## Landmarks and Skip Link

- Verify screen reader landmark navigation exposes main regions (for example: banner/header, main, navigation).
- Verify skip link is present on initial tab and moves focus directly to main content.
- Confirm page title/heading context changes when navigating from projects list to a project detail page.

## Lexical Editor Screen Reader Checks

- Entering the editor provides a clear editable region announcement.
- Typing basic text is announced normally without repeated or stale output.
- Cursor movement by character/word/line is announced accurately.
- Basic formatting shortcuts used by the UI (if enabled) do not break announcement flow.
- Exiting editor back to toolbar/panels is possible with keyboard only and without focus loss.
