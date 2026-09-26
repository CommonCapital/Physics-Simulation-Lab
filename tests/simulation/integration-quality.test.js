import assert from "node:assert/strict"
import test from "node:test"

import {
  absoluteError,
  compareTimeStepConvergence,
  conservationDrift,
  integrateRK4,
  relativeError,
  rk4Step,
} from "../../lib/games/runtime/simulation/index.js"

function solveExponential(timeStep) {
  const steps = Math.round(1 / timeStep)
  const trajectory = integrateRK4({
    derivative: (_time, [value]) => [value],
    initialState: [1],
    timeStep,
    steps,
  })
  return trajectory.at(-1).state[0]
}

test("rk4 solves exponential growth with deterministic fourth-order accuracy", () => {
  const first = solveExponential(0.1)
  const second = solveExponential(0.1)

  assert.equal(first, second)
  // global error at h=0.1 is about 2.1e-6 for this fourth-order method
  assert.ok(Math.abs(first - Math.E) < 2.5e-6)
})

test("rk4 rejects invalid steps and non-finite state or derivatives", () => {
  assert.throws(() => rk4Step((_time, state) => state, [1], 0, 0), /timeStep/)
  assert.throws(
    () => rk4Step((_time, state) => state, [Infinity], 0, 0.1),
    /state\[0\]/,
  )
  assert.throws(
    () => rk4Step(() => [NaN], [1], 0, 0.1),
    /derivative\[0\]/,
  )
  assert.throws(
    () => rk4Step(() => [Number.MAX_VALUE], [1], 0, 10),
    /nextState\[0\]/,
  )
})

test("error and conservation utilities calculate normalized differences", () => {
  assert.equal(absoluteError(9.8, 10), 0.1999999999999993)
  assert.equal(relativeError(9, 10), 0.1)
  assert.equal(conservationDrift(99.5, 100), 0.005)
  assert.throws(() => relativeError(1, 0), /reference/)
})

test("time-step comparison reports rk4 convergence near fourth order", () => {
  const comparison = compareTimeStepConvergence({
    coarseValue: solveExponential(0.2),
    fineValue: solveExponential(0.1),
    referenceValue: Math.E,
    refinementRatio: 2,
  })

  assert.equal(comparison.converges, true)
  // finite-step effects keep the observed order close to, but not exactly, four
  assert.ok(Math.abs(comparison.observedOrder - 4) < 0.15)
  assert.ok(comparison.errorReductionFactor > 14)
})
