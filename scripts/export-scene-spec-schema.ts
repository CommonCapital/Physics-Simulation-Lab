// Writes the scene spec's JSON Schema for the Python workers. With `--check`,
// fails instead if the committed file is out of date.

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { z } from "zod"

import { SceneSpec } from "../lib/scene-spec/schema.ts"

const OUTPUT = path.join(
  import.meta.dirname,
  "..",
  "workers",
  "physics",
  "scene_spec.schema.json"
)

const schema = z.toJSONSchema(SceneSpec, {
  target: "draft-2020-12",
  // Workers receive the spec after `SceneSpec.parse`, defaults filled in, so
  // every field the parse supplies is required here.
  io: "output",
})
const json = `${JSON.stringify(schema, null, 2)}\n`

if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT, "utf8").catch(() => "")

  if (current !== json) {
    console.error(
      `${path.relative(process.cwd(), OUTPUT)} is out of date. Run: npm run spec:schema`
    )
    process.exit(1)
  }
} else {
  await writeFile(OUTPUT, json)
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`)
}
