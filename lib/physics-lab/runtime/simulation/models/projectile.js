import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertInRange,
  assertNonNegative,
  assertPositive,
  requireField,
} from "../validation.js"

const MAX_TRAJECTORY_SAMPLES = 100_000
const HALF_PI = Math.PI / 2

const outputUnits = Object.freeze({
  time: "s",
  position: Object.freeze({ x: "m", y: "m" }),
  velocity: Object.freeze({ x: "m/s", y: "m/s" }),
  flightTime: "s",
  horizontalRange: "m",
  maximumHeight: "m",
})

export const PROJECTILE_MOTION_METADATA = Object.freeze({
  id: "projectile-motion-2d-no-drag",
  name: "Two-dimensional projectile motion without aerodynamic drag",
  assumptions: Object.freeze([
    "two spatial dimensions",
    "constant downward gravitational acceleration",
    "flat ground at y = 0",
    "point mass",
    "no aerodynamic drag, lift, or wind",
    "no Earth curvature",
    "no object rotation",
  ]),
  inputContract: Object.freeze({
    initialSpeed: "non-negative velocity quantity",
    launchAngle: "angle quantity from -90 deg to 90 deg, inclusive",
    initialHeight: "non-negative length quantity",
    gravitationalAcceleration: "positive acceleration quantity",
    sampling:
      "exactly one of positive sampleInterval or sampleCount from 2 to 100000",
  }),
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

function calculateFlightTime(initialHeight, verticalVelocity, gravity) {
  const discriminant = assertFiniteNumber(
    verticalVelocity ** 2 + 2 * gravity * initialHeight,
    "flightTime discriminant"
  )
  const root = Math.sqrt(discriminant)
  const flightTime =
    verticalVelocity < 0
      ? (2 * initialHeight) / (root - verticalVelocity)
      : (verticalVelocity + root) / gravity

  return assertNonNegative(flightTime, "flightTime")
}

function createSamplingTimes(options, flightTime) {
  const hasInterval = options.sampleInterval !== undefined
  const hasCount = options.sampleCount !== undefined
  if (hasInterval === hasCount) {
    throw new TypeError(
      "sampling requires exactly one of sampleInterval or sampleCount"
    )
  }

  if (hasCount) {
    const sampleCount = options.sampleCount
    if (
      !Number.isSafeInteger(sampleCount) ||
      sampleCount < 2 ||
      sampleCount > MAX_TRAJECTORY_SAMPLES
    ) {
      throw new RangeError(
        `sampleCount must be a safe integer from 2 to ${MAX_TRAJECTORY_SAMPLES}`
      )
    }

    if (flightTime === 0) return [0]
    return Array.from(
      { length: sampleCount },
      (_, index) => (flightTime * index) / (sampleCount - 1)
    )
  }

  const sampleInterval = readQuantity(options, "sampleInterval", "s")
  assertPositive(sampleInterval, "sampleInterval")
  if (flightTime === 0) return [0]

  const interiorSampleCount = Math.ceil(flightTime / sampleInterval)
  const totalSampleCount = interiorSampleCount + 1
  if (totalSampleCount > MAX_TRAJECTORY_SAMPLES) {
    throw new RangeError(
      `sampleInterval produces more than ${MAX_TRAJECTORY_SAMPLES} trajectory samples`
    )
  }

  const times = Array.from(
    { length: interiorSampleCount },
    (_, index) => index * sampleInterval
  )
  times.push(flightTime)
  return times
}

export function solveProjectileMotion(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const initialSpeed = assertNonNegative(
    readQuantity(options, "initialSpeed", "m/s"),
    "initialSpeed"
  )
  const launchAngle = assertInRange(
    readQuantity(options, "launchAngle", "rad"),
    -HALF_PI,
    HALF_PI,
    "launchAngle"
  )
  const initialHeight = assertNonNegative(
    readQuantity(options, "initialHeight", "m"),
    "initialHeight"
  )
  const gravity = assertPositive(
    readQuantity(options, "gravitationalAcceleration", "m/s^2"),
    "gravitationalAcceleration"
  )

  const isVertical = Math.abs(launchAngle) === HALF_PI
  const horizontalVelocity = isVertical
    ? 0
    : initialSpeed * Math.cos(launchAngle)
  const verticalVelocity = initialSpeed * Math.sin(launchAngle)
  assertFiniteNumber(horizontalVelocity, "initial horizontal velocity")
  assertFiniteNumber(verticalVelocity, "initial vertical velocity")

  const flightTime = calculateFlightTime(
    initialHeight,
    verticalVelocity,
    gravity
  )
  const horizontalRange = assertFiniteNumber(
    horizontalVelocity * flightTime,
    "horizontalRange"
  )
  const maximumHeight = assertFiniteNumber(
    verticalVelocity > 0
      ? initialHeight + verticalVelocity ** 2 / (2 * gravity)
      : initialHeight,
    "maximumHeight"
  )

  function positionAt(time) {
    assertInRange(time, 0, flightTime, "time")
    const x = assertFiniteNumber(horizontalVelocity * time, "position.x")
    const y =
      time === flightTime
        ? 0
        : assertFiniteNumber(
            initialHeight + verticalVelocity * time - (gravity * time ** 2) / 2,
            "position.y"
          )

    return Object.freeze({ x, y })
  }

  function velocityAt(time) {
    assertInRange(time, 0, flightTime, "time")
    return Object.freeze({
      x: horizontalVelocity,
      y: assertFiniteNumber(verticalVelocity - gravity * time, "velocity.y"),
    })
  }

  const sampleTimes = createSamplingTimes(options, flightTime)
  const trajectory = Object.freeze(
    sampleTimes.map((time) =>
      Object.freeze({
        time,
        position: positionAt(time),
        velocity: velocityAt(time),
      })
    )
  )

  return Object.freeze({
    metadata: PROJECTILE_MOTION_METADATA,
    units: outputUnits,
    positionAt,
    velocityAt,
    trajectory,
    flightTime,
    horizontalRange,
    maximumHeight,
  })
}
