import assert from "node:assert/strict"
import test from "node:test"

import {
  NOT_AVAILABLE,
  PERCENT_UNAVAILABLE,
  compareScenarioValue,
  compareScenarios,
  computeSeriesBounds,
  countInvalidPoints,
  describeSeries,
  formatNumber,
  formatPercent,
  formatQuantity,
  humanizeFieldName,
  isValidPoint,
  splitIntoSegments,
  validateNumericInput,
} from "../../lib/games/runtime/simulation/ui/index.js"

test("formats numbers at fixed significant digits across magnitudes", () => {
  assert.equal(formatNumber(9.80665), "9.807")
  assert.equal(formatNumber(123456), "123500")
  assert.equal(formatNumber(0.00123456), "0.001235")
  assert.equal(formatNumber(0.000123456), "1.235e-4")
  assert.equal(formatNumber(12345678), "1.235e+7")
  assert.equal(formatNumber(1.5, { significantDigits: 6 }), "1.5")
  assert.equal(formatNumber(2), "2")
})

test("formats zero, negative zero, and signed values without artefacts", () => {
  assert.equal(formatNumber(0), "0")
  assert.equal(formatNumber(-0), "0")
  assert.equal(formatNumber(1.25, { signed: true }), "+1.25")
  assert.equal(formatNumber(-1.25, { signed: true }), "-1.25")
})

test("non-finite values never render as numbers", () => {
  for (const value of [NaN, Infinity, -Infinity, null, undefined, "3"]) {
    assert.equal(formatNumber(value), NOT_AVAILABLE)
    assert.equal(formatQuantity(value, "m"), NOT_AVAILABLE)
    assert.equal(formatPercent(value), NOT_AVAILABLE)
  }
  assert.equal(formatNumber(NaN, { notAvailable: "n/a" }), "n/a")
})

test("quantities carry their unit, dimensionless values do not", () => {
  assert.equal(formatQuantity(4.2, "mm"), "4.2 mm")
  assert.equal(formatQuantity(4.2, ""), "4.2")
  assert.equal(formatQuantity(4.2, "1"), "4.2")
  assert.equal(formatQuantity(4.2, null), "4.2")
})

test("percentages round, trim, and can be signed", () => {
  assert.equal(formatPercent(12.5), "12.5%")
  assert.equal(formatPercent(12.5, { signed: true }), "+12.5%")
  assert.equal(formatPercent(-3.456), "-3.46%")
  assert.equal(formatPercent(0), "0%")
  assert.equal(formatPercent(-0.001), "0%")
})

test("field names become readable labels", () => {
  assert.equal(humanizeFieldName("initialSpeed"), "Initial speed")
  assert.equal(humanizeFieldName("max_deflection"), "Max deflection")
  assert.equal(humanizeFieldName(""), "")
})

test("comparison reports signed absolute and relative differences", () => {
  const row = compareScenarioValue({
    field: "horizontalRange",
    unit: "m",
    baseline: 40,
    modified: 50,
  })

  assert.equal(row.label, "Horizontal range")
  assert.equal(row.absoluteDifference, 10)
  assert.equal(row.percentDifference, 25)
  assert.equal(row.percentUnavailableReason, null)
  assert.equal(row.changed, true)
  assert.equal(row.complete, true)
})

test("relative change is normalised by the baseline magnitude", () => {
  const row = compareScenarioValue({ baseline: -40, modified: -50 })
  assert.equal(row.absoluteDifference, -10)
  assert.equal(row.percentDifference, -25)
})

test("percentage difference is withheld when the baseline is zero", () => {
  const row = compareScenarioValue({ baseline: 0, modified: 5 })
  assert.equal(row.absoluteDifference, 5)
  assert.equal(row.percentDifference, null)
  assert.equal(row.percentUnavailableReason, PERCENT_UNAVAILABLE.BASELINE_ZERO)
})

test("percentage and absolute differences are withheld for non-finite values", () => {
  for (const [baseline, modified] of [
    [NaN, 5],
    [5, Infinity],
    [undefined, 5],
    [5, null],
  ]) {
    const row = compareScenarioValue({ baseline, modified })
    assert.equal(row.absoluteDifference, null)
    assert.equal(row.percentDifference, null)
    assert.equal(row.percentUnavailableReason, PERCENT_UNAVAILABLE.NOT_FINITE)
    assert.equal(row.complete, false)
    assert.equal(row.changed, null)
  }
})

test("an unchanged value compares to a zero difference, not a missing one", () => {
  const row = compareScenarioValue({ baseline: 3, modified: 3 })
  assert.equal(row.absoluteDifference, 0)
  assert.equal(row.percentDifference, 0)
  assert.equal(row.changed, false)
})

test("scenario comparison keeps the declared field order", () => {
  const rows = compareScenarios({
    fields: [
      { field: "range", unit: "m" },
      { field: "apex", label: "Maximum height", unit: "m" },
      "flightTime",
    ],
    baseline: { apex: 10, range: 40, flightTime: 2 },
    modified: { apex: 12, range: 44, flightTime: 2 },
  })

  assert.deepEqual(
    rows.map((row) => row.field),
    ["range", "apex", "flightTime"]
  )
  assert.equal(rows[1].label, "Maximum height")
  assert.equal(rows[2].label, "Flight time")
  assert.equal(rows[2].changed, false)
})

test("scenario comparison rejects malformed field descriptors", () => {
  assert.throws(() => compareScenarios({ fields: "range" }), /fields/)
  assert.throws(() => compareScenarios({ fields: [{}] }), /name a key/)
  assert.throws(
    () => compareScenarios({ fields: [null] }),
    /string or an object/
  )
})

test("numeric validation accepts values on the boundary", () => {
  const rules = { label: "Span", unit: "m", min: 1, max: 10, step: 0.5 }
  assert.deepEqual(validateNumericInput("1", rules), {
    valid: true,
    value: 1,
    error: null,
  })
  assert.equal(validateNumericInput("10", rules).value, 10)
  assert.equal(validateNumericInput(" 2.5 ", rules).value, 2.5)
  assert.equal(validateNumericInput(7.5, rules).value, 7.5)
})

test("numeric validation names the field and the unit in every message", () => {
  const rules = { label: "Span", unit: "m", min: 1, max: 10, step: 0.5 }
  assert.match(validateNumericInput("", rules).error, /^Span is required\.$/)
  assert.match(
    validateNumericInput("abc", rules).error,
    /Span must be a number/
  )
  assert.match(validateNumericInput("12abc", rules).error, /must be a number/)
  assert.match(validateNumericInput("0.5", rules).error, /at least 1 m/)
  assert.match(validateNumericInput("11", rules).error, /at most 10 m/)
  assert.match(validateNumericInput("2.2", rules).error, /multiple of 0\.5 m/)
})

test("rejected numeric input never yields a value", () => {
  const rules = { label: "Span", unit: "m", min: 1, max: 10 }
  for (const raw of ["", "abc", "0", "99", "NaN", "Infinity"]) {
    const result = validateNumericInput(raw, rules)
    assert.equal(result.valid, false)
    assert.equal(result.value, null)
  }
})

test("an optional field accepts emptiness as an absent value", () => {
  const result = validateNumericInput("", { label: "Drag", required: false })
  assert.deepEqual(result, { valid: true, value: null, error: null })
})

test("step checking tolerates floating point representation error", () => {
  const rules = { label: "Time", unit: "s", min: 0, step: 0.1 }
  assert.equal(validateNumericInput("0.3", rules).valid, true)
  assert.equal(validateNumericInput(0.1 + 0.2, rules).valid, true)
  assert.equal(validateNumericInput("0.35", rules).valid, false)
})

test("the step grid starts at the minimum, not at zero", () => {
  const rules = { label: "Angle", unit: "deg", min: 5, step: 10 }
  assert.equal(validateNumericInput("15", rules).valid, true)
  assert.equal(validateNumericInput("10", rules).valid, false)
  assert.equal(
    validateNumericInput("10", { ...rules, stepBase: 0 }).valid,
    true
  )
})

test("a point is plottable only when both coordinates are finite", () => {
  assert.equal(isValidPoint({ x: 1, y: 2 }), true)
  for (const point of [
    { x: 1, y: NaN },
    { x: Infinity, y: 2 },
    { x: 1 },
    { x: "1", y: 2 },
    null,
    undefined,
  ]) {
    assert.equal(isValidPoint(point), false)
  }
})

test("series break at invalid points instead of interpolating across them", () => {
  const segments = splitIntoSegments([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: NaN },
    { x: 3, y: 3 },
    { x: 4, y: 4 },
  ])

  assert.equal(segments.length, 2)
  assert.deepEqual(segments[0], [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ])
  assert.deepEqual(segments[1], [
    { x: 3, y: 3 },
    { x: 4, y: 4 },
  ])
})

test("a lone valid point survives as its own segment", () => {
  const segments = splitIntoSegments([
    { x: 0, y: NaN },
    { x: 1, y: 1 },
    { x: 2, y: NaN },
  ])
  assert.deepEqual(segments, [[{ x: 1, y: 1 }]])
  assert.deepEqual(splitIntoSegments([]), [])
  assert.deepEqual(splitIntoSegments([{ x: 0, y: NaN }]), [])
})

test("invalid points are counted so a plot can disclose what it omitted", () => {
  assert.equal(countInvalidPoints([{ x: 0, y: 0 }, { x: 1, y: NaN }, null]), 2)
  assert.equal(countInvalidPoints([]), 0)
})

test("bounds span every valid point across every series", () => {
  const bounds = computeSeriesBounds([
    {
      label: "a",
      points: [
        { x: 0, y: -2 },
        { x: 4, y: 3 },
      ],
    },
    {
      label: "b",
      points: [
        { x: 2, y: 9 },
        { x: 6, y: NaN },
      ],
    },
  ])

  assert.deepEqual(bounds, {
    minX: 0,
    maxX: 4,
    minY: -2,
    maxY: 9,
    pointCount: 3,
  })
})

test("bounds are absent when nothing is plottable", () => {
  assert.equal(computeSeriesBounds([]), null)
  assert.equal(computeSeriesBounds([{ label: "a", points: [] }]), null)
  assert.equal(
    computeSeriesBounds([{ label: "a", points: [{ x: 0, y: NaN }] }]),
    null
  )
})

test("a degenerate axis is padded rather than left with zero width", () => {
  const bounds = computeSeriesBounds([
    {
      label: "flat",
      points: [
        { x: 2, y: 5 },
        { x: 2, y: 5 },
      ],
    },
  ])
  assert.ok(bounds.maxX > bounds.minX)
  assert.ok(bounds.maxY > bounds.minY)

  const atZero = computeSeriesBounds([
    { label: "zero", points: [{ x: 0, y: 0 }] },
  ])
  assert.deepEqual(
    [atZero.minX, atZero.maxX, atZero.minY, atZero.maxY],
    [-0.5, 0.5, -0.5, 0.5]
  )
})

test("the text alternative states range, endpoints, and omissions", () => {
  const description = describeSeries(
    [
      {
        label: "Height",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
          { x: 2, y: NaN },
          { x: 3, y: 2 },
        ],
      },
    ],
    { x: { label: "Time", unit: "s" }, y: { label: "Height", unit: "m" } }
  )

  assert.match(description, /Height: 3 points/)
  assert.match(description, /Time 0 s to 3 s/)
  assert.match(description, /starts at 0 m, ends at 2 m/)
  assert.match(description, /ranging from 0 m to 5 m/)
  assert.match(description, /1 of 4 points omitted as invalid/)
})

test("the text alternative admits when there is nothing to describe", () => {
  assert.equal(describeSeries([]), "No series to plot.")
  assert.match(
    describeSeries([{ label: "Shear", points: [{ x: 0, y: NaN }] }]),
    /Shear: no plottable points\. 1 of 1 point omitted as invalid\./
  )
})
