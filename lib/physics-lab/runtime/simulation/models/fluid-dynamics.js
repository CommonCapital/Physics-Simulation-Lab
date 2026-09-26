/**
 * Fluid dynamics — covering:
 *
 *  1. Continuity equation — mass and volumetric flow rate
 *  2. Bernoulli's equation — inviscid, steady, incompressible flow
 *  3. Hagen–Poiseuille — viscous laminar pipe flow
 *  4. Reynolds number — flow regime classification
 *  5. Terminal velocity and Stokes settling — particle in a fluid
 *  6. Drag coefficient analysis — form drag on common shapes
 *  7. Venturi meter and Pitot tube — Bernoulli applications
 *
 * Physical constants / reference values used:
 *   ρ_water   = 1000 kg/m³  (standard liquid water at 4°C)
 *   ρ_air_std = 1.225 kg/m³  (air at 15°C, 101325 Pa, ISA)
 *   η_water   = 1.002 × 10⁻³ Pa·s  (dynamic viscosity of water at 20°C)
 *
 * All solvers accept { value, unit } quantity objects and return SI results.
 *
 * Scope limitations:
 *   - Incompressible, Newtonian fluids only
 *   - No turbulence modeling (RANS, LES, DNS) — Reynolds number is a
 *     regime indicator only, not a full turbulent-flow solver
 *   - No open-channel flow, no two-phase flow, no non-Newtonian fluids
 *   - No compressible (supersonic/subsonic Mach) flows
 */

import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  requireField,
} from "../validation.js"

// ─── Helpers ─────────────────────────────────────────────────────────────

function readQ(options, field, siUnit) {
  const quantity = requireField(options, field)
  if (quantity === null || typeof quantity !== "object") throw new TypeError(`${field} must be { value, unit }`)
  const value = requireField(quantity, "value")
  const unit  = requireField(quantity, "unit")
  assertFiniteNumber(value, `${field}.value`)
  try {
    return assertFiniteNumber(convertUnit(value, unit, siUnit), `${field} in ${siUnit}`)
  } catch (err) { throw new err.constructor(`${field}: ${err.message}`) }
}

function readQOpt(options, field, siUnit, fallback) {
  if (options[field] === undefined) return fallback
  return readQ(options, field, siUnit)
}

// ─── 1. Continuity equation ───────────────────────────────────────────────

export const CONTINUITY_METADATA = Object.freeze({
  id: "continuity-equation",
  name: "Continuity equation — conservation of mass in steady pipe flow",
  assumptions: Object.freeze([
    "steady, incompressible flow",
    "uniform velocity profile across each cross-section",
    "no mass accumulation in the control volume",
  ]),
  governingEquations: Object.freeze([
    "A₁ v₁ = A₂ v₂   (volumetric continuity)",
    "ρ A₁ v₁ = ρ A₂ v₂   (mass continuity, incompressible: ρ constant)",
    "Q = A v   (volumetric flow rate)",
    "ṁ = ρ Q  (mass flow rate)",
  ]),
  outputUnits: Object.freeze({ velocity: "m/s", volumetricFlowRate: "m^3/s", massFlowRate: "kg/s", area: "m^2" }),
})

/**
 * Applies the continuity equation between two cross-sections.
 *
 * Options (provide any three of: area1, velocity1, area2, velocity2):
 *   area1     { value, unit }
 *   velocity1 { value, unit }
 *   area2     { value, unit }
 *   velocity2 { value, unit }
 *
 * Optional:
 *   fluidDensity { value, unit }  — ρ (kg/m³) for mass flow rate
 */
export function solveContinuity(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const hasA1 = options.area1     !== undefined
  const hasV1 = options.velocity1 !== undefined
  const hasA2 = options.area2     !== undefined
  const hasV2 = options.velocity2 !== undefined
  const given = [hasA1, hasV1, hasA2, hasV2].filter(Boolean).length
  if (given !== 3) throw new TypeError("Provide exactly three of: area1, velocity1, area2, velocity2")

  let A1 = hasA1 ? assertPositive(readQ(options, "area1",     "m^2"), "area1")   : null
  let v1 = hasV1 ? assertPositive(readQ(options, "velocity1", "m/s"), "velocity1") : null
  let A2 = hasA2 ? assertPositive(readQ(options, "area2",     "m^2"), "area2")   : null
  let v2 = hasV2 ? assertPositive(readQ(options, "velocity2", "m/s"), "velocity2") : null

  if (A1 === null) A1 = A2 * v2 / v1
  else if (v1 === null) v1 = A2 * v2 / A1
  else if (A2 === null) A2 = A1 * v1 / v2
  else v2 = A1 * v1 / A2

  const Q = A1 * v1
  const rho = readQOpt(options, "fluidDensity", "kg/m^3", null)
  const massFlowRate = rho !== null ? rho * Q : null

  return Object.freeze({
    metadata: CONTINUITY_METADATA, units: CONTINUITY_METADATA.outputUnits,
    area1: A1, velocity1: v1, area2: A2, velocity2: v2,
    volumetricFlowRate: Q,
    massFlowRate,
  })
}

// ─── 2. Bernoulli's equation ──────────────────────────────────────────────

export const BERNOULLI_METADATA = Object.freeze({
  id: "bernoulli-inviscid-incompressible",
  name: "Bernoulli's equation — inviscid, incompressible, steady flow",
  assumptions: Object.freeze([
    "incompressible fluid (constant density)",
    "inviscid (no viscosity, no friction losses)",
    "steady flow",
    "flow along a single streamline",
    "no heat transfer or work by machines along the streamline",
  ]),
  governingEquations: Object.freeze([
    "p₁ + ½ρv₁² + ρgh₁ = p₂ + ½ρv₂² + ρgh₂   (Bernoulli's equation)",
    "Stagnation pressure: p₀ = p + ½ρv²",
    "Dynamic pressure: q = ½ρv²",
  ]),
  outputUnits: Object.freeze({ pressure: "Pa", velocity: "m/s", height: "m", dynamicPressure: "Pa" }),
})

/**
 * Applies Bernoulli's equation. Provide all quantities at one point
 * and any two of {pressure, velocity, height} at the second.
 *
 * Options:
 *   fluidDensity  { value, unit }   — ρ (kg/m³)
 *   pressure1     { value, unit }   — p₁ (Pa)
 *   velocity1     { value, unit }   — v₁ (m/s)
 *   height1       { value, unit }   — z₁ (m), reference elevation
 *
 *   At section 2, provide any two of:
 *   pressure2     { value, unit }?
 *   velocity2     { value, unit }?
 *   height2       { value, unit }?
 *
 * Optional:
 *   gravity       { value, unit }   — default 9.80665 m/s²
 */
export function solveBernoulli(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const rho = assertPositive(readQ(options, "fluidDensity", "kg/m^3"), "fluidDensity")
  const p1  = assertFiniteNumber(readQ(options, "pressure1",  "Pa"),   "pressure1")
  const v1  = assertNonNegative (readQ(options, "velocity1",  "m/s"),  "velocity1")
  const z1  = assertFiniteNumber(readQ(options, "height1",    "m"),    "height1")
  const g   = assertPositive(readQOpt(options, "gravity", "m/s^2", 9.80665), "gravity")

  const hasP2 = options.pressure2 !== undefined
  const hasV2 = options.velocity2 !== undefined
  const hasZ2 = options.height2   !== undefined
  const given2 = [hasP2, hasV2, hasZ2].filter(Boolean).length
  if (given2 !== 2) throw new TypeError("Provide exactly two of: pressure2, velocity2, height2 for section 2")

  let p2 = hasP2 ? assertFiniteNumber(readQ(options, "pressure2", "Pa"),  "pressure2") : null
  let v2 = hasV2 ? assertNonNegative (readQ(options, "velocity2", "m/s"), "velocity2") : null
  let z2 = hasZ2 ? assertFiniteNumber(readQ(options, "height2",   "m"),   "height2")   : null

  // Bernoulli constant: H = p + ½ρv² + ρgz
  const H = p1 + 0.5 * rho * v1 * v1 + rho * g * z1

  if (p2 === null) p2 = H - 0.5 * rho * v2 * v2 - rho * g * z2
  else if (v2 === null) {
    const term = (H - p2 - rho * g * z2) / (0.5 * rho)
    if (term < 0) throw new RangeError("No real solution for v₂: pressure and elevation exceed Bernoulli constant")
    v2 = Math.sqrt(term)
  } else {
    z2 = (H - p2 - 0.5 * rho * v2 * v2) / (rho * g)
  }

  const dynamicPressure1 = 0.5 * rho * v1 * v1
  const dynamicPressure2 = 0.5 * rho * v2 * v2
  const stagnationPressure = p1 + dynamicPressure1

  return Object.freeze({
    metadata: BERNOULLI_METADATA, units: BERNOULLI_METADATA.outputUnits,
    fluidDensity: rho,
    pressure1: p1, velocity1: v1, height1: z1,
    pressure2: p2, velocity2: v2, height2: z2,
    bernoulliConstant: H,
    dynamicPressure1, dynamicPressure2,
    stagnationPressure,
  })
}

// ─── 3. Hagen–Poiseuille — viscous laminar pipe flow ─────────────────────

export const HAGEN_POISEUILLE_METADATA = Object.freeze({
  id: "hagen-poiseuille-laminar-pipe",
  name: "Hagen–Poiseuille — viscous laminar pipe flow",
  assumptions: Object.freeze([
    "fully developed laminar flow (Re < 2300)",
    "Newtonian, incompressible fluid",
    "straight, rigid, horizontal or any orientation pipe (pressure drives flow)",
    "no-slip boundary condition at the pipe wall",
    "circular cross-section",
  ]),
  governingEquations: Object.freeze([
    "Q = π R⁴ Δp / (8 η L)",
    "v_avg = R² Δp / (8 η L)",
    "v_max = 2 v_avg   (parabolic profile)",
    "τ_wall = R Δp / (2 L)",
    "Re = ρ v_avg (2R) / η",
  ]),
  outputUnits: Object.freeze({ volumetricFlowRate: "m^3/s", velocity: "m/s", pressure: "Pa", shearStress: "Pa" }),
})

/**
 * Options:
 *   radius            { value, unit }   — pipe inner radius (m)
 *   length            { value, unit }   — pipe length (m)
 *   dynamicViscosity  { value, unit }   — η (Pa·s)
 *
 * Provide one of:
 *   pressureDrop      { value, unit }   — Δp (Pa)   → derives Q
 *   volumetricFlow    { value, unit }   — Q (m³/s)  → derives Δp
 *
 * Optional:
 *   fluidDensity      { value, unit }   — ρ (kg/m³) for Reynolds number
 */
export function solveHagenPoiseuille(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const R  = assertPositive(readQ(options, "radius",           "m"),    "radius")
  const L  = assertPositive(readQ(options, "length",           "m"),    "length")
  const eta = assertPositive(readQ(options, "dynamicViscosity", "Pa*s"), "dynamicViscosity")

  const hasDP = options.pressureDrop    !== undefined
  const hasQ  = options.volumetricFlow  !== undefined
  if (hasDP === hasQ) throw new TypeError("Provide exactly one of: pressureDrop or volumetricFlow")

  let deltaP, Q
  if (hasDP) {
    deltaP = assertPositive(readQ(options, "pressureDrop",   "Pa"),   "pressureDrop")
    Q      = Math.PI * Math.pow(R, 4) * deltaP / (8 * eta * L)
  } else {
    Q      = assertPositive(readQ(options, "volumetricFlow", "m^3/s"), "volumetricFlow")
    deltaP = 8 * eta * L * Q / (Math.PI * Math.pow(R, 4))
  }

  const v_avg = Q / (Math.PI * R * R)
  const v_max = 2 * v_avg
  const tau_wall = R * deltaP / (2 * L)

  const result = {
    metadata: HAGEN_POISEUILLE_METADATA, units: HAGEN_POISEUILLE_METADATA.outputUnits,
    radius: R, length: L, dynamicViscosity: eta,
    pressureDrop: deltaP, volumetricFlowRate: Q,
    averageVelocity: v_avg, maximumVelocity: v_max, wallShearStress: tau_wall,
  }

  if (options.fluidDensity !== undefined) {
    const rho = assertPositive(readQ(options, "fluidDensity", "kg/m^3"), "fluidDensity")
    const Re  = rho * v_avg * (2 * R) / eta
    result.reynoldsNumber = Re
    result.flowRegime = Re < 2300 ? "laminar" : Re < 4000 ? "transitional" : "turbulent"
    result.note = Re >= 2300 ? "Re ≥ 2300: Hagen–Poiseuille is no longer valid — flow is transitional or turbulent" : null
  }

  return Object.freeze(result)
}

// ─── 4. Reynolds number ───────────────────────────────────────────────────

export const REYNOLDS_NUMBER_METADATA = Object.freeze({
  id: "reynolds-number",
  name: "Reynolds number — flow regime classification",
  assumptions: Object.freeze([
    "Newtonian fluid",
    "characteristic length is pipe diameter for internal flow, or body length for external flow",
    "regime boundaries are approximate — actual transition depends on inlet conditions and surface roughness",
  ]),
  governingEquations: Object.freeze([
    "Re = ρ v L / η = v L / ν",
    "Internal pipe flow: laminar Re < 2300, transitional 2300–4000, turbulent Re > 4000",
    "Flat plate (external): laminar Re < 5×10⁵, turbulent Re > 5×10⁵",
  ]),
  outputUnits: Object.freeze({ reynoldsNumber: "dimensionless" }),
})

/**
 * Options:
 *   fluidDensity       { value, unit }    — ρ (kg/m³)
 *   velocity           { value, unit }    — v (m/s)
 *   characteristicLength { value, unit }  — L (m); diameter for pipes
 *   dynamicViscosity   { value, unit }    — η (Pa·s)
 *
 * OR:
 *   kinematicViscosity { value, unit }    — ν = η/ρ (m²/s) instead of η + ρ
 *
 * Optional:
 *   flowGeometry       — "pipe" | "flatPlate" | "sphere" (for regime labeling)
 */
export function solveReynoldsNumber(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const v   = assertPositive(readQ(options, "velocity",              "m/s"), "velocity")
  const L   = assertPositive(readQ(options, "characteristicLength",  "m"),   "characteristicLength")

  let Re
  if (options.kinematicViscosity !== undefined) {
    const nu = assertPositive(readQ(options, "kinematicViscosity", "m^2/s"), "kinematicViscosity")
    Re = v * L / nu
  } else {
    const rho = assertPositive(readQ(options, "fluidDensity",      "kg/m^3"), "fluidDensity")
    const eta = assertPositive(readQ(options, "dynamicViscosity",  "Pa*s"),   "dynamicViscosity")
    Re = rho * v * L / eta
  }

  const geometry = options.flowGeometry ?? "pipe"
  let regime
  if (geometry === "pipe") {
    regime = Re < 2300 ? "laminar" : Re < 4000 ? "transitional" : "turbulent"
  } else if (geometry === "flatPlate") {
    regime = Re < 5e5 ? "laminar" : "turbulent"
  } else {
    // sphere / generic
    regime = Re < 1 ? "creeping (Stokes)" : Re < 1000 ? "laminar" : "turbulent"
  }

  return Object.freeze({
    metadata: REYNOLDS_NUMBER_METADATA, units: REYNOLDS_NUMBER_METADATA.outputUnits,
    reynoldsNumber: Re, flowGeometry: geometry, regime,
  })
}

// ─── 5. Stokes settling / terminal velocity in fluid ─────────────────────

export const STOKES_SETTLING_METADATA = Object.freeze({
  id: "stokes-settling",
  name: "Stokes settling — particle terminal velocity in a viscous fluid",
  assumptions: Object.freeze([
    "spherical particle",
    "Re ≪ 1 (creeping flow, Stokes regime)",
    "Newtonian, incompressible fluid of infinite extent",
    "no wall effects, no particle–particle interaction",
  ]),
  governingEquations: Object.freeze([
    "F_drag = 6π η r v   (Stokes drag on a sphere)",
    "v_terminal = 2 r² (ρ_particle − ρ_fluid) g / (9 η)",
    "Re = ρ_fluid v_t (2r) / η   (must be ≪ 1 for Stokes regime)",
  ]),
  outputUnits: Object.freeze({ velocity: "m/s", force: "N", reynoldsNumber: "dimensionless" }),
})

/**
 * Options:
 *   particleRadius    { value, unit }   — r (m)
 *   particleDensity   { value, unit }   — ρ_p (kg/m³)
 *   fluidDensity      { value, unit }   — ρ_f (kg/m³)
 *   dynamicViscosity  { value, unit }   — η (Pa·s)
 *   gravity           { value, unit }?  — default 9.80665 m/s²
 */
export function solveStokesSettling(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const r    = assertPositive(readQ(options, "particleRadius",   "m"),      "particleRadius")
  const rhoP = assertPositive(readQ(options, "particleDensity",  "kg/m^3"), "particleDensity")
  const rhoF = assertPositive(readQ(options, "fluidDensity",     "kg/m^3"), "fluidDensity")
  const eta  = assertPositive(readQ(options, "dynamicViscosity", "Pa*s"),   "dynamicViscosity")
  const g    = assertPositive(readQOpt(options, "gravity", "m/s^2", 9.80665), "gravity")

  const vt   = 2 * r * r * (rhoP - rhoF) * g / (9 * eta)
  const Re   = rhoF * Math.abs(vt) * (2 * r) / eta
  const Fd   = 6 * Math.PI * eta * r * Math.abs(vt)
  const Fg   = (4 / 3) * Math.PI * r * r * r * rhoP * g
  const Fb   = (4 / 3) * Math.PI * r * r * r * rhoF * g

  const validStokes = Re < 1

  return Object.freeze({
    metadata: STOKES_SETTLING_METADATA, units: STOKES_SETTLING_METADATA.outputUnits,
    particleRadius: r, particleDensity: rhoP, fluidDensity: rhoF, dynamicViscosity: eta,
    terminalVelocity: vt,
    direction: vt > 0 ? "sinking" : vt < 0 ? "rising (buoyant)" : "neutrally_buoyant",
    reynoldsNumber: Re,
    stokesRegimeValid: validStokes,
    stokesWarning: validStokes ? null : `Re = ${Re.toFixed(1)} — Stokes drag is inaccurate above Re ≈ 1`,
    dragForce: Fd,
    gravitationalForce: Fg,
    buoyantForce: Fb,
    netForce: Fg - Fb - Fd,
  })
}

// ─── 6. Drag coefficient ─────────────────────────────────────────────────

export const DRAG_COEFFICIENT_METADATA = Object.freeze({
  id: "drag-coefficient-form-drag",
  name: "Drag coefficient — form drag on submerged or aerodynamic bodies",
  assumptions: Object.freeze([
    "quadratic drag law: F_D = ½ ρ C_D A v²",
    "constant C_D (valid for high Re where C_D is approximately constant)",
    "fluid density and velocity are uniform over the reference area A",
  ]),
  governingEquations: Object.freeze([
    "F_D = ½ ρ C_D A v²",
    "C_D = 2 F_D / (ρ A v²)",
    "Power required to overcome drag: P = F_D v = ½ ρ C_D A v³",
  ]),
  referenceDragCoefficients: Object.freeze({
    sphere_Re1e5: 0.47,
    cylinder_crossflow: 1.0,
    flat_plate_perpendicular: 1.28,
    streamlined_body: 0.04,
    car_typical: 0.30,
    bicycle_upright: 1.0,
  }),
  outputUnits: Object.freeze({ force: "N", power: "W", dragCoefficient: "dimensionless" }),
})

/**
 * Options (provide any two of dragCoefficient, dragForce, velocity):
 *   dragCoefficient       — C_D (dimensionless)
 *   dragForce             { value, unit }  — F_D (N)
 *   velocity              { value, unit }  — v (m/s)
 *   fluidDensity          { value, unit }  — ρ (kg/m³)
 *   referenceArea         { value, unit }  — A (m²)
 */
export function solveDragCoefficient(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const rho = assertPositive(readQ(options, "fluidDensity",  "kg/m^3"), "fluidDensity")
  const A   = assertPositive(readQ(options, "referenceArea", "m^2"),    "referenceArea")

  const hasCd = options.dragCoefficient !== undefined
  const hasFd = options.dragForce       !== undefined
  const hasV  = options.velocity        !== undefined
  if ([hasCd, hasFd, hasV].filter(Boolean).length !== 2) {
    throw new TypeError("Provide exactly two of: dragCoefficient, dragForce, velocity")
  }

  let Cd = hasCd ? assertPositive(assertFiniteNumber(requireField(options, "dragCoefficient"), "dragCoefficient"), "dragCoefficient") : null
  let Fd = hasFd ? assertNonNegative(readQ(options, "dragForce", "N"),  "dragForce")  : null
  let v  = hasV  ? assertPositive   (readQ(options, "velocity",  "m/s"), "velocity") : null

  const q = () => 0.5 * rho * v * v  // dynamic pressure

  if (Cd === null) Cd = 2 * Fd / (rho * A * v * v)
  else if (Fd === null) Fd = 0.5 * rho * Cd * A * v * v
  else v = Math.sqrt(2 * Fd / (rho * Cd * A))

  const power = Fd * v

  return Object.freeze({
    metadata: DRAG_COEFFICIENT_METADATA, units: DRAG_COEFFICIENT_METADATA.outputUnits,
    fluidDensity: rho, referenceArea: A, dragCoefficient: Cd, dragForce: Fd, velocity: v,
    dynamicPressure: 0.5 * rho * v * v,
    powerToOvercomeDrag: power,
  })
}

// ─── 7. Venturi meter ─────────────────────────────────────────────────────

export const VENTURI_METER_METADATA = Object.freeze({
  id: "venturi-meter",
  name: "Venturi meter — flow-rate measurement using Bernoulli's principle",
  assumptions: Object.freeze([
    "inviscid, incompressible, steady flow",
    "horizontal meter (no height difference) or height difference provided",
    "ideal Venturi (no head loss) — multiply Q by discharge coefficient C_d for real meters",
  ]),
  governingEquations: Object.freeze([
    "Q = A₁ A₂ √(2 Δp / (ρ (A₁² − A₂²)))",
    "v₁ = Q / A₁,  v₂ = Q / A₂",
    "Δp = p₁ − p₂  (measured pressure difference)",
  ]),
  outputUnits: Object.freeze({ volumetricFlowRate: "m^3/s", velocity: "m/s" }),
})

/**
 * Options:
 *   inletArea      { value, unit }   — A₁ (m²)
 *   throatArea     { value, unit }   — A₂ (m²), A₂ < A₁
 *   pressureDrop   { value, unit }   — Δp = p₁ − p₂ (Pa)
 *   fluidDensity   { value, unit }   — ρ (kg/m³)
 *   dischargeCoeff               — C_d (dimensionless, default 1 for ideal)
 */
export function solveVenturiMeter(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const A1  = assertPositive(readQ(options, "inletArea",    "m^2"),   "inletArea")
  const A2  = assertPositive(readQ(options, "throatArea",   "m^2"),   "throatArea")
  if (A2 >= A1) throw new RangeError("throatArea must be less than inletArea")
  const dp  = assertPositive(readQ(options, "pressureDrop", "Pa"),    "pressureDrop")
  const rho = assertPositive(readQ(options, "fluidDensity", "kg/m^3"), "fluidDensity")
  const Cd  = options.dischargeCoeff !== undefined
    ? assertPositive(assertFiniteNumber(requireField(options,"dischargeCoeff"),"dischargeCoeff"),"dischargeCoeff")
    : 1

  const Q_ideal = A1 * A2 * Math.sqrt(2 * dp / (rho * (A1 * A1 - A2 * A2)))
  const Q = Cd * Q_ideal
  const v1 = Q / A1
  const v2 = Q / A2

  return Object.freeze({
    metadata: VENTURI_METER_METADATA, units: VENTURI_METER_METADATA.outputUnits,
    inletArea: A1, throatArea: A2, pressureDrop: dp, fluidDensity: rho, dischargeCoeff: Cd,
    volumetricFlowRate: Q, inletVelocity: v1, throatVelocity: v2,
  })
}
