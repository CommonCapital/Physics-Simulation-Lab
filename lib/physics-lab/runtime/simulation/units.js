import { assertFiniteNumber } from "./validation.js"

const unitDefinitions = {
  length: {
    mm: 1e-3,
    cm: 1e-2,
    m: 1,
    km: 1e3,
  },
  time: {
    ms: 1e-3,
    s: 1,
    min: 60,
    h: 3600,
  },
  mass: {
    mg: 1e-6,
    g: 1e-3,
    kg: 1,
    t: 1e3,       // metric tonne
  },
  force: {
    N: 1,
    kN: 1e3,
    MN: 1e6,
  },
  pressure: {
    Pa: 1,
    kPa: 1e3,
    MPa: 1e6,
    GPa: 1e9,
    bar: 1e5,
    atm: 101325,
    mmHg: 133.322,
    psi: 6894.757,
    // Ω is registered separately in electricResistance; avoid collision
    "Ω": undefined,   // placeholder — removed below
  },
  velocity: {
    "m/s": 1,
    "km/h": 1 / 3.6,
    "mph": 0.44704,
    "ft/s": 0.3048,
    "knot": 0.514444,
  },
  acceleration: {
    "m/s^2": 1,
    "km/s^2": 1e3,
    "g": 9.80665,    // standard gravity
  },
  forcePerLength: {
    "N/m": 1,
    "kN/m": 1e3,
    "MN/m": 1e6,
  },
  secondMomentOfArea: {
    "mm^4": 1e-12,
    "cm^4": 1e-8,
    "m^4": 1,
  },
  angle: {
    rad: 1,
    deg: Math.PI / 180,
  },
  // ----------------------------------------------------------------
  // New quantities added for extended physics catalog
  // ----------------------------------------------------------------
  energy: {
    J: 1,
    kJ: 1e3,
    MJ: 1e6,
    cal: 4.184,
    kcal: 4184,
    eV: 1.602176634e-19,
    "kW*h": 3.6e6,
  },
  power: {
    W: 1,
    kW: 1e3,
    MW: 1e6,
    "hp": 745.69987,
  },
  frequency: {
    Hz: 1,
    kHz: 1e3,
    MHz: 1e6,
    "rad/s": 1 / (2 * Math.PI),  // angular frequency → Hz (f = ω/2π)
  },
  angularFrequency: {
    "rad/s": 1,
    "rpm": Math.PI / 30,          // rev/min → rad/s
    "rev/s": 2 * Math.PI,
  },
  torque: {
    "N*m": 1,
    "kN*m": 1e3,
    "N*cm": 1e-2,
    "N*mm": 1e-3,
  },
  temperature: {
    K: 1,       // SI base unit; convertUnit handles offset units specially below
    // °C and °F require offset conversion, handled via convertTemperature
  },
  // Temperature difference — same scale as K or °C (no offset needed)
  temperatureDelta: {
    K_delta: 1,   // symbol for a temperature difference in K (= °C difference)
  },
  // Coefficient of thermal expansion: 1/K
  thermalExpansionCoefficient: {
    "1/K": 1,
    "1/°C": 1,   // same magnitude
    "µε/K": 1e-6,
    "ppm/K": 1e-6,
  },
  density: {
    "kg/m^3": 1,
    "g/cm^3": 1e3,
    "g/L": 1,
    "kg/L": 1e3,
  },
  volume: {
    "m^3": 1,
    "cm^3": 1e-6,
    "mm^3": 1e-9,
    "L": 1e-3,
    "mL": 1e-6,
  },
  electricVoltage: {
    V: 1,
    mV: 1e-3,
    kV: 1e3,
  },
  electricCurrent: {
    A: 1,
    mA: 1e-3,
    µA: 1e-6,
    kA: 1e3,
  },
  electricResistance: {
    "Ω": 1,
    "kΩ": 1e3,
    "MΩ": 1e6,
    "mΩ": 1e-3,
  },
  electricCapacitance: {
    F: 1,
    mF: 1e-3,
    µF: 1e-6,
    nF: 1e-9,
    pF: 1e-12,
  },
  electricCharge: {
    C: 1,
    mC: 1e-3,
    µC: 1e-6,
    nC: 1e-9,
  },
  amount: {
    mol: 1,
    mmol: 1e-3,
    kmol: 1e3,
  },
  // Linear damping / drag coefficient  F = b v  →  [N·s/m = kg/s]
  linearDamping: {
    "N*s/m": 1,
    "kg/s": 1,
    "N*s/m": 1,
  },
  // Rotational damping  τ = b ω  →  [N·m·s/rad]
  rotationalDamping: {
    "N*m*s/rad": 1,
    "kg*m^2/s": 1,
  },
  // Spring stiffness  F = k x  →  [N/m]
  springStiffness: {
    "N/m": 1,
    "kN/m": 1e3,
    "N/mm": 1e3,
    "N/cm": 100,
    "MN/m": 1e6,
  },
  // Moment of inertia  I  →  [kg·m²]
  momentOfInertia: {
    "kg*m^2": 1,
    "g*cm^2": 1e-7,
    "kg*cm^2": 1e-4,
  },
  // ── New unit families for electromagnetism, fluid dynamics, modern physics ──
  // Magnetic field (flux density)  B  →  [T = kg/(A·s²)]
  magneticField: {
    "T": 1,
    "mT": 1e-3,
    "µT": 1e-6,
    "nT": 1e-9,
    "G": 1e-4,     // Gauss (CGS)
  },
  // Magnetic flux  Φ_B  →  [Wb = V·s]
  magneticFlux: {
    "Wb": 1,
    "mWb": 1e-3,
    "µWb": 1e-6,
  },
  // Inductance  L  →  [H = Wb/A]
  inductance: {
    "H": 1,
    "mH": 1e-3,
    "µH": 1e-6,
    "nH": 1e-9,
  },
  // Electric field  E  →  [V/m = N/C]
  electricField: {
    "V/m": 1,
    "kV/m": 1e3,
    "MV/m": 1e6,
    "N/C": 1,      // same dimension
  },
  // Radioactivity  →  [Bq = s⁻¹]
  radioactivity: {
    "Bq": 1,
    "kBq": 1e3,
    "MBq": 1e6,
    "GBq": 1e9,
    "Ci": 3.7e10,      // Curie
    "mCi": 3.7e7,
    "µCi": 3.7e4,
  },
  // Kinematic viscosity  ν = η/ρ  →  [m²/s]
  kinematicViscosity: {
    "m^2/s": 1,
    "cm^2/s": 1e-4,   // Stokes = 1 cm²/s
    "mm^2/s": 1e-6,   // cSt
  },
  // Dynamic viscosity  η  →  [Pa·s = kg/(m·s)]
  dynamicViscosity: {
    "Pa*s": 1,
    "mPa*s": 1e-3,
    "µPa*s": 1e-6,
    "P": 0.1,          // Poise (CGS)
    "cP": 1e-3,        // centipoise
  },
  // Cross-sectional / plate area  →  [m²]
  area: {
    "m^2": 1,
    "cm^2": 1e-4,
    "mm^2": 1e-6,
    "km^2": 1e6,
    "ft^2": 0.0929030,
    "in^2": 6.4516e-4,
  },
  // Molar mass  →  [g/mol]  (note: SI is kg/mol but g/mol is universal usage)
  molarMass: {
    "g/mol": 1,
    "kg/mol": 1e3,
  },
  // Current change rate  dI/dt  →  [A/s]
  currentChangeRate: {
    "A/s": 1,
    "mA/s": 1e-3,
    "kA/s": 1e3,
  },
  // Momentum  →  [kg·m/s = N·s]
  momentum: {
    "kg*m/s": 1,
    "N*s": 1,
    "g*cm/s": 1e-5,
  },
  // Specific heat  c_p / c_v  →  [J/(kg·K)]
  specificHeat: {
    "J/(kg*K)": 1,
    "kJ/(kg*K)": 1e3,
    "cal/(g*K)": 4184,
  },
}

// Remove the placeholder Ω entry from pressure
delete unitDefinitions.pressure["Ω"]

export const SUPPORTED_UNITS = Object.freeze(
  Object.fromEntries(
    Object.entries(unitDefinitions).map(([quantity, units]) => [
      quantity,
      Object.freeze(Object.keys(units)),
    ])
  )
)

const unitsBySymbol = new Map()
for (const [quantity, units] of Object.entries(unitDefinitions)) {
  for (const [symbol, scaleToSi] of Object.entries(units)) {
    if (scaleToSi === undefined) continue
    // If a symbol appears in multiple quantity groups, the last write wins.
    // This is intentional only for "N*s/m" / "kg/s" aliases; for cross-
    // dimensional ambiguity the caller is expected to pass compatible units.
    unitsBySymbol.set(symbol, { quantity, scaleToSi })
  }
}

function getUnit(symbol, field) {
  if (typeof symbol !== "string" || !unitsBySymbol.has(symbol)) {
    throw new RangeError(`${field} contains unsupported unit symbol "${String(symbol)}"`)
  }

  return unitsBySymbol.get(symbol)
}

export function convertUnit(value, fromUnit, toUnit) {
  assertFiniteNumber(value, "value")
  const source = getUnit(fromUnit, "fromUnit")
  const target = getUnit(toUnit, "toUnit")

  if (source.quantity !== target.quantity) {
    throw new RangeError(
      `fromUnit "${fromUnit}" (${source.quantity}) is incompatible with toUnit "${toUnit}" (${target.quantity})`
    )
  }

  return (value * source.scaleToSi) / target.scaleToSi
}

/**
 * Convert a temperature value between K, °C, and °F.
 *
 * Temperature has an additive offset and cannot go through convertUnit's
 * multiplicative path. This is the only function permitted to handle
 * absolute temperature values; convertUnit handles temperature *differences*
 * via the K_delta / 1/K families.
 *
 * Returns the value in the toUnit.
 */
export function convertTemperature(value, fromUnit, toUnit) {
  assertFiniteNumber(value, "value")

  // Convert to Kelvin first
  let kelvin
  if (fromUnit === "K") {
    kelvin = value
  } else if (fromUnit === "°C") {
    kelvin = value + 273.15
  } else if (fromUnit === "°F") {
    kelvin = (value - 32) * (5 / 9) + 273.15
  } else {
    throw new RangeError(`convertTemperature: unsupported fromUnit "${fromUnit}"; use K, °C, or °F`)
  }

  if (kelvin < 0) {
    throw new RangeError("Temperature in Kelvin must be non-negative (physical constraint: T ≥ 0 K)")
  }

  if (toUnit === "K") return kelvin
  if (toUnit === "°C") return kelvin - 273.15
  if (toUnit === "°F") return (kelvin - 273.15) * (9 / 5) + 32

  throw new RangeError(`convertTemperature: unsupported toUnit "${toUnit}"; use K, °C, or °F`)
}
