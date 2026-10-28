/**
 * Number and quantity formatting for the simulation report.
 *
 * Every number a reader sees passes through here, for two reasons. The first
 * is consistency: a result written `9.81` in one section and `9.810000000001`
 * two sections down reads as two different numbers. The second is honesty —
 * a value that is not a finite number is never quietly rendered as `NaN` or
 * `Infinity` next to real results, because both look like measurements. They
 * become an explicit placeholder instead.
 *
 * Nothing in this file touches the DOM, so it is testable on its own.
 */

/** What stands in for a value that could not be computed. */
export const NOT_AVAILABLE = "—"

/** A unit string that means "this quantity is a bare ratio or count". */
function isDimensionless(unit) {
  return unit === undefined || unit === null || unit === "" || unit === "1"
}

export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

/**
 * `123.4500` -> `123.45`, `100` -> `100`.
 *
 * Only ever called on a fixed-notation string, so a bare `.` left behind by
 * the trim is always a trailing decimal point and safe to drop.
 */
function trimTrailingZeros(text) {
  if (!text.includes(".")) return text
  return text.replace(/0+$/, "").replace(/\.$/, "")
}

/**
 * A number at a fixed number of significant digits.
 *
 * Engineering results span a wide range — a deflection in metres is often
 * 1e-4 while a bending moment is 1e5 — so significant digits are the right
 * knob rather than decimal places, which would print either six zeros or
 * nothing useful depending on the quantity. Values outside the range a reader
 * can scan at a glance switch to exponential form for the same reason.
 */
export function formatNumber(value, options = {}) {
  const {
    significantDigits = 4,
    notAvailable = NOT_AVAILABLE,
    signed = false,
  } = options

  if (!isFiniteNumber(value)) return notAvailable
  if (!Number.isInteger(significantDigits) || significantDigits < 1) {
    throw new RangeError("significantDigits must be a positive integer")
  }

  // `-0` is a rounding artefact, never a measurement. It prints as zero.
  if (value === 0) return "0"

  const magnitude = Math.abs(value)
  let text
  if (magnitude >= 1e6 || magnitude < 1e-3) {
    // The trim has to reach the mantissa: `1.2300e+7` ends in the exponent,
    // so trimming the whole string would leave the zeros in place.
    const [mantissa, exponent] = value
      .toExponential(significantDigits - 1)
      .split("e")
    text = `${trimTrailingZeros(mantissa)}e${exponent}`
  } else {
    const exponent = Math.floor(Math.log10(magnitude))
    const decimals = Math.min(Math.max(significantDigits - 1 - exponent, 0), 20)
    // `toPrecision` does the rounding but switches to exponential notation
    // once the integer part outgrows the digit count, which is not wanted in
    // this range; rounding through it and re-printing fixed keeps both.
    text = trimTrailingZeros(
      Number(value.toPrecision(significantDigits)).toFixed(decimals)
    )
  }

  return signed && value > 0 ? `+${text}` : text
}

/** A number with its unit, e.g. `12.35 m`. Unitless values lose the space. */
export function formatQuantity(value, unit, options = {}) {
  const text = formatNumber(value, options)
  if (text === (options.notAvailable ?? NOT_AVAILABLE)) return text
  return isDimensionless(unit) ? text : `${text} ${unit}`
}

/**
 * A percentage.
 *
 * `value` is already a percentage, not a ratio — the comparison helpers hand
 * over `12.5` for "twelve and a half percent", and doing the ×100 in one place
 * upstream keeps the two from drifting apart.
 */
export function formatPercent(value, options = {}) {
  const { decimals = 2, notAvailable = NOT_AVAILABLE, signed = false } = options
  if (!isFiniteNumber(value)) return notAvailable

  const text = trimTrailingZeros(value.toFixed(decimals))
  const sign = signed && value > 0 ? "+" : ""
  return `${sign}${text === "-0" ? "0" : text}%`
}

/** `initialSpeed` -> `Initial speed`, for a label nobody remembered to write. */
export function humanizeFieldName(field) {
  if (typeof field !== "string" || field === "") return ""

  const words = field
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    // Sentence case, not title case — but an all-caps word is an acronym
    // (`RMS`, `SI`) and lowercasing it would be a different word.
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()))

  if (words.length === 0 || words[0] === "") return ""
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1)
  return words.join(" ")
}
