/**
 * Modern physics — covering:
 *
 *  1. Special relativity — time dilation, length contraction,
 *     relativistic momentum, kinetic and rest energy, mass-energy equivalence
 *  2. Photoelectric effect — Einstein's photon model
 *  3. de Broglie wavelength — wave-particle duality
 *  4. Bohr hydrogen atom — energy levels, spectral lines, orbital radii
 *  5. Radioactive decay — activity, half-life, decay constant, decay chain (1-level)
 *  6. Compton scattering — wavelength shift of X-rays scattered off electrons
 *
 * Physical constants (2018 CODATA):
 *   c  = 2.99792458 × 10⁸ m/s  (speed of light in vacuum)
 *   h  = 6.62607015 × 10⁻³⁴ J·s  (Planck constant)
 *   ħ  = h / 2π  (reduced Planck constant)
 *   e  = 1.602176634 × 10⁻¹⁹ C  (elementary charge)
 *   m_e = 9.1093837015 × 10⁻³¹ kg  (electron rest mass)
 *   m_p = 1.67262192369 × 10⁻²⁷ kg  (proton rest mass)
 *   k_B = 1.380649 × 10⁻²³ J/K  (Boltzmann constant)
 *   a₀  = 5.29177210903 × 10⁻¹¹ m  (Bohr radius)
 *   R_∞ = 1.0973731568539 × 10⁷ m⁻¹  (Rydberg constant)
 *
 * All solvers accept { value, unit } quantity objects and return SI results.
 * Energies are reported in both joules (J) and electron-volts (eV).
 *
 * Scope:
 *   - Special relativity: kinematics and energy-momentum only (no GR, no curvature)
 *   - Quantum mechanics: single-particle, closed-form models only
 *     (no wave-function integration, no perturbation theory, no many-body)
 *   - Nuclear physics: decay only; no fission, fusion, or reaction cross-sections
 */

import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  assertInRange,
  requireField,
} from "../validation.js"

// ─── Physical constants ───────────────────────────────────────────────────

const C        = 2.99792458e8        // m/s  (exact by SI 2019 definition)
const H        = 6.62607015e-34      // J·s
const HBAR     = H / (2 * Math.PI)
const E_CHARGE = 1.602176634e-19     // C
const M_E      = 9.1093837015e-31    // kg
const M_P      = 1.67262192369e-27   // kg
const K_B      = 1.380649e-23        // J/K
const A0       = 5.29177210903e-11   // m (Bohr radius)
const R_INF    = 1.0973731568539e7   // m⁻¹ (Rydberg)
const E_H      = -13.6057039763      // eV — hydrogen ground state energy
const C2       = C * C

export const PHYSICAL_CONSTANTS = Object.freeze({
  speedOfLight: C, planckConstant: H, reducedPlanck: HBAR,
  elementaryCharge: E_CHARGE, electronMass: M_E, protonMass: M_P,
  boltzmann: K_B, bohrRadius: A0, rydbergConstant: R_INF,
  hydrogenGroundStateEV: E_H,
})

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

const jouleToEV = (J) => J / E_CHARGE

// ─── 1. Special relativity ────────────────────────────────────────────────

export const SPECIAL_RELATIVITY_METADATA = Object.freeze({
  id: "special-relativity-kinematics-energy",
  name: "Special relativity — time dilation, length contraction, relativistic energy",
  assumptions: Object.freeze([
    "inertial reference frames (special relativity, not general)",
    "particle moves at constant velocity v relative to the lab frame",
    "v < c is strictly enforced — no superluminal inputs",
    "energy-momentum relation: E² = (pc)² + (m₀c²)²",
  ]),
  governingEquations: Object.freeze([
    "γ = 1 / √(1 − β²),   β = v/c",
    "Time dilation:   Δt = γ Δt₀   (proper time Δt₀ in moving frame)",
    "Length contraction: L = L₀ / γ   (proper length L₀)",
    "Relativistic momentum: p = γ m₀ v",
    "Total energy: E = γ m₀ c²",
    "Kinetic energy: KE = (γ − 1) m₀ c²",
    "Rest energy: E₀ = m₀ c²",
    "E² = (pc)² + (m₀c²)²",
  ]),
  outputUnits: Object.freeze({ energy: "J", energyEV: "eV", momentum: "kg*m/s", time: "s", length: "m" }),
  constants: Object.freeze({ c: C }),
})

/**
 * Options:
 *   restMass  { value, unit }   — m₀ (kg)
 *   velocity  { value, unit }   — v (m/s),  |v| < c
 *
 * Optional:
 *   properTime   { value, unit }  — Δt₀ (s) for time dilation
 *   properLength { value, unit }  — L₀ (m) for length contraction
 */
export function solveSpecialRelativity(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const m0 = assertPositive(readQ(options, "restMass", "kg"), "restMass")
  const v  = assertFiniteNumber(readQ(options, "velocity", "m/s"), "velocity")

  const beta = v / C
  if (Math.abs(beta) >= 1) throw new RangeError("velocity must be less than the speed of light c")

  const gamma = 1 / Math.sqrt(1 - beta * beta)
  const p     = gamma * m0 * v
  const E_total = gamma * m0 * C2
  const E_rest  = m0 * C2
  const KE      = (gamma - 1) * m0 * C2

  const result = {
    metadata: SPECIAL_RELATIVITY_METADATA, units: SPECIAL_RELATIVITY_METADATA.outputUnits,
    restMass: m0, velocity: v,
    beta, lorentzFactor: gamma,
    relativisticMomentum: p,
    restEnergy: E_rest, restEnergyEV: jouleToEV(E_rest),
    totalEnergy: E_total, totalEnergyEV: jouleToEV(E_total),
    kineticEnergy: KE, kineticEnergyEV: jouleToEV(KE),
  }

  if (options.properTime !== undefined) {
    const dt0 = assertPositive(readQ(options, "properTime", "s"), "properTime")
    result.properTime     = dt0
    result.dilatedTime    = gamma * dt0
  }

  if (options.properLength !== undefined) {
    const L0 = assertPositive(readQ(options, "properLength", "m"), "properLength")
    result.properLength       = L0
    result.contractedLength   = L0 / gamma
  }

  return Object.freeze(result)
}

// ─── 2. Photoelectric effect ──────────────────────────────────────────────

export const PHOTOELECTRIC_METADATA = Object.freeze({
  id: "photoelectric-effect",
  name: "Photoelectric effect — Einstein's photon model",
  assumptions: Object.freeze([
    "photon model of light: E_photon = h f = h c / λ",
    "each photon interacts with at most one electron",
    "work function Φ is the minimum energy required to eject an electron from the surface",
    "no relativistic corrections to electron kinetic energy",
  ]),
  governingEquations: Object.freeze([
    "E_photon = h f = h c / λ",
    "KE_max = E_photon − Φ  (Einstein's photoelectric equation)",
    "Threshold frequency: f₀ = Φ / h",
    "Stopping potential: V_stop = KE_max / e",
  ]),
  outputUnits: Object.freeze({ energy: "J", energyEV: "eV", frequency: "Hz", wavelength: "m", potential: "V" }),
  constants: Object.freeze({ h: H, c: C, e: E_CHARGE }),
})

/**
 * Options:
 *   workFunction  { value, unit }   — Φ (J or eV)
 *
 * Provide one of:
 *   frequency     { value, unit }   — f (Hz)
 *   wavelength    { value, unit }   — λ (m)
 */
export function solvePhotoelectricEffect(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const phi_J = options.workFunction !== undefined
    ? (() => {
        const q = requireField(options, "workFunction")
        if (q === null || typeof q !== "object") throw new TypeError("workFunction must be { value, unit }")
        const v = requireField(q, "value")
        const u = requireField(q, "unit")
        assertFiniteNumber(v, "workFunction.value")
        // Accept J or eV
        if (u === "eV") return assertPositive(v * E_CHARGE, "workFunction")
        return assertPositive(convertUnit(v, u, "J"), "workFunction")
      })()
    : null

  if (phi_J === null) throw new TypeError("workFunction is required")

  let f, lambda
  if (options.frequency !== undefined) {
    f      = assertPositive(readQ(options, "frequency", "Hz"), "frequency")
    lambda = C / f
  } else if (options.wavelength !== undefined) {
    lambda = assertPositive(readQ(options, "wavelength", "m"), "wavelength")
    f      = C / lambda
  } else {
    throw new TypeError("Provide one of: frequency or wavelength")
  }

  const E_photon = H * f
  const KE_max   = E_photon - phi_J
  const f0       = phi_J / H  // threshold frequency
  const V_stop   = KE_max > 0 ? KE_max / E_CHARGE : null

  return Object.freeze({
    metadata: PHOTOELECTRIC_METADATA, units: PHOTOELECTRIC_METADATA.outputUnits,
    workFunction: phi_J, workFunctionEV: jouleToEV(phi_J),
    frequency: f, wavelength: lambda,
    photonEnergy: E_photon, photonEnergyEV: jouleToEV(E_photon),
    maxKineticEnergy: Math.max(KE_max, 0),
    maxKineticEnergyEV: Math.max(jouleToEV(KE_max), 0),
    thresholdFrequency: f0,
    thresholdWavelength: C / f0,
    stoppingPotential: V_stop,
    ejectionOccurs: KE_max > 0,
    note: KE_max <= 0 ? "Photon energy is below the work function — no electron ejection occurs." : null,
  })
}

// ─── 3. de Broglie wavelength ─────────────────────────────────────────────

export const DE_BROGLIE_METADATA = Object.freeze({
  id: "de-broglie-wavelength",
  name: "de Broglie wavelength — wave-particle duality",
  assumptions: Object.freeze([
    "non-relativistic particle (v ≪ c) unless relativisticMomentum is explicitly provided",
    "λ = h / p",
  ]),
  governingEquations: Object.freeze([
    "λ = h / p = h / (m v)   (non-relativistic)",
    "λ = h / (γ m₀ v)         (relativistic)",
    "For particle accelerated through voltage V: λ = h / √(2 m e V)",
  ]),
  outputUnits: Object.freeze({ wavelength: "m", momentum: "kg*m/s" }),
  constants: Object.freeze({ h: H }),
})

/**
 * Options (choose a mode):
 *
 * Mode 1 — mass + velocity:
 *   mass     { value, unit }
 *   velocity { value, unit }
 *   relativistic — boolean (default false); if true uses γ m v
 *
 * Mode 2 — momentum:
 *   momentum { value, unit }
 *
 * Mode 3 — accelerating voltage (electron by default):
 *   acceleratingVoltage { value, unit }   — V (V)
 *   particleMass        { value, unit }?  — defaults to electron mass
 *   particleCharge      { value, unit }?  — defaults to elementary charge
 */
export function solveDeBroglie(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  let p

  if (options.momentum !== undefined) {
    p = assertPositive(readQ(options, "momentum", "kg*m/s"), "momentum")
  } else if (options.acceleratingVoltage !== undefined) {
    const V   = assertPositive(readQ(options, "acceleratingVoltage", "V"), "acceleratingVoltage")
    const m   = readQOpt(options, "particleMass",   "kg", M_E)
    const q   = readQOpt(options, "particleCharge", "C",  E_CHARGE)
    p = Math.sqrt(2 * assertPositive(m,"particleMass") * Math.abs(q) * V)
  } else if (options.mass !== undefined && options.velocity !== undefined) {
    const m  = assertPositive(readQ(options, "mass",     "kg"),  "mass")
    const v  = assertNonNegative(readQ(options, "velocity", "m/s"), "velocity")
    const relativistic = options.relativistic === true
    if (relativistic) {
      const beta = v / C
      if (beta >= 1) throw new RangeError("velocity must be less than c")
      const gamma = 1 / Math.sqrt(1 - beta * beta)
      p = gamma * m * v
    } else {
      p = m * v
    }
  } else {
    throw new TypeError("Provide momentum, or mass+velocity, or acceleratingVoltage")
  }

  if (p === 0) throw new RangeError("momentum is zero — de Broglie wavelength is undefined")
  const lambda = H / p

  return Object.freeze({
    metadata: DE_BROGLIE_METADATA, units: DE_BROGLIE_METADATA.outputUnits,
    momentum: p, wavelength: lambda,
  })
}

// ─── 4. Bohr hydrogen atom ────────────────────────────────────────────────

export const BOHR_ATOM_METADATA = Object.freeze({
  id: "bohr-hydrogen-atom",
  name: "Bohr hydrogen atom — energy levels, orbital radii, spectral lines",
  assumptions: Object.freeze([
    "hydrogen-like atom with a single electron (Z = 1 for hydrogen, or specify Z)",
    "electrons occupy discrete circular orbits at quantized radii",
    "Bohr model: angular momentum L = n ħ",
    "model is exact for hydrogen-like ions (He⁺, Li²⁺, ...); approximate for multi-electron atoms",
    "no spin, no fine structure, no quantum defect",
  ]),
  governingEquations: Object.freeze([
    "E_n = −13.6 Z² / n²  eV",
    "r_n = a₀ n² / Z",
    "Transition wavelength: 1/λ = R_∞ Z² (1/n_f² − 1/n_i²)",
    "Series: Lyman (n_f=1), Balmer (n_f=2), Paschen (n_f=3)",
  ]),
  outputUnits: Object.freeze({ energy: "J", energyEV: "eV", radius: "m", wavelength: "m", frequency: "Hz" }),
  constants: Object.freeze({ bohrRadius: A0, rydbergEV: 13.6057039763, rydberg_m: R_INF }),
})

/**
 * Options:
 *   principalQuantumNumber  — n (positive integer, 1–∞)
 *   atomicNumber           — Z (positive integer, default 1 for hydrogen)
 *
 * Optional transition:
 *   finalQuantumNumber     — n_f for emission (n_f < n) or absorption (n_f > n)
 */
export function solveBohrAtom(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const n = requireField(options, "principalQuantumNumber")
  if (!Number.isInteger(n) || n < 1) throw new RangeError("principalQuantumNumber must be a positive integer")
  const Z = options.atomicNumber !== undefined
    ? (() => { const z = requireField(options,"atomicNumber"); if(!Number.isInteger(z)||z<1) throw new RangeError("atomicNumber must be a positive integer"); return z })()
    : 1

  const E_eV = E_H * Z * Z / (n * n)  // negative (bound state)
  const E_J  = E_eV * E_CHARGE
  const r_n  = A0 * n * n / Z

  const v_n  = (E_CHARGE * E_CHARGE) / (2 * HBAR * 4 * Math.PI * 8.8541878128e-12) / n  // orbital speed (SI)
  const result = {
    metadata: BOHR_ATOM_METADATA, units: BOHR_ATOM_METADATA.outputUnits,
    principalQuantumNumber: n, atomicNumber: Z,
    energyEV: E_eV, energy: E_J,
    orbitalRadius: r_n,
    orbitalSpeed: v_n,
  }

  if (options.finalQuantumNumber !== undefined) {
    const nf = requireField(options, "finalQuantumNumber")
    if (!Number.isInteger(nf) || nf < 1) throw new RangeError("finalQuantumNumber must be a positive integer")
    if (nf === n) throw new RangeError("finalQuantumNumber must differ from principalQuantumNumber")

    const E_f_eV = E_H * Z * Z / (nf * nf)
    const dE_eV  = E_f_eV - E_eV  // >0 = emission, <0 = absorption

    const wavenumber = R_INF * Z * Z * (1 / (nf * nf) - 1 / (n * n))
    const lambda = 1 / Math.abs(wavenumber)
    const freq   = C * Math.abs(wavenumber)

    const series = nf === 1 ? "Lyman (UV)" : nf === 2 ? "Balmer (visible/UV)" : nf === 3 ? "Paschen (IR)" : `series n_f=${nf}`

    result.transition = Object.freeze({
      initialQuantumNumber: n, finalQuantumNumber: nf,
      energyChangedEV: dE_eV, type: dE_eV < 0 ? "emission" : "absorption",
      wavelength: lambda, frequency: freq, series,
    })
  }

  return Object.freeze(result)
}

// ─── 5. Radioactive decay ─────────────────────────────────────────────────

export const RADIOACTIVE_DECAY_METADATA = Object.freeze({
  id: "radioactive-decay",
  name: "Radioactive decay — activity, half-life, decay constant",
  assumptions: Object.freeze([
    "first-order exponential decay: N(t) = N₀ e^(−λ t)",
    "λ (decay constant) is constant — no branching ratio correction",
    "discrete nuclei modeled as continuous for large N₀",
  ]),
  governingEquations: Object.freeze([
    "N(t) = N₀ e^(−λ t)",
    "A(t) = λ N(t)  (activity in Bq = decays/second)",
    "t_{1/2} = ln 2 / λ",
    "Mean lifetime: τ = 1 / λ",
    "Mass remaining: m(t) = m₀ e^(−λ t)",
  ]),
  outputUnits: Object.freeze({ time: "s", activity: "Bq", nuclei: "count", mass: "kg", halfLife: "s" }),
})

/**
 * Options:
 *   halfLife       { value, unit }   — t_{1/2} (time unit)
 *   initialNuclei                   — N₀ (count)  OR
 *   initialActivity { value, unit }  — A₀ (Bq)  OR
 *   initialMass     { value, unit }  — m₀ (kg) (provide molarMass too)
 *
 *   duration       { value, unit }   — total time to simulate
 *   sampleCount                      — integer ≥ 2, default 200
 *
 * Optional:
 *   molarMass      { value, unit }   — M (g/mol) for mass ↔ nuclei conversion
 */
export function solveRadioactiveDecay(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const t12     = assertPositive(readQ(options, "halfLife", "s"), "halfLife")
  const lambda  = Math.LN2 / t12
  const tau     = 1 / lambda
  const dur     = assertPositive(readQ(options, "duration", "s"), "duration")
  const sampleCount = Number.isSafeInteger(options.sampleCount) && options.sampleCount >= 2 ? options.sampleCount : 200

  const N_AVOGADRO = 6.02214076e23

  let N0 = null, A0 = null, m0 = null
  if (options.initialNuclei !== undefined) {
    N0 = assertPositive(assertFiniteNumber(requireField(options,"initialNuclei"),"initialNuclei"), "initialNuclei")
    A0 = lambda * N0
  } else if (options.initialActivity !== undefined) {
    A0 = assertPositive(readQ(options, "initialActivity", "Bq"), "initialActivity")
    N0 = A0 / lambda
  } else if (options.initialMass !== undefined) {
    m0 = assertPositive(readQ(options, "initialMass", "kg"), "initialMass")
    if (options.molarMass === undefined) throw new TypeError("molarMass is required when initialMass is provided")
    const M = assertPositive(readQ(options, "molarMass", "g/mol"), "molarMass")
    N0 = (m0 * N_AVOGADRO) / (M * 1e-3)  // M in g/mol → kg/mol
    A0 = lambda * N0
  } else {
    throw new TypeError("Provide one of: initialNuclei, initialActivity, or initialMass (+molarMass)")
  }

  const samples = Array.from({ length: sampleCount }, (_, i) => {
    const t  = dur * i / (sampleCount - 1)
    const Nt = N0 * Math.exp(-lambda * t)
    const At = lambda * Nt
    return Object.freeze({ time: t, nuclei: Nt, activity: At })
  })

  return Object.freeze({
    metadata: RADIOACTIVE_DECAY_METADATA, units: RADIOACTIVE_DECAY_METADATA.outputUnits,
    halfLife: t12, decayConstant: lambda, meanLifetime: tau,
    initialNuclei: N0, initialActivity: A0,
    samples: Object.freeze(samples),
    nucleiAtEnd: samples[samples.length - 1].nuclei,
    activityAtEnd: samples[samples.length - 1].activity,
  })
}

// ─── 6. Compton scattering ────────────────────────────────────────────────

export const COMPTON_SCATTERING_METADATA = Object.freeze({
  id: "compton-scattering",
  name: "Compton scattering — wavelength shift of X-rays scattered off electrons",
  assumptions: Object.freeze([
    "target electron is initially at rest (rest-frame Compton formula)",
    "electron is treated as a free electron (no binding energy correction)",
    "relativistic energy-momentum conservation applied to photon + electron system",
  ]),
  governingEquations: Object.freeze([
    "Δλ = (h / m_e c)(1 − cos θ)",
    "Compton wavelength: λ_c = h / (m_e c) = 2.426 × 10⁻¹² m",
    "λ' = λ + Δλ",
    "Electron recoil KE: KE_e = E_photon_initial − E_photon_final",
  ]),
  outputUnits: Object.freeze({ wavelength: "m", energy: "J", energyEV: "eV", angle: "rad" }),
  comptonWavelength: H / (M_E * C),
  constants: Object.freeze({ h: H, m_e: M_E, c: C }),
})

/**
 * Options:
 *   incidentWavelength  { value, unit }  — λ (m) of incoming photon
 *   scatteringAngle     { value, unit }  — θ (angle unit, 0–π)
 */
export function solveComptonScattering(options) {
  if (options === null || typeof options !== "object") throw new TypeError("options is required")

  const lambda  = assertPositive(readQ(options, "incidentWavelength", "m"), "incidentWavelength")
  const theta   = assertInRange(readQ(options, "scatteringAngle", "rad"), 0, Math.PI, "scatteringAngle")

  const lambdaC = H / (M_E * C)   // Compton wavelength ≈ 2.426 pm
  const deltaLambda = lambdaC * (1 - Math.cos(theta))
  const lambdaP     = lambda + deltaLambda

  const E_initial  = H * C / lambda    // J
  const E_final    = H * C / lambdaP   // J
  const KE_electron = E_initial - E_final

  return Object.freeze({
    metadata: COMPTON_SCATTERING_METADATA, units: COMPTON_SCATTERING_METADATA.outputUnits,
    incidentWavelength: lambda, scatteringAngle: theta,
    wavelengthShift: deltaLambda,
    scatteredWavelength: lambdaP,
    comptonWavelength: lambdaC,
    incidentPhotonEnergy: E_initial, incidentPhotonEnergyEV: jouleToEV(E_initial),
    scatteredPhotonEnergy: E_final, scatteredPhotonEnergyEV: jouleToEV(E_final),
    electronRecoilKE: KE_electron, electronRecoilKE_EV: jouleToEV(KE_electron),
  })
}
