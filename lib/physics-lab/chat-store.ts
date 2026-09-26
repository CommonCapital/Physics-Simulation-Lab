import type { UIMessage } from "ai"
import { eq } from "drizzle-orm"

// Imported straight from `./client` rather than `@/lib/db`: this module runs
// inside the Trigger.dev worker, where the `server-only` marker on the `@/lib/db`
// entry would throw.
import { db, simulations } from "@/lib/db/client"

/**
 * A simulation's stored chat thread.
 */
export async function loadSimulationMessages(
  simulationId: string
): Promise<UIMessage[]> {
  const [row] = await db
    .select({ messages: simulations.messages })
    .from(simulations)
    .where(eq(simulations.id, simulationId))
    .limit(1)

  return row?.messages ?? []
}

/**
 * Replaces a simulation's chat thread.
 */
export async function saveSimulationMessages({
  simulationId,
  messages,
}: {
  simulationId: string
  messages: UIMessage[]
}): Promise<void> {
  await db
    .update(simulations)
    .set({ messages })
    .where(eq(simulations.id, simulationId))
}

/**
 * Replaces a simulation's chat thread and the stream cursor for it.
 *
 * One statement, so the two can't diverge.
 */
export async function saveSimulationTurn({
  simulationId,
  messages,
  chatAccessToken,
  chatLastEventId,
}: {
  simulationId: string
  messages: UIMessage[]
  chatAccessToken: string
  chatLastEventId: string | undefined
}): Promise<void> {
  await db
    .update(simulations)
    .set({ messages, chatAccessToken, chatLastEventId })
    .where(eq(simulations.id, simulationId))
}
