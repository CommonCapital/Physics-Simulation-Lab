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

// ── Extended catalog — oscillations & waves ───────────────────────────────────

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

// ── Extended catalog — kinematics & mechanics ─────────────────────────────────

export {
  FREE_FALL_METADATA,
  solveFreeFall,
} from "./models/free-fall.js"

export {
  CIRCULAR_MOTION_METADATA,
  solveCircularMotion,
} from "./models/circular-motion.js"

// ── Classical mechanics (full) ────────────────────────────────────────────────

export {
  KINEMATICS_1D_METADATA,
  solveKinematics1D,
  NEWTON_SECOND_LAW_METADATA,
  solveNewtonSecondLaw,
  DRAG_FORCE_METADATA,
  solveDragForce,
  FRICTION_METADATA,
  solveFriction,
  IMPULSE_MOMENTUM_METADATA,
  solveImpulseMomentum,
  WORK_ENERGY_METADATA,
  solveWorkEnergy,
  ANGULAR_KINEMATICS_METADATA,
  solveAngularKinematics,
  TORQUE_ROTATIONAL_METADATA,
  solveTorque,
  MOMENT_OF_INERTIA_METADATA,
  solveMomentOfInertia,
} from "./models/classical-mechanics.js"

// ── Fluid statics & thermodynamics ────────────────────────────────────────────

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

// ── Fluid dynamics ────────────────────────────────────────────────────────────

export {
  CONTINUITY_METADATA,
  solveContinuity,
  BERNOULLI_METADATA,
  solveBernoulli,
  HAGEN_POISEUILLE_METADATA,
  solveHagenPoiseuille,
  REYNOLDS_NUMBER_METADATA,
  solveReynoldsNumber,
  STOKES_SETTLING_METADATA,
  solveStokesSettling,
  DRAG_COEFFICIENT_METADATA,
  solveDragCoefficient,
  VENTURI_METER_METADATA,
  solveVenturiMeter,
} from "./models/fluid-dynamics.js"

// ── DC circuits & electrostatics ──────────────────────────────────────────────

export {
  OHM_LAW_METADATA,
  RC_CIRCUIT_METADATA,
  solveOhmLaw,
  solveRCCircuit,
} from "./models/circuits.js"

// ── Electromagnetism (full) ───────────────────────────────────────────────────

export {
  COULOMBS_LAW_METADATA,
  solveCoulombsLaw,
  ELECTRIC_FIELD_METADATA,
  solveElectricField,
  CAPACITOR_METADATA,
  solveCapacitor,
  LORENTZ_FORCE_METADATA,
  solveLorentzForce,
  BIOT_SAVART_METADATA,
  solveBiotSavart,
  FARADAY_LAW_METADATA,
  solveFaradayLaw,
  RL_CIRCUIT_METADATA,
  solveRLCircuit,
  RLC_CIRCUIT_METADATA,
  solveRLCCircuit,
  MAXWELL_EQUATIONS_METADATA,
  getMaxwellEquations,
} from "./models/electromagnetism.js"

// ── Modern physics ────────────────────────────────────────────────────────────

export {
  PHYSICAL_CONSTANTS,
  SPECIAL_RELATIVITY_METADATA,
  solveSpecialRelativity,
  PHOTOELECTRIC_METADATA,
  solvePhotoelectricEffect,
  DE_BROGLIE_METADATA,
  solveDeBroglie,
  BOHR_ATOM_METADATA,
  solveBohrAtom,
  RADIOACTIVE_DECAY_METADATA,
  solveRadioactiveDecay,
  COMPTON_SCATTERING_METADATA,
  solveComptonScattering,
} from "./models/modern-physics.js"
