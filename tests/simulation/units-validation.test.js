import assert from "node:assert/strict"
import test from "node:test"

import {
  SUPPORTED_UNITS,
  assertFiniteNumber,
  assertInRange,
  assertNonNegative,
  assertPositive,
  convertUnit,
  requireField,
} from "../../lib/games/runtime/simulation/index.js"

test("converts explicitly supported compatible units", () => {
  const conversions = [
    [1, "km", "m", 1000],
    [2, "min", "s", 120],
    [500, "mg", "kg", 5e-4],     // "g" is reserved for standard-gravity in acceleration
    [3, "kN", "N", 3000],
    [2, "MPa", "Pa", 2e6],
    [36, "km/h", "m/s", 10],
    [1, "km/s^2", "m/s^2", 1000],
    [180, "deg", "rad", Math.PI],
  ]

  for (const [value, fromUnit, toUnit, expected] of conversions) {
    assert.equal(convertUnit(value, fromUnit, toUnit), expected)
  }
  assert.ok(SUPPORTED_UNITS.force.includes("N"))
  assert.ok(SUPPORTED_UNITS.force.includes("kN"))
})

test("rejects unsupported, ambiguous, and incompatible units", () => {
  assert.throws(() => convertUnit(1, "meter", "m"), /fromUnit.*meter/)
  assert.throws(() => convertUnit(1, "M", "m"), /fromUnit.*M/)
  // error says "fromUnit X (quantity) is incompatible with toUnit Y (quantity)"
  assert.throws(() => convertUnit(1, "kg", "m"), /incompatible/)
})

test("validation accepts boundary values and returns the validated value", () => {
  assert.equal(requireField({ mass: 0 }, "mass"), 0)
  assert.equal(assertFiniteNumber(-2.5, "velocity"), -2.5)
  assert.equal(assertPositive(0.1, "timeStep"), 0.1)
  assert.equal(assertNonNegative(0, "energy"), 0)
  assert.equal(assertInRange(10, 0, 10, "temperature"), 10)
})

test("validation errors identify the affected field", () => {
  assert.throws(() => requireField({}, "mass"), /mass is required/)
  assert.throws(() => assertFiniteNumber(NaN, "velocity"), /velocity/)
  assert.throws(() => assertPositive(0, "timeStep"), /timeStep/)
  assert.throws(() => assertNonNegative(-1, "energy"), /energy/)
  assert.throws(() => assertInRange(11, 0, 10, "temperature"), /temperature/)
})
