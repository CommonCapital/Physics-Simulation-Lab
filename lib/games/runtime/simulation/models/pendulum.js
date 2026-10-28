/**
 * Simple pendulum (point mass on a massless rod) and physical pendulum
 * (rigid body pivoting about a fixed axis).
 *
 * Both use the exact nonlinear equation of motion via RK4 integration, so
 * small-angle results reproduce the familiar ω = √(g/L) period and large-angle
 * behaviour diverges from it correctly.
 *
 * Sign convention: angle θ measured from the downward vertical, positive
 * counter-clockwise. Angular velocity ω = dθ/dt.
 *
 * Governing equation (simple pendulum, no damping):
 *   d²θ/dt² = −(g/L) sin(θ)
 *
 * Governing equation (physical pendulum, no damping):
 *   d²θ/dt² = −(m g d / I) sin(θ)
 *   where d = distance from pivot to centre of mass, I = moment of inertia
 *   about the pivot (via parallel-axis theorem if needed).
 *
 * With linear viscous damping b (N·m·s/rad):
 *   d²θ/dt² += −(b / I_eff) · ω
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

export const SIMPLE_PENDULUM_METADATA = Object.freeze({
  id: "simple-pendulum",
  name: "Simple pendulum — exact nonlinear equation of motion",
  assumptions: Object.freeze([
    "point mass on a massless, inextensible rod",
    "pivot is frictionless and fixed",
    "no aerodynamic drag unless damping coefficient is supplied",
    "motion confined to one vertical plane",
    "rigid attachment — no rope flex",
  ]),
  governingEquation:
    "d²θ/dt² = −(g/L) sin(θ) − (b/(mL²)) dθ/dt",
  smallAngleLimit:
    "For |θ₀| < 15°, the small-angle period T ≈ 2π√(L/g) is within 0.5% of the exact value.",
  outputUnits: Object.freeze({
    time: "s",
    angle: "rad",
    angularVelocity: "rad/s",
    period: "s",
    energy: "J",
  }),
})

export const PHYSICAL_PENDULUM_METADATA = Object.freeze({
  id: "physical-pendulum",
  name: "Physical pendulum — rigid body rotating about a fixed pivot",
  assumptions: Object.freeze([
    "rigid body",
    "frictionless fixed pivot",
    "moment of inertia about pivot supplied by user or computed via parallel-axis theorem",
    "no aerodynamic drag unless damping coefficient is supplied",
    "motion confined to one vertical plane",
    "homogeneous gravitational field",
  ]),
  governingEquation:
    "d²θ/dt² = −(m g d / I) sin(θ) − (b / I) dθ/dt",
  outputUnits: Object.freeze({
    time: "s",
    angle: "rad",
    angularVelocity: "rad/s",
    period: "s",
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
 * Returns the small-angle (linearised) period T = 2π √(I_eff / κ).
 * κ is the restoring-torque coefficient (m g L for simple, m g d for physical).
 */
function smallAnglePeriod(iEff, kappa) {
  return TWO_PI * Math.sqrt(iEff / kappa)
}

/**
 * Builds the RK4 derivative function for a pendulum with effective inertia
 * `iEff`, restoring-torque coefficient `kappa` (= m g L or m g d), and
 * optional linear damping `b`.
 *
 * State vector: [θ, ω]
 */
function buildDerivative(iEff, kappa, damping) {
  return function derivative(_time, [theta, omega]) {
    const alpha = -(kappa / iEff) * Math.sin(theta) - (damping / iEff) * omega
    return [omega, alpha]
  }
}

function solvePendulumCore({ iEff, kappa, damping, mass, gravity, initialTheta, initialOmega, duration, timeStep }) {
  const derivative = buildDerivative(iEff, kappa, damping)
  const steps = Math.ceil(duration / timeStep)
  const actualStep = duration / steps

  const trajectory = integrateRK4({
    derivative,
    initialState: [initialTheta, initialOmega],
    startTime: 0,
    timeStep: actualStep,
    steps,
  })

  // Mechanical energy: E = ½ I ω² + m g L (1 − cos θ) for simple pendulum
  // For physical: replace L with d (encoded in kappa as m*g*d, so L_eff = kappa/(m*g))
  const Leff = kappa / (mass * gravity)

  const samples = trajectory.map(({ time, state: [theta, omega] }) => {
    const ke = 0.5 * iEff * omega * omega
    const pe = mass * gravity * Leff * (1 - Math.cos(theta))
    return Object.freeze({ time, angle: theta, angularVelocity: omega, kineticEnergy: ke, potentialEnergy: pe, totalEnergy: ke + pe })
  })

  const period = smallAnglePeriod(iEff, kappa)

  return Object.freeze({
    samples: Object.freeze(samples),
    smallAnglePeriod: period,
    iEff,
    kappa,
    damping,
  })
}

/**
 * Solves a simple pendulum (point mass m on massless rod of length L).
 *
 * Options:
 *   length             { value, unit }   — rod length (length unit)
 *   mass               { value, unit }   — bob mass (mass unit)
 *   gravity            { value, unit }   — gravitational acceleration (m/s²)
 *   initialAngle       { value, unit }   — initial angle from vertical (angle unit)
 *   initialOmega       { value, unit }?  — initial angular velocity (rad/s), default 0
 *   dampingCoefficient { value, unit }?  — viscous damping b (N·m·s/rad), default 0
 *   duration           { value, unit }   — simulation duration (time unit)
 *   timeStep           { value, unit }   — integration step (time unit)
 */
export function solveSimplePendulum(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const L = assertPositive(readQuantity(options, "length", "m"), "length")
  const m = assertPositive(readQuantity(options, "mass", "kg"), "mass")
  const g = assertPositive(readQuantity(options, "gravity", "m/s^2"), "gravity")
  const theta0 = assertFiniteNumber(readQuantity(options, "initialAngle", "rad"), "initialAngle")
  const omega0 = assertFiniteNumber(readOptionalQuantity(options, "initialOmega", "rad/s", 0), "initialOmega")
  const b = assertNonNegative(readOptionalQuantity(options, "dampingCoefficient", "N*m*s/rad", 0), "dampingCoefficient")
  const duration = assertPositive(readQuantity(options, "duration", "s"), "duration")
  const timeStep = assertPositive(readQuantity(options, "timeStep", "s"), "timeStep")

  const iEff = m * L * L          // I = mL²
  const kappa = m * g * L         // restoring coefficient

  const result = solvePendulumCore({ iEff, kappa, damping: b, mass: m, gravity: g, initialTheta: theta0, initialOmega: omega0, duration, timeStep })

  return Object.freeze({
    metadata: SIMPLE_PENDULUM_METADATA,
    units: SIMPLE_PENDULUM_METADATA.outputUnits,
    length: L,
    mass: m,
    gravity: g,
    iEff,
    ...result,
  })
}

/**
 * Solves a physical pendulum (rigid body of mass m, moment of inertia I_pivot
 * about the pivot, centre of mass at distance d from the pivot).
 *
 * Options:
 *   mass               { value, unit }   — total mass (mass unit)
 *   momentOfInertia    { value, unit }   — I about pivot (kg·m²)
 *   pivotToCmDistance  { value, unit }   — d (length unit)
 *   gravity            { value, unit }   — gravitational acceleration (m/s²)
 *   initialAngle       { value, unit }   — initial angle from vertical (angle unit)
 *   initialOmega       { value, unit }?  — initial angular velocity (rad/s), default 0
 *   dampingCoefficient { value, unit }?  — viscous damping b (N·m·s/rad), default 0
 *   duration           { value, unit }   — simulation duration (time unit)
 *   timeStep           { value, unit }   — integration step (time unit)
 */
export function solvePhysicalPendulum(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const m = assertPositive(readQuantity(options, "mass", "kg"), "mass")
  const I = assertPositive(readQuantity(options, "momentOfInertia", "kg*m^2"), "momentOfInertia")
  const d = assertPositive(readQuantity(options, "pivotToCmDistance", "m"), "pivotToCmDistance")
  const g = assertPositive(readQuantity(options, "gravity", "m/s^2"), "gravity")
  const theta0 = assertFiniteNumber(readQuantity(options, "initialAngle", "rad"), "initialAngle")
  const omega0 = assertFiniteNumber(readOptionalQuantity(options, "initialOmega", "rad/s", 0), "initialOmega")
  const b = assertNonNegative(readOptionalQuantity(options, "dampingCoefficient", "N*m*s/rad", 0), "dampingCoefficient")
  const duration = assertPositive(readQuantity(options, "duration", "s"), "duration")
  const timeStep = assertPositive(readQuantity(options, "timeStep", "s"), "timeStep")

  const kappa = m * g * d

  const result = solvePendulumCore({ iEff: I, kappa, damping: b, mass: m, gravity: g, initialTheta: theta0, initialOmega: omega0, duration, timeStep })

  return Object.freeze({
    metadata: PHYSICAL_PENDULUM_METADATA,
    units: PHYSICAL_PENDULUM_METADATA.outputUnits,
    mass: m,
    momentOfInertia: I,
    pivotToCmDistance: d,
    gravity: g,
    iEff: I,
    ...result,
  })
}
