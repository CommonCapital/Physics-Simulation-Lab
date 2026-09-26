import { anthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"

import type { SimulationModelId } from "./model-catalog"

export const simulationModels = {
  "claude-opus-5": anthropic("claude-opus-5"),
  "claude-sonnet-5": anthropic("claude-sonnet-5"),
  "claude-haiku-4-5": anthropic("claude-haiku-4-5"),
} satisfies Record<SimulationModelId, LanguageModel>

// Backward-compatible alias
export const gameModels = simulationModels
