/**
 * The models a simulation can be built with, in the order a picker should offer them.
 *
 * Client-safe on purpose: ids and copy, and nothing that talks to Anthropic.
 */
export const SIMULATION_MODELS = [
  {
    id: "claude-opus-5",
    name: "Opus 5",
    tagline: "Most thorough — best for a new simulation or complex physics.",
  },
  {
    id: "claude-sonnet-5",
    name: "Sonnet 5",
    tagline: "Most of the capability, noticeably faster. Good for iterating.",
  },
  {
    id: "claude-haiku-4-5",
    name: "Haiku 4.5",
    tagline: "Fastest and lowest cost — best for targeted adjustments.",
  },
] as const

export type SimulationModelId = (typeof SIMULATION_MODELS)[number]["id"]

// Keep backward-compatible aliases so any remaining import of the old names
// from lib/physics-lab still compiles.
export const GAME_MODELS = SIMULATION_MODELS
export type GameModelId = SimulationModelId

export const DEFAULT_SIMULATION_MODEL_ID: SimulationModelId = "claude-opus-5"
export const DEFAULT_GAME_MODEL_ID = DEFAULT_SIMULATION_MODEL_ID

export function isSimulationModelId(value: unknown): value is SimulationModelId {
  return SIMULATION_MODELS.some((model) => model.id === value)
}

export const isGameModelId = isSimulationModelId
