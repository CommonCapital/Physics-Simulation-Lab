/**
 * Ideal gas law and isoprocess thermodynamics.
 *
 * The four reversible quasi-static processes for an ideal gas:
 *
 *   Isothermal  (T = const):  p V = const  →  p₂ = p₁ V₁ / V₂
 *   Isobaric    (p = const):  V / T = const →  V₂ = V₁ T₂ / T₁
 *   Isochoric   (V = const):  p / T = const →  p₂ = p₁ T₂ / T₁
 *   Adiabatic   (Q = 0):      p V^γ = const →  p₂ = p₁ (V₁/V₂)^γ
 *
 * Ideal gas law:  p V = n R T
 *   where R = 8.314 J/(mol·K), n is moles, T in Kelvin.
 *
 * Work done BY the gas:
 *   Isothermal:  W = n R T ln(V₂/V₁)
 *   Isobaric:    W = p ΔV
 *   Isochoric:   W = 0
 *   Adiabatic:   W = (p₁ V₁ − p₂ V₂) / (γ − 1)
 *
 * Heat added TO the gas (first law, ΔU = Q − W):
 *   ΔU = n Cv ΔT  (Cv = R/(γ−1) for ideal gas)
 *   Q = ΔU + W
 *   Adiabatic: Q = 0 by definition.
 *
 * Thermal expansion (linear) — a separate utility:
 *   ΔL = α L₀ ΔT
 *
 * All temperatures in Kelvin internally; accept Celsius and Fahrenheit at input.
 */

import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertPositive,
  requireField,
} from "../validation.js"

const R_GAS = 8.314462618   // J/(mol·K), CODATA 2018

export const IDEAL_GAS_METADATA = Object.freeze({
  id: "ideal-gas-law",
  name: "Ideal gas law and quasi-static isoprocesses",
  assumptions: Object.freeze([
    "ideal gas: molecules have no volume, no intermolecular forces",
    "quasi-static process (infinitely slow, always in equilibrium)",
    "reversible process (no friction, no turbulence)",
    "closed system (fixed amount of gas, no mass flow)",
    "γ (heat capacity ratio) supplied by user or defaulted to diatomic ideal gas (γ = 1.4)",
  ]),
  governingEquations: Object.freeze([
    "Ideal gas law: p V = n R T  (R = 8.314 J/mol/K)",
    "Isothermal: p₁ V₁ = p₂ V₂",
    "Isobaric: V₁/T₁ = V₂/T₂",
    "Isochoric: p₁/T₁ = p₂/T₂",
    "Adiabatic: p V^γ = const, T V^(γ−1) = const",
  ]),
  limitations: Object.freeze([
    "ideal gas only — real-gas effects (van der Waals, compressibility) not modelled",
    "quasi-static and reversible — no shock, no rapid compression",
    "no phase changes, no chemical reactions",
    "single-component gas only",
  ]),
  outputUnits: Object.freeze({
    pressure: "Pa",
    volume: "m^3",
    temperature: "K",
    work: "J",
    heat: "J",
    internalEnergyChange: "J",
  }),
})

export const THERMAL_EXPANSION_METADATA = Object.freeze({
  id: "linear-thermal-expansion",
  name: "Linear thermal expansion",
  assumptions: Object.freeze([
    "linear coefficient of thermal expansion α is constant over the temperature range",
    "isotropic material",
    "small strains (ΔL/L₀ ≪ 1)",
    "unconstrained expansion — no stress developed",
  ]),
  governingEquation: "ΔL = α L₀ ΔT",
  outputUnits: Object.freeze({ length: "m", strain: "dimensionless" }),
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
 * Solves one quasi-static isoprocess for an ideal gas.
 *
 * Options:
 *   processType     — "isothermal" | "isobaric" | "isochoric" | "adiabatic"
 *   moles           { value, unit }  — n (mol), must be positive
 *   initialPressure { value, unit }  — p₁ (pressure unit)
 *   initialVolume   { value, unit }  — V₁ (volume unit)
 *   initialTemp     { value, unit }  — T₁ (temperature unit: K, °C, or °F)
 *   gamma           ?                — γ = Cp/Cv, default 1.4 (diatomic ideal gas, e.g. N₂, O₂, air)
 *
 *   For the free variable that changes:
 *     isothermal:  finalVolume  { value, unit }
 *     isobaric:    finalTemp    { value, unit }
 *     isochoric:   finalTemp    { value, unit }
 *     adiabatic:   finalVolume  { value, unit }
 *
 *   sampleCount — number of intermediate states along the process path (integer ≥ 2), default 100
 */
export function solveIdealGasProcess(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const processType = requireField(options, "processType")
  const validProcesses = ["isothermal", "isobaric", "isochoric", "adiabatic"]
  if (!validProcesses.includes(processType)) {
    throw new RangeError(`processType must be one of: ${validProcesses.join(", ")}`)
  }

  const n = assertPositive(readQuantity(options, "moles", "mol"), "moles")
  const p1 = assertPositive(readQuantity(options, "initialPressure", "Pa"), "initialPressure")
  const V1 = assertPositive(readQuantity(options, "initialVolume", "m^3"), "initialVolume")
  const T1 = assertPositive(readQuantity(options, "initialTemp", "K"), "initialTemp")
  const gamma = options.gamma !== undefined
    ? assertPositive(assertFiniteNumber(options.gamma, "gamma"), "gamma")
    : 1.4

  if (gamma <= 1) throw new RangeError("gamma must be greater than 1")

  // Verify the initial state is self-consistent with pV = nRT
  const T1check = (p1 * V1) / (n * R_GAS)
  const consistency = Math.abs(T1check - T1) / T1
  if (consistency > 0.01) {
    throw new RangeError(
      `Initial state is inconsistent: pV = nRT gives T = ${T1check.toFixed(2)} K but initialTemp = ${T1.toFixed(2)} K. ` +
      "Supply three of the four state variables and derive the fourth, or ensure they are consistent."
    )
  }

  const Cv = R_GAS / (gamma - 1)   // molar heat capacity at constant volume

  const sampleCount = options.sampleCount !== undefined
    ? (() => {
        const nc = options.sampleCount
        if (!Number.isSafeInteger(nc) || nc < 2) throw new RangeError("sampleCount must be a safe integer ≥ 2")
        return nc
      })()
    : 100

  let p2, V2, T2, W, Q, deltaU, path

  if (processType === "isothermal") {
    V2 = assertPositive(readQuantity(options, "finalVolume", "m^3"), "finalVolume")
    T2 = T1
    p2 = p1 * V1 / V2
    W = n * R_GAS * T1 * Math.log(V2 / V1)
    deltaU = 0
    Q = W

    path = Array.from({ length: sampleCount }, (_, i) => {
      const V = V1 + (V2 - V1) * i / (sampleCount - 1)
      const p = p1 * V1 / V
      const T = T1
      return Object.freeze({ volume: V, pressure: p, temperature: T })
    })
  } else if (processType === "isobaric") {
    T2 = assertPositive(readQuantity(options, "finalTemp", "K"), "finalTemp")
    p2 = p1
    V2 = V1 * T2 / T1
    W = p1 * (V2 - V1)
    deltaU = n * Cv * (T2 - T1)
    Q = deltaU + W

    path = Array.from({ length: sampleCount }, (_, i) => {
      const T = T1 + (T2 - T1) * i / (sampleCount - 1)
      const V = V1 * T / T1
      return Object.freeze({ volume: V, pressure: p1, temperature: T })
    })
  } else if (processType === "isochoric") {
    T2 = assertPositive(readQuantity(options, "finalTemp", "K"), "finalTemp")
    V2 = V1
    p2 = p1 * T2 / T1
    W = 0
    deltaU = n * Cv * (T2 - T1)
    Q = deltaU

    path = Array.from({ length: sampleCount }, (_, i) => {
      const T = T1 + (T2 - T1) * i / (sampleCount - 1)
      const p = p1 * T / T1
      return Object.freeze({ volume: V1, pressure: p, temperature: T })
    })
  } else {
    // Adiabatic
    V2 = assertPositive(readQuantity(options, "finalVolume", "m^3"), "finalVolume")
    p2 = p1 * Math.pow(V1 / V2, gamma)
    T2 = T1 * Math.pow(V1 / V2, gamma - 1)
    W = (p1 * V1 - p2 * V2) / (gamma - 1)
    Q = 0
    deltaU = -W

    path = Array.from({ length: sampleCount }, (_, i) => {
      const V = V1 + (V2 - V1) * i / (sampleCount - 1)
      const p = p1 * Math.pow(V1 / V, gamma)
      const T = T1 * Math.pow(V1 / V, gamma - 1)
      return Object.freeze({ volume: V, pressure: p, temperature: T })
    })
  }

  assertFiniteNumber(p2, "finalPressure")
  assertFiniteNumber(V2, "finalVolume")
  assertFiniteNumber(T2, "finalTemperature")

  return Object.freeze({
    metadata: IDEAL_GAS_METADATA,
    units: IDEAL_GAS_METADATA.outputUnits,
    processType,
    moles: n,
    gamma,
    initialState: Object.freeze({ pressure: p1, volume: V1, temperature: T1 }),
    finalState: Object.freeze({ pressure: p2, volume: V2, temperature: T2 }),
    work: assertFiniteNumber(W, "work"),
    heatAdded: assertFiniteNumber(Q, "heat"),
    internalEnergyChange: assertFiniteNumber(deltaU, "internalEnergyChange"),
    processPath: Object.freeze(path),
  })
}

/**
 * Solves linear thermal expansion.
 *
 * Options:
 *   initialLength              { value, unit }  — L₀ (length unit)
 *   linearExpansionCoefficient { value, unit }  — α (1/K or 1/°C, same magnitude)
 *   temperatureChange          { value, unit }  — ΔT (K or °C difference, same magnitude)
 */
export function solveThermalExpansion(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const L0 = assertPositive(readQuantity(options, "initialLength", "m"), "initialLength")
  const alpha = assertPositive(readQuantity(options, "linearExpansionCoefficient", "1/K"), "linearExpansionCoefficient")
  const deltaT = assertFiniteNumber(readQuantity(options, "temperatureChange", "K_delta"), "temperatureChange")

  const deltaL = alpha * L0 * deltaT
  const finalLength = L0 + deltaL
  const strain = deltaL / L0

  return Object.freeze({
    metadata: THERMAL_EXPANSION_METADATA,
    units: THERMAL_EXPANSION_METADATA.outputUnits,
    initialLength: L0,
    linearExpansionCoefficient: alpha,
    temperatureChange: deltaT,
    elongation: deltaL,
    finalLength,
    strain,
  })
}
