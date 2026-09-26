import "server-only"

import * as Sentry from "@sentry/nextjs"
import { runs, sessions } from "@trigger.dev/sdk"

import { describeError } from "@/lib/observability"

/**
 * Ends a simulation's chat session and whatever run it has going.
 */
export async function endSimulationChatSession(
  simulationId: string
): Promise<void> {
  let currentRunId: string | null | undefined

  try {
    ;({ currentRunId } = await sessions.retrieve(simulationId))
  } catch (error) {
    Sentry.logger.debug(
      Sentry.logger.fmt`No chat session to end for simulation ${simulationId}`,
      { "simulation.id": simulationId, ...describeError(error) }
    )

    return
  }

  if (currentRunId) {
    try {
      await runs.cancel(currentRunId)
    } catch (error) {
      Sentry.logger.warn(
        Sentry.logger.fmt`Could not cancel run ${currentRunId} of deleted simulation ${simulationId}`,
        {
          "simulation.id": simulationId,
          "run.id": currentRunId,
          ...describeError(error),
        }
      )
    }
  }

  try {
    await sessions.close(simulationId, { reason: "simulation deleted" })
  } catch (error) {
    Sentry.logger.warn(
      Sentry.logger.fmt`Could not close the chat session of deleted simulation ${simulationId}`,
      { "simulation.id": simulationId, ...describeError(error) }
    )
  }
}
