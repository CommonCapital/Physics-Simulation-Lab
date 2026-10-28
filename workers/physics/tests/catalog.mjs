// Runs one solver from the physics catalog for the Python benchmarks, so they
// compare MuJoCo against the catalog itself rather than a copy of its maths.
//
//   node catalog.mjs '{"solver": "solveFreeFall", "options": {...}}'
//
// Prints the solver's result as JSON. Functions on the result (positionAt and
// the like) are dropped; benchmarks use the sampled values instead.

import * as catalog from "../../../lib/physics-lab/runtime/simulation/index.js"

const { solver, options } = JSON.parse(process.argv[2])

if (typeof catalog[solver] !== "function") {
  console.error(`No solver named ${solver} in the catalog`)
  process.exit(1)
}

process.stdout.write(JSON.stringify(catalog[solver](options)))
