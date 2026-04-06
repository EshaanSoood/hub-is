# Collab Session Manager Notes

The main future watchpoint for workspace-doc collaboration is
[`src/features/notes/collabSessionManager.ts`](/Users/eshaansood/hub-os/src/features/notes/collabSessionManager.ts).

Why:

- The app now reuses one Hocuspocus provider and one `Y.Doc` per room.
- Both our session manager and Lexical's collaboration plugin can call `provider.connect()`.
- Without an idempotent guard, a second `connect()` during `CONNECTING` causes Hocuspocus to call `cleanupWebSocket()` and close the still-opening socket.
- In the browser this shows up as:
  `WebSocket connection to 'wss://collab.eshaansood.org/' failed: WebSocket is closed before the connection is established.`

Current mitigation:

- `ManagedLexicalHocuspocusProvider.connect()` treats websocket status
  `connecting` and `connected` as no-op states.
- This is implemented only in our wrapper code. We did not patch Hocuspocus or Lexical directly.

What to re-check later:

- If `@hocuspocus/provider` is upgraded, verify that `configuration.websocketProvider.status`
  still exists and still uses the same status values.
- If another editor surface or collab hook is added, make sure it does not introduce another
  duplicate `connect()` path on the shared provider.
- If collab warning spam returns, rerun
  [`scripts/diagnose-workspace-doc-persistence.mjs`](/Users/eshaansood/hub-os/scripts/diagnose-workspace-doc-persistence.mjs),
  which now captures browser-side WebSocket constructor and `close()` stacks.
