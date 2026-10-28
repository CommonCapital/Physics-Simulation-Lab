export { SUPPORTED_UNITS, convertUnit, convertTemperature } from "./units.js"

export {
  requireField,
  assertFiniteNumber,
  assertPositive,
  assertNonNegative,
  assertInRange,
} from "./validation.js"

export { rk4Step, integrateRK4 } from "./integration.js"

export {
  absoluteError,
  relativeError,
  conservationDrift,
  compareTimeStepConvergence,
} from "./quality.js"

// ── Original catalog ──────────────────────────────────────────────────────────

export {
  PROJECTILE_MOTION_METADATA,
  solveProjectileMotion,
} from "./models/projectile.js"

export {
  SIMPLY_SUPPORTED_BEAM_METADATA,
  solveSimplySupportedBeam,
} from "./models/simply-supported-beam.js"

// ── Extended catalog ──────────────────────────────────────────────────────────

export {
  SIMPLE_PENDULUM_METADATA,
  PHYSICAL_PENDULUM_METADATA,
  solveSimplePendulum,
  solvePhysicalPendulum,
} from "./models/pendulum.js"

export {
  SPRING_MASS_METADATA,
  solveSpringMass,
} from "./models/spring-mass.js"

export {
  FREE_FALL_METADATA,
  solveFreeFall,
} from "./models/free-fall.js"

export {
  CIRCULAR_MOTION_METADATA,
  solveCircularMotion,
} from "./models/circular-motion.js"

export {
  FLUID_STATICS_METADATA,
  solveFluidStatics,
} from "./models/fluid-statics.js"

export {
  IDEAL_GAS_METADATA,
  THERMAL_EXPANSION_METADATA,
  solveIdealGasProcess,
  solveThermalExpansion,
} from "./models/thermodynamics.js"

export {
  OHM_LAW_METADATA,
  RC_CIRCUIT_METADATA,
  solveOhmLaw,
  solveRCCircuit,
} from "./models/circuits.js"
