# Physics worker

Runs one seed of a scene spec in MuJoCo and writes the trajectory as JSON.
The trajectory is the single physics source of truth: the browser preview
replays it and the render worker will pose its scenes from it.

```
spec (lib/scene-spec/schema.ts, parsed) ─► sample(seed) ─► MJCF ─► MuJoCo ─► trajectory JSON
```

## Use

Requires [uv](https://docs.astral.sh/uv/).

```bash
cd workers/physics
uv run python -m physics_worker spec.json --seed 0 --out trajectory.json
```

The spec must already be parsed by `SceneSpec` (defaults filled in).
Invalid or unbuildable specs exit with status 2 and the reason on stderr.

## Trajectory

- `bodies`: per body, its id, set, label, shape, and sampled mass and friction.
- `frames`: one per capture tick, each with:
  - `poses`: per body, `x, y, z, qw, qx, qy, qz`
  - `velocities`: per body, world frame, `vx, vy, vz, wx, wy, wz`
  - `energy`: kinetic and potential
  - `contacts`: geom pair, position, normal force
- `stats`: initial and peak penetration, whether everything came to rest,
  bodies that fell through the ground, and total energy at the start and end.

## Contract with the TypeScript side

`scene_spec.schema.json` is generated from `lib/scene-spec/schema.ts`.
After changing the schema, run `npm run spec:schema` and commit both files.
`npm run test:physics` fails if they disagree.

## Accuracy

`tests/test_benchmarks.py` runs scenarios from the JS solver catalog
(`lib/physics-lab/runtime/simulation`) through MuJoCo and asserts agreement:

| Benchmark | Tolerance |
|---|---|
| Free fall, 5 m | 1 cm |
| Projectile, 10 m/s at 30° | 1 cm |
| Block sliding down a 30° ramp, μ = 0.2 | 2 % of acceleration |
| Block holding on a 30° ramp, μ = 0.8 | < 1 mm creep in 1 s |

Known limits: there is no restitution (collisions are close to perfectly
inelastic), and bodies dropped from a metre or two overlap by up to about
1 cm for a frame on impact.
