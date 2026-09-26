/**
 * Free fall under constant gravity with optional linear aerodynamic drag.
 *
 * Two models:
 *
 * 1. Drag-free free fall (exact closed form):
 *    y(t) = y₀ + v₀ t − ½ g t²
 *    Terminal velocity is infinite (no drag).
 *
 * 2. Free fall with linear drag F_drag = −b v (Stokes drag):
 *    Solved via RK4. Terminal velocity v_t = m g / b.
 *    This is valid for small Reynolds numbers (viscous flow, Re < ~1).
 *    For larger objects use the quadratic drag model (F_drag = ½ ρ C_D A v²),
 *    which is not in this catalog.
 *
 * Sign convention: y is positive upward, g > 0 downward.
 * v positive means moving upward.
 *
 * Ground impact is detected at y = 0 when approached from above.
 */

import { integrateRK4 } from "../integration.js"
import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  requireField,
} from "../validation.js"

export const FREE_FALL_METADATA = Object.freeze({
  id: "free-fall-linear-drag",
  name: "Free fall — constant gravity, optional linear (Stokes) drag",
  assumptions: Object.freeze([
    "constant downward gravitational acceleration",
    "one spatial dimension (vertical)",
    "point mass",
    "drag proportional to velocity (linear / Stokes drag) when drag coefficient b > 0",
    "no buoyancy, no Magnus effect, no wind",
    "ground is flat at y = 0; trajectory ends on contact",
  ]),
  governingEquation:
    "m ÿ = −m g + F_drag, where F_drag = 0 (no drag) or −b ẏ (linear Stokes drag)",
  linearDragApplicability:
    "Linear drag F = bv is physically valid for very small particles at low Reynolds number (Re < ~1). For macroscopic objects in air, quadratic drag is more appropriate but is not in this catalog.",
  outputUnits: Object.freeze({
    time: "s",
    position: "m",
    velocity: "m/s",
    terminalVelocity: "m/s",
    flightTime: "s",
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
 * Solves free fall with optional linear drag.
 *
 * Options:
 *   mass                 { value, unit }  — mass m (kg)
 *   gravity              { value, unit }  — g (m/s²)
 *   initialHeight        { value, unit }  — y₀ (length unit), must be ≥ 0
 *   initialVelocity      { value, unit }? — v₀ (velocity unit), default 0 (positive = upward)
 *   linearDragCoefficient{ value, unit }? — b (N·s/m = kg/s), default 0 (no drag)
 *   timeStep             { value, unit }  — integration step (time unit)
 */
export function solveFreeFall(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const m = assertPositive(readQuantity(options, "mass", "kg"), "mass")
  const g = assertPositive(readQuantity(options, "gravity", "m/s^2"), "gravity")
  const y0 = assertNonNegative(readQuantity(options, "initialHeight", "m"), "initialHeight")
  const v0 = assertFiniteNumber(readOptionalQuantity(options, "initialVelocity", "m/s", 0), "initialVelocity")
  const b = assertNonNegative(readOptionalQuantity(options, "linearDragCoefficient", "kg/s", 0), "linearDragCoefficient")
  const timeStep = assertPositive(readQuantity(options, "timeStep", "s"), "timeStep")

  const terminalVelocity = b > 0 ? m * g / b : null   // null means no terminal velocity

  // Integrate until y ≤ 0 (ground), capped at a reasonable maximum
  const MAX_STEPS = 1_000_000
  let samples = []

  if (b === 0) {
    // Closed-form: y(t) = y0 + v0*t - 0.5*g*t²
    // Ground time: solve y(t) = 0 → t = (v0 + √(v0² + 2 g y0)) / g
    const disc = v0 * v0 + 2 * g * y0
    // disc ≥ 0 always since y0 ≥ 0
    const tImpact = (v0 + Math.sqrt(disc)) / g
    const tSafe = Math.max(tImpact, 0)
    const nSteps = Math.min(Math.ceil(tSafe / timeStep), MAX_STEPS)
    const dt = nSteps > 0 ? tSafe / nSteps : timeStep

    for (let i = 0; i <= nSteps; i++) {
      const t = i === nSteps ? tSafe : i * dt
      const y = i === nSteps ? 0 : y0 + v0 * t - 0.5 * g * t * t
      const v = v0 - g * t
      samples.push(Object.freeze({ time: t, position: y, velocity: v }))
    }
  } else {
    // RK4: state = [y, v]
    const trajectory = []
    let state = [y0, v0]
    let t = 0
    trajectory.push({ time: t, state: state.slice() })

    for (let step = 0; step < MAX_STEPS; step++) {
      const next = _rk4StepLocal(state, t, timeStep, m, g, b)
      t += timeStep
      state = next
      trajectory.push({ time: t, state: state.slice() })

      if (state[0] <= 0) {
        // Linear interpolation to exact ground crossing
        const prev = trajectory[trajectory.length - 2]
        const frac = prev.state[0] / (prev.state[0] - state[0])
        const tGround = prev.time + frac * timeStep
        const vGround = prev.state[1] + frac * (state[1] - prev.state[1])
        trajectory[trajectory.length - 1] = { time: tGround, state: [0, vGround] }
        break
      }
    }

    samples = trajectory.map(({ time, state: [y, v] }) =>
      Object.freeze({ time, position: y, velocity: v })
    )
  }

  const flightTime = samples.length > 0 ? samples[samples.length - 1].time : 0

  return Object.freeze({
    metadata: FREE_FALL_METADATA,
    units: FREE_FALL_METADATA.outputUnits,
    mass: m,
    gravity: g,
    initialHeight: y0,
    initialVelocity: v0,
    linearDragCoefficient: b,
    terminalVelocity,
    flightTime,
    samples: Object.freeze(samples),
  })
}

/** Inline RK4 step to avoid importing integrateRK4's overhead inside a loop. */
function _rk4StepLocal([y, v], t, dt, m, g, b) {
  function deriv(yi, vi) {
    return [vi, (-m * g - b * vi) / m]
  }
  const [k1y, k1v] = deriv(y, v)
  const [k2y, k2v] = deriv(y + 0.5 * dt * k1y, v + 0.5 * dt * k1v)
  const [k3y, k3v] = deriv(y + 0.5 * dt * k2y, v + 0.5 * dt * k2v)
  const [k4y, k4v] = deriv(y + dt * k3y, v + dt * k3v)
  return [
    y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y),
    v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  ]
}
