/**
 * Spring-mass system: one degree of freedom, horizontal or vertical.
 *
 * Covers free vibration (undamped, underdamped, critically damped,
 * overdamped) and forced vibration under a harmonic driving force. Uses
 * both the closed-form analytical solution (exact, always available) and
 * RK4 integration (for the forced case, which has no elementary closed form
 * when damping is present).
 *
 * Sign convention: displacement x measured from the static-equilibrium
 * position, positive in the direction of applied force.
 *
 * Governing equation:
 *   m ẍ + c ẋ + k x = F₀ cos(ω_d t)
 *
 * where c is the damping coefficient [N·s/m], k is the spring constant [N/m],
 * F₀ is the forcing amplitude [N] (zero for free vibration), and ω_d is the
 * driving angular frequency [rad/s].
 *
 * Derived quantities reported:
 *   ω_n  = √(k/m)              natural angular frequency [rad/s]
 *   f_n  = ω_n / (2π)          natural frequency [Hz]
 *   T_n  = 1 / f_n             natural period [s]
 *   ζ    = c / (2 √(km))       damping ratio [dimensionless]
 *   ω_d  = ω_n √(1 − ζ²)      damped natural frequency (underdamped only) [rad/s]
 */

import { integrateRK4 } from "../integration.js"
import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  requireField,
} from "../validation.js"

const TWO_PI = 2 * Math.PI

export const SPRING_MASS_METADATA = Object.freeze({
  id: "spring-mass-1dof",
  name: "Spring-mass system — 1 DOF free and forced vibration",
  assumptions: Object.freeze([
    "single degree of freedom",
    "linear spring obeying Hooke's law (F = kx)",
    "linear viscous damping (F = cẋ)",
    "lumped mass",
    "small displacements — geometric nonlinearity neglected",
    "massless spring",
    "harmonic forcing only (F = F₀ cos(ω_d t)) when forcing is present",
  ]),
  governingEquation:
    "m ẍ + c ẋ + k x = F₀ cos(ω_d t)",
  outputUnits: Object.freeze({
    time: "s",
    displacement: "m",
    velocity: "m/s",
    naturalFrequency: "Hz",
    naturalPeriod: "s",
    dampingRatio: "dimensionless",
    energy: "J",
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
 * Solves a spring-mass system via RK4 integration.
 *
 * Options (all required unless noted):
 *   mass                 { value, unit }  — mass m (kg)
 *   springConstant       { value, unit }  — spring stiffness k (N/m)
 *   dampingCoefficient   { value, unit }? — viscous damping c (N·s/m), default 0
 *   initialDisplacement  { value, unit }  — x(0) (length unit)
 *   initialVelocity      { value, unit }? — ẋ(0) (velocity unit), default 0
 *   forcingAmplitude     { value, unit }? — F₀ (N), default 0 (free vibration)
 *   forcingFrequency     { value, unit }? — ω_d (rad/s), required when F₀ ≠ 0
 *   duration             { value, unit }  — simulation duration (time unit)
 *   timeStep             { value, unit }  — integration step (time unit)
 */
export function solveSpringMass(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const m = assertPositive(readQuantity(options, "mass", "kg"), "mass")
  const k = assertPositive(readQuantity(options, "springConstant", "N/m"), "springConstant")
  const c = assertNonNegative(readOptionalQuantity(options, "dampingCoefficient", "N*s/m", 0), "dampingCoefficient")
  const x0 = assertFiniteNumber(readQuantity(options, "initialDisplacement", "m"), "initialDisplacement")
  const v0 = assertFiniteNumber(readOptionalQuantity(options, "initialVelocity", "m/s", 0), "initialVelocity")
  const F0 = assertNonNegative(readOptionalQuantity(options, "forcingAmplitude", "N", 0), "forcingAmplitude")
  const duration = assertPositive(readQuantity(options, "duration", "s"), "duration")
  const timeStep = assertPositive(readQuantity(options, "timeStep", "s"), "timeStep")

  let omegaDriving = 0
  if (F0 > 0) {
    omegaDriving = assertPositive(
      readQuantity(options, "forcingFrequency", "rad/s"),
      "forcingFrequency"
    )
  }

  // Derived quantities
  const omegaN = Math.sqrt(k / m)              // natural angular frequency
  const fN = omegaN / TWO_PI                   // natural frequency [Hz]
  const tN = 1 / fN                            // natural period [s]
  const criticalDamping = 2 * Math.sqrt(k * m)
  const zeta = c / criticalDamping             // damping ratio

  let dampingRegime
  if (c === 0) dampingRegime = "undamped"
  else if (zeta < 1) dampingRegime = "underdamped"
  else if (Math.abs(zeta - 1) < 1e-9) dampingRegime = "critically-damped"
  else dampingRegime = "overdamped"

  const omegaDamped = zeta < 1 ? omegaN * Math.sqrt(1 - zeta * zeta) : 0

  // RK4: state = [x, v], derivative = [v, (-k x - c v + F0 cos(ωd t)) / m]
  const steps = Math.ceil(duration / timeStep)
  const actualStep = duration / steps

  const trajectory = integrateRK4({
    derivative(time, [x, v]) {
      const forcing = F0 * Math.cos(omegaDriving * time)
      const a = (-k * x - c * v + forcing) / m
      return [v, a]
    },
    initialState: [x0, v0],
    startTime: 0,
    timeStep: actualStep,
    steps,
  })

  const samples = trajectory.map(({ time, state: [x, v] }) => {
    const ke = 0.5 * m * v * v
    const pe = 0.5 * k * x * x
    return Object.freeze({ time, displacement: x, velocity: v, kineticEnergy: ke, potentialEnergy: pe, totalEnergy: ke + pe })
  })

  return Object.freeze({
    metadata: SPRING_MASS_METADATA,
    units: SPRING_MASS_METADATA.outputUnits,
    mass: m,
    springConstant: k,
    dampingCoefficient: c,
    naturalAngularFrequency: omegaN,
    naturalFrequency: fN,
    naturalPeriod: tN,
    dampingRatio: zeta,
    dampingRegime,
    dampedNaturalFrequency: omegaDamped,
    forcingAmplitude: F0,
    forcingAngularFrequency: omegaDriving,
    samples: Object.freeze(samples),
  })
}
