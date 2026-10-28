# Gap plan: from Physics Simulation Lab to the Phase 1 MVP

*2026-10-29 · Source: "Lovable for Physics Simulation" report v2, §3.1, §4 and §8 Phase 1*

## Target

Phase 1 from the report, scoped to one vertical (industrial parts / warehouse):

> Chat → scene spec → browser preview → rigid-body physics → Blender Cycles
> render → COCO/YOLO export.

**Exit criterion:** one design-partner pilot where a detector trained on our
data (alone or mixed with real images) beats the real-only baseline on the
partner's real test set by a margin you agree with the partner in advance.

Before any of this is built: get the legal answer on employer IP (report §9, rated High).

---

## 1. Where the repo stands

| Area | Today | Gap |
|---|---|---|
| Chat agent | `trigger/chat.ts` runs a `chat.agent` with up to 48 steps and a model picker. | **Keep.** |
| Agent output | The agent writes raw JS/HTML files into a Daytona sandbox (`write_file`, `replace_text` in `lib/physics-lab/tools.ts`). It is only *told* to use the solver catalog. | **Replace.** The report says the agent should output a typed scene spec that is checked before use. Today nothing enforces that; it is prompt-only. |
| Physics | 31 closed-form or single-body solvers (`runtime/simulation/models/`). `runtime/engine/physics.js` does arcade collision only and says so itself: "Not a rigid-body simulation". | **Missing.** There is no multi-body rigid-body solver: no stacking, no tumbling, no contacts. |
| 3D | Three.js 0.185 loaded from a CDN, with engine modules for lighting, materials, models, post-processing and particles. | **Adapt.** Useful for the preview viewer. The game modules (input, sound, HUD, controls) are not needed. |
| Rendering | Browser only. | **Missing.** No offline photoreal render and no GPU workers. |
| Labels / export | None. | **Missing.** No masks, boxes, depth or pose output, and no COCO/YOLO writer. |
| Randomisation / batch | None. Each simulation is a single run. | **Missing.** No seeds, randomisation ranges, job fan-out or progress tracking. |
| Storage | Postgres (Neon) holds only `simulations`, which stores messages and a sandbox id. | **Missing.** No object storage for frames or datasets, and no tables for specs, jobs or datasets. |
| Validation | Unit tests for the analytic solvers. | **Partial.** Nothing trains a model or measures sim-to-real. The analytic solvers are still useful (see §3.4). |
| Auth / tenancy | None. Anyone can open anything. | **Missing.** Pilots need private projects. |
| Billing | Stubs (`lib/billing/ledger.ts` does nothing). | Can wait until Phase 2. |

### Problems in the current code to fix first

1. **The sandbox gets the stale runtime.** `lib/physics-lab/seed.ts:14` reads
   `lib/games/runtime`, and `trigger.config.ts:87` ships `lib/games/runtime/**`.
   As a result the agent never sees `classical-mechanics.js`,
   `electromagnetism.js`, `fluid-dynamics.js` or `modern-physics.js`, which
   exist only under `lib/physics-lab/runtime`. The README's 31-solver catalog
   is not what runs.
2. **`lib/games/` is a duplicate copy of `lib/physics-lab/`** that is still
   imported (`components/chat-composer.tsx`, `components/model-picker.tsx`).
   Point these imports at `lib/physics-lab`, then delete `lib/games/`.
3. **Leftover backward-compatibility aliases:** `games` / `Game` in
   `lib/db/schema.ts`, `gameChat`, `createGameSandbox`, `GAME_DIR`,
   `startGameServer`. Remove them.

---

## 2. Target architecture for the MVP

```
 Chat (Next.js) ──► chat.agent (Trigger.dev)
                       │  tools: get_spec / patch_spec / preview / generate
                       ▼
                 SceneSpec (zod, versioned in Postgres)
                       │  static checks: units, scale, overlaps, mass sanity
                       ▼
   preview ──► physics worker (MuJoCo, CPU) ──► trajectory JSON ──► Three.js
               short, low-res, 1 seed           playback in the browser
                       │
   generate ──► Trigger.dev fan-out: N seeds
                 ├─ physics worker (MuJoCo, CPU)  → trajectories + physics state
                 └─ render worker (Blender/BlenderProc, GPU) → RGB, depth,
                    instance masks, boxes, 6-DoF poses
                       ▼
                 object storage (R2/S3) ──► exporter ──► COCO / YOLO zip
```

The design keeps a **single physics source of truth**. The browser preview
does not run its own physics engine. It replays the trajectory the real
solver produced, so the preview always matches what gets rendered.

---

## 3. Key decisions (recommendations)

### 3.1 Physics engine: MuJoCo for the MVP

- Rigid bodies with contacts and friction are all Phase 1 needs. MuJoCo is
  Apache-2.0, deterministic, runs on CPU, and handles a few hundred bodies
  quickly enough for preview turnaround measured in seconds.
- Genesis is the stronger long-term option (GPU, multiple solvers), but it
  needs GPUs and is less mature. Keep the physics interface engine-agnostic
  (spec → engine adapter → trajectory) so Genesis can be added in Phase 3.
- The physics worker should be a Python container. Daytona sandboxes can run
  it, but a dedicated worker image is simpler. Daytona fits the current
  "agent edits files" model, which goes away under this plan.

### 3.2 Render: BlenderProc on a GPU provider, called from Trigger.dev

- Trigger.dev machines have no GPUs. Use Modal, RunPod or similar for render
  jobs, and keep the orchestration in Trigger.dev (`batchTrigger`,
  per-job metadata for progress).
- BlenderProc provides segmentation, depth, normals and COCO output
  out of the box, which removes most of the work in the export layer.
- It is GPL. Running it server-side is the easier licensing case, but get a
  legal review before launch (report §9).

### 3.3 Scene spec: TypeScript/zod, exported as JSON Schema for Python

- `lib/scene-spec/` holds the zod schema. Zod 4's `z.toJSONSchema` gives
  the Python workers the same contract.
- MVP scope:
  - scene bounds and ground
  - static fixtures (shelf, conveyor, bin)
  - object sets: asset ref, count, mass range, friction, restitution, scale range
  - spawn regions
  - an optional kinematic actor (pushing conveyor, impactor)
  - cameras: pose ranges, intrinsics
  - lights: type, intensity range, colour-temperature range
  - sim duration and capture frames
  - seed count
  - outputs
- Every randomised quantity is a range. A run is fully determined by
  (spec version, seed), which gives the reproducibility from report §3.3 for free.
- **Defer OpenUSD.** The report recommends it internally, but for the MVP
  JSON spec → MJCF (physics) + BlenderProc script (render) is less work. Add
  USD export when CAD import or enterprise interoperability needs it.

### 3.4 Reuse the analytic catalog as physics benchmarks

The existing solvers (free fall, projectile, pendulum, impulse-momentum,
friction on an incline) have closed-form answers. Run the same scenarios
through the MuJoCo adapter in CI and assert agreement within a set tolerance.
That turns "full physics laws" into a regression suite the team can publish
(report §4.2 and §4.3). This is the main thing the current repo contributes
to the new product beyond the app shell.

### 3.5 Keep or drop the educational product?

Recommendation: **freeze it, don't extend it.** Keep it working until the
pivot is decided, but put all new work on the spec pipeline. The two products
share the chat shell and little else.

---

## 4. Agent changes

Replace the file-editing tools with spec tools:

| Tool | Does |
|---|---|
| `get_spec` | Returns the current spec version. |
| `patch_spec` | Applies a JSON patch, validates it against zod and the static checks, and returns the errors so the model can fix them. |
| `run_preview` | Runs one seed at low resolution and returns trajectory stats: did bodies settle, energy drift, penetration depth, objects that left bounds. |
| `estimate_cost` | Gives frames × seeds × resolution → GPU minutes, shown before generation. |
| `start_generation` | Requires user confirmation (human-in-the-loop) and starts the fan-out. |
| `ask_user` | Keep it. |

Rewrite `lib/physics-lab/instructions/*` around the spec. This is a much
smaller prompt than today's runtime and engine API docs.

---

## 5. Data model (via `lib/db/schema.ts` + `npm run db:push`)

- `projects`: replaces `simulations` (title, messages, chat state, owner).
- `scene_specs`: project id, version, spec JSONB, created by (agent or user).
- `jobs`: spec version, kind (preview or generate), seeds, status, Trigger
  run id, cost estimate and actual cost.
- `datasets`: job id, storage prefix, format, frame count, a manifest of
  class names and counts.
- `users` / `org_members`: minimal auth for pilots.

Per AGENTS.md: drop `simulations` before pushing the replacement table so
`db:push` runs unattended.

---

## 6. Build order (about 16 weeks, matching report Phase 1, months 1–4)

| Weeks | Milestone | Done when |
|---|---|---|
| 0–1 | **Cleanup** | Seed path fixed, `lib/games` deleted, aliases removed, tests green. |
| 1–3 | **Spec + physics worker** | Zod spec, MJCF compiler, MuJoCo container returns trajectories. Analytic benchmark suite in CI. |
| 3–5 | **Spec agent + preview** | Chat edits the spec; the browser plays back trajectories with timeline scrubbing and camera orbit. Daytona dropped from the main path. |
| 5–8 | **Render worker** | BlenderProc on a GPU provider renders RGB, masks, depth and boxes for one seed from the same trajectory. Frames and labels land in R2/S3. |
| 8–10 | **Batch + export** | Fan-out over N seeds, a progress UI, a COCO/YOLO zip download, and a dataset page with sample frames and label overlays. |
| 10–12 | **Vertical pack + auth** | One asset pack (boxes, bolts, pallets, shelves, conveyor) with a physical materials table, simple auth, and private projects. |
| 12–16 | **Pilot** | Build the partner's scenario, train a baseline offline (a manual validation loop is fine for Phase 1), and report against the exit criterion. |

Not in Phase 1: the automated validation loop, CAD import, counterfactuals,
world-model export formats, billing, and the public gallery.

---

## 7. Open questions for the founders

1. **GPU provider** for rendering (Modal, RunPod, or something else): affects cost and how the render worker is packaged.
2. **First pilot scenario:** decides which assets, fixtures and labels (boxes vs. masks vs. 6-DoF) to build first.
3. **Freeze or remove** the educational simulation mode.
4. **Object storage:** Cloudflare R2 or S3.
5. **Legal:** employer IP clearance, and Blender/BlenderProc GPL review.

## 8. Main risks for this plan

- **Two new runtimes** (Python physics, GPU Blender) added to a TypeScript-only team. Isolate them behind narrow job contracts: spec + seed in, files out.
- **Preview latency:** if MuJoCo plus the upload round-trip is slower than about 5 s for a typical scene, reduce preview body count or duration before considering a second engine in the browser.
- **The sim-to-real gap is untested** until week 12+. Pull a small manual render-and-train experiment forward to around week 6 using the partner's images.
