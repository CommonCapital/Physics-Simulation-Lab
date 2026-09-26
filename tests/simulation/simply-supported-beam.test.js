import assert from "node:assert/strict"
import test from "node:test"

import {
  SIMPLY_SUPPORTED_BEAM_METADATA,
  absoluteError,
  solveSimplySupportedBeam,
} from "../../lib/games/runtime/simulation/index.js"

const NUMERICAL_TOLERANCE = 1e-12
const quantity = (value, unit) => ({ value, unit })

function assertClose(actual, expected) {
  const scale = Math.max(1, Math.abs(expected))
  assert.ok(absoluteError(actual, expected) <= NUMERICAL_TOLERANCE * scale)
}

function solvePointLoad(overrides = {}) {
  return solveSimplySupportedBeam({
    spanLength: quantity(10, "m"),
    youngModulus: quantity(200, "GPa"),
    secondMomentOfArea: quantity(5e10, "mm^4"),
    loadType: "central-point-load",
    pointLoad: quantity(100, "kN"),
    sampleCount: 11,
    ...overrides,
  })
}

function solveDistributedLoad(overrides = {}) {
  return solveSimplySupportedBeam({
    spanLength: quantity(10, "m"),
    youngModulus: quantity(200, "GPa"),
    secondMomentOfArea: quantity(5e10, "mm^4"),
    loadType: "uniform-distributed-load",
    distributedLoad: quantity(10, "kN/m"),
    sampleCount: 11,
    ...overrides,
  })
}

function assertSymmetric(result) {
  const lastIndex = result.deflectionSamples.length - 1
  for (let index = 0; index <= lastIndex; index += 1) {
    const mirrorIndex = lastIndex - index
    assertClose(
      result.bendingMomentSamples[index].value,
      result.bendingMomentSamples[mirrorIndex].value
    )
    assertClose(
      result.deflectionSamples[index].value,
      result.deflectionSamples[mirrorIndex].value
    )
    assertClose(
      result.shearForceSamples[index].value,
      -result.shearForceSamples[mirrorIndex].value
    )
  }
}

test("central point load satisfies equilibrium, symmetry, and support conditions", () => {
  const result = solvePointLoad()
  const appliedLoad = 100_000

  assertClose(
    result.supportReactions.left + result.supportReactions.right,
    appliedLoad
  )
  assertSymmetric(result)
  assert.equal(result.deflectionSamples[0].value, 0)
  assert.equal(result.deflectionSamples.at(-1).value, 0)
})

test("central point load maxima match closed-form results", () => {
  const result = solvePointLoad()
  const load = 100_000
  const span = 10
  const youngModulus = 200e9
  const secondMoment = 0.05

  assertClose(result.maximumBendingMoment.value, (load * span) / 4)
  assertClose(
    result.maximumDeflection.value,
    (load * span ** 3) / (48 * youngModulus * secondMoment)
  )
  assert.equal(result.maximumBendingMoment.position, span / 2)
  assert.equal(result.maximumDeflection.position, span / 2)
})

test("uniform load satisfies equilibrium, symmetry, and support conditions", () => {
  const result = solveDistributedLoad()
  const totalAppliedLoad = 10_000 * 10

  assertClose(
    result.supportReactions.left + result.supportReactions.right,
    totalAppliedLoad
  )
  assertSymmetric(result)
  assert.equal(result.deflectionSamples[0].value, 0)
  assert.equal(result.deflectionSamples.at(-1).value, 0)
})

test("uniform-load maxima match closed-form results", () => {
  const result = solveDistributedLoad()
  const loadIntensity = 10_000
  const span = 10
  const youngModulus = 200e9
  const secondMoment = 0.05

  assertClose(
    result.maximumBendingMoment.value,
    (loadIntensity * span ** 2) / 8
  )
  assertClose(
    result.maximumDeflection.value,
    (5 * loadIntensity * span ** 4) / (384 * youngModulus * secondMoment)
  )
  assert.equal(result.maximumBendingMoment.position, span / 2)
  assert.equal(result.maximumDeflection.position, span / 2)
})

test("rejects missing, zero, negative, non-finite, and unsupported inputs", () => {
  assert.throws(() => solvePointLoad({ spanLength: undefined }), /spanLength/)
  assert.throws(
    () => solvePointLoad({ spanLength: quantity(0, "m") }),
    /spanLength/
  )
  assert.throws(
    () => solvePointLoad({ youngModulus: quantity(-1, "Pa") }),
    /youngModulus/
  )
  assert.throws(
    () => solvePointLoad({ secondMomentOfArea: quantity(NaN, "m^4") }),
    /secondMomentOfArea/
  )
  assert.throws(
    () => solvePointLoad({ secondMomentOfArea: quantity(0, "m^4") }),
    /secondMomentOfArea/
  )
  assert.throws(() => solvePointLoad({ pointLoad: undefined }), /pointLoad/)
  assert.throws(
    () => solvePointLoad({ pointLoad: quantity(0, "N") }),
    /pointLoad/
  )
  assert.throws(
    () => solveDistributedLoad({ distributedLoad: undefined }),
    /distributedLoad/
  )
  assert.throws(
    () => solveDistributedLoad({ distributedLoad: quantity(-1, "N/m") }),
    /distributedLoad/
  )
  assert.throws(() => solvePointLoad({ sampleCount: 2 }), /sampleCount/)
  assert.throws(() => solvePointLoad({ sampleCount: Infinity }), /sampleCount/)
  assert.throws(() => solvePointLoad({ loadType: "cantilever" }), /loadType/)
  assert.throws(
    () => solvePointLoad({ distributedLoad: quantity(1, "N/m") }),
    /distributedLoad/
  )
})

test("labels results and exposes assumptions, conventions, and exclusions", () => {
  const result = solvePointLoad()

  assert.equal(result.resultLabel, "preliminary analytical estimate")
  assert.equal(result.units.bendingMoment, "N*m")
  assert.match(
    SIMPLY_SUPPORTED_BEAM_METADATA.signConvention.deflection,
    /downward.*positive/
  )
  assert.ok(
    SIMPLY_SUPPORTED_BEAM_METADATA.applicabilityLimits.includes(
      "not a bridge safety validator"
    )
  )
  assert.ok(
    SIMPLY_SUPPORTED_BEAM_METADATA.applicabilityLimits.some((limit) =>
      limit.includes("code compliance")
    )
  )
})
