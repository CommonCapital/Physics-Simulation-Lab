import { z } from "zod"

/**
 * The scene spec: the one thing the agent writes and every worker reads.
 *
 * A spec describes a family of scenes, not one scene: any quantity given as a
 * range is sampled per seed by the physics worker, so `(spec, seed)` fully
 * determines a run. Everything is SI — metres, kilograms, seconds, degrees
 * only where the field name says so — and the world is Z-up.
 *
 * This file is the source of truth. The Python workers validate against the
 * JSON Schema exported from it (`npm run spec:schema`) and receive specs only
 * after `SceneSpec.parse`, with every default filled in. A field added here
 * reaches them once that export is rerun and committed.
 */

/** A fixed value, or a `[min, max]` range sampled uniformly per seed. */
const Range = (base: z.ZodNumber) =>
  z.union([
    base,
    z
      .object({ min: base, max: base })
      .refine((range) => range.min <= range.max, {
        message: "min must not exceed max",
      }),
  ])

const Vec3 = z.tuple([z.number(), z.number(), z.number()])

const Shape = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("box"),
    /** Full edge lengths along x, y, z. */
    size: z.tuple([
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
    ]),
  }),
  z.object({ type: z.literal("sphere"), radius: z.number().positive() }),
  z.object({
    type: z.literal("cylinder"),
    radius: z.number().positive(),
    /** Full length along the local z axis. */
    length: z.number().positive(),
  }),
  z.object({
    type: z.literal("capsule"),
    radius: z.number().positive(),
    /** Length of the cylindrical part, excluding the end caps. */
    length: z.number().positive(),
  }),
])

const Pose = z.object({
  position: Vec3,
  /** Intrinsic XYZ Euler angles. */
  rotationDeg: Vec3.default([0, 0, 0]),
})

/** Coulomb coefficient. Contacts use the larger of the two geoms' values. */
const Friction = z.number().nonnegative().max(5)

const Fixture = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  shape: Shape,
  pose: Pose,
  friction: Friction.default(0.8),
})

const Placement = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pose"), pose: Pose }),
  z.object({
    type: z.literal("region"),
    /** Axis-aligned box the body centres are sampled from, without overlap. */
    center: Vec3,
    size: Vec3,
    randomRotation: z.boolean().default(false),
  }),
])

const BodySet = z.object({
  /** Bodies in a set of more than one are named `${id}_${index}`. */
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  /** Class label the dataset writes for every body in the set. */
  label: z.string().min(1),
  count: z.number().int().positive().max(1000).default(1),
  shape: Shape,
  mass: Range(z.number().positive()),
  friction: Range(Friction).default(0.8),
  placement: Placement,
  linearVelocity: Vec3.default([0, 0, 0]),
  angularVelocity: Vec3.default([0, 0, 0]),
})

const Camera = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  position: Vec3,
  lookAt: Vec3,
  fovDeg: z.number().gt(1).lt(179).default(60),
  width: z.number().int().positive().max(8192).default(1280),
  height: z.number().int().positive().max(8192).default(720),
})

export const SceneSpec = z
  .object({
    version: z.literal(1),
    gravity: Vec3.default([0, 0, -9.81]),
    /** Ground plane at z = 0, or none for free space. */
    ground: z
      .object({ friction: Friction.default(0.8) })
      .nullable()
      .default({ friction: 0.8 }),
    fixtures: z.array(Fixture).default([]),
    bodies: z.array(BodySet).min(1),
    cameras: z.array(Camera).default([]),
    simulation: z.object({
      duration: z.number().positive().max(120),
      timestep: z.number().positive().max(0.01).default(0.002),
      captureHz: z.number().positive().max(1000).default(30),
    }),
    seeds: z.number().int().positive().max(100_000).default(1),
  })
  .superRefine((spec, ctx) => {
    const ids = [
      ...spec.fixtures.map((fixture) => fixture.id),
      ...spec.bodies.map((body) => body.id),
      ...spec.cameras.map((camera) => camera.id),
    ]
    const seen = new Set<string>()

    for (const id of ids) {
      if (seen.has(id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate id: ${id}` })
      }
      seen.add(id)
    }

    if (1 / spec.simulation.captureHz < spec.simulation.timestep) {
      ctx.addIssue({
        code: "custom",
        path: ["simulation", "captureHz"],
        message: "captureHz must not exceed the physics rate (1 / timestep)",
      })
    }
  })

export type SceneSpec = z.infer<typeof SceneSpec>
export type SceneSpecInput = z.input<typeof SceneSpec>
