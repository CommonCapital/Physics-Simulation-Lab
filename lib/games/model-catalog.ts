// Redirect shim — canonical location is lib/physics-lab/model-catalog.ts
export {
  SIMULATION_MODELS,
  SIMULATION_MODELS as GAME_MODELS,
  DEFAULT_SIMULATION_MODEL_ID,
  DEFAULT_SIMULATION_MODEL_ID as DEFAULT_GAME_MODEL_ID,
  isSimulationModelId,
  isSimulationModelId as isGameModelId,
} from "@/lib/physics-lab/model-catalog"
export type {
  SimulationModelId,
  SimulationModelId as GameModelId,
} from "@/lib/physics-lab/model-catalog"
