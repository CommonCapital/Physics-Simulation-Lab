/**
 * DC circuit analysis: Ohm's law, series and parallel resistor networks,
 * and RC circuit transient response.
 *
 * Ohm's law:    V = I R
 *
 * Series resistors:   R_total = R₁ + R₂ + … + Rₙ
 * Parallel resistors: 1/R_total = 1/R₁ + 1/R₂ + … + 1/Rₙ
 *
 * Power dissipated:   P = V I = I² R = V² / R
 *
 * RC circuit — charging (capacitor initially uncharged, source V_s):
 *   V_C(t) = V_s (1 − e^(−t/τ))        τ = RC
 *   I(t)   = (V_s / R) e^(−t/τ)
 *
 * RC circuit — discharging (capacitor initially charged to V₀):
 *   V_C(t) = V₀ e^(−t/τ)
 *   I(t)   = −(V₀ / R) e^(−t/τ)
 *
 * These are exact closed-form solutions to the first-order linear ODE:
 *   C dV_C/dt + V_C/R = V_s/R
 *
 * This module covers DC circuits only. No AC, no inductors, no mutual
 * inductance, no nonlinear components, no dependent sources.
 */

import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  requireField,
} from "../validation.js"

export const OHM_LAW_METADATA = Object.freeze({
  id: "ohms-law-dc-circuit",
  name: "Ohm's law and DC resistor network analysis",
  assumptions: Object.freeze([
    "linear, time-invariant resistors",
    "DC (direct current) — voltages and currents are constant in time",
    "ideal voltage source (zero internal resistance) unless specified",
    "no inductors, no capacitors, no nonlinear components",
    "Kirchhoff's voltage law (KVL) and current law (KCL) apply",
  ]),
  governingEquations: Object.freeze([
    "V = I R  (Ohm's law)",
    "P = V I = I²R = V²/R  (power dissipation)",
    "R_series = R₁ + R₂ + … + Rₙ",
    "1/R_parallel = 1/R₁ + 1/R₂ + … + 1/Rₙ",
  ]),
  outputUnits: Object.freeze({
    voltage: "V",
    current: "A",
    resistance: "Ω",
    power: "W",
  }),
})

export const RC_CIRCUIT_METADATA = Object.freeze({
  id: "rc-circuit-transient",
  name: "RC circuit — charging and discharging transient response",
  assumptions: Object.freeze([
    "series RC circuit with ideal resistor and capacitor",
    "ideal DC voltage source (zero internal resistance)",
    "capacitor is linear (constant capacitance)",
    "no inductance",
    "switch closes instantaneously at t = 0",
  ]),
  governingEquation:
    "C dV_C/dt + V_C/R = V_s/R  →  V_C(t) = V_f + (V₀ − V_f) e^(−t/τ),  τ = RC",
  outputUnits: Object.freeze({
    time: "s",
    voltage: "V",
    current: "A",
    charge: "C",
    energy: "J",
    timeConstant: "s",
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
 * Solves a simple Ohm's law / resistor network.
 *
 * Options:
 *   voltage    { value, unit }? — supply voltage V (V)
 *   current    { value, unit }? — current I (A)
 *   resistance { value, unit }? — resistance R (Ω)
 *
 *   Exactly two of the three must be given; the third is derived.
 *
 * Optional resistor network (pass instead of a single resistance):
 *   resistors   — array of { value (number), unit: "Ω"|"kΩ"|"MΩ" }
 *   configuration — "series" | "parallel"
 */
export function solveOhmLaw(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  let R = null

  // Resistor network
  if (options.resistors !== undefined) {
    if (!Array.isArray(options.resistors) || options.resistors.length === 0) {
      throw new TypeError("resistors must be a non-empty array")
    }
    const config = requireField(options, "configuration")
    if (config !== "series" && config !== "parallel") {
      throw new RangeError("configuration must be series or parallel")
    }

    const values = options.resistors.map((r, i) => {
      if (r === null || typeof r !== "object") throw new TypeError(`resistors[${i}] must be {value, unit}`)
      const v = requireField(r, "value")
      const u = requireField(r, "unit")
      assertFiniteNumber(v, `resistors[${i}].value`)
      return assertPositive(convertUnit(v, u, "Ω"), `resistors[${i}]`)
    })

    if (config === "series") {
      R = values.reduce((a, b) => a + b, 0)
    } else {
      R = 1 / values.reduce((sum, r) => sum + 1 / r, 0)
    }
  } else if (options.resistance !== undefined) {
    R = assertPositive(readQuantity(options, "resistance", "Ω"), "resistance")
  }

  const hasV = options.voltage !== undefined
  const hasI = options.current !== undefined

  const given = [hasV, hasI, R !== null].filter(Boolean).length
  if (given < 2) {
    throw new TypeError(
      "Provide at least two of: voltage, current, resistance (or resistors + configuration)"
    )
  }

  let V = hasV ? assertFiniteNumber(readQuantity(options, "voltage", "V"), "voltage") : null
  let I = hasI ? assertFiniteNumber(readQuantity(options, "current", "A"), "current") : null

  if (V !== null && I !== null && R === null) {
    if (I === 0) throw new RangeError("current must be non-zero to derive resistance")
    R = V / I
  } else if (V !== null && R !== null && I === null) {
    I = V / R
  } else if (I !== null && R !== null && V === null) {
    V = I * R
  }

  const P = assertFiniteNumber(V * I, "power")

  return Object.freeze({
    metadata: OHM_LAW_METADATA,
    units: OHM_LAW_METADATA.outputUnits,
    voltage: V,
    current: I,
    resistance: R,
    power: P,
  })
}

/**
 * Solves an RC circuit transient response.
 *
 * Options:
 *   resistance           { value, unit }  — R (Ω)
 *   capacitance          { value, unit }  — C (F)
 *   sourceVoltage        { value, unit }  — V_s (V) — supply after switch closes
 *   initialVoltage       { value, unit }? — V_C(0) (V), default 0 (uncharged)
 *   duration             { value, unit }  — total time to simulate (time unit)
 *   sampleCount                           — number of time samples (integer ≥ 2), default 200
 */
export function solveRCCircuit(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const R = assertPositive(readQuantity(options, "resistance", "Ω"), "resistance")
  const C = assertPositive(readQuantity(options, "capacitance", "F"), "capacitance")
  const Vs = assertFiniteNumber(readQuantity(options, "sourceVoltage", "V"), "sourceVoltage")
  const V0 = assertFiniteNumber(readOptionalQuantity(options, "initialVoltage", "V", 0), "initialVoltage")
  const duration = assertPositive(readQuantity(options, "duration", "s"), "duration")

  const sampleCount = options.sampleCount !== undefined
    ? (() => {
        const n = options.sampleCount
        if (!Number.isSafeInteger(n) || n < 2) throw new RangeError("sampleCount must be a safe integer ≥ 2")
        return n
      })()
    : 200

  const tau = R * C    // time constant

  const samples = Array.from({ length: sampleCount }, (_, i) => {
    const t = duration * i / (sampleCount - 1)
    const Vc = Vs + (V0 - Vs) * Math.exp(-t / tau)
    const current = (Vs - Vc) / R
    const charge = C * Vc
    const energyCapacitor = 0.5 * C * Vc * Vc
    return Object.freeze({ time: t, capacitorVoltage: Vc, current, charge, energyCapacitor })
  })

  // Energy dissipated in resistor over the full duration
  const Vc_final = samples[samples.length - 1].capacitorVoltage
  const energyInitial = 0.5 * C * V0 * V0
  const energyFinal = 0.5 * C * Vc_final * Vc_final
  const energySource = Vs * C * (Vc_final - V0)          // Q·Vs
  const energyDissipated = energySource - (energyFinal - energyInitial)

  return Object.freeze({
    metadata: RC_CIRCUIT_METADATA,
    units: RC_CIRCUIT_METADATA.outputUnits,
    resistance: R,
    capacitance: C,
    sourceVoltage: Vs,
    initialVoltage: V0,
    timeConstant: tau,
    samples: Object.freeze(samples),
    energyDissipatedInResistor: energyDissipated,
    finalCapacitorVoltage: Vc_final,
  })
}
