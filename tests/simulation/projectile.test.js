import assert from "node:assert/strict"
import test from "node:test"

import {
  PROJECTILE_MOTION_METADATA,
  absoluteError,
  integrateRK4,
  solveProjectileMotion,
} from "../../lib/games/runtime/simulation/index.js"

const LENGTH_TOLERANCE = 1e-12
const TIME_TOLERANCE = 1e-12

const quantity = (value, unit) => ({ value, unit })

function solve(overrides = {}) {
  return solveProjectileMotion({
    initialSpeed: quantity(10, "m/s"),
    launchAngle: quantity(0, "deg"),
    initialHeight: quantity(20, "m"),
    gravitationalAcceleration: quantity(10, "m/s^2"),
    sampleCount: 5,
    ...overrides,
  })
}

test("horizontal launch from height stops at its first ground intersection", () => {
  const result = solve({
    sampleCount: undefined,
    sampleInterval: quantity(0.6, "s"),
  })

  assert.ok(absoluteError(result.flightTime, 2) < TIME_TOLERANCE)
  assert.ok(absoluteError(result.horizontalRange, 20) < LENGTH_TOLERANCE)
  assert.equal(result.maximumHeight, 20)
  assert.deepEqual(result.positionAt(1), { x: 10, y: 15 })
  assert.deepEqual(result.velocityAt(1), { x: 10, y: -10 })
  assert.equal(result.trajectory.at(-1).time, result.flightTime)
  assert.equal(result.trajectory.at(-1).position.y, 0)
  assert.ok(result.trajectory.every((sample) => sample.position.y >= 0))
  assert.throws(() => result.positionAt(2.01), /time/)
})

test("45-degree ground launch returns the analytical range and peak", () => {
  const result = solve({
    launchAngle: quantity(45, "deg"),
    initialHeight: quantity(0, "m"),
  })

  assert.ok(absoluteError(result.flightTime, Math.SQRT2) < TIME_TOLERANCE)
  assert.ok(absoluteError(result.horizontalRange, 10) < LENGTH_TOLERANCE)
  assert.ok(absoluteError(result.maximumHeight, 2.5) < LENGTH_TOLERANCE)
})

test("vertical launch has zero horizontal position and range", () => {
  const result = solve({
    initialSpeed: quantity(20, "m/s"),
    launchAngle: quantity(90, "deg"),
    initialHeight: quantity(0, "m"),
  })

  assert.equal(result.flightTime, 4)
  assert.equal(result.horizontalRange, 0)
  assert.equal(result.maximumHeight, 20)
  assert.equal(result.positionAt(2).x, 0)
  assert.equal(result.positionAt(2).y, 20)
})

test("initially downward launch uses the initial height as its maximum", () => {
  const result = solve({
    launchAngle: quantity(-30, "deg"),
    initialHeight: quantity(15, "m"),
  })
  const expectedFlightTime = (-5 + Math.sqrt(325)) / 10

  assert.ok(
    absoluteError(result.flightTime, expectedFlightTime) < TIME_TOLERANCE
  )
  assert.equal(result.maximumHeight, 15)
  assert.ok(result.velocityAt(0).y < 0)
  assert.equal(result.trajectory.at(-1).position.y, 0)
})

test("rejects invalid physical and sampling inputs by field", () => {
  assert.throws(
    () => solve({ initialSpeed: quantity(-1, "m/s") }),
    /initialSpeed/
  )
  assert.throws(
    () => solve({ launchAngle: quantity(91, "deg") }),
    /launchAngle/
  )
  assert.throws(
    () => solve({ gravitationalAcceleration: quantity(0, "m/s^2") }),
    /gravitationalAcceleration/
  )
  assert.throws(
    () => solve({ initialHeight: quantity(-1, "m") }),
    /initialHeight/
  )
  assert.throws(
    () => solve({ initialSpeed: quantity(Infinity, "m/s") }),
    /initialSpeed/
  )
  assert.throws(() => solve({ sampleCount: 1 }), /sampleCount/)
  assert.throws(
    () => solve({ sampleCount: undefined, sampleInterval: quantity(0, "s") }),
    /sampleInterval/
  )
  assert.throws(
    () => solve({ sampleInterval: quantity(0.1, "s") }),
    /exactly one/
  )
})

test("sampled analytical states agree with fixed-step rk4 integration", () => {
  const timeStep = 0.1
  const result = solve({
    launchAngle: quantity(45, "deg"),
    initialHeight: quantity(5, "m"),
    sampleCount: undefined,
    sampleInterval: quantity(timeStep, "s"),
  })
  const initialVelocity = result.velocityAt(0)
  const numerical = integrateRK4({
    derivative: (_time, state) => [state[2], state[3], 0, -10],
    initialState: [0, 5, initialVelocity.x, initialVelocity.y],
    timeStep,
    steps: Math.floor(result.flightTime / timeStep),
  })

  // rk4 integrates constant acceleration exactly apart from floating-point roundoff
  const numericalTolerance = 1e-12
  for (const sample of numerical) {
    const analyticalPosition = result.positionAt(sample.time)
    const analyticalVelocity = result.velocityAt(sample.time)
    assert.ok(
      absoluteError(sample.state[0], analyticalPosition.x) < numericalTolerance
    )
    assert.ok(
      absoluteError(sample.state[1], analyticalPosition.y) < numericalTolerance
    )
    assert.ok(
      absoluteError(sample.state[2], analyticalVelocity.x) < numericalTolerance
    )
    assert.ok(
      absoluteError(sample.state[3], analyticalVelocity.y) < numericalTolerance
    )
  }
})

test("exposes the SI contract and model assumptions", () => {
  const result = solve()

  assert.equal(result.units.position.x, "m")
  assert.equal(result.units.velocity.y, "m/s")
  assert.ok(PROJECTILE_MOTION_METADATA.assumptions.includes("point mass"))
  assert.ok(
    PROJECTILE_MOTION_METADATA.assumptions.includes(
      "no aerodynamic drag, lift, or wind"
    )
  )
})
