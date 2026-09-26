/**
 * Electromagnetism — covering:
 *
 *  1. Coulomb's law — electrostatic force between point charges
 *  2. Electric field and potential — point charges, parallel plates
 *  3. Capacitor analysis — parallel-plate geometry, energy, charge
 *  4. Magnetic force — Lorentz force F = q v × B and F = I L × B
 *  5. Biot–Savart (simple cases): B on-axis of a circular loop, solenoid
 *  6. Electromagnetic induction — Faraday's law, motional EMF
 *  7. RL and LC circuits — transient response
 *  8. RLC circuit — series, damped oscillation or overdamped
 *  9. Maxwell's equations — metadata and qualitative summary only
 *
 * Physical constants (2018 CODATA):
 *   ε₀ = 8.8541878128 × 10⁻¹² F/m  (permittivity of free space)
 *   μ₀ = 4π × 10⁻⁷ T·m/A           (permeability of free space)
 *   k_e = 1 / (4πε₀) ≈ 8.9875 × 10⁹ N·m²/C²  (Coulomb constant)
 *
 * All solvers accept { value, unit } quantity objects and return SI results.
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

// ─── Physical constants ───────────────────────────────────────────────────

const EPSILON_0 = 8.8541878128e-12   // F/m
const MU_0      = 4 * Math.PI * 1e-7  // T·m/A
const K_E       = 1 / (4 * Math.PI * EPSILON_0)  // N·m²/C²

// ─── Shared helpers ───────────────────────────────────────────────────────

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

// ─── 1. Coulomb's law ────────────────────────────────────────────────────

export const COULOMBS_LAW_METADATA = Object.freeze({
  id: "coulombs-law",
  name: "Coulomb's law — electrostatic force between point charges",
  assumptions: Object.freeze([
    "point charges (dimensionless size)",
    "static (not moving) charges; no magnetic effects",
    "medium is vacuum (or free space); no dielectric",
    "inverse-square law: F = k_e q₁ q₂ / r²",
  ]),
  governingEquations: Object.freeze([
    "F = k_e q₁ q₂ / r²",
    "k_e = 8.9875 × 10⁹ N·m²/C²",
    "Repulsive if q₁ q₂ > 0, attractive if q₁ q₂ < 0",
  ]),
  outputUnits: Object.freeze({ force: "N", electricField: "N/C", potential: "V" }),
  constants: Object.freeze({ k_e: K_E, epsilon_0: EPSILON_0 }),
})

/**
 * Options:
 *   charge1 { value, unit }  — q₁ (C)
 *   charge2 { value, unit }  — q₂ (C)
 *   separation { value, unit } — r (m)
 */
export function solveCoulombsLaw(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const q1 = assertFiniteNumber(readQ(options, "charge1",     "C"), "charge1")
  const q2 = assertFiniteNumber(readQ(options, "charge2",     "C"), "charge2")
  const r  = assertPositive    (readQ(options, "separation",  "m"), "separation")

  const F = K_E * q1 * q2 / (r * r)  // positive = repulsive
  const E1_at_r = K_E * Math.abs(q1) / (r * r)  // field magnitude due to q1 at distance r
  const E2_at_r = K_E * Math.abs(q2) / (r * r)
  const V1_at_r = K_E * q1 / r       // potential due to q1 at distance r
  const V2_at_r = K_E * q2 / r

  return Object.freeze({
    metadata: COULOMBS_LAW_METADATA,
    units: COULOMBS_LAW_METADATA.outputUnits,
    charge1: q1,
    charge2: q2,
    separation: r,
    force: F,
    forceType: F > 0 ? "repulsive" : F < 0 ? "attractive" : "zero",
    electricFieldDueToQ1: E1_at_r,
    electricFieldDueToQ2: E2_at_r,
    potentialDueToQ1: V1_at_r,
    potentialDueToQ2: V2_at_r,
    totalPotential: V1_at_r + V2_at_r,
    potentialEnergy: K_E * q1 * q2 / r,
  })
}

// ─── 2. Electric field and potential (point charge / uniform field) ──────

export const ELECTRIC_FIELD_METADATA = Object.freeze({
  id: "electric-field-point-charge",
  name: "Electric field and potential — point charge and uniform field",
  assumptions: Object.freeze([
    "superposition: fields from multiple point charges add vectorially",
    "vacuum permittivity ε₀",
    "uniform field between parallel plates: E = V/d",
  ]),
  governingEquations: Object.freeze([
    "E = k_e q / r²    (point charge field magnitude)",
    "V = k_e q / r     (point charge potential)",
    "E = V / d         (uniform field between plates)",
    "Work W = q (V₁ − V₂) = q E d",
    "Energy of test charge: U = q V",
  ]),
  outputUnits: Object.freeze({ electricField: "N/C", potential: "V", energy: "J", force: "N" }),
})

/**
 * Options (pick a mode):
 *
 * Point-charge mode:
 *   sourceCharge  { value, unit }  — q (C)
 *   distance      { value, unit }  — r (m)
 *   testCharge    { value, unit }? — q_test (C) for force/energy
 *
 * Parallel-plate mode (uniform field):
 *   voltage     { value, unit }  — V (V)
 *   separation  { value, unit }  — d (m)
 *   testCharge  { value, unit }? — q_test (C)
 */
export function solveElectricField(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  if (options.sourceCharge !== undefined) {
    const q   = assertFiniteNumber(readQ(options, "sourceCharge", "C"), "sourceCharge")
    const r   = assertPositive    (readQ(options, "distance",     "m"), "distance")
    const E   = K_E * q / (r * r)   // signed
    const V   = K_E * q / r

    const result = { metadata: ELECTRIC_FIELD_METADATA, units: ELECTRIC_FIELD_METADATA.outputUnits,
      electricFieldMagnitude: Math.abs(E), electricField: E, potential: V }

    if (options.testCharge !== undefined) {
      const qt = assertFiniteNumber(readQ(options, "testCharge", "C"), "testCharge")
      result.forceOnTestCharge = qt * E
      result.potentialEnergyOfTestCharge = qt * V
      result.testCharge = qt
    }
    return Object.freeze(result)
  }

  if (options.voltage !== undefined && options.separation !== undefined) {
    const Vp = assertFiniteNumber(readQ(options, "voltage",    "V"), "voltage")
    const d  = assertPositive    (readQ(options, "separation", "m"), "separation")
    const E  = Vp / d

    const result = { metadata: ELECTRIC_FIELD_METADATA, units: ELECTRIC_FIELD_METADATA.outputUnits,
      electricField: E, voltage: Vp, separation: d }

    if (options.testCharge !== undefined) {
      const qt = assertFiniteNumber(readQ(options, "testCharge", "C"), "testCharge")
      result.forceOnTestCharge = qt * E
      result.workMovingAcrossPlates = qt * Vp
      result.testCharge = qt
    }
    return Object.freeze(result)
  }

  throw new TypeError("Provide either sourceCharge+distance or voltage+separation")
}

// ─── 3. Capacitor analysis ────────────────────────────────────────────────

export const CAPACITOR_METADATA = Object.freeze({
  id: "capacitor-parallel-plate",
  name: "Capacitor analysis — parallel-plate geometry, energy, charge",
  assumptions: Object.freeze([
    "ideal parallel-plate capacitor with uniform field",
    "no fringe effects",
    "dielectric is linear and uniform",
    "C = ε₀ κ A / d   (κ = dielectric constant, 1 for vacuum)",
  ]),
  governingEquations: Object.freeze([
    "C = ε₀ κ A / d",
    "Q = C V",
    "E_stored = ½ C V² = Q²/(2C) = ½ Q V",
    "Energy density u = ½ ε₀ κ E²",
    "C_series: 1/C_eq = Σ 1/Cᵢ",
    "C_parallel: C_eq = Σ Cᵢ",
  ]),
  outputUnits: Object.freeze({ capacitance: "F", charge: "C", energy: "J", voltage: "V" }),
  constants: Object.freeze({ epsilon_0: EPSILON_0 }),
})

/**
 * Options (at least two of C, Q, V — or geometry):
 *   capacitance      { value, unit }?
 *   charge           { value, unit }?
 *   voltage          { value, unit }?
 *
 * Geometry mode:
 *   area             { value, unit }   — plate area (m²)
 *   separation       { value, unit }   — plate gap (m)
 *   dielectricConstant               — κ (dimensionless, default 1)
 *
 * Network mode:
 *   capacitors       — array of { value, unit }
 *   configuration    — "series" | "parallel"
 */
export function solveCapacitor(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  let C = options.capacitance !== undefined ? assertPositive(readQ(options, "capacitance", "F"), "capacitance") : null

  // Geometry derivation
  if (C === null && options.area !== undefined && options.separation !== undefined) {
    const A   = assertPositive(readQ(options, "area",       "m^2"), "area")
    const d   = assertPositive(readQ(options, "separation", "m"),   "separation")
    const kap = options.dielectricConstant !== undefined
      ? assertPositive(assertFiniteNumber(requireField(options, "dielectricConstant"), "dielectricConstant"), "dielectricConstant")
      : 1
    C = EPSILON_0 * kap * A / d
  }

  // Network
  if (C === null && options.capacitors !== undefined) {
    const config = requireField(options, "configuration")
    if (!["series","parallel"].includes(config)) throw new RangeError("configuration must be series or parallel")
    const vals = options.capacitors.map((cap, i) => {
      if (cap === null || typeof cap !== "object") throw new TypeError(`capacitors[${i}] must be { value, unit }`)
      return assertPositive(convertUnit(requireField(cap,"value"), requireField(cap,"unit"), "F"), `capacitors[${i}]`)
    })
    C = config === "parallel"
      ? vals.reduce((a, b) => a + b, 0)
      : 1 / vals.reduce((s, c) => s + 1 / c, 0)
  }

  let Q = options.charge  !== undefined ? assertNonNegative(readQ(options, "charge",  "C"), "charge")  : null
  let V = options.voltage !== undefined ? assertFiniteNumber(readQ(options, "voltage", "V"), "voltage") : null

  const given = [C, Q, V].filter(x => x !== null).length
  if (given < 2) throw new TypeError("Provide at least two of: capacitance (or geometry/network), charge, voltage")

  if (C !== null && V !== null && Q === null) Q = C * V
  else if (C !== null && Q !== null && V === null) V = Q / C
  else if (Q !== null && V !== null && C === null) C = Q / V

  const energy = 0.5 * C * V * V

  return Object.freeze({
    metadata: CAPACITOR_METADATA,
    units: CAPACITOR_METADATA.outputUnits,
    capacitance: C, charge: Q, voltage: V, energyStored: energy,
  })
}

// ─── 4. Lorentz force (magnetic) ─────────────────────────────────────────

export const LORENTZ_FORCE_METADATA = Object.freeze({
  id: "lorentz-force-magnetic",
  name: "Lorentz force — magnetic force on moving charge and current-carrying wire",
  assumptions: Object.freeze([
    "uniform magnetic field B over the region of interest",
    "non-relativistic particle velocity v ≪ c",
    "straight wire segment of length L",
  ]),
  governingEquations: Object.freeze([
    "F_particle = q v × B   → magnitude: |F| = |q| v B sin θ",
    "F_wire     = I L × B   → magnitude: |F| = I L B sin θ",
    "Radius of circular orbit: r = m v / (|q| B)",
    "Cyclotron frequency: f_c = |q| B / (2π m)",
  ]),
  outputUnits: Object.freeze({ force: "N", radius: "m", cyclotronFrequency: "Hz" }),
})

/**
 * Options (choose particle or wire mode):
 *
 * Particle mode:
 *   charge          { value, unit }  — q (C)
 *   speed           { value, unit }  — v (m/s)
 *   magneticField   { value, unit }  — B (T)
 *   angle           { value, unit }? — θ between v and B (default π/2 = ⊥)
 *   mass            { value, unit }? — for cyclotron radius and frequency
 *
 * Wire mode:
 *   current         { value, unit }  — I (A)
 *   wireLength      { value, unit }  — L (m)
 *   magneticField   { value, unit }  — B (T)
 *   angle           { value, unit }? — θ (default π/2)
 */
export function solveLorentzForce(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const B   = assertNonNegative(readQ(options, "magneticField", "T"), "magneticField")
  const ang = readQOpt(options, "angle", "rad", Math.PI / 2)

  if (options.charge !== undefined && options.speed !== undefined) {
    const q = assertFiniteNumber(readQ(options, "charge", "C"), "charge")
    const v = assertNonNegative(readQ(options, "speed",   "m/s"), "speed")
    const F = Math.abs(q) * v * B * Math.sin(ang)

    const result = { metadata: LORENTZ_FORCE_METADATA, units: LORENTZ_FORCE_METADATA.outputUnits,
      charge: q, speed: v, magneticField: B, force: F }

    if (options.mass !== undefined) {
      const m = assertPositive(readQ(options, "mass", "kg"), "mass")
      if (Math.abs(q) > 0 && v > 0 && B > 0) {
        result.cyclotronRadius    = m * v / (Math.abs(q) * B)
        result.cyclotronFrequency = Math.abs(q) * B / (2 * Math.PI * m)
      }
      result.mass = m
    }
    return Object.freeze(result)
  }

  if (options.current !== undefined && options.wireLength !== undefined) {
    const I = assertFiniteNumber(readQ(options, "current",    "A"), "current")
    const L = assertPositive    (readQ(options, "wireLength", "m"), "wireLength")
    const F = Math.abs(I) * L * B * Math.sin(ang)
    return Object.freeze({ metadata: LORENTZ_FORCE_METADATA, units: LORENTZ_FORCE_METADATA.outputUnits,
      current: I, wireLength: L, magneticField: B, force: F })
  }

  throw new TypeError("Provide either (charge + speed) or (current + wireLength), plus magneticField")
}

// ─── 5. Biot–Savart — simple cases ───────────────────────────────────────

export const BIOT_SAVART_METADATA = Object.freeze({
  id: "biot-savart-simple",
  name: "Biot–Savart — magnetic field of a circular loop and solenoid",
  assumptions: Object.freeze([
    "steady current (magnetostatics)",
    "vacuum permeability μ₀",
    "circular loop: field computed only on the symmetry axis",
    "solenoid: ideal infinite solenoid or finite approximation",
  ]),
  governingEquations: Object.freeze([
    "Circular loop on axis: B = μ₀ I R² / (2 (R² + x²)^(3/2))",
    "Solenoid interior: B = μ₀ n I   (n = turns per metre)",
    "μ₀ = 4π × 10⁻⁷ T·m/A",
  ]),
  outputUnits: Object.freeze({ magneticField: "T" }),
  constants: Object.freeze({ mu_0: MU_0 }),
})

/**
 * Options (choose a geometry):
 *
 * Circular loop:
 *   geometry      — "loop"
 *   current       { value, unit }  — I (A)
 *   radius        { value, unit }  — R (m)
 *   axialDistance { value, unit }  — x (m), distance along axis from centre
 *
 * Solenoid:
 *   geometry      — "solenoid"
 *   current       { value, unit }  — I (A)
 *   turnsPerMetre               — n (turns/m, dimensionless integer or float)
 *                                  OR provide turns { value (integer) } and length { value, unit }
 */
export function solveBiotSavart(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const geometry = requireField(options, "geometry")
  const I = assertFiniteNumber(readQ(options, "current", "A"), "current")

  if (geometry === "loop") {
    const R = assertPositive(readQ(options, "radius",        "m"), "radius")
    const x = assertFiniteNumber(readQ(options, "axialDistance", "m"), "axialDistance")
    const denom = Math.pow(R * R + x * x, 1.5)
    const B = (MU_0 * I * R * R) / (2 * denom)
    return Object.freeze({ metadata: BIOT_SAVART_METADATA, units: BIOT_SAVART_METADATA.outputUnits,
      geometry, current: I, radius: R, axialDistance: x, magneticField: B })
  }

  if (geometry === "solenoid") {
    let n
    if (options.turnsPerMetre !== undefined) {
      n = assertPositive(assertFiniteNumber(requireField(options, "turnsPerMetre"), "turnsPerMetre"), "turnsPerMetre")
    } else {
      const N = assertPositive(assertFiniteNumber(requireField(options, "turns"), "turns"), "turns")
      const L = assertPositive(readQ(options, "length", "m"), "length")
      n = N / L
    }
    const B = MU_0 * n * I
    return Object.freeze({ metadata: BIOT_SAVART_METADATA, units: BIOT_SAVART_METADATA.outputUnits,
      geometry, current: I, turnsPerMetre: n, magneticField: B })
  }

  throw new RangeError("geometry must be 'loop' or 'solenoid'")
}

// ─── 6. Faraday's law — electromagnetic induction ────────────────────────

export const FARADAY_LAW_METADATA = Object.freeze({
  id: "faraday-law-induction",
  name: "Faraday's law — electromagnetic induction and motional EMF",
  assumptions: Object.freeze([
    "EMF = −dΦ_B/dt  (Faraday's law of induction)",
    "For uniform B changing with time: ΔΦ = B A cos θ − B₀ A cos θ",
    "Motional EMF: ε = B L v (conductor moving at speed v in field B)",
    "Lenz's law: induced current opposes the change in flux",
  ]),
  governingEquations: Object.freeze([
    "Φ_B = B A cos θ   (magnetic flux)",
    "ε = −ΔΦ_B / Δt   (average induced EMF)",
    "ε = B L v         (motional EMF, conductor ⊥ to B)",
    "ε = −L dI/dt      (inductor back-EMF, L = self-inductance)",
  ]),
  outputUnits: Object.freeze({ emf: "V", flux: "Wb", inductance: "H" }),
})

/**
 * Options (choose a mode):
 *
 * Flux change mode:
 *   magneticField      { value, unit }  — B (T)
 *   area               { value, unit }  — A (m²)
 *   angle              { value, unit }? — θ between B and area normal (default 0)
 *   initialField       { value, unit }? — B₀ for ΔΦ = (B − B₀) A
 *   timePeriod         { value, unit }  — Δt (s) over which flux changes
 *
 * Motional EMF mode:
 *   motionalEmf        — set true
 *   magneticField      { value, unit }
 *   conductorLength    { value, unit }  — L (m)
 *   speed              { value, unit }  — v (m/s)
 *
 * Inductor back-EMF mode:
 *   inductance         { value, unit }  — L (H)
 *   currentChangeRate  { value, unit }  — dI/dt (A/s)
 */
export function solveFaradayLaw(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  if (options.motionalEmf) {
    const B = assertNonNegative(readQ(options, "magneticField",   "T"),   "magneticField")
    const L = assertPositive   (readQ(options, "conductorLength", "m"),   "conductorLength")
    const v = assertNonNegative(readQ(options, "speed",           "m/s"), "speed")
    const emf = B * L * v
    return Object.freeze({ metadata: FARADAY_LAW_METADATA, units: FARADAY_LAW_METADATA.outputUnits,
      mode: "motional", magneticField: B, conductorLength: L, speed: v, emf })
  }

  if (options.inductance !== undefined && options.currentChangeRate !== undefined) {
    const L  = assertPositive(readQ(options, "inductance",        "H"),   "inductance")
    const dI = assertFiniteNumber(readQ(options, "currentChangeRate", "A/s"), "currentChangeRate")
    const emf = -L * dI   // back-EMF
    return Object.freeze({ metadata: FARADAY_LAW_METADATA, units: FARADAY_LAW_METADATA.outputUnits,
      mode: "inductor", inductance: L, currentChangeRate: dI, emf })
  }

  // Flux-change mode
  const B  = assertNonNegative(readQ(options, "magneticField", "T"),   "magneticField")
  const A  = assertPositive   (readQ(options, "area",          "m^2"), "area")
  const th = readQOpt(options, "angle", "rad", 0)
  const B0 = options.initialField !== undefined ? assertNonNegative(readQ(options, "initialField", "T"), "initialField") : 0
  const dt = assertPositive(readQ(options, "timePeriod", "s"), "timePeriod")

  const flux_before = B0 * A * Math.cos(th)
  const flux_after  = B  * A * Math.cos(th)
  const deltaFlux   = flux_after - flux_before
  const emf         = -deltaFlux / dt

  return Object.freeze({ metadata: FARADAY_LAW_METADATA, units: FARADAY_LAW_METADATA.outputUnits,
    mode: "flux-change", magneticField: B, area: A, fluxBefore: flux_before, fluxAfter: flux_after,
    deltaFlux, timePeriod: dt, emf })
}

// ─── 7. RL circuit transient ──────────────────────────────────────────────

export const RL_CIRCUIT_METADATA = Object.freeze({
  id: "rl-circuit-transient",
  name: "RL circuit — current growth and decay transient",
  assumptions: Object.freeze([
    "series RL circuit with ideal components",
    "ideal DC voltage source",
    "switch closes at t = 0",
    "no capacitance",
  ]),
  governingEquations: Object.freeze([
    "L dI/dt + R I = V_s",
    "Growth: I(t) = (V_s/R)(1 − e^(−t/τ)),  τ = L/R",
    "Decay:  I(t) = I₀ e^(−t/τ)",
    "τ = L / R",
  ]),
  outputUnits: Object.freeze({ time: "s", current: "A", voltage: "V", energy: "J", timeConstant: "s" }),
})

/**
 * Options:
 *   resistance    { value, unit }
 *   inductance    { value, unit }
 *   sourceVoltage { value, unit }   — V_s after switch closes
 *   initialCurrent { value, unit }? — I(0), default 0 (growth) or a positive value (decay)
 *   duration      { value, unit }
 *   sampleCount                    — default 200
 */
export function solveRLCircuit(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const R  = assertPositive    (readQ(options, "resistance",    "Ω"),   "resistance")
  const L  = assertPositive    (readQ(options, "inductance",    "H"),   "inductance")
  const Vs = assertFiniteNumber(readQ(options, "sourceVoltage", "V"),   "sourceVoltage")
  const I0 = assertFiniteNumber(readQOpt(options, "initialCurrent", "A", 0), "initialCurrent")
  const dur = assertPositive   (readQ(options, "duration",      "s"),   "duration")
  const sampleCount = Number.isSafeInteger(options.sampleCount) && options.sampleCount >= 2 ? options.sampleCount : 200

  const tau = L / R
  const I_ss = Vs / R  // steady-state current

  const samples = Array.from({ length: sampleCount }, (_, i) => {
    const t  = dur * i / (sampleCount - 1)
    const It = I_ss + (I0 - I_ss) * Math.exp(-t / tau)
    const Vl = L * (I_ss - I0) * Math.exp(-t / tau) / tau  // = L dI/dt
    const Vr = It * R
    const energy = 0.5 * L * It * It
    return Object.freeze({ time: t, current: It, inductorVoltage: Vl, resistorVoltage: Vr, energyInductor: energy })
  })

  return Object.freeze({
    metadata: RL_CIRCUIT_METADATA, units: RL_CIRCUIT_METADATA.outputUnits,
    resistance: R, inductance: L, sourceVoltage: Vs, initialCurrent: I0,
    timeConstant: tau, steadyStateCurrent: I_ss,
    samples: Object.freeze(samples),
  })
}

// ─── 8. RLC series circuit ────────────────────────────────────────────────

export const RLC_CIRCUIT_METADATA = Object.freeze({
  id: "rlc-series-circuit",
  name: "RLC series circuit — free and driven oscillation",
  assumptions: Object.freeze([
    "series RLC circuit, ideal components",
    "initial conditions: V_C(0) and I(0) specified",
    "free oscillation only (no driving source) — for driven response use a separate AC analysis",
    "damping regimes: underdamped (R < 2√(L/C)), critically damped, overdamped",
  ]),
  governingEquations: Object.freeze([
    "L d²q/dt² + R dq/dt + q/C = 0",
    "ω₀ = 1/√(LC)   (natural frequency)",
    "α  = R/(2L)     (damping coefficient)",
    "ω_d = √(ω₀² − α²)  (damped natural frequency, underdamped)",
    "Q_factor = ω₀ L / R = 1/(R √(C/L))",
  ]),
  outputUnits: Object.freeze({ time: "s", charge: "C", current: "A", voltage: "V",
    frequency: "Hz", energy: "J" }),
})

/**
 * Options:
 *   resistance    { value, unit }
 *   inductance    { value, unit }
 *   capacitance   { value, unit }
 *   initialCharge { value, unit }?   — q(0) on capacitor (C), default 0
 *   initialCurrent { value, unit }?  — I(0) = dq/dt at t=0 (A), default 0
 *   duration      { value, unit }
 *   sampleCount                      — default 400
 */
export function solveRLCCircuit(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const R  = assertPositive    (readQ(options, "resistance",    "Ω"),  "resistance")
  const L  = assertPositive    (readQ(options, "inductance",    "H"),  "inductance")
  const C  = assertPositive    (readQ(options, "capacitance",   "F"),  "capacitance")
  const q0 = assertFiniteNumber(readQOpt(options, "initialCharge",   "C", 0), "initialCharge")
  const I0 = assertFiniteNumber(readQOpt(options, "initialCurrent",  "A", 0), "initialCurrent")
  const dur = assertPositive   (readQ(options, "duration", "s"), "duration")
  const sampleCount = Number.isSafeInteger(options.sampleCount) && options.sampleCount >= 2 ? options.sampleCount : 400

  const omega0  = 1 / Math.sqrt(L * C)
  const alpha   = R / (2 * L)
  const Qfactor = omega0 * L / R
  const timeStep = dur / (sampleCount - 1)

  // ODE: L q'' + R q' + q/C = 0
  // State: [q, I = dq/dt]
  const derivative = (_t, [q, I]) => {
    const d2q = -(R / L) * I - q / (L * C)
    return [I, d2q]
  }

  const raw = integrateRK4({ derivative, initialState: [q0, I0], startTime: 0, timeStep, steps: sampleCount - 1 })

  const samples = Object.freeze(raw.map(({ time, state: [q, I] }) => {
    const Vc = q / C
    const Vl = L !== 0 ? -R * I - q / (L * C) * L : 0
    const Vr = I * R
    const energy = 0.5 * L * I * I + 0.5 * q * q / C
    return Object.freeze({ time, charge: q, current: I, capacitorVoltage: Vc, resistorVoltage: Vr, totalEnergy: energy })
  }))

  const regime = alpha < omega0 ? "underdamped" : alpha > omega0 ? "overdamped" : "critically_damped"
  const dampedFreq = regime === "underdamped" ? Math.sqrt(omega0 * omega0 - alpha * alpha) : null

  return Object.freeze({
    metadata: RLC_CIRCUIT_METADATA, units: RLC_CIRCUIT_METADATA.outputUnits,
    resistance: R, inductance: L, capacitance: C,
    naturalFrequency: omega0 / (2 * Math.PI),
    naturalAngularFrequency: omega0,
    dampingCoefficient: alpha,
    dampedFrequency: dampedFreq ? dampedFreq / (2 * Math.PI) : null,
    qFactor: Qfactor,
    regime,
    samples,
  })
}

// ─── 9. Maxwell's equations — metadata and summary ────────────────────────

export const MAXWELL_EQUATIONS_METADATA = Object.freeze({
  id: "maxwell-equations-summary",
  name: "Maxwell's equations — integral and differential form summary",
  note: "This module provides metadata and symbolic descriptions only. Numerical solutions of Maxwell's equations require full-field PDE solvers (FDTD, FEM) that are outside this catalog.",
  equations: Object.freeze({
    gaussLawElectric:  { name: "Gauss's law (electric)",  integral: "∮ E·dA = Q_enc / ε₀",   differential: "∇·E = ρ/ε₀" },
    gaussLawMagnetic:  { name: "Gauss's law (magnetic)",  integral: "∮ B·dA = 0",             differential: "∇·B = 0" },
    faradayLaw:        { name: "Faraday's law",           integral: "∮ E·dl = −dΦ_B/dt",      differential: "∇×E = −∂B/∂t" },
    ampereMaxwellLaw:  { name: "Ampère–Maxwell law",      integral: "∮ B·dl = μ₀(I + ε₀ dΦ_E/dt)", differential: "∇×B = μ₀J + μ₀ε₀ ∂E/∂t" },
  }),
  constants: Object.freeze({ epsilon_0: EPSILON_0, mu_0: MU_0, speedOfLight: 1 / Math.sqrt(EPSILON_0 * MU_0) }),
  speedOfLight_ms: 1 / Math.sqrt(EPSILON_0 * MU_0),
})

/** Returns the Maxwell equations metadata. No numerical computation. */
export function getMaxwellEquations() {
  return MAXWELL_EQUATIONS_METADATA
}
