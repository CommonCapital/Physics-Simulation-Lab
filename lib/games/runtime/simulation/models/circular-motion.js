/**
 * Uniform circular motion and centripetal/centrifugal analysis.
 *
 * Physics:
 *   For a mass m moving at constant speed v on a circle of radius r:
 *     angular velocity    ω = v / r              [rad/s]
 *     period              T = 2π / ω             [s]
 *     frequency           f = 1 / T              [Hz]
 *     centripetal acc.    a_c = v² / r = ω² r    [m/s²]
 *     centripetal force   F_c = m a_c            [N]
 *
 * The position as a function of time:
 *     x(t) = r cos(ω t + φ₀)
 *     y(t) = r sin(ω t + φ₀)
 *
 * This module reports the kinematics and dynamics of the circular motion;
 * it does NOT model the source of the centripetal force (gravity, tension,
 * normal force, friction). The user must identify which real force provides
 * the centripetal acceleration — this tool reports only that acceleration
 * and the force required to sustain it.
 *
 * Banked-turn geometry (optional):
 *   For a banked curve of angle θ, ideal bank speed (no friction needed):
 *     v_ideal = √(r g tan θ)
 */

import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  requireField,
} from "../validation.js"

const TWO_PI = 2 * Math.PI

export const CIRCULAR_MOTION_METADATA = Object.freeze({
  id: "uniform-circular-motion",
  name: "Uniform circular motion — kinematics and centripetal dynamics",
  assumptions: Object.freeze([
    "constant speed (uniform circular motion)",
    "circular path of constant radius",
    "motion in a horizontal plane unless noted",
    "point mass",
    "no air resistance",
    "Newton's second law applied in the inertial frame — centripetal force is the net inward force, not a separate 'centrifugal' force",
  ]),
  physicsNotes: Object.freeze([
    "Centripetal force is the NET force directed toward the centre; it is not an additional force. The centrifugal force is a fictitious force that appears only in the rotating reference frame.",
    "The source of centripetal force (gravity, tension, normal force, friction) depends on the physical setup and is not modelled here.",
  ]),
  outputUnits: Object.freeze({
    angularVelocity: "rad/s",
    period: "s",
    frequency: "Hz",
    centripetalAcceleration: "m/s^2",
    centripetalForce: "N",
    time: "s",
    positionX: "m",
    positionY: "m",
    velocityX: "m/s",
    velocityY: "m/s",
  }),
})

function readQuantity(options, field, siUnit) {
  const quantity = requireField(options, field)
  if (quantity === null || typeof quantity !== "object") {
    throw new TypeError(`${field} must contain value and unit`)
  }
  const value = requireField(quantity, "value")
  const unit = requireField(quantity, "unit")
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

function readOptionalQuantity(options, field, siUnit, defaultValue) {
  if (options[field] === undefined) return defaultValue
  return readQuantity(options, field, siUnit)
}

/**
 * Solves uniform circular motion.
 *
 * Options:
 *   radius           { value, unit }  — circle radius r (length unit)
 *   mass             { value, unit }  — mass of the object (mass unit)
 *   speed            { value, unit }  — tangential speed v (velocity unit)
 *   initialAngle     { value, unit }? — φ₀ (angle unit), default 0
 *   duration         { value, unit }  — how long to sample (time unit)
 *   sampleCount                       — number of samples (integer ≥ 2), default 360
 *   bankAngle        { value, unit }? — if present, computes ideal bank speed (angle unit)
 *   gravity          { value, unit }? — required when bankAngle is given (m/s²)
 */
export function solveCircularMotion(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const r = assertPositive(readQuantity(options, "radius", "m"), "radius")
  const m = assertPositive(readQuantity(options, "mass", "kg"), "mass")
  const v = assertPositive(readQuantity(options, "speed", "m/s"), "speed")
  const phi0 = assertFiniteNumber(readOptionalQuantity(options, "initialAngle", "rad", 0), "initialAngle")
  const duration = assertPositive(readQuantity(options, "duration", "s"), "duration")
  const sampleCount = options.sampleCount !== undefined
    ? (() => {
        const n = options.sampleCount
        if (!Number.isSafeInteger(n) || n < 2) throw new RangeError("sampleCount must be a safe integer ≥ 2")
        return n
      })()
    : 360

  const omega = v / r
  const period = TWO_PI / omega
  const frequency = 1 / period
  const aC = v * v / r          // centripetal acceleration
  const fC = m * aC             // centripetal force

  const samples = Array.from({ length: sampleCount }, (_, i) => {
    const t = duration * i / (sampleCount - 1)
    const angle = omega * t + phi0
    const x = r * Math.cos(angle)
    const y = r * Math.sin(angle)
    const vx = -v * Math.sin(angle)
    const vy = v * Math.cos(angle)
    return Object.freeze({ time: t, angle, x, y, velocityX: vx, velocityY: vy })
  })

  let bankAngleResult = null
  if (options.bankAngle !== undefined) {
    const theta = readQuantity(options, "bankAngle", "rad")
    const g = assertPositive(readQuantity(options, "gravity", "m/s^2"), "gravity")
    assertNonNegative(theta, "bankAngle")
    const idealSpeed = Math.sqrt(r * g * Math.tan(theta))
    bankAngleResult = Object.freeze({ bankAngle: theta, idealSpeed, gravity: g })
  }

  return Object.freeze({
    metadata: CIRCULAR_MOTION_METADATA,
    units: CIRCULAR_MOTION_METADATA.outputUnits,
    radius: r,
    mass: m,
    speed: v,
    angularVelocity: omega,
    period,
    frequency,
    centripetalAcceleration: aC,
    centripetalForce: fC,
    samples: Object.freeze(samples),
    bankAngleAnalysis: bankAngleResult,
  })
}
