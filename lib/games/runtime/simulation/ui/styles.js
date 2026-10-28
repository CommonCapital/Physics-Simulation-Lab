/**
 * The report's stylesheet, injected once on first use.
 *
 * Same approach as the engine HUD: a sandbox has no bundler and no CSS
 * imports, so a self-contained module that appends a <style> is how a
 * component arrives already looking finished. The class prefix is `sim-`
 * rather than `hud-` deliberately — the two are different surfaces and must
 * never inherit each other's rules. Scientific results do not belong in the
 * game HUD.
 *
 * The palette is the one in style.css, read through the same custom
 * properties where they exist so a game that retunes them retunes this too.
 * Contrast was chosen against the dark ground: body text and headings sit
 * above 12:1, the muted grey above 5.5:1, and error red above 4.5:1.
 */

const STYLE_ID = "simulation-ui-style"

const CSS = `
.sim-panel {
  --sim-ink: var(--ink, #0a0a0a);
  --sim-surface: rgba(18, 18, 18, 0.94);
  --sim-line: rgba(255, 255, 255, 0.11);
  --sim-snow: var(--snow, #ededed);
  --sim-mist: #b4b4b4;
  --sim-ember: var(--ember, #ea580c);
  --sim-amber: var(--amber, #fb923c);
  --sim-danger: #fca5a5;
  --sim-ok: #86efac;

  position: absolute;
  top: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: min(420px, 100vw);
  max-height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding:
    calc(16px + env(safe-area-inset-top))
    calc(16px + env(safe-area-inset-right))
    calc(16px + env(safe-area-inset-bottom))
    16px;
  gap: 14px;
  background: var(--sim-surface);
  border-left: 1px solid var(--sim-line);
  color: var(--sim-snow);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  /* The page sets these for a game that is dragged; a report is read and
     copied out of, so it opts back in. */
  user-select: text;
  -webkit-user-select: text;
  touch-action: pan-y;
}
.sim-panel[hidden] { display: none; }

.sim-panel :focus-visible {
  outline: 2px solid var(--sim-amber);
  outline-offset: 2px;
}

.sim-header { display: grid; gap: 8px; }
.sim-title {
  margin: 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.sim-badge {
  justify-self: start;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--sim-line);
  background: rgba(255, 255, 255, 0.06);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--sim-amber);
}
.sim-badge[data-mode="preliminary-engineering"] { color: var(--sim-amber); }
.sim-badge[data-mode="educational"] { color: #93c5fd; }
.sim-badge[data-mode="conceptual-visualization"] { color: #d8b4fe; }
.sim-badge-note { margin: 0; color: var(--sim-mist); font-size: 12px; }

.sim-section { display: grid; gap: 6px; }
.sim-section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sim-mist);
}
.sim-section p { margin: 0; }
.sim-section ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }

.sim-definitions {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  font-variant-numeric: tabular-nums;
}
.sim-definitions dt { color: var(--sim-mist); min-width: 0; }
.sim-definitions dd { margin: 0; text-align: right; font-weight: 600; }

.sim-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 650;
}
.sim-status::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.sim-status[data-status="verified"] { color: var(--sim-ok); }
.sim-status[data-status="partially-verified"] { color: var(--sim-amber); }
.sim-status[data-status="unverified"] { color: var(--sim-danger); }

.sim-field { display: grid; gap: 4px; }
.sim-field-label { font-weight: 600; }
.sim-field-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--sim-line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}
.sim-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  /* The outline lives on the wrapper so the unit stays inside the ring. */
  outline: none;
}
.sim-field-unit { color: var(--sim-mist); white-space: nowrap; }
.sim-field-hint { color: var(--sim-mist); font-size: 12px; }
.sim-field-error { color: var(--sim-danger); font-size: 12px; min-height: 0; }
.sim-field-error:empty { display: none; }
.sim-field[data-invalid="true"] .sim-field-input {
  border-color: var(--sim-danger);
}

.sim-plot { display: grid; gap: 6px; }
.sim-plot svg { width: 100%; height: auto; display: block; }
.sim-plot-axis { stroke: rgba(255, 255, 255, 0.28); stroke-width: 1; }
.sim-plot-grid { stroke: rgba(255, 255, 255, 0.07); stroke-width: 1; }
.sim-plot-tick { fill: var(--sim-mist); font-size: 9px; }
.sim-plot-axis-label { fill: var(--sim-mist); font-size: 10px; letter-spacing: 0.04em; }
.sim-plot-line { fill: none; stroke-width: 1.75; stroke-linejoin: round; stroke-linecap: round; }
.sim-plot-dot { stroke: none; }
.sim-plot-empty {
  padding: 18px 12px;
  border: 1px dashed var(--sim-line);
  border-radius: 8px;
  text-align: center;
  color: var(--sim-mist);
}
.sim-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none; }
.sim-legend li { display: flex; align-items: center; gap: 6px; color: var(--sim-mist); }
.sim-legend-swatch { width: 10px; height: 2px; border-radius: 999px; }
.sim-plot-note { margin: 0; color: var(--sim-amber); font-size: 12px; }
.sim-plot-data summary { cursor: pointer; color: var(--sim-mist); font-size: 12px; }

.sim-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.sim-table caption {
  text-align: left;
  color: var(--sim-mist);
  font-size: 12px;
  padding-bottom: 4px;
}
.sim-table th, .sim-table td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--sim-line);
  text-align: right;
  white-space: nowrap;
}
.sim-table th:first-child, .sim-table td:first-child {
  text-align: left;
  white-space: normal;
}
.sim-table thead th {
  color: var(--sim-mist);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
}
.sim-table td[data-unavailable="true"] { color: var(--sim-mist); font-weight: 400; }

/* For text that must reach a screen reader but would repeat what is already
   on screen for everyone else. */
.sim-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 720px) {
  .sim-panel {
    position: static;
    width: 100%;
    max-height: 50vh;
    border-left: 0;
    border-top: 1px solid var(--sim-line);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sim-panel, .sim-panel * {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
`

export function ensureSimulationStyles(document_ = document) {
  if (document_.getElementById(STYLE_ID)) return
  const style = document_.createElement("style")
  style.id = STYLE_ID
  style.textContent = CSS
  document_.head.appendChild(style)
}
