import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertPositive,
  requireField,
} from "../validation.js"

const ESTIMATE_LABEL = "preliminary analytical estimate"
const MAX_SAMPLE_COUNT = 100_000

const outputUnits = Object.freeze({
  position: "m",
  supportReaction: "N",
  shearForce: "N",
  bendingMoment: "N*m",
  deflection: "m",
})

export const SIMPLY_SUPPORTED_BEAM_METADATA = Object.freeze({
  id: "simply-supported-euler-bernoulli-beam",
  name: "Simply supported Euler-Bernoulli beam",
  resultLabel: ESTIMATE_LABEL,
  supportedLoadTypes: Object.freeze([
    "central-point-load",
    "uniform-distributed-load",
  ]),
  assumptions: Object.freeze([
    "straight prismatic beam",
    "simple supports at both ends",
    "homogeneous linear-elastic material",
    "small deflection Euler-Bernoulli theory",
    "constant Young's modulus",
    "constant second moment of area",
    "one static central point load or one static uniform distributed load",
  ]),
  signConvention: Object.freeze({
    position: "x increases from the left support",
    appliedLoad: "input load magnitudes act downward and are positive",
    supportReaction: "upward reactions are positive",
    shearForce: "positive shear acts upward on the left cut face",
    bendingMoment: "sagging bending moment is positive",
    deflection: "downward deflection is positive",
    pointLoadShear:
      "shear is discontinuous at the central point load; its sampled value there is the average of the one-sided limits, zero",
  }),
  applicabilityLimits: Object.freeze([
    "preliminary analytical estimate only",
    "not a bridge safety validator",
    "does not evaluate safety factors, capacity, failure, buckling, fatigue, connections, dynamics, or code compliance",
    "material and section properties must be supplied and are never inferred",
  ]),
  outputUnits,
})

function readQuantity(options, field, siUnit) {
  const quantity = requireField(options, field)
  if (quantity === null || typeof quantity !== "object") {
    throw new TypeError(`${field} must contain value and unit`)
  }

  let value
  let unit
  try {
    value = requireField(quantity, "value")
    unit = requireField(quantity, "unit")
  } catch (error) {
    throw new TypeError(`${field}: ${error.message}`)
  }

  assertFiniteNumber(value, `${field}.value`)

  try {
    return assertFiniteNumber(
      convertUnit(value, unit, siUnit),
      `${field} in ${siUnit}`
    )
  } catch (error) {
    throw new error.constructor(`${field}: ${error.message}`)
  }
}

function readSampleCount(options) {
  const sampleCount = requireField(options, "sampleCount")
  if (
    !Number.isSafeInteger(sampleCount) ||
    sampleCount < 3 ||
    sampleCount > MAX_SAMPLE_COUNT
  ) {
    throw new RangeError(
      `sampleCount must be a safe integer from 3 to ${MAX_SAMPLE_COUNT}`
    )
  }

  return sampleCount
}

function readLoad(options) {
  const loadType = requireField(options, "loadType")

  if (loadType === "central-point-load") {
    if (options.distributedLoad !== undefined) {
      throw new TypeError(
        "distributedLoad is not allowed for loadType central-point-load"
      )
    }
    return {
      loadType,
      magnitude: assertPositive(
        readQuantity(options, "pointLoad", "N"),
        "pointLoad"
      ),
    }
  }

  if (loadType === "uniform-distributed-load") {
    if (options.pointLoad !== undefined) {
      throw new TypeError(
        "pointLoad is not allowed for loadType uniform-distributed-load"
      )
    }
    return {
      loadType,
      magnitude: assertPositive(
        readQuantity(options, "distributedLoad", "N/m"),
        "distributedLoad"
      ),
    }
  }

  throw new RangeError(
    "loadType must be central-point-load or uniform-distributed-load"
  )
}

function centralPointLoadValues({
  position,
  spanLength,
  load,
  flexuralRigidity,
}) {
  const halfSpan = spanLength / 2
  const distanceToNearestSupport = Math.min(position, spanLength - position)
  const shearForce =
    position < halfSpan ? load / 2 : position > halfSpan ? -load / 2 : 0
  const bendingMoment = (load * distanceToNearestSupport) / 2
  const deflection =
    (load *
      distanceToNearestSupport *
      (3 * spanLength ** 2 - 4 * distanceToNearestSupport ** 2)) /
    (48 * flexuralRigidity)

  return { shearForce, bendingMoment, deflection }
}

function uniformDistributedLoadValues({
  position,
  spanLength,
  load,
  flexuralRigidity,
}) {
  const shearForce = load * (spanLength / 2 - position)
  const bendingMoment = (load * position * (spanLength - position)) / 2
  const deflection =
    position === 0 || position === spanLength
      ? 0
      : (load *
          position *
          (spanLength ** 3 - 2 * spanLength * position ** 2 + position ** 3)) /
        (24 * flexuralRigidity)

  return { shearForce, bendingMoment, deflection }
}

function createSamples({
  spanLength,
  sampleCount,
  loadType,
  load,
  flexuralRigidity,
}) {
  const valueAt =
    loadType === "central-point-load"
      ? centralPointLoadValues
      : uniformDistributedLoadValues
  const shearForceSamples = []
  const bendingMomentSamples = []
  const deflectionSamples = []

  for (let index = 0; index < sampleCount; index += 1) {
    const position =
      index === sampleCount - 1
        ? spanLength
        : spanLength * (index / (sampleCount - 1))
    const values = valueAt({
      position,
      spanLength,
      load,
      flexuralRigidity,
    })

    shearForceSamples.push(
      Object.freeze({
        position,
        value: assertFiniteNumber(values.shearForce, "shearForce"),
      })
    )
    bendingMomentSamples.push(
      Object.freeze({
        position,
        value: assertFiniteNumber(values.bendingMoment, "bendingMoment"),
      })
    )
    deflectionSamples.push(
      Object.freeze({
        position,
        value: assertFiniteNumber(values.deflection, "deflection"),
      })
    )
  }

  return {
    shearForceSamples: Object.freeze(shearForceSamples),
    bendingMomentSamples: Object.freeze(bendingMomentSamples),
    deflectionSamples: Object.freeze(deflectionSamples),
  }
}

export function solveSimplySupportedBeam(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const spanLength = assertPositive(
    readQuantity(options, "spanLength", "m"),
    "spanLength"
  )
  const youngModulus = assertPositive(
    readQuantity(options, "youngModulus", "Pa"),
    "youngModulus"
  )
  const secondMomentOfArea = assertPositive(
    readQuantity(options, "secondMomentOfArea", "m^4"),
    "secondMomentOfArea"
  )
  const sampleCount = readSampleCount(options)
  const { loadType, magnitude: load } = readLoad(options)
  const flexuralRigidity = assertFiniteNumber(
    youngModulus * secondMomentOfArea,
    "flexuralRigidity"
  )
  assertPositive(flexuralRigidity, "flexuralRigidity")

  const totalLoad = assertFiniteNumber(
    loadType === "central-point-load" ? load : load * spanLength,
    "totalLoad"
  )
  const reaction = totalLoad / 2
  const supportReactions = Object.freeze({ left: reaction, right: reaction })
  const maximumBendingMoment = Object.freeze({
    value: assertFiniteNumber(
      loadType === "central-point-load"
        ? (load * spanLength) / 4
        : (load * spanLength ** 2) / 8,
      "maximumBendingMoment"
    ),
    position: spanLength / 2,
  })
  const maximumDeflection = Object.freeze({
    value: assertFiniteNumber(
      loadType === "central-point-load"
        ? (load * spanLength ** 3) / (48 * flexuralRigidity)
        : (5 * load * spanLength ** 4) / (384 * flexuralRigidity),
      "maximumDeflection"
    ),
    position: spanLength / 2,
  })
  const samples = createSamples({
    spanLength,
    sampleCount,
    loadType,
    load,
    flexuralRigidity,
  })

  return Object.freeze({
    resultLabel: ESTIMATE_LABEL,
    metadata: SIMPLY_SUPPORTED_BEAM_METADATA,
    units: outputUnits,
    loadType,
    supportReactions,
    ...samples,
    maximumBendingMoment,
    maximumDeflection,
  })
}
