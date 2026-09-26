/**
 * Classical mechanics — a unified module covering:
 *
 *  1. Kinematics (1-D and 2-D) — constant-acceleration, SUVAT
 *  2. Newton's Second Law — net force → acceleration, given mass
 *  3. Drag forces — Stokes (linear) and quadratic (aerodynamic)
 *  4. Friction — static and kinetic, inclined-plane equilibrium
 *  5. Impulse and momentum — single and two-body, collision analysis
 *  6. Work, energy, power — work-energy theorem, conservative forces
 *  7. 1-D elastic and inelastic collisions
 *  8. Angular kinematics — constant angular acceleration (rotational SUVAT)
 *  9. Torque and rotational dynamics — τ = I α, rolling without slipping
 * 10. Moment-of-inertia catalog — 8 common rigid body shapes
 *
 * All solvers accept { value, unit } quantity objects and return SI results.
 * Physical constants embedded here:
 *   g_std = 9.80665 m/s²  (standard gravity, used only as a default)
 *
 * Governing equations and assumptions for each solver are documented inline
 * and exposed via the *_METADATA constants.
 */

import { integrateRK4 } from "../integration.js"
import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  assertInRange,
  requireField,
} from "../validation.js"

// ─── Shared helpers ──────────────────────────────────────────────────────────

function readQ(options, field, siUnit) {
  const quantity = requireField(options, field)
  if (quantity === null || typeof quantity !== "object") {
    throw new TypeError(`${field} must be { value, unit }`)
  }
  const value = requireField(quantity, "value")
  const unit  = requireField(quantity, "unit")
  assertFiniteNumber(value, `${field}.value`)
  try {
    return assertFiniteNumber(convertUnit(value, unit, siUnit), `${field} in ${siUnit}`)
  } catch (err) {
    throw new err.constructor(`${field}: ${err.message}`)
  }
}

function readQOpt(options, field, siUnit, fallback) {
  if (options[field] === undefined) return fallback
  return readQ(options, field, siUnit)
}

// ─── 1. Kinematics (1-D, constant acceleration) ───────────────────────────

export const KINEMATICS_1D_METADATA = Object.freeze({
  id: "kinematics-1d-constant-acceleration",
  name: "One-dimensional kinematics — constant acceleration (SUVAT)",
  assumptions: Object.freeze([
    "constant acceleration throughout the interval",
    "straight-line motion along one axis",
    "no relativistic effects",
  ]),
  governingEquations: Object.freeze([
    "v = u + a t",
    "s = u t + ½ a t²",
    "v² = u² + 2 a s",
    "s = ½ (u + v) t",
  ]),
  outputUnits: Object.freeze({
    displacement: "m",
    finalVelocity: "m/s",
    time: "s",
    acceleration: "m/s^2",
    trajectory: "array of { time(s), position(m), velocity(m/s) }",
  }),
})

/**
 * Solves 1-D constant-acceleration kinematics (SUVAT).
 *
 * Provide exactly three of the five SUVAT quantities; the other two are derived.
 * All inputs as { value, unit } objects.
 *
 * Options (any three of five):
 *   initialVelocity  { value, unit }  — u  (velocity unit)
 *   finalVelocity    { value, unit }  — v  (velocity unit)
 *   acceleration     { value, unit }  — a  (acceleration unit)
 *   displacement     { value, unit }  — s  (length unit)
 *   time             { value, unit }  — t  (time unit, must be > 0)
 *
 * Optional:
 *   sampleCount  (integer ≥ 2, default 100) — trajectory samples
 */
export function solveKinematics1D(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const has = (f) => options[f] !== undefined
  const given = ["initialVelocity","finalVelocity","acceleration","displacement","time"].filter(has)
  if (given.length !== 3) throw new TypeError("Provide exactly three of: initialVelocity, finalVelocity, acceleration, displacement, time")

  let u = has("initialVelocity") ? readQ(options, "initialVelocity", "m/s") : null
  let v = has("finalVelocity")   ? readQ(options, "finalVelocity",   "m/s") : null
  let a = has("acceleration")    ? readQ(options, "acceleration",  "m/s^2") : null
  let s = has("displacement")    ? readQ(options, "displacement",      "m") : null
  let t = has("time")            ? readQ(options, "time",               "s") : null

  // Derive the two missing quantities from the three known ones
  // v = u + at
  if (v === null && u !== null && a !== null && t !== null) v = u + a * t
  if (a === null && u !== null && v !== null && t !== null) a = (v - u) / t
  if (u === null && v !== null && a !== null && t !== null) u = v - a * t
  if (t === null && a !== null && u !== null && v !== null) {
    if (a === 0) throw new RangeError("acceleration is zero — time cannot be derived from v = u + at")
    t = (v - u) / a
  }

  // s = ut + ½at²  /  v² = u² + 2as
  if (s === null && u !== null && a !== null && t !== null) s = u * t + 0.5 * a * t * t
  if (s === null && u !== null && v !== null && a !== null && a !== 0) s = (v * v - u * u) / (2 * a)
  if (s === null && u !== null && v !== null && t !== null) s = 0.5 * (u + v) * t

  if (t === null && u !== null && a !== null && s !== null) {
    // s = ut + ½at²  → ½at² + ut − s = 0
    if (a === 0) {
      if (u === 0) throw new RangeError("Both acceleration and initial velocity are zero — time is indeterminate")
      t = s / u
    } else {
      const disc = u * u + 2 * a * s
      if (disc < 0) throw new RangeError("No real solution for time: discriminant < 0 (object never reaches that displacement)")
      const t1 = (-u + Math.sqrt(disc)) / a
      const t2 = (-u - Math.sqrt(disc)) / a
      // Prefer positive time; if both positive take the smaller (first crossing)
      const candidates = [t1, t2].filter(x => x >= 0)
      if (candidates.length === 0) throw new RangeError("No positive-time solution for given displacement and acceleration")
      t = Math.min(...candidates)
    }
  }

  // Re-derive any still-null
  if (v === null) v = u + a * t
  if (s === null) s = u * t + 0.5 * a * t * t

  // Validate
  if (t < 0) throw new RangeError("Derived time is negative — check inputs for physical consistency")

  const sampleCount = Number.isSafeInteger(options.sampleCount) && options.sampleCount >= 2
    ? options.sampleCount : 100
  const trajectory = Array.from({ length: sampleCount }, (_, i) => {
    const ti = t * i / (sampleCount - 1)
    return Object.freeze({ time: ti, position: u * ti + 0.5 * a * ti * ti, velocity: u + a * ti })
  })

  return Object.freeze({
    metadata: KINEMATICS_1D_METADATA,
    units: KINEMATICS_1D_METADATA.outputUnits,
    initialVelocity: u,
    finalVelocity: v,
    acceleration: a,
    displacement: s,
    time: t,
    trajectory: Object.freeze(trajectory),
  })
}

// ─── 2. Newton's Second Law ───────────────────────────────────────────────

export const NEWTON_SECOND_LAW_METADATA = Object.freeze({
  id: "newton-second-law",
  name: "Newton's Second Law — F = m a",
  assumptions: Object.freeze([
    "inertial reference frame",
    "point mass or rigid body (for translational motion)",
    "non-relativistic speeds",
    "net force is the vector sum of all applied forces",
  ]),
  governingEquations: Object.freeze([
    "F_net = m a",
    "a = F_net / m",
    "W = m g  (weight, g = 9.80665 m/s² standard)",
  ]),
  outputUnits: Object.freeze({ force: "N", acceleration: "m/s^2", mass: "kg", weight: "N" }),
})

/**
 * Applies Newton's Second Law. Provide any two of force, mass, acceleration.
 *
 * Options (exactly two of three):
 *   force        { value, unit }
 *   mass         { value, unit }
 *   acceleration { value, unit }
 *
 * Optional:
 *   gravity { value, unit }  — for computing weight (default 9.80665 m/s²)
 */
export function solveNewtonSecondLaw(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const hasF = options.force        !== undefined
  const hasM = options.mass         !== undefined
  const hasA = options.acceleration !== undefined
  if ([hasF, hasM, hasA].filter(Boolean).length !== 2) {
    throw new TypeError("Provide exactly two of: force, mass, acceleration")
  }

  let F = hasF ? readQ(options, "force", "N")              : null
  let m = hasM ? assertPositive(readQ(options, "mass", "kg"), "mass") : null
  let acc = hasA ? readQ(options, "acceleration", "m/s^2") : null

  if (F === null) F = m * acc
  else if (m === null) { if (acc === 0) throw new RangeError("acceleration is zero — mass cannot be derived"); m = F / acc }
  else acc = F / m

  const g = readQOpt(options, "gravity", "m/s^2", 9.80665)
  const weight = m * g

  return Object.freeze({
    metadata: NEWTON_SECOND_LAW_METADATA,
    units: NEWTON_SECOND_LAW_METADATA.outputUnits,
    force: F,
    mass: m,
    acceleration: acc,
    weight,
    gravity: g,
  })
}

// ─── 3. Drag forces ──────────────────────────────────────────────────────

export const DRAG_FORCE_METADATA = Object.freeze({
  id: "drag-force-stokes-and-quadratic",
  name: "Drag forces — Stokes (linear) and quadratic (aerodynamic)",
  assumptions: Object.freeze([
    "Stokes drag F = b v valid for Re ≪ 1 (creeping flow / very small particles)",
    "Quadratic drag F = ½ ρ C_D A v² valid for turbulent flow (Re ≫ 1)",
    "drag opposes velocity direction",
    "fluid density and drag coefficient are constant",
    "2-D vertical motion only for the trajectory solver",
  ]),
  governingEquations: Object.freeze([
    "Stokes (linear):    F_drag = b v   [b = 6π η r for a sphere]",
    "Quadratic:          F_drag = ½ ρ C_D A v²",
    "Terminal velocity (Stokes):     v_t = m g / b",
    "Terminal velocity (quadratic):  v_t = √(2 m g / (ρ C_D A))",
    "Equation of motion: m dv/dt = m g − F_drag (downward positive)",
  ]),
  outputUnits: Object.freeze({
    dragForce: "N",
    terminalVelocity: "m/s",
    time: "s",
    velocity: "m/s",
    position: "m",
  }),
})

/**
 * Computes drag force and terminal velocity; optionally integrates trajectory.
 *
 * Options:
 *   dragModel        — "stokes" | "quadratic"
 *   mass             { value, unit }  — object mass (kg)
 *   velocity         { value, unit }  — instantaneous speed for force calculation (m/s)
 *
 * For dragModel "stokes":
 *   linearDragCoefficient { value, unit }  — b (N·s/m)
 *
 * For dragModel "quadratic":
 *   fluidDensity          { value, unit }  — ρ (kg/m³)
 *   dragCoefficient                        — C_D (dimensionless number)
 *   crossSectionalArea    { value, unit }  — A (m²)
 *
 * Optional trajectory integration:
 *   gravity           { value, unit }  — g (m/s²), default 9.80665
 *   initialVelocity   { value, unit }  — v₀ (m/s), default 0 (released from rest)
 *   duration          { value, unit }  — simulation duration (s)
 *   sampleCount                        — integer ≥ 2, default 200
 */
export function solveDragForce(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const model = requireField(options, "dragModel")
  if (model !== "stokes" && model !== "quadratic") throw new RangeError("dragModel must be 'stokes' or 'quadratic'")

  const m   = assertPositive(readQ(options, "mass", "kg"), "mass")
  const v   = assertNonNegative(readQ(options, "velocity", "m/s"), "velocity")
  const g   = assertPositive(readQOpt(options, "gravity", "m/s^2", 9.80665), "gravity")

  let F_drag, v_terminal, effectiveDamping

  if (model === "stokes") {
    const b = assertPositive(readQ(options, "linearDragCoefficient", "N*s/m"), "linearDragCoefficient")
    F_drag = b * v
    v_terminal = (m * g) / b
    effectiveDamping = b
  } else {
    const rho = assertPositive(readQ(options, "fluidDensity", "kg/m^3"), "fluidDensity")
    const Cd  = assertPositive(assertFiniteNumber(requireField(options, "dragCoefficient"), "dragCoefficient"), "dragCoefficient")
    const A   = assertPositive(readQ(options, "crossSectionalArea", "m^2"), "crossSectionalArea")
    F_drag = 0.5 * rho * Cd * A * v * v
    v_terminal = Math.sqrt((2 * m * g) / (rho * Cd * A))
    effectiveDamping = null  // non-linear, cannot linearise
  }

  const result = Object.freeze({
    metadata: DRAG_FORCE_METADATA,
    units: DRAG_FORCE_METADATA.outputUnits,
    dragModel: model,
    dragForce: F_drag,
    terminalVelocity: v_terminal,
    atSpeed: v,
  })

  if (options.duration === undefined) return result

  // Trajectory integration via RK4 (vertical motion, downward positive)
  const v0       = readQOpt(options, "initialVelocity", "m/s", 0)
  const duration = assertPositive(readQ(options, "duration", "s"), "duration")
  const sampleCount = Number.isSafeInteger(options.sampleCount) && options.sampleCount >= 2
    ? options.sampleCount : 200
  const timeStep = duration / (sampleCount - 1)

  // State: [y (downward from release), vy]
  const derivative = (_t, [_y, vy]) => {
    let drag
    if (model === "stokes") {
      drag = effectiveDamping * vy
    } else {
      const rho = assertPositive(readQ(options, "fluidDensity", "kg/m^3"), "fluidDensity")
      const Cd  = requireField(options, "dragCoefficient")
      const A   = assertPositive(readQ(options, "crossSectionalArea", "m^2"), "crossSectionalArea")
      drag = 0.5 * rho * Cd * A * vy * Math.abs(vy)
    }
    const ay = g - drag / m
    return [vy, ay]
  }

  const raw = integrateRK4({
    derivative,
    initialState: [0, v0],
    startTime: 0,
    timeStep,
    steps: sampleCount - 1,
  })

  const trajectory = Object.freeze(raw.map(({ time, state: [y, vy] }) =>
    Object.freeze({ time, position: y, velocity: vy })
  ))

  return Object.freeze({ ...result, trajectory })
}

// ─── 4. Friction ────────────────────────────────────────────────────────

export const FRICTION_METADATA = Object.freeze({
  id: "friction-static-kinetic",
  name: "Friction — static and kinetic, inclined plane",
  assumptions: Object.freeze([
    "rigid surfaces, no deformation",
    "Coulomb friction model: f ≤ μ_s N (static), f = μ_k N (kinetic)",
    "flat surface or inclined plane (2-D)",
    "normal force determined by weight component perpendicular to surface",
  ]),
  governingEquations: Object.freeze([
    "N = m g cos θ   (normal force on incline)",
    "f_static_max = μ_s N",
    "f_kinetic     = μ_k N",
    "Minimum angle for sliding: tan θ_crit = μ_s",
    "Net force along incline: F_net = m g sin θ − μ_k m g cos θ",
    "Acceleration: a = g (sin θ − μ_k cos θ)",
  ]),
  outputUnits: Object.freeze({
    normalForce: "N",
    maxStaticFriction: "N",
    kineticFriction: "N",
    netForce: "N",
    acceleration: "m/s^2",
    criticalAngle: "deg",
  }),
})

/**
 * Analyses friction on a flat or inclined surface.
 *
 * Options:
 *   mass                { value, unit }  — object mass (kg)
 *   staticCoefficient                    — μ_s (dimensionless)
 *   kineticCoefficient                   — μ_k (dimensionless)
 *
 * Optional:
 *   angle    { value, unit }  — incline angle from horizontal (default 0 rad = flat)
 *   gravity  { value, unit }  — default 9.80665 m/s²
 *   appliedForce { value, unit } — force along the slope (positive = up the slope)
 */
export function solveFriction(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const m   = assertPositive(readQ(options, "mass", "kg"), "mass")
  const mus = assertNonNegative(assertFiniteNumber(requireField(options, "staticCoefficient"),  "staticCoefficient"),  "staticCoefficient")
  const muk = assertNonNegative(assertFiniteNumber(requireField(options, "kineticCoefficient"), "kineticCoefficient"), "kineticCoefficient")
  if (muk > mus) throw new RangeError("kineticCoefficient must not exceed staticCoefficient")
  const g     = assertPositive(readQOpt(options, "gravity", "m/s^2", 9.80665), "gravity")
  const theta = readQOpt(options, "angle", "rad", 0)
  assertInRange(theta, 0, Math.PI / 2, "angle")

  const N   = m * g * Math.cos(theta)
  const fSmax = mus * N
  const fK    = muk * N

  const gravityAlongSlope = m * g * Math.sin(theta)
  const F_applied = options.appliedForce !== undefined ? readQ(options, "appliedForce", "N") : 0

  // Determine if the block moves
  const netDrivingForce = gravityAlongSlope + F_applied
  const isSliding = Math.abs(netDrivingForce) > fSmax
  const frictionActual = isSliding ? fK * Math.sign(netDrivingForce) : netDrivingForce
  const netForce = isSliding ? netDrivingForce - frictionActual : 0
  const acceleration = netForce / m

  const criticalAngleDeg = (Math.atan(mus) * 180) / Math.PI

  return Object.freeze({
    metadata: FRICTION_METADATA,
    units: FRICTION_METADATA.outputUnits,
    mass: m,
    normalForce: N,
    maxStaticFriction: fSmax,
    kineticFriction: fK,
    criticalAngleDeg,
    isSliding,
    netForce,
    acceleration,
    angle: theta,
    gravityAlongSlope,
  })
}

// ─── 5. Impulse and momentum ────────────────────────────────────────────

export const IMPULSE_MOMENTUM_METADATA = Object.freeze({
  id: "impulse-momentum",
  name: "Impulse and momentum — single body and two-body collisions",
  assumptions: Object.freeze([
    "isolated system for collision analysis (no external forces during collision)",
    "point masses",
    "1-D motion",
    "conservation of linear momentum: p_total_before = p_total_after",
  ]),
  governingEquations: Object.freeze([
    "p = m v   (linear momentum)",
    "J = F Δt = Δp  (impulse-momentum theorem)",
    "Elastic:   ½m₁v₁² + ½m₂v₂² conserved",
    "Inelastic: only momentum conserved",
    "Perfectly inelastic: bodies stick together, v_f = (m₁v₁ + m₂v₂)/(m₁ + m₂)",
  ]),
  outputUnits: Object.freeze({
    momentum: "kg*m/s",
    impulse: "kg*m/s",
    velocity: "m/s",
    kineticEnergy: "J",
    coefficientOfRestitution: "dimensionless",
  }),
})

/**
 * Analyses impulse/momentum or two-body collision.
 *
 * Single-body mode (provide mass, initialVelocity, and one of impulse or finalVelocity):
 *   mass            { value, unit }
 *   initialVelocity { value, unit }
 *   finalVelocity   { value, unit }?
 *   impulse         { value, unit }?  — J = F Δt (N·s)
 *   force           { value, unit }?  — average force during impact
 *   collisionTime   { value, unit }?  — duration of impact (s)
 *
 * Two-body collision mode (provide collisionType):
 *   collisionType   — "elastic" | "inelastic" | "perfectly_inelastic"
 *   mass1 / mass2           { value, unit }
 *   initialVelocity1/2      { value, unit }
 *   coefficientOfRestitution                  — e (0..1); required for "inelastic"
 */
export function solveImpulseMomentum(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  if (options.collisionType !== undefined) {
    // Two-body collision
    const type = requireField(options, "collisionType")
    if (!["elastic","inelastic","perfectly_inelastic"].includes(type)) {
      throw new RangeError("collisionType must be elastic, inelastic, or perfectly_inelastic")
    }
    const m1 = assertPositive(readQ(options, "mass1", "kg"), "mass1")
    const m2 = assertPositive(readQ(options, "mass2", "kg"), "mass2")
    const u1 = readQ(options, "initialVelocity1", "m/s")
    const u2 = readQ(options, "initialVelocity2", "m/s")

    const p_before = m1 * u1 + m2 * u2
    const ke_before = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2

    let v1, v2, e
    if (type === "perfectly_inelastic") {
      v1 = v2 = p_before / (m1 + m2)
      e = 0
    } else if (type === "elastic") {
      e = 1
      v1 = ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2)
      v2 = ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2)
    } else {
      // inelastic — coefficient of restitution required
      e = assertInRange(assertFiniteNumber(requireField(options, "coefficientOfRestitution"), "coefficientOfRestitution"), 0, 1, "coefficientOfRestitution")
      // e = (v2 - v1)/(u1 - u2),  m1 u1 + m2 u2 = m1 v1 + m2 v2
      v1 = (m1 * u1 + m2 * u2 - m2 * e * (u1 - u2)) / (m1 + m2)
      v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / (m1 + m2)
    }

    const ke_after = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2
    const p_after  = m1 * v1 + m2 * v2

    return Object.freeze({
      metadata: IMPULSE_MOMENTUM_METADATA,
      units: IMPULSE_MOMENTUM_METADATA.outputUnits,
      collisionType: type,
      momentumBefore: p_before,
      momentumAfter: p_after,
      kineticEnergyBefore: ke_before,
      kineticEnergyAfter: ke_after,
      kineticEnergyLost: ke_before - ke_after,
      coefficientOfRestitution: e,
      finalVelocity1: v1,
      finalVelocity2: v2,
    })
  }

  // Single-body mode
  const m    = assertPositive(readQ(options, "mass", "kg"), "mass")
  const v0   = readQ(options, "initialVelocity", "m/s")
  const p0   = m * v0

  let J  = options.impulse       !== undefined ? readQ(options, "impulse",       "kg*m/s") : null
  let vf = options.finalVelocity !== undefined ? readQ(options, "finalVelocity", "m/s")    : null

  if (J === null && vf !== null) J = m * (vf - v0)
  if (vf === null && J !== null) vf = v0 + J / m
  if (J === null && vf === null) throw new TypeError("Provide one of: impulse or finalVelocity")

  const pf = m * vf
  const ke0 = 0.5 * m * v0 * v0
  const kef = 0.5 * m * vf * vf

  let avgForce = null, collisionTime = null
  if (options.force !== undefined) {
    avgForce = readQ(options, "force", "N")
    collisionTime = J / avgForce
  } else if (options.collisionTime !== undefined) {
    collisionTime = readQ(options, "collisionTime", "s")
    avgForce = J / collisionTime
  }

  return Object.freeze({
    metadata: IMPULSE_MOMENTUM_METADATA,
    units: IMPULSE_MOMENTUM_METADATA.outputUnits,
    mass: m,
    initialMomentum: p0,
    finalMomentum: pf,
    impulse: J,
    finalVelocity: vf,
    kineticEnergyBefore: ke0,
    kineticEnergyAfter: kef,
    kineticEnergyChange: kef - ke0,
    averageForce: avgForce,
    collisionTime,
  })
}

// ─── 6. Work, energy, power ──────────────────────────────────────────────

export const WORK_ENERGY_METADATA = Object.freeze({
  id: "work-energy-power",
  name: "Work, kinetic energy, potential energy, and power",
  assumptions: Object.freeze([
    "rigid body or point mass",
    "constant force (or average force for work calculation)",
    "uniform gravitational field for gravitational PE",
    "linear spring for elastic PE",
    "work-energy theorem: W_net = ΔKE",
  ]),
  governingEquations: Object.freeze([
    "W = F · d cos θ   (work by constant force)",
    "KE = ½ m v²",
    "PE_grav = m g h",
    "PE_spring = ½ k x²",
    "P = W / t = F v",
    "W_net = ΔKE = KE_f − KE_i",
  ]),
  outputUnits: Object.freeze({
    work: "J",
    kineticEnergy: "J",
    potentialEnergy: "J",
    power: "W",
    velocity: "m/s",
  }),
})

/**
 * Computes work, energy, and power quantities.
 *
 * Options (at least one calculation group must be specified):
 *
 * Work by force:
 *   force     { value, unit }
 *   displacement { value, unit }
 *   angle     { value, unit }?   — angle between force and displacement (default 0)
 *
 * Kinetic energy:
 *   mass      { value, unit }
 *   velocity  { value, unit }     — OR initialVelocity + finalVelocity for ΔKE
 *   initialVelocity { value, unit }?
 *   finalVelocity   { value, unit }?
 *
 * Gravitational PE:
 *   mass   { value, unit }
 *   height { value, unit }
 *   gravity { value, unit }?  (default 9.80665 m/s²)
 *
 * Spring PE:
 *   springConstant { value, unit }
 *   springExtension { value, unit }
 *
 * Power:
 *   workDone { value, unit }
 *   timeTaken { value, unit }
 */
export function solveWorkEnergy(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const result = {}

  if (options.force !== undefined && options.displacement !== undefined) {
    const F   = readQ(options, "force", "N")
    const d   = readQ(options, "displacement", "m")
    const ang = readQOpt(options, "angle", "rad", 0)
    result.work = F * d * Math.cos(ang)
    result.force = F
    result.displacement = d
    result.angle = ang
  }

  const g = readQOpt(options, "gravity", "m/s^2", 9.80665)

  if (options.mass !== undefined && options.velocity !== undefined) {
    const m = assertPositive(readQ(options, "mass", "kg"), "mass")
    const v = readQ(options, "velocity", "m/s")
    result.kineticEnergy = 0.5 * m * v * v
    result.mass = m
    result.velocity = v
  }

  if (options.mass !== undefined && options.initialVelocity !== undefined && options.finalVelocity !== undefined) {
    const m  = assertPositive(readQ(options, "mass", "kg"), "mass")
    const vi = readQ(options, "initialVelocity", "m/s")
    const vf = readQ(options, "finalVelocity",   "m/s")
    result.kineticEnergyInitial = 0.5 * m * vi * vi
    result.kineticEnergyFinal   = 0.5 * m * vf * vf
    result.deltaKineticEnergy   = result.kineticEnergyFinal - result.kineticEnergyInitial
    result.workNetRequired      = result.deltaKineticEnergy
    result.mass = m
  }

  if (options.mass !== undefined && options.height !== undefined) {
    const m = assertPositive(readQ(options, "mass", "kg"), "mass")
    const h = readQ(options, "height", "m")
    result.gravitationalPE = m * g * h
    result.mass = m
    result.height = h
  }

  if (options.springConstant !== undefined && options.springExtension !== undefined) {
    const k = assertPositive(readQ(options, "springConstant", "N/m"), "springConstant")
    const x = readQ(options, "springExtension", "m")
    result.springPE = 0.5 * k * x * x
    result.springConstant = k
    result.springExtension = x
  }

  if (options.workDone !== undefined && options.timeTaken !== undefined) {
    const W = readQ(options, "workDone", "J")
    const t = assertPositive(readQ(options, "timeTaken", "s"), "timeTaken")
    result.power = W / t
    result.workDone = W
    result.timeTaken = t
  }

  if (Object.keys(result).length === 0) {
    throw new TypeError("No recognized input combination — provide force+displacement, mass+velocity, mass+height, springConstant+springExtension, or workDone+timeTaken")
  }

  return Object.freeze({ metadata: WORK_ENERGY_METADATA, units: WORK_ENERGY_METADATA.outputUnits, ...result })
}

// ─── 7. Angular kinematics ───────────────────────────────────────────────

export const ANGULAR_KINEMATICS_METADATA = Object.freeze({
  id: "angular-kinematics-constant-alpha",
  name: "Angular kinematics — constant angular acceleration",
  assumptions: Object.freeze([
    "constant angular acceleration throughout the interval",
    "rotation about a fixed axis",
    "angles measured in radians internally",
    "no relativistic effects",
  ]),
  governingEquations: Object.freeze([
    "ω = ω₀ + α t",
    "θ = ω₀ t + ½ α t²",
    "ω² = ω₀² + 2 α θ",
    "θ = ½ (ω₀ + ω) t",
    "Tangential speed: v = r ω",
    "Centripetal acceleration: a_c = r ω² = v²/r",
    "Tangential acceleration: a_t = r α",
  ]),
  outputUnits: Object.freeze({
    angle: "rad",
    angularVelocity: "rad/s",
    angularAcceleration: "rad/s^2",
    time: "s",
    tangentialVelocity: "m/s",
    centripetal: "m/s^2",
    tangential: "m/s^2",
  }),
})

/**
 * Solves rotational kinematics with constant angular acceleration.
 * Provide exactly three of: initialAngularVelocity, finalAngularVelocity,
 * angularAcceleration, angularDisplacement, time.
 *
 * Optional:
 *   radius { value, unit }  — for tangential/centripetal quantities
 */
export function solveAngularKinematics(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const fields = ["initialAngularVelocity","finalAngularVelocity","angularAcceleration","angularDisplacement","time"]
  const units_ = { initialAngularVelocity:"rad/s", finalAngularVelocity:"rad/s", angularAcceleration:"rad/s^2", angularDisplacement:"rad", time:"s" }
  const given  = fields.filter(f => options[f] !== undefined)
  if (given.length !== 3) throw new TypeError("Provide exactly three of: initialAngularVelocity, finalAngularVelocity, angularAcceleration, angularDisplacement, time")

  const vals = {}
  for (const f of given) vals[f] = readQ(options, f, units_[f])

  let w0 = vals.initialAngularVelocity  ?? null
  let w  = vals.finalAngularVelocity    ?? null
  let al = vals.angularAcceleration     ?? null
  let th = vals.angularDisplacement     ?? null
  let t  = vals.time                    ?? null

  // Derive analogously to linear SUVAT
  if (w  === null && w0!==null && al!==null && t !==null) w  = w0 + al * t
  if (al === null && w0!==null && w !==null && t !==null) al = (w - w0) / t
  if (w0 === null && w !==null && al!==null && t !==null) w0 = w - al * t
  if (t  === null && al!==null && w0!==null && w !==null) { if(al===0) throw new RangeError("angularAcceleration is zero — time indeterminate"); t = (w - w0) / al }
  if (th === null && w0!==null && al!==null && t !==null) th = w0 * t + 0.5 * al * t * t
  if (th === null && w0!==null && w !==null && t !==null) th = 0.5 * (w0 + w) * t
  if (w  === null) w = w0 + al * t
  if (th === null) th = w0 * t + 0.5 * al * t * t

  if (t < 0) throw new RangeError("Derived time is negative")

  const result = { metadata: ANGULAR_KINEMATICS_METADATA, units: ANGULAR_KINEMATICS_METADATA.outputUnits,
    initialAngularVelocity: w0, finalAngularVelocity: w, angularAcceleration: al, angularDisplacement: th, time: t }

  if (options.radius !== undefined) {
    const r = assertPositive(readQ(options, "radius", "m"), "radius")
    result.radius = r
    result.tangentialVelocityFinal  = r * w
    result.tangentialVelocityInitial = r * w0
    result.centripetalAcceleration  = r * w * w
    result.tangentialAcceleration   = r * al
  }

  return Object.freeze(result)
}

// ─── 8. Torque and rotational dynamics ──────────────────────────────────

export const TORQUE_ROTATIONAL_METADATA = Object.freeze({
  id: "torque-rotational-dynamics",
  name: "Torque and rotational dynamics — τ = I α",
  assumptions: Object.freeze([
    "rotation about a fixed axis",
    "rigid body",
    "moment of inertia does not change during the motion",
    "torques may be due to forces at a moment arm or directly specified",
  ]),
  governingEquations: Object.freeze([
    "τ = r × F = r F sin φ   (torque from a force)",
    "τ_net = I α             (rotational Newton's 2nd law)",
    "L = I ω                 (angular momentum)",
    "KE_rot = ½ I ω²",
    "Rolling without slip: v_cm = r ω,  a_cm = r α",
  ]),
  outputUnits: Object.freeze({
    torque: "N*m",
    angularAcceleration: "rad/s^2",
    angularMomentum: "kg*m^2/s",
    rotationalKE: "J",
  }),
})

/**
 * Analyses torque and rotational dynamics.
 *
 * Options (any two of torque, momentOfInertia, angularAcceleration):
 *   torque              { value, unit }   — net torque τ (N·m)
 *   momentOfInertia     { value, unit }   — I (kg·m²)
 *   angularAcceleration { value, unit }?  — α (rad/s²)
 *
 * Optional:
 *   angularVelocity     { value, unit }  — ω for KE and L
 *   force               { value, unit }  — for τ = r F sin φ
 *   momentArm           { value, unit }  — r (m)
 *   forceAngle          { value, unit }  — φ between r and F (default π/2)
 *
 * Rolling without slip:
 *   rollingRadius       { value, unit }  — r (m)
 */
export function solveTorque(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const hasT = options.torque               !== undefined
  const hasI = options.momentOfInertia      !== undefined
  const hasA = options.angularAcceleration  !== undefined

  let tau = hasT ? readQ(options, "torque", "N*m")          : null
  let I   = hasI ? assertPositive(readQ(options, "momentOfInertia", "kg*m^2"), "momentOfInertia") : null
  let al  = hasA ? readQ(options, "angularAcceleration", "rad/s^2") : null

  // τ = r F sin φ
  if (!hasT && options.force !== undefined && options.momentArm !== undefined) {
    const F   = readQ(options, "force", "N")
    const r   = assertPositive(readQ(options, "momentArm", "m"), "momentArm")
    const phi = readQOpt(options, "forceAngle", "rad", Math.PI / 2)
    tau = r * F * Math.sin(phi)
  }

  const given = [tau, I, al].filter(x => x !== null).length
  if (given < 2) throw new TypeError("Provide at least two of: torque (or force+momentArm), momentOfInertia, angularAcceleration")

  if (al === null) al = tau / I
  else if (I === null) { if(al === 0) throw new RangeError("angularAcceleration is zero — moment of inertia indeterminate"); I = tau / al }
  else if (tau === null) tau = I * al

  const result = { metadata: TORQUE_ROTATIONAL_METADATA, units: TORQUE_ROTATIONAL_METADATA.outputUnits,
    torque: tau, momentOfInertia: I, angularAcceleration: al }

  if (options.angularVelocity !== undefined) {
    const w = readQ(options, "angularVelocity", "rad/s")
    result.angularMomentum = I * w
    result.rotationalKE    = 0.5 * I * w * w
    result.angularVelocity = w
  }

  if (options.rollingRadius !== undefined) {
    const r = assertPositive(readQ(options, "rollingRadius", "m"), "rollingRadius")
    result.rollingRadius = r
    if (options.angularVelocity !== undefined) result.rollingLinearVelocity = r * result.angularVelocity
    result.rollingLinearAcceleration = r * al
  }

  return Object.freeze(result)
}

// ─── 9. Moment-of-inertia catalog ─────────────────────────────────────

export const MOMENT_OF_INERTIA_METADATA = Object.freeze({
  id: "moment-of-inertia-catalog",
  name: "Moment of inertia catalog — 8 common rigid body shapes",
  assumptions: Object.freeze([
    "uniform mass distribution unless stated otherwise",
    "rotation axis passes through the centre of mass unless 'aboutEnd' or 'aboutEdge' specified",
    "parallel-axis theorem: I = I_cm + m d² for offset axes",
  ]),
  shapes: Object.freeze([
    "solidSphere", "hollowSphere", "solidCylinder", "hollowCylinder",
    "thinRod_cm", "thinRod_end", "rectangularPlate", "thinRing",
  ]),
  outputUnits: Object.freeze({ momentOfInertia: "kg*m^2" }),
})

/**
 * Computes the moment of inertia for a standard shape.
 *
 * Options:
 *   shape   — one of the shape strings in MOMENT_OF_INERTIA_METADATA.shapes
 *   mass    { value, unit }
 *
 * Shape-specific dimensions (all { value, unit }, length units):
 *   solidSphere / hollowSphere:             radius
 *   solidCylinder / hollowCylinder:         radius (outer), innerRadius (hollow only)
 *   thinRod_cm / thinRod_end:               length
 *   rectangularPlate (axis ⊥ to plane):     width, height
 *   thinRing:                               radius
 *
 * Optional:
 *   parallelAxisOffset { value, unit }  — d for parallel-axis theorem (adds m d²)
 */
export function solveMomentOfInertia(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const shape = requireField(options, "shape")
  const m = assertPositive(readQ(options, "mass", "kg"), "mass")

  const catalog = MOMENT_OF_INERTIA_METADATA.shapes
  if (!catalog.includes(shape)) throw new RangeError(`shape must be one of: ${catalog.join(", ")}`)

  let I_cm

  switch (shape) {
    case "solidSphere": {
      const r = assertPositive(readQ(options, "radius", "m"), "radius")
      I_cm = 0.4 * m * r * r
      break
    }
    case "hollowSphere": {
      const r = assertPositive(readQ(options, "radius", "m"), "radius")
      I_cm = (2 / 3) * m * r * r
      break
    }
    case "solidCylinder": {
      const r = assertPositive(readQ(options, "radius", "m"), "radius")
      I_cm = 0.5 * m * r * r
      break
    }
    case "hollowCylinder": {
      const ro = assertPositive(readQ(options, "radius", "m"), "radius")
      const ri = assertPositive(readQ(options, "innerRadius", "m"), "innerRadius")
      if (ri >= ro) throw new RangeError("innerRadius must be less than radius")
      I_cm = 0.5 * m * (ro * ro + ri * ri)
      break
    }
    case "thinRod_cm": {
      const L = assertPositive(readQ(options, "length", "m"), "length")
      I_cm = (1 / 12) * m * L * L
      break
    }
    case "thinRod_end": {
      const L = assertPositive(readQ(options, "length", "m"), "length")
      I_cm = (1 / 3) * m * L * L
      break
    }
    case "rectangularPlate": {
      const w = assertPositive(readQ(options, "width",  "m"), "width")
      const h = assertPositive(readQ(options, "height", "m"), "height")
      I_cm = (1 / 12) * m * (w * w + h * h)
      break
    }
    case "thinRing": {
      const r = assertPositive(readQ(options, "radius", "m"), "radius")
      I_cm = m * r * r
      break
    }
  }

  let I = I_cm
  if (options.parallelAxisOffset !== undefined) {
    const d = assertNonNegative(readQ(options, "parallelAxisOffset", "m"), "parallelAxisOffset")
    I = I_cm + m * d * d
  }

  return Object.freeze({
    metadata: MOMENT_OF_INERTIA_METADATA,
    units: MOMENT_OF_INERTIA_METADATA.outputUnits,
    shape,
    mass: m,
    momentOfInertia: I,
    momentOfInertiaCM: I_cm,
  })
}
