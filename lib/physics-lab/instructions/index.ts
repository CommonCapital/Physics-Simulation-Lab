import type { Instructions } from "ai"

import { engine } from "./engine"
import { runtime } from "./runtime"
import { workflow } from "./workflow"

export const simulationInstructions = [
  { role: "system", content: workflow },
  { role: "system", content: runtime },
  { role: "system", content: engine },
] satisfies Instructions

// Backward-compatible alias
export const gameInstructions = simulationInstructions
