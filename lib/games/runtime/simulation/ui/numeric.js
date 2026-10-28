/**
 * Validation for a numeric input, decided before any DOM is touched.
 *
 * The browser's own `<input type="number">` constraint validation is not
 * enough on its own here: its messages say "Value must be less than or equal
 * to 30" with no unit, it reports a blank field and a typed `abc` the same
 * way, and `:invalid` styling alone tells a screen reader nothing. So the
 * rules live here as a pure function, the control renders the message it
 * returns, and the same function can be run over a whole form before a
 * solver is called.
 *
 * Returns `{ valid, value, error }`. `value` is null whenever `valid` is
 * false, so a caller can never accidentally feed a rejected number onward.
 */

import { formatQuantity } from "./format.js"

function withUnit(value, unit) {
  return formatQuantity(value, unit, { significantDigits: 6 })
}

/**
 * How far off a step a value may sit and still count as on it.
 *
 * Floating point makes exact step arithmetic a trap: 0.1 + 0.2 lands at
 * 0.30000000000000004, which is not a multiple of 0.1 by any exact test but
 * is certainly what the person typing meant. The tolerance scales with the
 * magnitudes involved so it stays meaningful for both millimetres and
 * megapascals.
 */
function isOnStep(value, step, base) {
  const offset = value - base
  const steps = Math.round(offset / step)
  const tolerance =
    1e-9 * Math.max(Math.abs(value), Math.abs(base), Math.abs(step))
  return Math.abs(offset - steps * step) <= tolerance
}

export function validateNumericInput(rawValue, options = {}) {
  const {
    label = "Value",
    unit = "",
    min,
    max,
    step,
    // Where the step grid starts. `min` when there is one, because that is
    // what a browser does and what a reader assumes.
    stepBase = typeof min === "number" ? min : 0,
    required = true,
  } = options

  const text =
    typeof rawValue === "number" ? String(rawValue) : `${rawValue ?? ""}`.trim()

  if (text === "") {
    return required
      ? { valid: false, value: null, error: `${label} is required.` }
      : { valid: true, value: null, error: null }
  }

  // `Number` rather than `parseFloat`: parseFloat("12abc") is 12, which would
  // silently accept a typo as a measurement.
  const value = Number(text)
  if (!Number.isFinite(value)) {
    return {
      valid: false,
      value: null,
      error: `${label} must be a number.`,
    }
  }

  if (typeof min === "number" && value < min) {
    return {
      valid: false,
      value: null,
      error: `${label} must be at least ${withUnit(min, unit)}.`,
    }
  }

  if (typeof max === "number" && value > max) {
    return {
      valid: false,
      value: null,
      error: `${label} must be at most ${withUnit(max, unit)}.`,
    }
  }

  if (
    typeof step === "number" &&
    step > 0 &&
    !isOnStep(value, step, stepBase)
  ) {
    return {
      valid: false,
      value: null,
      error: `${label} must be a multiple of ${withUnit(step, unit)} from ${withUnit(stepBase, unit)}.`,
    }
  }

  return { valid: true, value, error: null }
}
