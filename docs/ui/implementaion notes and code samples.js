import { useState } from "react";

const PINNED_PANES = [
  { id: "inbox",    label: "Inbox" },
  { id: "calendar", label: "Calendar" },
  { id: "tasks",    label: "Tasks" },
  { id: "notes",    label: "Notes" },
  { id: "docs",     label: "Docs" },
  { id: "crm",      label: "CRM" },
];

function Tab({ label, isActive, isAnchorLeft, isAnchorRight, onClick }) {
  const anchorStyles = isAnchorLeft
    ? { position: "sticky", left: 0, zIndex: 20, backgroundColor: "var(--color-surface)" }
    : isAnchorRight
    ? { position: "sticky", right: 0, zIndex: 20, backgroundColor: "var(--color-surface)" }
    : {};

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      style={{
        fontFamily: "var(--font-heading)",
        fontSize:   "0.875rem",
        fontWeight: 500,
        flexShrink: 0,
        cursor:     "pointer",
        border:     "none",
        background: "transparent",
        padding:    "0.5rem 1.5rem 0.75rem",
        transition: "color 0.15s ease",
        position:   "relative",
        outline:    "none",
        ...(isActive ? {
          backgroundColor: "var(--color-elevated)",
          color:           "var(--color-primary)",
          borderRadius:    "var(--radius-panel) var(--radius-panel) 0 0",
          border:          "1px solid var(--color-border-subtle)",
          borderBottom:    "1px solid transparent",
          top:             "1px",
          zIndex:          30,
        } : {
          color: "var(--color-muted)",
        }),
        ...anchorStyles,
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--color-text)"; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--color-muted)"; }}PaneSwitcher — Visual Code
import { useState } from "react";

// Replace with your real pane data passed as props
const DEMO_PANES = [
  { id: "inbox",    label: "Inbox",    shortcutNumber: 1 },
  { id: "calendar", label: "Calendar", shortcutNumber: 2 },
  { id: "tasks",    label: "Tasks",    shortcutNumber: 3 },
  { id: "notes",    label: "Notes",    shortcutNumber: 4 },
  { id: "docs",     label: "Docs",     shortcutNumber: 5 },
];

function PaneDot({ pane, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      aria-label={`${pane.label}, pane ${pane.shortcutNumber}`}
      aria-pressed={isActive}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        setHovered(true);
        e.currentTarget.style.outline = "2px solid var(--color-primary)";
        e.currentTarget.style.outlineOffset = "3px";
      }}
      onBlur={(e) => {
        setHovered(false);
        e.currentTarget.style.outline = "none";
      }}
      style={{
        position:        "relative",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        background:      "none",
        border:          "none",
        cursor:          "pointer",
        padding:         "6px",
        borderRadius:    "var(--radius-control)",
        outline:         "none",
        // The zoom and label reveal are driven by CSS transition-delay
        // so a quick accidental mouse-over won't trigger the expansion
      }}
    >
      {/* The dot itself */}
      <span
        style={{
          display:         "block",
          width:           hovered ? "auto" : "7px",
          height:          hovered ? "auto" : "7px",
          minWidth:        hovered ? "unset" : "7px",
          borderRadius:    hovered ? "var(--radius-control)" : "50%",
          backgroundColor: isActive
            ? "var(--color-primary)"
            : hovered
            ? "var(--color-text)"
            : "var(--color-muted)",
          boxShadow: isActive && !hovered
            ? "0 0 0 2px var(--color-surface), 0 0 0 3.5px var(--color-primary)"
            : "none",
          padding:         hovered ? "0.25rem 0.625rem" : "0",
          fontFamily:      "var(--font-body)",
          fontSize:        "0.7rem",
          fontWeight:      500,
          color:           isActive ? "var(--color-on-primary)" : "var(--color-surface)",
          whiteSpace:      "nowrap",
          overflow:        "hidden",
          maxWidth:        hovered ? "120px" : "7px",
          // Transition everything EXCEPT the delay — the delay on max-width
          // means a fast mouse-over won't trigger the zoom
          transition: [
            "max-width 0.2s ease 0.35s",
            "width 0.2s ease 0.35s",
            "height 0.2s ease 0.35s",
            "border-radius 0.15s ease 0.35s",
            "padding 0.2s ease 0.35s",
            "background-color 0.15s ease",
            "box-shadow 0.15s ease",
            "color 0.15s ease 0.35s",
          ].join(", "),
        }}
      >
        {hovered && (
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ opacity: 0.5, fontSize: "0.6rem" }}>{pane.shortcutNumber}</span>
            {pane.label}
          </span>
        )}
      </span>
    </button>
  );
}

export default function PaneSwitcher({ panes = DEMO_PANES, activePaneId, onPaneChange }) {
  return (
    <div
      role="toolbar"
      aria-label="Open panes"
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            "2px",
        padding:        "4px 8px",
        // Sits flush under the Work tab area, no heavy chrome
        backgroundColor: "transparent",
      }}
    >
      {panes.map((pane) => (
        <PaneDot
          key={pane.id}
          pane={pane}
          isActive={pane.id === activePaneId}
          onClick={() => onPaneChange?.(pane.id)}
        />
      ))}
    </div>
  );
}
Implementation notes for the programmer:
	•	State: activePaneId and onPaneChange are props — parent owns pane state. The hovered state per dot is purely local and visual.
	•	Hover delay: The 0.35s transition-delay on max-width, padding, border-radius and color is intentional — it prevents the zoom triggering on accidental mouse-overs while still feeling snappy on a deliberate hover. Tune this value if needed.
	•	Modifier + number shortcut: Wire ⌘+number (or Ctrl+number) at the app level using a keydown listener, not inside this component. Map the number to the pane's shortcutNumber field and call onPaneChange directly.
	•	Drag to reorder: Recommend dnd-kit (@dnd-kit/core + @dnd-kit/sortable). It has first-class React support, is actively maintained, and handles touch and pointer events cleanly. Wrap this component's pane list in a <SortableContext> with a horizontal strategy. The dots are small so consider making the entire dot the drag handle rather than a separate affordance.
	•	VoiceOver / Safari keyboard shortcuts: The modifier+number shortcut approach is a known minefield on 



Addition to PaneSwitcher implementation notes:
	•	VoiceOver-safe keyboard pattern: Use role="toolbar" on the pane strip. When a VoiceOver user enters interaction mode (VO+Shift+Down), VoiceOver steps back and lets the app own the keyboard. Inside that context wire: Left/Right Arrow to move focus between panes, Ctrl+Left / Ctrl+Right to reorder the focused pane one position, and Ctrl+Shift+Number to quick-switch to a pane by index. This 



PaneHeaderControls — Visual Code
import { useState } from "react";

// ── Icon primitives (inline SVG to avoid icon-lib dependency) ─────────────────

function PinIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}

function FocusIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r={active ? "4" : "2"} fill={active ? "currentColor" : "none"} />
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill="var(--color-surface)" />
      <circle cx="16" cy="12" r="2" fill="var(--color-surface)" />
      <circle cx="10" cy="18" r="2" fill="var(--color-surface)" />
    </svg>
  );
}

// ── Shared small icon button ──────────────────────────────────────────────────

function IconButton({ onClick, active, disabled, "aria-label": ariaLabel, "aria-pressed": ariaPressed, "aria-expanded": ariaExpanded, children }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
      onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
      style={{
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        width:           "28px",
        height:          "28px",
        borderRadius:    "var(--radius-control)",
        border:          active
                           ? "1px solid var(--color-primary)"
                           : "1px solid transparent",
        backgroundColor: active
                           ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                           : hovered
                           ? "var(--color-surface-elevated)"
                           : "transparent",
        color:           active
                           ? "var(--color-primary)"
                           : hovered
                           ? "var(--color-text)"
                           : "var(--color-muted)",
        cursor:          disabled ? "not-allowed" : "pointer",
        opacity:         disabled ? 0.4 : 1,
        transition:      "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease",
        outline:         "none",
        flexShrink:      0,
      }}
    >
      {children}
    </button>
  );
}

// ── Popover contents: audience selector + region toggles ─────────────────────

const AUDIENCES   = ["Everyone", "Team", "Private"];
const REGIONS     = ["NA", "EU", "APAC", "LATAM"];

function ConfigPopover({ audience, onAudienceChange, activeRegions, onRegionToggle }) {
  return (
    <div
      role="dialog"
      aria-label="Pane configuration"
      style={{
        position:        "absolute",
        top:             "calc(100% + 6px)",
        right:           0,
        zIndex:          50,
        backgroundColor: "var(--color-surface-elevated)",
        border:          "1px solid var(--color-border-subtle)",
        borderRadius:    "var(--radius-panel)",
        padding:         "0.75rem",
        minWidth:        "220px",
        boxShadow:       "0 4px 16px rgb(0 0 0 / 0.2)",
        display:         "flex",
        flexDirection:   "column",
        gap:             "0.75rem",
      }}
    >
      {/* Audience selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", fontWeight: 500, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Audience
        </span>
        <div role="group" aria-label="Audience" style={{ display: "flex", gap: "0.375rem" }}>
          {AUDIENCES.map((a) => {
            const selected = audience === a;
            return (
              <button
                key={a}
                aria-pressed={selected}
                onClick={() => onAudienceChange?.(a)}
                onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
                onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
                style={{
                  flex:            1,
                  padding:         "0.25rem 0",
                  fontFamily:      "var(--font-body)",
                  fontSize:        "0.72rem",
                  fontWeight:      selected ? 600 : 400,
                  borderRadius:    "var(--radius-control)",
                  border:          selected ? "1px solid var(--color-primary)" : "1px solid var(--color-border-subtle)",
                  backgroundColor: selected ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
                  color:           selected ? "var(--color-primary)" : "var(--color-muted)",
                  cursor:          "pointer",
                  transition:      "all 0.15s ease",
                  outline:         "none",
                }}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {/* Region toggles */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", fontWeight: 500, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Regions
        </span>
        <div role="group" aria-label="Regions" style={{ display: "flex", gap: "0.375rem" }}>
          {REGIONS.map((r) => {
            const active = activeRegions?.includes(r);
            return (
              <button
                key={r}
                aria-pressed={active}
                onClick={() => onRegionToggle?.(r)}
                onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
                onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
                style={{
                  flex:            1,
                  padding:         "0.25rem 0",
                  fontFamily:      "var(--font-body)",
                  fontSize:        "0.72rem",
                  fontWeight:      active ? 600 : 400,
                  borderRadius:    "var(--radius-control)",
                  border:          active ? "1px solid var(--color-primary)" : "1px solid var(--color-border-subtle)",
                  backgroundColor: active ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
                  color:           active ? "var(--color-primary)" : "var(--color-muted)",
                  cursor:          "pointer",
                  transition:      "all 0.15s ease",
                  outline:         "none",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PaneHeaderControls({
  paneName       = "Untitled Pane",
  onRename,
  isPinned       = false,
  onPinToggle,
  isFocusMode    = false,
  onFocusToggle,
  audience       = "Everyone",
  onAudienceChange,
  activeRegions  = ["NA"],
  onRegionToggle,
  disabled       = false,
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             "0.5rem",
        padding:         "0.375rem 0.75rem",
        backgroundColor: "var(--color-surface-elevated)",
        borderBottom:    "1px solid var(--color-border-subtle)",
        position:        "relative",
        minHeight:       "40px",
      }}
    >
      {/* Rename input — takes remaining space */}
      <input
        type="text"
        defaultValue={paneName}
        disabled={disabled}
        aria-label="Pane name"
        onChange={(e) => onRename?.(e.target.value)}
        onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
        onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
        style={{
          flex:            1,
          minWidth:        0,
          fontFamily:      "var(--font-heading)",
          fontSize:        "0.875rem",
          fontWeight:      600,
          color:           disabled ? "var(--color-muted)" : "var(--color-text)",
          backgroundColor: "transparent",
          border:          "1px solid transparent",
          borderRadius:    "var(--radius-control)",
          padding:         "0.25rem 0.375rem",
          outline:         "none",
          transition:      "box-shadow 0.15s ease, border-color 0.15s ease",
          opacity:         disabled ? 0.4 : 1,
          cursor:          disabled ? "not-allowed" : "text",
        }}
      />

      {/* Right-side controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>

        {/* Config popover trigger */}
        <div style={{ position: "relative" }}>
          <IconButton
            aria-label="Pane configuration"
            aria-expanded={popoverOpen}
            active={popoverOpen}
            disabled={disabled}
            onClick={() => setPopoverOpen((v) => !v)}
          >
            <TuneIcon />
          </IconButton>

          {popoverOpen && (
            <ConfigPopover
              audience={audience}
              onAudienceChange={onAudienceChange}
              activeRegions={activeRegions}
              onRegionToggle={onRegionToggle}
            />
          )}
        </div>

        {/* Thin divider */}
        <span style={{ width: "1px", height: "16px", backgroundColor: "var(--color-border-subtle)", flexShrink: 0 }} />

        {/* Pin */}
        <IconButton
          aria-label={isPinned ? "Unpin pane" : "Pin pane"}
          aria-pressed={isPinned}
          active={isPinned}
          disabled={disabled}
          onClick={onPinToggle}
        >
          <PinIcon filled={isPinned} />
        </IconButton>

        {/* Focus mode */}
        <IconButton
          aria-label={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
          aria-pressed={isFocusMode}
          active={isFocusMode}
          disabled={disabled}
          onClick={onFocusToggle}
        >
          <FocusIcon active={isFocusMode} />
        </IconButton>

      </div>
    </div>
  );
}
Implementation notes for the programmer:
	•	This component is fully stateless except for popoverOpen which is local visual state. All other values (isPinned, isFocusMode, audience, activeRegions, paneName) are props owned by the parent.
	•	The popover has no outside-click-to-dismiss logic here — add a useEffect with a mousedown listener on document that calls setPopoverOpen(false) when the click target is outside the popover and trigger button. Also close on Escapekeydown.
	•	The popover uses position: absolute anchored to its nearest relative parent — make sure no ancestor above PaneHeaderControls has overflow: hidden set or the popover will be clipped.
	•	onRename fires on every keystroke via onChange. If you want debounced save behaviour, wrap the handler in a debounce (300–500ms) at the call site rather than inside this component.
	•	The disabled prop cascades opacity and cursor: not-allowed to all controls simultaneously — useful for locked or read-only panes.
	•	color-mix(in srgb, ...) is used for the active tint backgrounds. This is supported in all modern browsers but if you need to support older targets replace it with a hardcoded rgba value derived from your primary token.

Module System — Visual Code
import { useState } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMN_SPAN = { S: 3, M: 6, L: 9 };
const MIN_HEIGHT  = { S: "180px", M: "240px", L: "320px" };
const MAX_MODULES = 8;
const TOTAL_COLS  = 12;

// Accent dot colors per module type — extend as needed
const MODULE_TYPE_COLORS = {
  calendar:  "#7EB8F7",
  tasks:     "#F7A07E",
  notes:     "#A8E6CF",
  metrics:   "#F7D07E",
  docs:      "#C3A8F7",
  feed:      "#F7A8D0",
};

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_MODULES = [
  { id: "m1", label: "Calendar",  type: "calendar",  size: "L" },
  { id: "m2", label: "Tasks",     type: "tasks",     size: "M" },
  { id: "m3", label: "Notes",     type: "notes",     size: "S" },
  { id: "m4", label: "Metrics",   type: "metrics",   size: "M" },
  { id: "m5", label: "Docs",      type: "docs",      size: "S" },
];

// ── Confirmation Dialog ───────────────────────────────────────────────────────

function DeleteConfirmDialog({ moduleName, onConfirm, onCancel }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${moduleName}`}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          100,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        backgroundColor: "var(--color-overlay)",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface-elevated)",
          border:          "1px solid var(--color-border-subtle)",
          borderRadius:    "var(--radius-panel)",
          padding:         "1.5rem",
          width:           "320px",
          display:         "flex",
          flexDirection:   "column",
          gap:             "1rem",
          boxShadow:       "0 8px 32px rgb(0 0 0 / 0.3)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700, color: "var(--color-text)" }}>
            Delete {moduleName}?
          </span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: "var(--color-muted)", lineHeight: 1.5 }}>
            This will permanently remove the module and its configuration. This cannot be undone.
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.8rem",
              fontWeight:      500,
              padding:         "0.375rem 0.875rem",
              borderRadius:    "var(--radius-control)",
              border:          "1px solid var(--color-border-subtle)",
              backgroundColor: "transparent",
              color:           "var(--color-muted)",
              cursor:          "pointer",
              outline:         "none",
              transition:      "color 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted)"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            autoFocus
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-danger)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.8rem",
              fontWeight:      600,
              padding:         "0.375rem 0.875rem",
              borderRadius:    "var(--radius-control)",
              border:          "1px solid var(--color-danger)",
              backgroundColor: "var(--color-danger-subtle)",
              color:           "var(--color-danger)",
              cursor:          "pointer",
              outline:         "none",
              transition:      "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--color-danger) 22%, transparent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-danger-subtle)"; }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Module Card ───────────────────────────────────────────────────────────────

function ModuleCard({ module, onDeleteRequest }) {
  const [hovered, setHovered] = useState(false);
  const accentColor = MODULE_TYPE_COLORS[module.type] ?? "var(--color-muted)";
  const colSpan     = COLUMN_SPAN[module.size];
  const minHeight   = MIN_HEIGHT[module.size];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn:      `span ${colSpan}`,
        minHeight,
        backgroundColor: "var(--color-surface-elevated)",
        border:          "1px solid var(--color-border-subtle)",
        borderRadius:    "var(--radius-panel)",
        boxShadow:       hovered
                           ? "0 8px 24px rgb(0 0 0 / 0.18)"
                           : "0 2px 8px rgb(0 0 0 / 0.1)",
        display:         "flex",
        flexDirection:   "column",
        position:        "relative",
        transition:      "box-shadow 0.2s ease",
        overflow:        "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          "0.5rem",
          padding:      "0.625rem 0.75rem",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        {/* Accent dot */}
        <span
          style={{
            width:        "7px",
            height:       "7px",
            borderRadius: "50%",
            backgroundColor: accentColor,
            flexShrink:   0,
          }}
        />

        {/* Module label */}
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize:   "0.8rem",
            fontWeight: 600,
            color:      "var(--color-text)",
            flex:       1,
          }}
        >
          {module.label}
        </span>

        {/* Lens control placeholder — wire to your lens selector */}
        <button
          aria-label={`Change lens for ${module.label}`}
          onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
          onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
          style={{
            fontFamily:      "var(--font-body)",
            fontSize:        "0.65rem",
            fontWeight:      500,
            color:           "var(--color-muted)",
            backgroundColor: "transparent",
            border:          "1px solid var(--color-border-subtle)",
            borderRadius:    "var(--radius-control)",
            padding:         "0.2rem 0.5rem",
            cursor:          "pointer",
            outline:         "none",
            transition:      "color 0.15s ease, border-color 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted)"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; }}
        >
          Lens
        </button>

        {/* Delete trigger — visible on hover */}
        <button
          aria-label={`Delete ${module.label}`}
          onClick={() => onDeleteRequest(module)}
          onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-danger)"; setHovered(true); }}
          onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
          style={{
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            width:           "20px",
            height:          "20px",
            borderRadius:    "var(--radius-control)",
            border:          "1px solid transparent",
            backgroundColor: "transparent",
            color:           "var(--color-muted)",
            cursor:          "pointer",
            outline:         "none",
            opacity:         hovered ? 1 : 0,
            pointerEvents:   hovered ? "auto" : "none",
            transition:      "opacity 0.15s ease, color 0.15s ease, border-color 0.15s ease",
            fontSize:        "1rem",
            lineHeight:      1,
            fontFamily:      "var(--font-body)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-danger)"; e.currentTarget.style.borderColor = "var(--color-danger)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted)"; e.currentTarget.style.borderColor = "transparent"; }}
        >
          −
        </button>
      </div>

      {/* Card body — slot for module content */}
      <div
        style={{
          flex:    1,
          padding: "0.75rem",
          color:   "var(--color-muted)",
          fontFamily: "var(--font-body)",
          fontSize:   "0.75rem",
        }}
      >
        {/* Module content rendered here by parent */}
      </div>
    </div>
  );
}

// ── Ghost placeholder — fills orphaned column space elegantly ─────────────────

function GhostPlaceholder({ colSpan }) {
  return (
    <div
      aria-hidden="true"
      style={{
        gridColumn:      `span ${colSpan}`,
        minHeight:       "180px",
        borderRadius:    "var(--radius-panel)",
        border:          "1px dashed var(--color-border-subtle)",
        opacity:         0.35,
      }}
    />
  );
}

// ── Add Module Button ─────────────────────────────────────────────────────────

function AddModuleButton({ onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      aria-label="Add module"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e)  => { setHovered(true); e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
      onBlur={(e)   => { setHovered(false); e.currentTarget.style.boxShadow = "none"; }}
      style={{
        gridColumn:      "span 3",
        minHeight:       "180px",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        gap:             "0.5rem",
        borderRadius:    "var(--radius-panel)",
        border:          `1px dashed ${hovered ? "var(--color-primary)" : "var(--color-border-subtle)"}`,
        backgroundColor: hovered
                           ? "color-mix(in srgb, var(--color-primary) 6%, transparent)"
                           : "transparent",
        cursor:          "pointer",
        outline:         "none",
        transition:      "border-color 0.2s ease, background-color 0.2s ease",
      }}
    >
      {/* Pulsing ring */}
      <span
        style={{
          position:        "relative",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          width:           "36px",
          height:          "36px",
        }}
      >
        <span
          style={{
            position:        "absolute",
            inset:           0,
            borderRadius:    "50%",
            border:          `1px solid ${hovered ? "var(--color-primary)" : "var(--color-border-subtle)"}`,
            animation:       "pulse-ring 2s ease-out infinite",
            opacity:         hovered ? 0.6 : 0.3,
          }}
        />
        <span
          style={{
            fontSize:   "1.25rem",
            lineHeight: 1,
            color:      hovered ? "var(--color-primary)" : "var(--color-muted)",
            transition: "color 0.2s ease",
            fontWeight: 300,
          }}
        >
          ＋
        </span>
      </span>

      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize:   "0.72rem",
          fontWeight: 500,
          color:      hovered ? "var(--color-primary)" : "var(--color-muted)",
          transition: "color 0.2s ease",
        }}
      >
        Add module
      </span>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.4; }
          70%  { transform: scale(1.5); opacity: 0;   }
          100% { transform: scale(1.5); opacity: 0;   }
        }
      `}</style>
    </button>
  );
}

// ── Grid layout helper — computes orphaned columns in last row ────────────────

function computeOrphanCols(modules) {
  const totalSpan = modules.reduce((acc, m) => acc + COLUMN_SPAN[m.size], 0);
  const remainder = totalSpan % TOTAL_COLS;
  return remainder === 0 ? 0 : TOTAL_COLS - remainder;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ModuleGrid({
  modules       = DEMO_MODULES,
  onModuleDelete,
  onAddModule,
  maxModules    = MAX_MODULES,
}) {
  const [pendingDelete, setPendingDelete] = useState(null);
  const atMax      = modules.length >= maxModules;
  const orphanCols = computeOrphanCols(modules);

  // Account for Add Module button (3 cols) in orphan calculation
  const orphanAfterAdd = atMax
    ? orphanCols
    : (orphanCols >= 3 ? orphanCols - 3 : TOTAL_COLS - 3 + orphanCols) % TOTAL_COLS;

  const handleDeleteRequest = (module) => setPendingDelete(module);
  const handleDeleteConfirm = () => {
    onModuleDelete?.(pendingDelete.id);
    setPendingDelete(null);
  };
  const handleDeleteCancel  = () => setPendingDelete(null);

  return (
    <>
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: `repeat(${TOTAL_COLS}, 1fr)`,
          gap:                 "1rem",
          padding:             "1rem",
          backgroundColor:     "var(--color-surface)",
          width:               "100%",
          boxSizing:           "border-box",
        }}
      >
        {modules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            onDeleteRequest={handleDeleteRequest}
          />
        ))}

        {/* Add Module button — fixed in grid, hidden at max */}
        {!atMax && <AddModuleButton onClick={onAddModule} />}

        {/* Elegant ghost fill for orphaned columns */}
        {orphanAfterAdd > 0 && (
          <GhostPlaceholder colSpan={orphanAfterAdd} />
        )}
      </div>

      {/* Confirmation dialog — rendered outside grid flow */}
      {pendingDelete && (
        <DeleteConfirmDialog
          moduleName={pendingDelete.label}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </>
  );
}
Implementation notes for the programmer:
	•	modules, onModuleDelete, onAddModule, and maxModules are all props — the parent owns module state. This component renders and deletes only, it does not add module content.
	•	The delete confirmation dialog uses autoFocus on the Delete button so keyboard users land on the destructive action already focused — this is intentional per ARIA dialog best practices. If your UX prefers focus on Cancel instead, move autoFocus there.
	•	The dialog uses position: fixed and will need a focus trap wired in code — use focus-trap-react or a Radix Dialog primitive for this. Without a focus trap, Tab will escape the dialog.
	•	computeOrphanCols calculates leftover columns after all modules and the Add button are placed, and fills them with a ghost placeholder so the grid never looks broken. This is purely visual — aria-hidden is set on ghost elements.
	•	Module content (charts, lists, stats) is rendered inside the card body slot — pass it as a render prop or children from the parent.
	•	The ModuleLensControl referenced in the handoff doc is stubbed as the "Lens" button in the card header — wire it to your lens selector UI in a follow-up.
	•	color-mix(in srgb, ...) is used for hover tints — replace with hardcoded rgba if you need older browser support.


Focus Mode — Visual Code
import { useState } from "react";

// ── Demo module data — replace with real modules passed as props ──────────────
// Each module needs an icon — these are inline SVG placeholders
// Replace with your actual module icons once designed

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <polyline points="3 6 4 7 6 5" />
      <polyline points="3 12 4 13 6 11" />
      <polyline points="3 18 4 19 6 17" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function MetricsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

const DEMO_MODULES = [
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "tasks",    label: "Tasks",    Icon: TasksIcon    },
  { id: "notes",    label: "Notes",    Icon: NotesIcon    },
  { id: "metrics",  label: "Metrics",  Icon: MetricsIcon  },
  { id: "docs",     label: "Docs",     Icon: DocsIcon     },
];

// ── Close button ──────────────────────────────────────────────────────────────

function CloseButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close module"
      onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
      onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
      style={{
        position:        "absolute",
        top:             "0.75rem",
        right:           "0.75rem",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        width:           "28px",
        height:          "28px",
        borderRadius:    "var(--radius-control)",
        border:          "1px solid var(--color-border-subtle)",
        backgroundColor: "transparent",
        color:           "var(--color-muted)",
        cursor:          "pointer",
        outline:         "none",
        transition:      "color 0.15s ease, border-color 0.15s ease",
        fontSize:        "1rem",
        lineHeight:      1,
        fontFamily:      "var(--font-body)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-primary)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted)"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; }}
    >
      ✕
    </button>
  );
}

// ── Module Dialog ─────────────────────────────────────────────────────────────

function ModuleDialog({ module, onClose }) {
  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position:        "fixed",
          inset:           0,
          zIndex:          60,
          backgroundColor: "var(--color-overlay)",
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={module.label}
        style={{
          position:        "fixed",
          top:             "50%",
          left:            "50%",
          transform:       "translate(-50%, -50%)",
          zIndex:          70,
          width:           "min(720px, 90vw)",
          minHeight:       "480px",
          backgroundColor: "var(--color-surface-elevated)",
          border:          "1px solid var(--color-border-subtle)",
          borderRadius:    "var(--radius-panel)",
          boxShadow:       "0 16px 48px rgb(0 0 0 / 0.3)",
          display:         "flex",
          flexDirection:   "column",
          overflow:        "hidden",
        }}
      >
        {/* Dialog header */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "0.5rem",
            padding:      "0.75rem 1rem",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <span style={{ color: "var(--color-primary)", display: "flex" }}>
            <module.Icon />
          </span>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize:   "0.875rem",
              fontWeight: 600,
              color:      "var(--color-text)",
            }}
          >
            {module.label}
          </span>
        </div>

        {/* Dialog body — slot for module content */}
        <div
          style={{
            flex:       1,
            padding:    "1rem",
            color:      "var(--color-muted)",
            fontFamily: "var(--font-body)",
            fontSize:   "0.8rem",
          }}
        >
          {/* Module content rendered here by parent */}
        </div>

        <CloseButton onClick={onClose} />
      </div>
    </>
  );
}

// ── Toolbar icon button ───────────────────────────────────────────────────────

function ToolbarButton({ module, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      aria-label={`Open ${module.label}`}
      aria-pressed={isActive}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e)  => { setHovered(true); e.currentTarget.style.outline = "2px solid var(--color-primary)"; e.currentTarget.style.outlineOffset = "2px"; }}
      onBlur={(e)   => { setHovered(false); e.currentTarget.style.outline = "none"; }}
      style={{
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        width:           "36px",
        height:          "36px",
        borderRadius:    "var(--radius-control)",
        border:          "none",
        backgroundColor: isActive
                           ? "var(--color-surface-elevated)"
                           : "transparent",
        color:           isActive || hovered
                           ? "var(--color-primary)"
                           : "var(--color-muted)",
        cursor:          "pointer",
        outline:         "none",
        transition:      "background-color 0.15s ease, color 0.15s ease",
        flexShrink:      0,
      }}
    >
      <module.Icon />
    </button>
  );
}

// ── Focus Mode Toolbar ────────────────────────────────────────────────────────

export default function FocusModeToolbar({
  modules      = DEMO_MODULES,
  isVisible    = true,
}) {
  const [activeModuleId, setActiveModuleId] = useState(null);
  const activeModule = modules.find((m) => m.id === activeModuleId) ?? null;

  const handleOpen  = (id) => setActiveModuleId(id);
  const handleClose = ()   => setActiveModuleId(null);

  if (!isVisible) return null;

  return (
    <>
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Module shortcuts"
        style={{
          position:        "fixed",
          top:             0,
          left:            "50%",
          transform:       "translateX(-50%)",
          zIndex:          80,
          display:         "flex",
          alignItems:      "center",
          gap:             "0.25rem",
          padding:         "0.375rem 0.5rem",
          backgroundColor: "var(--color-surface)",
          border:          "1px solid var(--color-border-subtle)",
          borderTop:       "none",
          borderRadius:    "0 0 var(--radius-panel) var(--radius-panel)",
          boxShadow:       "0 4px 16px rgb(0 0 0 / 0.15)",
        }}
      >
        {modules.map((module) => (
          <ToolbarButton
            key={module.id}
            module={module}
            isActive={activeModuleId === module.id}
            onClick={() => activeModuleId === module.id ? handleClose() : handleOpen(module.id)}
          />
        ))}
      </div>

      {/* Module dialog — rendered when a module is open */}
      {activeModule && (
        <ModuleDialog
          module={activeModule}
          onClose={handleClose}
        />
      )}
    </>
  );
}
Implementation notes for the programmer:
	•	isVisible is a prop toggled by the parent when focus mode is entered and exited — this component renders nothing when false. Wire it to the same state that collapses the module grid and reveals the page editor below.
	•	activeModuleId is local state — clicking an already-active button closes the dialog, clicking a new one swaps it. Only one module dialog is open at a time. If you want multiple simultaneous dialogs, convert activeModuleId to an array.
	•	The dialog needs a focus trap — use focus-trap-react or a Radix Dialog primitive. Without it Tab escapes the dialog. The overlay onClick closes the dialog for mouse users but keyboard users need Escape wired to handleClose via a keydown listener on the dialog element.
	•	The toolbar is centered and fixed at the top, hanging down with no top border — it reads as dropping from the top edge. If the page editor below has its own top bar at any point you may need to offset with a top value rather than 0.
	•	Module icons are stubbed as inline SVG placeholders — swap each Icon reference for your real module icons once designed. The icon slot expects a zero-prop component so keep that interface consistent.

Overview Header — Visual Code
import { useState } from "react";

// ── Collaborator avatar ───────────────────────────────────────────────────────

function Avatar({ name, color }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      aria-label={name}
      title={name}
      style={{
        width:           "26px",
        height:          "26px",
        borderRadius:    "50%",
        backgroundColor: color,
        border:          "2px solid var(--color-surface-elevated)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        fontFamily:      "var(--font-body)",
        fontSize:        "0.65rem",
        fontWeight:      700,
        color:           "var(--color-surface)",
        flexShrink:      0,
        marginLeft:      "-6px",
      }}
    >
      {initial}
    </div>
  );
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_COLLABORATORS = [
  { id: "u1", name: "Alex",  color: "#7EB8F7" },
  { id: "u2", name: "Sam",   color: "#A8E6CF" },
  { id: "u3", name: "Jordan",color: "#F7A07E" },
];

const DEMO_REFS = [
  { id: "r1", label: "Acme Corp",       value: "+1 212 555 0100" },
  { id: "r2", label: "Brand Guidelines", value: "figma.com/acme" },
];

// ── Refs popover ──────────────────────────────────────────────────────────────

function RefsPopover({ refs, onClose }) {
  return (
    <div
      role="dialog"
      aria-label="Quick references"
      style={{
        position:        "absolute",
        top:             "calc(100% + 6px)",
        right:           0,
        zIndex:          50,
        backgroundColor: "var(--color-surface-elevated)",
        border:          "1px solid var(--color-border-subtle)",
        borderRadius:    "var(--radius-panel)",
        padding:         "0.75rem",
        minWidth:        "240px",
        boxShadow:       "0 4px 16px rgb(0 0 0 / 0.2)",
        display:         "flex",
        flexDirection:   "column",
        gap:             "0.5rem",
      }}
    >
      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", fontWeight: 500, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Quick References
      </span>

      {refs.map((ref) => (
        <div
          key={ref.id}
          style={{
            display:         "flex",
            flexDirection:   "column",
            gap:             "0.125rem",
            padding:         "0.375rem 0.5rem",
            borderRadius:    "var(--radius-control)",
            backgroundColor: "var(--color-surface)",
            border:          "1px solid var(--color-border-subtle)",
          }}
        >
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 600, color: "var(--color-text)" }}>{ref.label}</span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", color: "var(--color-muted)" }}>{ref.value}</span>
        </div>
      ))}

      {/* Add ref placeholder — wire to your input logic */}
      <button
        onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
        onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
        style={{
          fontFamily:      "var(--font-body)",
          fontSize:        "0.72rem",
          color:           "var(--color-muted)",
          backgroundColor: "transparent",
          border:          "1px dashed var(--color-border-subtle)",
          borderRadius:    "var(--radius-control)",
          padding:         "0.375rem 0.5rem",
          cursor:          "pointer",
          outline:         "none",
          textAlign:       "left",
          transition:      "color 0.15s ease, border-color 0.15s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-primary)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted)"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; }}
      >
        ＋ Add reference
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewHeader({
  title          = "Untitled Project",
  startDate      = "Mar 4, 2026",
  collaborators  = DEMO_COLLABORATORS,
  refs           = DEMO_REFS,
  onInvite,
  onTitleChange,
}) {
  const [refsOpen, setRefsOpen] = useState(false);

  return (
    <div
      style={{
        display:         "flex",
        flexDirection:   "column",
        gap:             "0.375rem",
        padding:         "0.875rem 1rem 0.75rem",
        backgroundColor: "var(--color-surface-elevated)",
        borderBottom:    "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Line 1 — Title */}
      <input
        type="text"
        defaultValue={title}
        aria-label="Project title"
        onChange={(e) => onTitleChange?.(e.target.value)}
        onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
        onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
        style={{
          fontFamily:      "var(--font-heading)",
          fontSize:        "1.25rem",
          fontWeight:      700,
          color:           "var(--color-text)",
          backgroundColor: "transparent",
          border:          "1px solid transparent",
          borderRadius:    "var(--radius-control)",
          padding:         "0 0.25rem",
          outline:         "none",
          width:           "100%",
          transition:      "box-shadow 0.15s ease",
        }}
      />

      {/* Line 2 — Metadata row */}
      <div
        style={{
          display:     "flex",
          alignItems:  "center",
          gap:         "0.75rem",
        }}
      >
        {/* Start date */}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize:   "0.75rem",
            color:      "var(--color-muted)",
            display:    "flex",
            alignItems: "center",
            gap:        "0.3rem",
            flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {startDate}
        </span>

        {/* Thin divider */}
        <span style={{ width: "1px", height: "12px", backgroundColor: "var(--color-border-subtle)", flexShrink: 0 }} />

        {/* Collaborator avatars + invite */}
        <div
          style={{
            display:    "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {/* First avatar has no negative margin */}
          {collaborators.map((c, i) => (
            <div key={c.id} style={{ marginLeft: i === 0 ? 0 : "-6px" }}>
              <Avatar name={c.name} color={c.color} />
            </div>
          ))}

          {/* Invite button */}
          <button
            onClick={onInvite}
            aria-label="Invite collaborator"
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              marginLeft:      "4px",
              width:           "26px",
              height:          "26px",
              borderRadius:    "50%",
              border:          "1px dashed var(--color-border-subtle)",
              backgroundColor: "transparent",
              color:           "var(--color-muted)",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              cursor:          "pointer",
              outline:         "none",
              fontSize:        "0.8rem",
              transition:      "color 0.15s ease, border-color 0.15s ease",
              flexShrink:      0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-primary)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted)"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; }}
          >
            ＋
          </button>
        </div>

        {/* Thin divider */}
        <span style={{ width: "1px", height: "12px", backgroundColor: "var(--color-border-subtle)", flexShrink: 0 }} />

        {/* Quick refs */}
        <div style={{ position: "relative", marginLeft: "auto" }}>
          <button
            onClick={() => setRefsOpen((v) => !v)}
            aria-label="Quick references"
            aria-expanded={refsOpen}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              display:         "flex",
              alignItems:      "center",
              gap:             "0.3rem",
              fontFamily:      "var(--font-body)",
              fontSize:        "0.72rem",
              fontWeight:      500,
              color:           refsOpen ? "var(--color-primary)" : "var(--color-muted)",
              backgroundColor: refsOpen ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : "transparent",
              border:          "1px solid",
              borderColor:     refsOpen ? "var(--color-primary)" : "var(--color-border-subtle)",
              borderRadius:    "var(--radius-control)",
              padding:         "0.2rem 0.5rem",
              cursor:          "pointer",
              outline:         "none",
              transition:      "all 0.15s ease",
              flexShrink:      0,
            }}
            onMouseEnter={(e) => { if (!refsOpen) { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-text)"; }}}
            onMouseLeave={(e) => { if (!refsOpen) { e.currentTarget.style.color = "var(--color-muted)"; e.currentTarget.style.borderColor = "var(--color-border-subtle)"; }}}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            {refs.length} refs
          </button>

          {refsOpen && <RefsPopover refs={refs} onClose={() => setRefsOpen(false)} />}
        </div>
      </div>
    </div>
  );
}
Implementation notes for the programmer:
	•	onInvite should open your collaborator invite dialog — wire to a Radix Dialog with focus trap.
	•	The refs popover needs an outside-click dismissal useEffect and Escape keydown handler, same pattern as PaneHeaderControls.
	•	onTitleChange fires on every keystroke — debounce at the call site.
	•	The refs add button is a visual stub — wire to your data model for storing and editing reference entries.

Timeline Tab — Visual Code
// ── Priority color tokens — fixed, never reused for categories or people ──────
const PRIORITY_COLORS = {
  high:   "rgb(220 80 100)",   // reddish pink
  medium: "rgb(255 163 205)",  // medium pink — same as --color-primary
  low:    "rgb(255 210 230)",  // light pink
};

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_TIMELINE = [
  {
    id:       "t1",
    date:     "Today",
    items: [
      { id: "i1", label: "Kicked off brand review",     type: "event",     priority: "high"   },
      { id: "i2", label: "Script draft due",            type: "task",      priority: "high"   },
      { id: "i3", label: "Weekly sync with Alex",       type: "event",     priority: "medium" },
    ],
  },
  {
    id:       "t2",
    date:     "Yesterday",
    items: [
      { id: "i4", label: "Uploaded campaign assets",    type: "event",     priority: "low"    },
      { id: "i5", label: "Client call — Acme Corp",     type: "event",     priority: "high"   },
    ],
  },
  {
    id:       "t3",
    date:     "Mar 2",
    items: [
      { id: "i6", label: "Reviewed landing page copy",  type: "task",      priority: "medium" },
      { id: "i7", label: "Figma handoff delivered",     type: "milestone", priority: "low"    },
    ],
  },
];

const TYPE_LABELS = {
  event:     "Event",
  task:      "Task",
  milestone: "Milestone",
};

// ── Timeline item row ─────────────────────────────────────────────────────────

function TimelineItem({ item, isLast }) {
  const priorityColor = PRIORITY_COLORS[item.priority];

  return (
    <div
      style={{
        display:  "flex",
        gap:      "0.875rem",
        position: "relative",
      }}
    >
      {/* Left rail — dot + connecting line */}
      <div
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          flexShrink:     0,
          width:          "16px",
        }}
      >
        {/* Dot */}
        <div
          style={{
            width:           "9px",
            height:          "9px",
            borderRadius:    "50%",
            backgroundColor: priorityColor,
            flexShrink:      0,
            marginTop:       "4px",
            boxShadow:       `0 0 0 2px var(--color-surface-elevated), 0 0 0 3px ${priorityColor}33`,
          }}
        />
        {/* Connecting line — hidden on last item */}
        {!isLast && (
          <div
            style={{
              flex:            1,
              width:           "1px",
              backgroundColor: "var(--color-border-subtle)",
              marginTop:       "4px",
              minHeight:       "20px",
            }}
          />
        )}
      </div>

      {/* Item content */}
      <div
        style={{
          flex:          1,
          paddingBottom: isLast ? 0 : "0.875rem",
          display:       "flex",
          alignItems:    "baseline",
          gap:           "0.5rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize:   "0.8rem",
            fontWeight: 500,
            color:      "var(--color-text)",
            flex:       1,
            lineHeight: 1.4,
          }}
        >
          {item.label}
        </span>

        {/* Type badge */}
        <span
          style={{
            fontFamily:      "var(--font-body)",
            fontSize:        "0.65rem",
            fontWeight:      500,
            color:           "var(--color-muted)",
            backgroundColor: "var(--color-surface)",
            border:          "1px solid var(--color-border-subtle)",
            borderRadius:    "var(--radius-control)",
            padding:         "0.125rem 0.4rem",
            flexShrink:      0,
            textTransform:   "capitalize",
          }}
        >
          {TYPE_LABELS[item.type]}
        </span>
      </div>
    </div>
  );
}

// ── Day cluster ───────────────────────────────────────────────────────────────

function DayCluster({ cluster }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Sticky date header */}
      <div
        style={{
          position:        "sticky",
          top:             0,
          zIndex:          10,
          backgroundColor: "var(--color-surface)",
          paddingBottom:   "0.5rem",
          paddingTop:      "0.125rem",
        }}
      >
        <span
          style={{
            fontFamily:    "var(--font-heading)",
            fontSize:      "0.7rem",
            fontWeight:    700,
            color:         "var(--color-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {cluster.date}
        </span>
      </div>

      {/* Items */}
      <div style={{ paddingLeft: "0.25rem" }}>
        {cluster.items.map((item, index) => (
          <TimelineItem
            key={item.id}
            item={item}
            isLast={index === cluster.items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TimelineTab({ clusters = DEMO_TIMELINE }) {
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        gap:           "1.25rem",
        padding:       "1rem",
        overflowY:     "auto",
        height:        "100%",
        boxSizing:     "border-box",
      }}
    >
      {clusters.map((cluster) => (
        <DayCluster key={cluster.id} cluster={cluster} />
      ))}
    </div>
  );
}
Implementation notes for the programmer:
	•	clusters is a prop — parent should derive the grouped/sorted structure from raw timeline data before passing it in.
	•	Sticky date headers require the scroll container to be this component's root div, not a parent with overflow: hidden.
	•	Priority color constants are defined at the top of this file — import them as a shared token file across Timeline, Calendar, and Tasks so the color system stays in sync.

Calendar Tab — Visual Code
import { useState } from "react";

// ── Shared priority colors — import from shared token file in real codebase ───
const PRIORITY_COLORS = {
  high:   "rgb(220 80 100)",
  medium: "rgb(255 163 205)",
  low:    "rgb(255 210 230)",
};

// ── Collaborator and category colors — separate palette, never pink ───────────
const COLLABORATOR_COLORS = {
  u1: "#7EB8F7",
  u2: "#A8E6CF",
  u3: "#F7A07E",
};

const CATEGORY_COLORS = {
  youtube:   "#7EB8F7",
  writing:   "#A8E6CF",
  design:    "#C3A8F7",
  marketing: "#F7D07E",
};

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_COLLABORATORS = [
  { id: "all", label: "All" },
  { id: "u1",  label: "Alex"   },
  { id: "u2",  label: "Sam"    },
  { id: "u3",  label: "Jordan" },
];

const DEMO_CATEGORIES = [
  { id: "all",       label: "All"       },
  { id: "youtube",   label: "YouTube"   },
  { id: "writing",   label: "Writing"   },
  { id: "design",    label: "Design"    },
  { id: "marketing", label: "Marketing" },
];

const TIME_VIEWS = ["Day", "Week", "Month", "Year"];

// Minimal demo events — replace with real data
const DEMO_EVENTS = [
  { id: "e1", date: new Date(2026, 2, 4),  label: "Brand Kickoff",    category: "marketing", assignee: "u1", priority: "high"   },
  { id: "e2", date: new Date(2026, 2, 4),  label: "Script Due",       category: "writing",   assignee: "u2", priority: "high"   },
  { id: "e3", date: new Date(2026, 2, 5),  label: "Weekly Sync",      category: "youtube",   assignee: "u1", priority: "medium" },
  { id: "e4", date: new Date(2026, 2, 7),  label: "Figma Review",     category: "design",    assignee: "u3", priority: "low"    },
  { id: "e5", date: new Date(2026, 2, 10), label: "Client Call",      category: "marketing", assignee: "u2", priority: "high"   },
  { id: "e6", date: new Date(2026, 2, 15), label: "YouTube Upload",   category: "youtube",   assignee: "u1", priority: "medium" },
  { id: "e7", date: new Date(2026, 2, 20), label: "Copy Deadline",    category: "writing",   assignee: "u3", priority: "high"   },
];

// ── Lens chip ─────────────────────────────────────────────────────────────────

function LensChip({ label, isActive, color, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      aria-pressed={isActive}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
      onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             "0.3rem",
        fontFamily:      "var(--font-body)",
        fontSize:        "0.72rem",
        fontWeight:      isActive ? 600 : 400,
        padding:         "0.25rem 0.625rem",
        borderRadius:    "var(--radius-control)",
        border:          "1px solid",
        borderColor:     isActive
                           ? (color ?? "var(--color-primary)")
                           : hovered
                           ? "var(--color-text)"
                           : "var(--color-border-subtle)",
        backgroundColor: isActive
                           ? `color-mix(in srgb, ${color ?? "var(--color-primary)"} 12%, transparent)`
                           : "transparent",
        color:           isActive
                           ? (color ?? "var(--color-primary)")
                           : hovered
                           ? "var(--color-text)"
                           : "var(--color-muted)",
        cursor:          "pointer",
        outline:         "none",
        transition:      "all 0.15s ease",
        flexShrink:      0,
      }}
    >
      {color && isActive && (
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
      )}
      {label}
    </button>
  );
}

// ── Event chip ────────────────────────────────────────────────────────────────

function EventChip({ event, viewMode }) {
  // In month/year view chips are minimal dots, week/day show labels
  const isCompact = viewMode === "Month" || viewMode === "Year";
  const chipColor = CATEGORY_COLORS[event.category] ?? "var(--color-muted)";

  if (viewMode === "Year") {
    return (
      <div
        title={event.label}
        style={{
          width:           "6px",
          height:          "6px",
          borderRadius:    "50%",
          backgroundColor: chipColor,
          opacity:         0.7,
          flexShrink:      0,
        }}
      />
    );
  }

  return (
    <div
      title={event.label}
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             "0.25rem",
        padding:         isCompact ? "0.1rem 0.3rem" : "0.2rem 0.4rem",
        borderRadius:    "calc(var(--radius-control) / 2)",
        backgroundColor: `color-mix(in srgb, ${chipColor} 15%, transparent)`,
        borderLeft:      `2px solid ${chipColor}`,
        overflow:        "hidden",
        width:           "100%",
      }}
    >
      <span
        style={{
          fontFamily:   "var(--font-body)",
          fontSize:     isCompact ? "0.6rem" : "0.68rem",
          fontWeight:   500,
          color:        "var(--color-text)",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          opacity:      0.9,
        }}
      >
        {event.label}
      </span>
    </div>
  );
}

// ── Calendar grid helpers ─────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

// ── Month grid ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const OVERFLOW_LIMIT = 2;

function MonthGrid({ year, month, filteredEvents, viewMode }) {
  const today       = new Date();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);
  const blanks      = Array(firstDay).fill(null);
  const days        = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const allCells    = [...blanks, ...days];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", marginBottom: "2px" }}>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              fontFamily:    "var(--font-body)",
              fontSize:      "0.65rem",
              fontWeight:    600,
              color:         "var(--color-muted)",
              textAlign:     "center",
              padding:       "0.25rem 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {allCells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;

          const cellDate     = new Date(year, month, day);
          const isToday      = isSameDay(cellDate, today);
          const dayEvents    = filteredEvents.filter((e) => isSameDay(e.date, cellDate));
          const visible      = dayEvents.slice(0, OVERFLOW_LIMIT);
          const overflowCount = dayEvents.length - visible.length;

          return (
            <div
              key={day}
              style={{
                minHeight:       viewMode === "Month" ? "72px" : "48px",
                backgroundColor: isToday
                                   ? "color-mix(in srgb, var(--color-primary) 6%, transparent)"
                                   : "transparent",
                border:          "1px solid",
                borderColor:     isToday ? "var(--color-primary)" : "var(--color-border-subtle)",
                borderRadius:    "calc(var(--radius-control) / 1.5)",
                padding:         "0.25rem",
                display:         "flex",
                flexDirection:   "column",
                gap:             "2px",
                opacity:         1,
              }}
            >
              {/* Day number */}
              <span
                style={{
                  fontFamily:      "var(--font-body)",
                  fontSize:        "0.68rem",
                  fontWeight:      isToday ? 700 : 400,
                  color:           isToday ? "var(--color-primary)" : "var(--color-muted)",
                  alignSelf:       "flex-end",
                  lineHeight:      1,
                  paddingBottom:   "2px",
                }}
              >
                {day}
              </span>

              {/* Event chips */}
              {visible.map((event) => (
                <EventChip key={event.id} event={event} viewMode={viewMode} />
              ))}

              {/* Overflow count */}
              {overflowCount > 0 && (
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize:   "0.6rem",
                    color:      "var(--color-muted)",
                    paddingLeft: "0.25rem",
                  }}
                >
                  +{overflowCount} more
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarTab({
  events        = DEMO_EVENTS,
  collaborators = DEMO_COLLABORATORS,
  categories    = DEMO_CATEGORIES,
}) {
  const today = new Date();

  const [timeView,      setTimeView]      = useState("Month");
  const [activeUser,    setActiveUser]    = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");

  // Filter events by active lens selections
  const filteredEvents = events.filter((e) => {
    const userMatch     = activeUser     === "all" || e.assignee === activeUser;
    const categoryMatch = activeCategory === "all" || e.category === activeCategory;
    return userMatch && categoryMatch;
  });

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        height:        "100%",
        overflow:      "hidden",
      }}
    >
      {/* Lens chip bar */}
      <div
        style={{
          display:         "flex",
          alignItems:      "center",
          gap:             "0.375rem",
          padding:         "0.5rem 1rem",
          borderBottom:    "1px solid var(--color-border-subtle)",
          overflowX:       "auto",
          scrollbarWidth:  "none",
          flexShrink:      0,
        }}
      >
        {/* Time view chips */}
        {TIME_VIEWS.map((v) => (
          <LensChip
            key={v}
            label={v}
            isActive={timeView === v}
            onClick={() => setTimeView(v)}
          />
        ))}

        {/* Divider */}
        <span style={{ width: "1px", height: "16px", backgroundColor: "var(--color-border-subtle)", flexShrink: 0, margin: "0 0.125rem" }} />

        {/* Collaborator chips */}
        {collaborators.map((c) => (
          <LensChip
            key={c.id}
            label={c.label}
            isActive={activeUser === c.id}
            color={c.id !== "all" ? COLLABORATOR_COLORS[c.id] : undefined}
            onClick={() => setActiveUser(c.id)}
          />
        ))}

        {/* Divider */}
        <span style={{ width: "1px", height: "16px", backgroundColor: "var(--color-border-subtle)", flexShrink: 0, margin: "0 0.125rem" }} />

        {/* Category chips */}
        {categories.map((cat) => (
          <LensChip
            key={cat.id}
            label={cat.label}
            isActive={activeCategory === cat.id}
            color={cat.id !== "all" ? CATEGORY_COLORS[cat.id] : undefined}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* Calendar grid */}
      <div
        style={{
          flex:      1,
          overflowY: "auto",
          padding:   "0.75rem 1rem",
        }}
      >
        {/* Month view — default */}
        {(timeView === "Month" || timeView === "Week" || timeView === "Day" || timeView === "Year") && (
          <MonthGrid
            year={today.getFullYear()}
            month={today.getMonth()}
            filteredEvents={filteredEvents}
            viewMode={timeView}
          />
        )}
      </div>
    </div>
  );
}
Implementation notes for the programmer:
	•	Week, Day, and Year views are stubbed to the same MonthGrid with visual adjustments via viewMode — build out dedicated layout components for each view and swap based on timeView state.
	•	The lens chip bar scrolls horizontally on overflow — same no-scrollbar pattern as TopNavTabs.
	•	PRIORITY_COLORS, COLLABORATOR_COLORS, and CATEGORY_COLORS should live in a shared token file imported across Timeline, Calendar, and Tasks to guarantee consistency.
	•	Collaborator and category color palettes must never use the pink range reserved for priority. Add a lint comment or a code review note flagging this constraint.
	•	Navigation between months/weeks/days (prev/next controls) is not included here — add a chevron pair above the grid wired to month/week offset state in the parent.

Tasks Tab — Visual Code
import { useState } from "react";

// ── Shared priority colors ────────────────────────────────────────────────────
const PRIORITY_COLORS = {
  high:   "rgb(220 80 100)",
  medium: "rgb(255 163 205)",
  low:    "rgb(255 210 230)",
};

const PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_TASKS = [
  {
    id: "task1", label: "Write launch script", priority: "high",
    category: "writing", assignee: "u1", due: "Mar 4, 2026",
    subtasks: [
      { id: "s1", label: "Draft intro section",   priority: null, due: "Mar 4" },
      { id: "s2", label: "Review with Sam",        priority: "medium", due: "Mar 4" },
    ],
  },
  {
    id: "task2", label: "Design thumbnail",     priority: "medium",
    category: "design",   assignee: "u3", due: "Mar 5, 2026",
    subtasks: [
      { id: "s3", label: "Sketch concepts",        priority: null, due: "Mar 5" },
    ],
  },
  {
    id: "task3", label: "Client check-in email", priority: "high",
    category: "marketing", assignee: "u2", due: "Mar 4, 2026",
    subtasks: [],
  },
  {
    id: "task4", label: "Upload to YouTube",     priority: "low",
    category: "youtube",   assignee: "u1", due: "Mar 10, 2026",
    subtasks: [
      { id: "s4", label: "Add captions",           priority: null, due: "Mar 10" },
      { id: "s5", label: "Write description",       priority: null, due: "Mar 10" },
      { id: "s6", label: "Schedule publish time",   priority: "medium", due: "Mar 10" },
    ],
  },
];

const DEMO_COLLABORATORS = [
  { id: "all", label: "All" },
  { id: "u1",  label: "Alex"   },
  { id: "u2",  label: "Sam"    },
  { id: "u3",  label: "Jordan" },
];

const DEMO_CATEGORIES = [
  { id: "all",       label: "All"       },
  { id: "youtube",   label: "YouTube"   },
  { id: "writing",   label: "Writing"   },
  { id: "design",    label: "Design"    },
  { id: "marketing", label: "Marketing" },
];

const CLUSTER_MODES = ["Chronological", "Category", "Priority"];

// ── Cluster helpers ───────────────────────────────────────────────────────────

function clusterByChronological(tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groups = { Overdue: [], Today: [], "This Week": [], Later: [] };

  tasks.forEach((task) => {
    const due = new Date(task.due);
    due.setHours(0, 0, 0, 0);
    const diff = Math.floor((due - today) / 86400000);
    if      (diff < 0)  groups["Overdue"].push(task);
    else if (diff === 0) groups["Today"].push(task);
    else if (diff <= 7)  groups["This Week"].push(task);
    else                 groups["Later"].push(task);
  });

  return Object.entries(groups).filter(([, items]) => items.length > 0).map(([label, items]) => ({ label, items }));
}

function clusterByCategory(tasks) {
  const map = {};
  tasks.forEach((task) => {
    if (!map[task.category]) map[task.category] = [];
    map[task.category].push(task);
  });
  return Object.entries(map).map(([label, items]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    items,
  }));
}

function clusterByPriority(tasks) {
  const order = ["high", "medium", "low"];
  const map   = { high: [], medium: [], low: [] };
  tasks.forEach((task) => { map[task.priority].push(task); });
  return order.filter((p) => map[p].length > 0).map((p) => ({
    label:       PRIORITY_LABELS[p],
    items:       map[p],
    priorityKey: p,
  }));
}

// ── Subtask row ───────────────────────────────────────────────────────────────

function SubtaskRow({ subtask, parentPriority, depth = 1 }) {
  const resolvedPriority = subtask.priority ?? parentPriority;
  const priorityColor    = PRIORITY_COLORS[resolvedPriority];
  const indentWidth      = depth * 20;
  const lineOpacity      = Math.max(0.15, 0.4 - depth * 0.1);
  const lineWidth        = Math.max(1, 2 - depth * 0.5);

  return (
    <div
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "0.5rem",
        paddingLeft: `${indentWidth}px`,
        position:   "relative",
      }}
    >
      {/* Vertical connecting line */}
      <div
        style={{
          position:        "absolute",
          left:            `${indentWidth - 10}px`,
          top:             0,
          bottom:          0,
          width:           `${lineWidth}px`,
          backgroundColor: priorityColor,
          opacity:         lineOpacity,
        }}
      />

      {/* Horizontal connector */}
      <div
        style={{
          position:        "absolute",
          left:            `${indentWidth - 10}px`,
          top:             "50%",
          width:           "8px",
          height:          `${lineWidth}px`,
          backgroundColor: priorityColor,
          opacity:         lineOpacity,
        }}
      />

      {/* Priority dot */}
      <div
        style={{
          width:           "5px",
          height:          "5px",
          borderRadius:    "50%",
          backgroundColor: priorityColor,
          flexShrink:      0,
          opacity:         subtask.priority ? 1 : 0.5,
        }}
      />

      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize:   "0.75rem",
          color:      "var(--color-muted)",
          flex:       1,
          lineHeight: 1.4,
        }}
      >
        {subtask.label}
      </span>

      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize:   "0.65rem",
          color:      "var(--color-muted)",
          flexShrink: 0,
          opacity:    0.6,
        }}
      >
        {subtask.due}
      </span>
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered,  setHovered]  = useState(false);
  const priorityColor           = PRIORITY_COLORS[task.priority];
  const hasSubtasks             = task.subtasks.length > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main task row */}
      <div
        style={{
          display:         "flex",
          alignItems:      "center",
          gap:             "0.625rem",
          padding:         "0.5rem 0.625rem",
          borderRadius:    "var(--radius-control)",
          backgroundColor: hovered ? "var(--color-surface-elevated)" : "transparent",
          transition:      "background-color 0.15s ease",
          cursor:          hasSubtasks ? "pointer" : "default",
        }}
        onClick={() => hasSubtasks && setExpanded((v) => !v)}
      >
        {/* Priority bar */}
        <div
          style={{
            width:           "3px",
            height:          "28px",
            borderRadius:    "2px",
            backgroundColor: priorityColor,
            flexShrink:      0,
            opacity:         0.85,
          }}
        />

        {/* Task label */}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize:   "0.8rem",
            fontWeight: 500,
            color:      "var(--color-text)",
            flex:       1,
            lineHeight: 1.4,
          }}
        >
          {task.label}
        </span>

        {/* Subtask count badge */}
        {hasSubtasks && (
          <span
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.62rem",
              fontWeight:      600,
              color:           priorityColor,
              backgroundColor: `color-mix(in srgb, ${priorityColor} 12%, transparent)`,
              border:          `1px solid color-mix(in srgb, ${priorityColor} 25%, transparent)`,
              borderRadius:    "var(--radius-control)",
              padding:         "0.1rem 0.4rem",
              flexShrink:      0,
            }}
          >
            {task.subtasks.length}
          </span>
        )}

        {/* Due date */}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize:   "0.68rem",
            color:      "var(--color-muted)",
            flexShrink: 0,
          }}
        >
          {task.due}
        </span>

        {/* Expand chevron */}
        {hasSubtasks && (
          <span
            style={{
              color:      "var(--color-muted)",
              fontSize:   "0.65rem",
              transform:  expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              flexShrink: 0,
            }}
          >
            ▶
          </span>
        )}
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div
          style={{
            display:       "flex",
            flexDirection: "column",
            gap:           "0.375rem",
            padding:       "0.25rem 0 0.5rem",
          }}
        >
          {task.subtasks.map((sub) => (
            <SubtaskRow
              key={sub.id}
              subtask={sub}
              parentPriority={task.priority}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cluster group ─────────────────────────────────────────────────────────────

function ClusterGroup({ cluster, clusterMode }) {
  const [collapsed, setCollapsed] = useState(false);
  const isPriorityCluster         = clusterMode === "Priority";
  const accentColor               = isPriorityCluster && cluster.priorityKey
                                      ? PRIORITY_COLORS[cluster.priorityKey]
                                      : "var(--color-muted)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
      {/* Cluster header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
        onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
        style={{
          display:         "flex",
          alignItems:      "center",
          gap:             "0.5rem",
          padding:         "0.375rem 0.625rem",
          backgroundColor: "transparent",
          border:          "none",
          borderRadius:    "var(--radius-control)",
          cursor:          "pointer",
          outline:         "none",
          width:           "100%",
          textAlign:       "left",
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width:           "12px",
            height:          "2px",
            borderRadius:    "1px",
            backgroundColor: accentColor,
            opacity:         0.7,
            flexShrink:      0,
          }}
        />

        <span
          style={{
            fontFamily:    "var(--font-heading)",
            fontSize:      "0.7rem",
            fontWeight:    700,
            color:         "var(--color-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            flex:          1,
          }}
        >
          {cluster.label}
        </span>

        <span
          style={{
            fontFamily:      "var(--font-body)",
            fontSize:        "0.62rem",
            color:           "var(--color-muted)",
            backgroundColor: "var(--color-surface-elevated)",
            border:          "1px solid var(--color-border-subtle)",
            borderRadius:    "var(--radius-control)",
            padding:         "0.1rem 0.4rem",
          }}
        >
          {cluster.items.length}
        </span>

        <span
          style={{
            color:      "var(--color-muted)",
            fontSize:   "0.6rem",
            transform:  collapsed ? "rotate(-90deg)" : "rotate(90deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          ▶
        </span>
      </button>

      {/* Task rows */}
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {cluster.items.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cluster mode selector ─────────────────────────────────────────────────────

function ClusterToggle({ active, onChange }) {
  return (
    <div
      role="group"
      aria-label="Cluster by"
      style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}
    >
      <span style={{ fontFamily: "var(--font-body)", fontSize: "0.65rem", color: "var(--color-muted)", flexShrink: 0 }}>
        Group by
      </span>
      {CLUSTER_MODES.map((mode) => {
        const isActive = active === mode;
        return (
          <button
            key={mode}
            aria-pressed={isActive}
            onClick={() => onChange(mode)}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.72rem",
              fontWeight:      isActive ? 600 : 400,
              padding:         "0.25rem 0.625rem",
              borderRadius:    "var(--radius-control)",
              border:          "1px solid",
              borderColor:     isActive ? "var(--color-primary)" : "var(--color-border-subtle)",
              backgroundColor: isActive ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
              color:           isActive ? "var(--color-primary)" : "var(--color-muted)",
              cursor:          "pointer",
              outline:         "none",
              transition:      "all 0.15s ease",
            }}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TasksTab({
  tasks         = DEMO_TASKS,
  collaborators = DEMO_COLLABORATORS,
  categories    = DEMO_CATEGORIES,
}) {
  const [clusterMode,     setClusterMode]     = useState("Chronological");
  const [activeUser,      setActiveUser]      = useState("all");
  const [activeCategory,  setActiveCategory]  = useState("all");

  // Filter
  const filtered = tasks.filter((t) => {
    const userMatch     = activeUser    === "all" || t.assignee === t.assignee && activeUser === t.assignee;
    const categoryMatch = activeCategory === "all" || t.category === activeCategory;
    return userMatch && categoryMatch;
  });

  // Cluster
  const clusters =
    clusterMode === "Chronological" ? clusterByChronological(filtered) :
    clusterMode === "Category"      ? clusterByCategory(filtered)      :
                                      clusterByPriority(filtered);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Control bar */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            "0.75rem",
          padding:        "0.5rem 1rem",
          borderBottom:   "1px solid var(--color-border-subtle)",
          overflowX:      "auto",
          scrollbarWidth: "none",
          flexShrink:     0,
          flexWrap:       "wrap",
          rowGap:         "0.5rem",
        }}
      >
        <ClusterToggle active={clusterMode} onChange={setClusterMode} />

        {/* Divider */}
        <span style={{ width: "1px", height: "16px", backgroundColor: "var(--color-border-subtle)", flexShrink: 0 }} />

        {/* Collaborator filter */}
        {collaborators.map((c) => (
          <button
            key={c.id}
            aria-pressed={activeUser === c.id}
            onClick={() => setActiveUser(c.id)}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.72rem",
              fontWeight:      activeUser === c.id ? 600 : 400,
              padding:         "0.25rem 0.625rem",
              borderRadius:    "var(--radius-control)",
              border:          "1px solid",
              borderColor:     activeUser === c.id ? "var(--color-primary)" : "var(--color-border-subtle)",
              backgroundColor: activeUser === c.id ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
              color:           activeUser === c.id ? "var(--color-primary)" : "var(--color-muted)",
              cursor:          "pointer",
              outline:         "none",
              transition:      "all 0.15s ease",
            }}
          >
            {c.label}
          </button>
        ))}

        {/* Divider */}
        <span style={{ width: "1px", height: "16px", backgroundColor: "var(--color-border-subtle)", flexShrink: 0 }} />

        {/* Category filter */}
        {categories.map((cat) => (
          <button
            key={cat.id}
            aria-pressed={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.72rem",
              fontWeight:      activeCategory === cat.id ? 600 : 400,
              padding:         "0.25rem 0.625rem",
              borderRadius:    "var(--radius-control)",
              border:          "1px solid",
              borderColor:     activeCategory === cat.id ? "var(--color-primary)" : "var(--color-border-subtle)",
              backgroundColor: activeCategory === cat.id ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
              color:           activeCategory === cat.id ? "var(--color-primary)" : "var(--color-muted)",
              cursor:          "pointer",
              outline:         "none",
              transition:      "all 0.15s ease",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Clustered task list */}
      <div
        style={{
          flex:      1,
          overflowY: "auto",
          padding:   "0.75rem 1rem",
          display:   "flex",
          flexDirection: "column",
          gap:       "1rem",
        }}
      >
        {clusters.map((cluster, i) => (
          <ClusterGroup key={i} cluster={cluster} clusterMode={clusterMode} />
        ))}
      </div>
    </div>
  );
}
Implementation notes for the programmer:
	•	PRIORITY_COLORS must be imported from a shared token file — same object used in Timeline and Calendar. Define it once, import everywhere.
	•	Subtask priority inheritance: when subtask.priority is null, SubtaskRow falls back to parentPriority. If a subtask has an explicit priority set, it overrides. This is purely visual — the data model should store null for inherited and an explicit value for overridden.
	•	The clusterByChronological helper parses task.due as a string — replace with proper date objects from your data model.
	•	The userMatch filter logic in the main component has a redundant condition — simplify to activeUser === "all" || t.assignee === activeUser when wiring to real data.
	•	Deep nesting beyond one level of subtask is supported by the depth prop on SubtaskRow — the connecting line gets thinner and more transparent at each level. Wire recursive subtask trees from your data model if needed.
	•	Cluster collapse state is local to each ClusterGroup — if you need to add a global collapse-all toggle, lift that state up to the parent.

Locked in. Here's the code:
FilterBar — Visual Code
import { useState } from "react";

// ── Demo filter schema — replace with real filter definitions ─────────────────
const FILTER_GROUPS = [
  {
    id:      "status",
    label:   "Status",
    filters: [
      { id: "todo",        label: "To Do"       },
      { id: "inprogress",  label: "In Progress" },
      { id: "done",        label: "Done"        },
      { id: "blocked",     label: "Blocked"     },
    ],
  },
  {
    id:      "category",
    label:   "Category",
    filters: [
      { id: "youtube",   label: "YouTube"   },
      { id: "writing",   label: "Writing"   },
      { id: "design",    label: "Design"    },
      { id: "marketing", label: "Marketing" },
    ],
  },
  {
    id:      "assignee",
    label:   "Assignee",
    filters: [
      { id: "u1", label: "Alex"   },
      { id: "u2", label: "Sam"    },
      { id: "u3", label: "Jordan" },
    ],
  },
  {
    id:      "priority",
    label:   "Priority",
    filters: [
      { id: "high",   label: "High"   },
      { id: "medium", label: "Medium" },
      { id: "low",    label: "Low"    },
    ],
  },
];

// Priority chips use the reserved pink palette, others use muted
const PRIORITY_CHIP_COLORS = {
  high:   "rgb(220 80 100)",
  medium: "rgb(255 163 205)",
  low:    "rgb(255 210 230)",
};

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({ filter, groupId, isActive, onToggle }) {
  const [hovered, setHovered] = useState(false);

  // Priority group uses reserved colors, everything else uses primary
  const activeColor = groupId === "priority"
    ? PRIORITY_CHIP_COLORS[filter.id]
    : "var(--color-primary)";

  return (
    <button
      aria-pressed={isActive}
      onClick={() => onToggle(filter.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e)  => { e.currentTarget.style.boxShadow = `0 0 0 2px ${activeColor}`; }}
      onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             "0.3rem",
        fontFamily:      "var(--font-body)",
        fontSize:        "0.72rem",
        fontWeight:      isActive ? 600 : 400,
        padding:         "0.25rem 0.625rem",
        borderRadius:    "var(--radius-control)",
        border:          "1px solid",
        borderColor:     isActive
                           ? activeColor
                           : hovered
                           ? "var(--color-text)"
                           : "var(--color-border-subtle)",
        backgroundColor: isActive
                           ? `color-mix(in srgb, ${activeColor} 12%, transparent)`
                           : "transparent",
        color:           isActive
                           ? activeColor
                           : hovered
                           ? "var(--color-text)"
                           : "var(--color-muted)",
        cursor:          "pointer",
        outline:         "none",
        transition:      "all 0.15s ease",
        flexShrink:      0,
      }}
    >
      {/* Active dot */}
      {isActive && (
        <span
          style={{
            width:           "5px",
            height:          "5px",
            borderRadius:    "50%",
            backgroundColor: activeColor,
            flexShrink:      0,
          }}
        />
      )}
      {filter.label}
    </button>
  );
}

// ── Filter group ──────────────────────────────────────────────────────────────

function FilterGroup({ group, activeFilters, onToggle }) {
  const activeCount = group.filters.filter((f) => activeFilters.includes(f.id)).length;

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        gap:           "0.5rem",
      }}
    >
      {/* Group label */}
      <div
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        "0.375rem",
        }}
      >
        <span
          style={{
            fontFamily:    "var(--font-body)",
            fontSize:      "0.65rem",
            fontWeight:    600,
            color:         "var(--color-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {group.label}
        </span>
        {activeCount > 0 && (
          <span
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.6rem",
              fontWeight:      700,
              color:           "var(--color-primary)",
              backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
              border:          "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
              borderRadius:    "var(--radius-control)",
              padding:         "0.1rem 0.35rem",
            }}
          >
            {activeCount}
          </span>
        )}
      </div>

      {/* Chips */}
      <div
        style={{
          display:  "flex",
          flexWrap: "wrap",
          gap:      "0.375rem",
        }}
      >
        {group.filters.map((filter) => (
          <FilterChip
            key={filter.id}
            filter={filter}
            groupId={group.id}
            isActive={activeFilters.includes(filter.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

// ── Funnel icon ───────────────────────────────────────────────────────────────

function FunnelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FilterBar({
  filterGroups  = FILTER_GROUPS,
  activeFilters = [],
  onFilterToggle,
  onClearAll,
}) {
  const [expanded, setExpanded] = useState(false);
  const totalActive = activeFilters.length;

  return (
    <div style={{ position: "relative" }}>

      {/* Trigger button */}
      <div
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        "0.5rem",
          padding:    "0.375rem 0.75rem",
          borderBottom: expanded
            ? "none"
            : "1px solid var(--color-border-subtle)",
        }}
      >
        <button
          aria-expanded={expanded}
          aria-controls="filter-panel"
          onClick={() => setExpanded((v) => !v)}
          onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
          onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
          style={{
            display:         "flex",
            alignItems:      "center",
            gap:             "0.375rem",
            fontFamily:      "var(--font-body)",
            fontSize:        "0.72rem",
            fontWeight:      expanded || totalActive > 0 ? 600 : 400,
            padding:         "0.25rem 0.5rem",
            borderRadius:    "var(--radius-control)",
            border:          "1px solid",
            borderColor:     expanded || totalActive > 0
                               ? "var(--color-primary)"
                               : "var(--color-border-subtle)",
            backgroundColor: expanded || totalActive > 0
                               ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                               : "transparent",
            color:           expanded || totalActive > 0
                               ? "var(--color-primary)"
                               : "var(--color-muted)",
            cursor:          "pointer",
            outline:         "none",
            transition:      "all 0.15s ease",
          }}
        >
          <FunnelIcon />
          Filter

          {/* Active count badge */}
          {totalActive > 0 && (
            <span
              style={{
                fontFamily:      "var(--font-body)",
                fontSize:        "0.6rem",
                fontWeight:      700,
                color:           "var(--color-on-primary)",
                backgroundColor: "var(--color-primary)",
                borderRadius:    "var(--radius-control)",
                padding:         "0.1rem 0.35rem",
                lineHeight:      1.2,
              }}
            >
              {totalActive}
            </span>
          )}
        </button>

        {/* Clear all — only when filters active and panel is closed */}
        {totalActive > 0 && !expanded && (
          <button
            onClick={onClearAll}
            onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
            onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
            style={{
              fontFamily:      "var(--font-body)",
              fontSize:        "0.7rem",
              color:           "var(--color-muted)",
              backgroundColor: "transparent",
              border:          "none",
              cursor:          "pointer",
              outline:         "none",
              padding:         "0.25rem 0.25rem",
              transition:      "color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-danger)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-muted)"; }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Overlay filter panel */}
      {expanded && (
        <>
          {/* Invisible backdrop to close on outside click */}
          <div
            aria-hidden="true"
            onClick={() => setExpanded(false)}
            style={{
              position: "fixed",
              inset:    0,
              zIndex:   40,
            }}
          />

          {/* Panel */}
          <div
            id="filter-panel"
            role="region"
            aria-label="Filters"
            style={{
              position:        "absolute",
              top:             "calc(100% + 4px)",
              left:            0,
              zIndex:          50,
              backgroundColor: "var(--color-surface-elevated)",
              border:          "1px solid var(--color-border-subtle)",
              borderRadius:    "var(--radius-panel)",
              padding:         "0.875rem",
              minWidth:        "320px",
              maxWidth:        "480px",
              boxShadow:       "0 8px 24px rgb(0 0 0 / 0.2)",
              display:         "flex",
              flexDirection:   "column",
              gap:             "1rem",
            }}
          >
            {/* Panel header */}
            <div
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize:   "0.8rem",
                  fontWeight: 700,
                  color:      "var(--color-text)",
                }}
              >
                Filters
              </span>

              {totalActive > 0 && (
                <button
                  onClick={() => { onClearAll?.(); }}
                  onFocus={(e)  => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-primary)"; }}
                  onBlur={(e)   => { e.currentTarget.style.boxShadow = "none"; }}
                  style={{
                    fontFamily:      "var(--font-body)",
                    fontSize:        "0.7rem",
                    color:           "var(--color-danger)",
                    backgroundColor: "transparent",
                    border:          "none",
                    cursor:          "pointer",
                    outline:         "none",
                    padding:         "0.25rem 0.25rem",
                    transition:      "opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Filter groups */}
            {filterGroups.map((group) => (
              <FilterGroup
                key={group.id}
                group={group}
                activeFilters={activeFilters}
                onToggle={onFilterToggle}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
Implementation notes for the programmer:
	•	activeFilters and onFilterToggle are props — parent owns filter state. onFilterToggle receives a single filter id and the parent toggles it in or out of the active array. onClearAll resets the array to empty.
	•	The backdrop div uses position: fixed to catch outside clicks — same pattern as the popovers in earlier components. Also wire Escape keydown to setExpanded(false).
	•	expanded is local visual state only — the panel open/closed state does not need to live in the parent.
	•	Priority chips use the reserved pink color palette — this is intentional and consistent with the priority color system across Timeline, Calendar, and Tasks. Do not remap these colors.
	•	The panel is position: absolute anchored to the trigger — make sure no ancestor has overflow: hidden or the panel will be clipped.
	•	color-mix(in srgb, ...) used throughout for tints — replace with hardcoded rgba if older browser support is needed.
