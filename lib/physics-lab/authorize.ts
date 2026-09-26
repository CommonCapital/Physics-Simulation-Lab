import "server-only"

import type { Simulation } from "@/lib/db"
import { getSimulation } from "@/lib/physics-lab/queries"

/**
 * The check every action that names a simulation runs first.
 *
 * Returns the row so callers don't need to read it again.
 * Throws "Not Found" when the simulation doesn't exist.
 */
export async function authorizeSimulation(
  simulationId: string,
  _action: string
): Promise<{ simulation: Simulation }> {
  const simulation = await getSimulation(simulationId)

  if (!simulation) {
    throw new Error("Not Found")
  }

  return { simulation }
}
