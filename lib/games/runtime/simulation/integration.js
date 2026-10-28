import { assertFiniteNumber, assertPositive } from "./validation.js"

function validateState(state, field) {
  if (!Array.isArray(state) || state.length === 0) {
    throw new TypeError(`${field} must be a non-empty array`)
  }

  return state.map((value, index) =>
    assertFiniteNumber(value, `${field}[${index}]`),
  )
}

function evaluateDerivative(derivative, time, state, expectedLength) {
  const result = derivative(time, state.slice())
  const validated = validateState(result, "derivative")

  if (validated.length !== expectedLength) {
    throw new RangeError(
      `derivative must contain ${expectedLength} values, received ${validated.length}`,
    )
  }

  return validated
}

function addScaled(state, derivative, scale) {
  return state.map((value, index) => value + derivative[index] * scale)
}

export function rk4Step(derivative, state, time, timeStep) {
  if (typeof derivative !== "function") {
    throw new TypeError("derivative must be a function")
  }

  const currentState = validateState(state, "state")
  assertFiniteNumber(time, "time")
  assertPositive(timeStep, "timeStep")

  const size = currentState.length
  const halfStep = timeStep / 2
  const k1 = evaluateDerivative(derivative, time, currentState, size)
  const k2 = evaluateDerivative(
    derivative,
    time + halfStep,
    addScaled(currentState, k1, halfStep),
    size,
  )
  const k3 = evaluateDerivative(
    derivative,
    time + halfStep,
    addScaled(currentState, k2, halfStep),
    size,
  )
  const k4 = evaluateDerivative(
    derivative,
    time + timeStep,
    addScaled(currentState, k3, timeStep),
    size,
  )

  const nextState = currentState.map(
    (value, index) =>
      value +
      (timeStep / 6) *
        (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]),
  )

  return validateState(nextState, "nextState")
}

export function integrateRK4({
  derivative,
  initialState,
  startTime = 0,
  timeStep,
  steps,
}) {
  assertFiniteNumber(startTime, "startTime")
  assertPositive(timeStep, "timeStep")
  if (!Number.isSafeInteger(steps) || steps < 0) {
    throw new RangeError("steps must be a non-negative safe integer")
  }

  let time = startTime
  let state = validateState(initialState, "initialState")
  const trajectory = [{ time, state: state.slice() }]

  for (let step = 0; step < steps; step += 1) {
    state = rk4Step(derivative, state, time, timeStep)
    time += timeStep
    assertFiniteNumber(time, "time")
    trajectory.push({ time, state: state.slice() })
  }

  return trajectory
}
