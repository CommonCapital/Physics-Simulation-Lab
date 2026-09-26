/**
 * Fluid statics: hydrostatic pressure, buoyancy (Archimedes' principle),
 * and pressure at depth in a static fluid.
 *
 * Physics:
 *   Hydrostatic pressure at depth h below the free surface:
 *     p(h) = p_atm + ρ g h
 *
 *   Gauge pressure (relative to atmospheric):
 *     p_gauge(h) = ρ g h
 *
 *   Buoyant force (Archimedes' principle):
 *     F_B = ρ_fluid g V_submerged
 *
 *   Net vertical force on a submerged/floating object:
 *     F_net = F_B − W = (ρ_fluid V_sub − m_object) g
 *
 *   Float/sink condition:
 *     F_net > 0 → object floats (displaces its own weight)
 *     F_net < 0 → object sinks
 *     F_net = 0 → neutral buoyancy
 *
 *   For a fully submerged object:
 *     fraction of weight supported by buoyancy = ρ_fluid / ρ_object
 *
 * This module covers STATIC fluids only. No flow, no viscosity effects,
 * no dynamic pressure (Bernoulli), no capillary effects.
 */

import { convertUnit } from "../units.js"
import {
  assertFiniteNumber,
  assertNonNegative,
  assertPositive,
  requireField,
} from "../validation.js"

export const FLUID_STATICS_METADATA = Object.freeze({
  id: "fluid-statics",
  name: "Fluid statics — hydrostatic pressure and Archimedes buoyancy",
  assumptions: Object.freeze([
    "fluid is static (no flow)",
    "fluid is incompressible and homogeneous",
    "constant fluid density throughout the column",
    "constant gravitational acceleration",
    "free surface is flat and at atmospheric pressure",
    "object has uniform density (or user supplies submerged volume directly)",
  ]),
  governingEquations: Object.freeze([
    "p(h) = p_atm + ρ g h  (absolute pressure at depth h)",
    "p_gauge(h) = ρ g h     (gauge pressure at depth h)",
    "F_B = ρ_fluid g V_sub  (Archimedes buoyant force)",
    "F_net = F_B − m g      (net force on object)",
  ]),
  limitations: Object.freeze([
    "static fluids only — no Bernoulli, no flow velocity, no dynamic pressure",
    "no surface tension or capillary effects",
    "no compressibility (valid for liquids; approximate for gases at moderate depths)",
    "no temperature-dependent density variation within the column",
  ]),
  outputUnits: Object.freeze({
    pressure: "Pa",
    force: "N",
    depth: "m",
    density: "kg/m^3",
    volume: "m^3",
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
 * Solves fluid statics: pressure profile and buoyancy.
 *
 * Options:
 *   fluidDensity          { value, unit }  — ρ_fluid (kg/m³ equivalent)
 *   gravity               { value, unit }  — g (m/s²)
 *   atmosphericPressure   { value, unit }? — p_atm (Pa), default 101325 Pa (1 atm)
 *   fluidDepth            { value, unit }  — total fluid column depth for profile (length unit)
 *   sampleCount                            — number of depth samples (integer ≥ 2), default 50
 *
 * Object buoyancy (all optional; omit for pressure-only):
 *   objectMass            { value, unit }? — mass of the object (kg)
 *   objectVolume          { value, unit }? — total volume of the object (m³)
 *   submergedFraction                      ? — fraction of volume submerged (0–1), default 1.0 (fully submerged)
 *                                             If object floats, this is calculated automatically.
 */
export function solveFluidStatics(options) {
  if (options === null || typeof options !== "object") {
    throw new TypeError("options is required")
  }

  const rhoF = assertPositive(readQuantity(options, "fluidDensity", "kg/m^3"), "fluidDensity")
  const g = assertPositive(readQuantity(options, "gravity", "m/s^2"), "gravity")
  const pAtm = assertNonNegative(readOptionalQuantity(options, "atmosphericPressure", "Pa", 101325), "atmosphericPressure")
  const depth = assertPositive(readQuantity(options, "fluidDepth", "m"), "fluidDepth")

  const n = options.sampleCount !== undefined
    ? (() => {
        const n = options.sampleCount
        if (!Number.isSafeInteger(n) || n < 2) throw new RangeError("sampleCount must be a safe integer ≥ 2")
        return n
      })()
    : 50

  // Pressure profile
  const pressureProfile = Array.from({ length: n }, (_, i) => {
    const h = depth * i / (n - 1)
    const pAbs = pAtm + rhoF * g * h
    const pGauge = rhoF * g * h
    return Object.freeze({ depth: h, absolutePressure: pAbs, gaugePressure: pGauge })
  })

  // Buoyancy analysis (optional)
  let buoyancy = null

  if (options.objectMass !== undefined && options.objectVolume !== undefined) {
    const mObj = assertPositive(readQuantity(options, "objectMass", "kg"), "objectMass")
    const vObj = assertPositive(readQuantity(options, "objectVolume", "m^3"), "objectVolume")
    const rhoObj = mObj / vObj
    const weight = mObj * g

    // Determine float vs sink
    const maxBuoyancy = rhoF * g * vObj        // buoyant force if fully submerged
    let subFrac, vSub, fBuoy, fNet, condition

    if (maxBuoyancy >= weight) {
      // Object floats: displaces exactly its own weight
      vSub = weight / (rhoF * g)
      subFrac = vSub / vObj
      fBuoy = weight                            // equals weight in equilibrium
      fNet = 0
      condition = "floats"
    } else {
      // Object sinks: fully submerged, net downward force
      subFrac = options.submergedFraction !== undefined
        ? assertNonNegative(options.submergedFraction, "submergedFraction")
        : 1.0
      if (subFrac > 1) throw new RangeError("submergedFraction must not exceed 1.0")
      vSub = vObj * subFrac
      fBuoy = rhoF * g * vSub
      fNet = fBuoy - weight                     // negative = sinks
      condition = Math.abs(fNet) < 1e-9 * weight ? "neutral-buoyancy" : "sinks"
    }

    buoyancy = Object.freeze({
      objectMass: mObj,
      objectVolume: vObj,
      objectDensity: rhoObj,
      weight,
      submergedFraction: subFrac,
      submergedVolume: vSub,
      buoyantForce: fBuoy,
      netVerticalForce: fNet,
      condition,
      apparentWeight: weight - fBuoy,
    })
  }

  return Object.freeze({
    metadata: FLUID_STATICS_METADATA,
    units: FLUID_STATICS_METADATA.outputUnits,
    fluidDensity: rhoF,
    gravity: g,
    atmosphericPressure: pAtm,
    pressureProfile: Object.freeze(pressureProfile),
    buoyancy,
  })
}
