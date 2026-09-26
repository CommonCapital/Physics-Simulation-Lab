/**
 * Baseline-versus-modified comparison, as numbers rather than markup.
 *
 * The one rule this file exists to enforce: a percentage difference is only
 * reported when it is mathematically meaningful. Against a baseline of zero
 * the relative change is undefined, not "infinite" and certainly not "100%",
 * and a report that prints a number there is inventing a result. Every row
 * therefore carries both the value and the reason it is absent, so the
 * renderer can say *why* the cell is empty instead of leaving a dash.
 *
 * Nothing here touches the DOM.
 */

import { humanizeFieldName, isFiniteNumber } from "./format.js"

/** Why a percentage difference could not be computed. */
export const PERCENT_UNAVAILABLE = Object.freeze({
  BASELINE_ZERO: "baseline is zero, so relative change is undefined",
  NOT_FINITE: "a compared value is not a finite number",
})

/**
 * One row of a comparison.
 *
 * The absolute difference is `modified - baseline`, so its sign answers "which
 * way did it move" without the reader having to subtract in their head. The
 * percentage is normalised by `|baseline|`, which keeps that same sign
 * meaningful when the baseline itself is negative.
 */
export function compareScenarioValue(options = {}) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const { field = "", label, unit = "", baseline, modified } = options
  const resolvedLabel = label ?? humanizeFieldName(field) ?? ""

  const bothFinite = isFiniteNumber(baseline) && isFiniteNumber(modified)
  const absoluteDifference = bothFinite ? modified - baseline : null

  let percentDifference = null
  let percentUnavailableReason = null
  if (!bothFinite) {
    percentUnavailableReason = PERCENT_UNAVAILABLE.NOT_FINITE
  } else if (baseline === 0) {
    percentUnavailableReason = PERCENT_UNAVAILABLE.BASELINE_ZERO
  } else {
    percentDifference = (absoluteDifference / Math.abs(baseline)) * 100
  }

  return Object.freeze({
    field,
    label: resolvedLabel,
    unit,
    baseline: isFiniteNumber(baseline) ? baseline : null,
    modified: isFiniteNumber(modified) ? modified : null,
    absoluteDifference,
    percentDifference,
    percentUnavailableReason,
    // `changed` is deliberately exact. A tolerance here would be a physical
    // judgement — how much movement matters depends on the quantity — and
    // that belongs to the model, not to a formatting helper.
    changed: bothFinite ? modified !== baseline : null,
    complete: bothFinite,
  })
}

/**
 * A whole comparison table.
 *
 * `fields` describes what to compare and in what order; `baseline` and
 * `modified` are plain records of numbers in the units the field declares.
 * Taking the field list explicitly rather than walking the objects means a
 * scenario that gained a key does not silently reorder the report.
 */
export function compareScenarios(options = {}) {
  const { fields, baseline = {}, modified = {} } = options
  if (!Array.isArray(fields)) {
    throw new TypeError("fields must be an array")
  }
  if (baseline === null || typeof baseline !== "object") {
    throw new TypeError("baseline must be an object")
  }
  if (modified === null || typeof modified !== "object") {
    throw new TypeError("modified must be an object")
  }

  return Object.freeze(
    fields.map((entry) => {
      const descriptor = typeof entry === "string" ? { field: entry } : entry
      if (descriptor === null || typeof descriptor !== "object") {
        throw new TypeError("each field must be a string or an object")
      }

      const { field, label, unit } = descriptor
      if (typeof field !== "string" || field === "") {
        throw new TypeError("each field must name a key")
      }

      return compareScenarioValue({
        field,
        label,
        unit,
        baseline: baseline[field],
        modified: modified[field],
      })
    })
  )
}
