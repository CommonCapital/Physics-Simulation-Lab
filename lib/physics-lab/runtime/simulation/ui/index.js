/**
 * Browser-side UI primitives for presenting a simulation honestly:
 * what went in, what the model assumes, what came out, and how far the
 * result can be trusted.
 *
 * Framework-free and dependency-free — a sandbox has no bundler, no
 * node_modules and no build step, so these are plain ES modules loaded
 * straight by the browser.
 */

export {
  NOT_AVAILABLE,
  formatNumber,
  formatPercent,
  formatQuantity,
  humanizeFieldName,
  isFiniteNumber,
} from "./format.js"

export {
  PERCENT_UNAVAILABLE,
  compareScenarioValue,
  compareScenarios,
} from "./compare.js"

export { validateNumericInput } from "./numeric.js"

export {
  computeSeriesBounds,
  countInvalidPoints,
  describeSeries,
  isValidPoint,
  splitIntoSegments,
} from "./series.js"

export { createNumericField, validateFields } from "./controls.js"

export { createPlot } from "./plot.js"

export { createComparisonTable } from "./comparison.js"

export {
  SIMULATION_MODES,
  VERIFICATION_STATUSES,
  createSimulationPanel,
} from "./panel.js"

export { ensureSimulationStyles } from "./styles.js"
