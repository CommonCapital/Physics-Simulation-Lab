import type { SimulationModelId } from "./model-catalog"
import { simulationModels } from "./models"

export function simulationModelSettings(modelId: SimulationModelId) {
  return { model: simulationModels[modelId] }
}

// Backward-compatible alias
export const gameModelSettings = simulationModelSettings
