import assert from "node:assert/strict"
import test from "node:test"

import { SceneSpec } from "../../lib/scene-spec/schema.ts"

const minimal = {
  version: 1,
  bodies: [
    {
      id: "bolt",
      label: "bolt",
      shape: { type: "cylinder", radius: 0.005, length: 0.04 },
      mass: { min: 0.01, max: 0.02 },
      placement: {
        type: "region",
        center: [0, 0, 0.5],
        size: [0.4, 0.4, 0.2],
      },
    },
  ],
  simulation: { duration: 2 },
}

test("parse fills in every default the workers rely on", () => {
  const spec = SceneSpec.parse(minimal)

  assert.deepEqual(spec.gravity, [0, 0, -9.81])
  assert.deepEqual(spec.ground, { friction: 0.8 })
  assert.deepEqual(spec.fixtures, [])
  assert.deepEqual(spec.cameras, [])
  assert.equal(spec.seeds, 1)
  assert.equal(spec.simulation.timestep, 0.002)
  assert.equal(spec.simulation.captureHz, 30)

  const [body] = spec.bodies
  assert.equal(body.count, 1)
  assert.equal(body.friction, 0.8)
  assert.deepEqual(body.linearVelocity, [0, 0, 0])
  assert.equal(
    body.placement.type === "region" && body.placement.randomRotation,
    false
  )
})

test("ground can be removed with null", () => {
  assert.equal(SceneSpec.parse({ ...minimal, ground: null }).ground, null)
})

test("rejects a range whose min exceeds its max", () => {
  const spec = structuredClone(minimal)
  spec.bodies[0].mass = { min: 2, max: 1 }

  assert.throws(() => SceneSpec.parse(spec), /min must not exceed max/)
})

test("rejects duplicate ids across fixtures, bodies and cameras", () => {
  const spec = {
    ...minimal,
    cameras: [{ id: "bolt", position: [1, 1, 1], lookAt: [0, 0, 0] }],
  }

  assert.throws(() => SceneSpec.parse(spec), /Duplicate id: bolt/)
})

test("rejects capturing faster than the physics steps", () => {
  const spec = {
    ...minimal,
    simulation: { duration: 1, timestep: 0.01, captureHz: 200 },
  }

  assert.throws(() => SceneSpec.parse(spec), /captureHz must not exceed/)
})

test("rejects malformed ids and unknown shapes", () => {
  assert.throws(() =>
    SceneSpec.parse({
      ...minimal,
      bodies: [{ ...minimal.bodies[0], id: "Bolt 1" }],
    })
  )
  assert.throws(() =>
    SceneSpec.parse({
      ...minimal,
      bodies: [{ ...minimal.bodies[0], shape: { type: "torus", radius: 1 } }],
    })
  )
})
