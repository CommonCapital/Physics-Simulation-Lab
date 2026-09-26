import { GAME_DIR, PREVIEW_PORT } from "@/lib/daytona/utils"

/**
 * The sandbox the simulation is built in and served from.
 *
 * The directory and port are the ones `@/lib/daytona/utils` actually creates
 * and serves, interpolated rather than restated, so the agent can't be told
 * about a layout the sandbox doesn't have.
 *
 * The seeded tree is whatever is under `@/lib/games/runtime`, walked and
 * uploaded wholesale by `@/lib/games/seed`, so a module added there arrives in
 * every sandbox — but only the parts described here are ones the agent will
 * think to use. Keep this list in step with that directory.
 */
export const runtime = `# Where the simulation lives

Each simulation has its own Linux sandbox, and it is the same sandbox for the
whole conversation — what you wrote on an earlier turn is still on disk.

The source lives in ${GAME_DIR}. That directory is the simulation: nothing
outside it is served, and nothing that isn't a file in it survives the turn.

${GAME_DIR}/index.html is the entry point — it is what loads at "/", so it has
to exist and has to be the running simulation.

# What is already there

A new sandbox is not empty. It starts with:

- index.html — the page, carrying the report.js tag and the import map
  described below.
- style.css — a full-bleed canvas, no scrolling, no tap highlights.
- welcome.js — the holding screen. Delete it and its <script> tag on the first
  turn; it is a placeholder, not part of any simulation.
- report.js — the error reporter. It catches whatever the page throws and hands
  it to the preview panel, which is how a page that fails to start says so
  instead of showing a black frame. Don't edit it, don't delete it, don't
  repurpose it, and don't write your own file of that name. Leave its <script>
  tag exactly where it is: first in index.html, above the import map and above
  every other script, and plain rather than type="module". A reporter that
  loads after the file that broke reports nothing.
- simulation/ — the solvers, the scientific utilities and the report UI. This
  is where results come from.
- engine/ — a three.js rendering and interaction toolkit, described in its own
  section. It draws pictures. It never produces a result.

Do not rewrite anything under simulation/ or engine/. They are shared ground:
a turn that edits them is a turn whose successor starts by re-reading a
toolkit that no longer matches what it was told.

# simulation/ — where every number comes from

Import only what you need from the barrel:

  import {
    // — Classical mechanics —
    solveKinematics1D, solveAngularKinematics, solveProjectileMotion,
    solveFreeFall, solveCircularMotion,
    solveNewtonSecondLaw, solveDragForce, solveFriction,
    solveImpulseMomentum, solveWorkEnergy,
    solveTorque, solveMomentOfInertia,
    solveSimplePendulum, solvePhysicalPendulum, solveSpringMass,
    solveSimplySupportedBeam,
    // — Fluids —
    solveFluidStatics,
    solveContinuity, solveBernoulli, solveHagenPoiseuille,
    solveReynoldsNumber, solveStokesSettling,
    solveDragCoefficient, solveVenturiMeter,
    // — Thermodynamics —
    solveIdealGasProcess, solveThermalExpansion,
    // — Circuits —
    solveOhmLaw, solveRCCircuit, solveRLCircuit, solveRLCCircuit,
    // — Electromagnetism —
    solveCoulombsLaw, solveElectricField, solveCapacitor,
    solveLorentzForce, solveBiotSavart, solveFaradayLaw,
    getMaxwellEquations,
    // — Modern physics —
    solveSpecialRelativity, solvePhotoelectricEffect, solveDeBroglie,
    solveBohrAtom, solveRadioactiveDecay, solveComptonScattering,
    PHYSICAL_CONSTANTS,
    // — Utilities —
    convertUnit, convertTemperature, SUPPORTED_UNITS,
    requireField, assertFiniteNumber, assertPositive,
    assertNonNegative, assertInRange,
    rk4Step, integrateRK4,
    absoluteError, relativeError, conservationDrift,
  } from "./simulation/index.js"

The full API for each solver is in the workflow instructions. Key reminders:
- Every solver accepts { value, unit } quantity objects and returns SI values.
- solveKinematics1D — SUVAT: provide 3 of 5 quantities; derives the rest.
- solveAngularKinematics — rotational SUVAT; provide 3 of 5.
- solveDragForce — "stokes" or "quadratic" model; RK4 trajectory optional.
- solveFriction — flat or inclined plane; isSliding flag in result.
- solveImpulseMomentum — single-body or two-body collision (elastic /
  inelastic / perfectly_inelastic).
- solveTorque — τ = Iα; optional rolling-without-slip.
- solveMomentOfInertia — 8 catalog shapes + parallel-axis theorem.
- solveBernoulli — provide full section 1 + any two of p₂/v₂/h₂.
- solveHagenPoiseuille — laminar pipe flow; warns when Re ≥ 2300.
- solveRLCircuit / solveRLCCircuit — time-domain transients; RK4 for RLC.
- solveCoulombsLaw / solveElectricField / solveCapacitor — electrostatics.
- solveLorentzForce — particle (F = qvB) or wire (F = ILB).
- solveBiotSavart — "loop" (on-axis) or "solenoid" geometry.
- solveSpecialRelativity — v must be < c; outputs γ, p_rel, E_total, KE.
- solveBohrAtom — principalQuantumNumber + optional finalQuantumNumber.
- solveRadioactiveDecay — accepts initialNuclei, initialActivity, or
  initialMass + molarMass.
- PHYSICAL_CONSTANTS — use for c, h, ħ, e, m_e, m_p, k_B, a₀, R_∞.
- convertUnit — multiplicative; convertTemperature — for K/°C/°F.
- A solver refuses bad input by throwing. Catch and show the message.

A solver refuses bad input by throwing. Catch it and show the message in the
report's own validation area; never swallow it and never substitute a value.

# simulation/ui/ — how the result is presented

The shared report UI. Use it rather than hand-rolling markup, so every
simulation discloses the same things in the same order.

  import {
    createSimulationPanel,
    formatQuantity,
  } from "./simulation/ui/index.js"

  const panel = createSimulationPanel({
    title: "Simply supported beam",
    mode: "preliminary-engineering",
  })

createSimulationPanel({ title, mode, container }) returns a panel whose
methods are the sections every simulation owes the reader: inputs(entries),
assumptions(items), physicalModel(text), numericalMethod(text),
results(entries), limitations(items), verification({ status, detail,
evidence }), nextSteps(items). \`mode\` is one of "educational",
"preliminary-engineering" or "conceptual-visualization", and the badge it
draws carries the caveat that goes with it. \`status\` is "unverified",
"partially-verified" or "verified".

Also on the panel: numericField({ label, unit, value, min, max, step, hint,
onChange }) for an accessible, range-checked, unit-carrying input;
plot({ title, axes, series }) for labelled line plots that break rather than
interpolate across invalid samples, and that carry a text alternative and a
data table; and comparison({ fields, baseline, modified }) for a
baseline-versus-modified table whose percentage column is blank, with a
reason, wherever a percentage would not be mathematically valid.

Two of the required disclosures have no method of their own, because they vary
too much in shape. Use section(id, title) for them, which creates a section in
the report's running order and returns a handle with setText, setList,
setQuantities and append:

  panel.section("conditions", "Boundary and initial conditions").setList([...])

Put the boundary and initial conditions there, and put "expert review
required before use" and "physical testing required" in nextSteps, where the
reader is already looking for what to do next.

Standalone equivalents are exported too: createNumericField, createPlot,
createComparisonTable, validateFields, and the pure helpers formatNumber,
formatQuantity, formatPercent, compareScenarios, validateNumericInput.

The panel is its own surface. Do not put results into the engine's HUD, and do
not put score-like decoration into the panel.

# What you write

Keep the layers in separate files. The point is that the science can be read,
and re-read on a later turn, without picking it out of rendering code.

- index.html — the entry point. Keep report.js first, keep the import map, and
  load your own module after both.
- scenario.json — the confirmed specification: objective, every input with its
  unit, geometry, material properties, initial and boundary conditions,
  requested outputs, fidelity, the classification you settled on, and which
  values were defaults the user explicitly accepted. Write it as the answers
  land. Read it at the start of any later turn that touches an input. It is
  the record of what was agreed, and it is what stops a later turn from
  drifting away from it.
- one focused simulation module (./model.js) — reads scenario.json, validates,
  calls the approved solver, and returns SI results. No three.js in this file.
- the presentation code (./view.js, and ./scene.js if there is a 3D view) —
  builds the panel from simulation/ui/, renders the solved values, and drives
  three.js from them. Results flow one way, from the model into the view.

Name your own files anything sensible, with one exception: report.js is taken.

If it grows, split it further alongside these rather than letting one file
sprawl — you will be reading this code back on every later turn.

# How it reaches the user

A static file server is already running on port ${PREVIEW_PORT} against that
directory, and the preview panel loads it in an iframe. You never start,
restart or configure a server; one is running before your first turn, and a
second one on that port would only fail to bind.

Files are served exactly as they are written, straight from disk, per request.
There is no build step, no bundler, no transpiler and no package install, and
nothing to restart after an edit — a saved file is live on the next reload.

That means the browser has to understand what you write:

- HTML, CSS and JavaScript that runs as-is. No TypeScript, no JSX, no SCSS.
- Your own modules load by relative path: "./model.js", "./simulation/index.js".
- Everything runs in the user's browser. There is no backend, no database and
  no server-side code; persistence is localStorage. Load scenario.json with
  fetch from your own module.

# three.js, and the import map

index.html declares an import map, so these two specifiers resolve in the
browser with no bundler:

- "three" — the library itself.
- "three/addons/..." — everything under examples/jsm: OrbitControls,
  GLTFLoader, EffectComposer and the rest.

  import * as THREE from "three"
  import { OrbitControls } from "three/addons/controls/OrbitControls.js"

The map only applies to the document that declares it, so it has to stay in
index.html, above the first module script. If you rewrite index.html, carry it
across — along with the report.js tag above it — because without the map every
import of "three" fails and the screen stays blank, including every file under
engine/.

Any other library has to come from a CDN by full url, loaded by the page. There
is no physics, FEA or CFD library in the sandbox, and fetching one from a CDN
does not make its results approved: the catalog in simulation/ is the whole of
what may be presented as computed.

# Assets

Beyond three.js there is no art and no audio in the sandbox, so a path to an
image you didn't create is a broken image. Build geometry in code
(engine/models.js), draw textures to a canvas (engine/materials.js). Reach for
a CDN url only when you are certain of it.`
