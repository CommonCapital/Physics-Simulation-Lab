"use server"

import * as Sentry from "@sentry/nextjs"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, type ChatStartSessionParams } from "@trigger.dev/sdk/ai"

import { authorizeSimulation } from "@/lib/physics-lab/authorize"
import { describeError, elapsed } from "@/lib/observability"
import type { simulationChat } from "@/trigger/chat"

const startSession = chat.createStartSessionAction<typeof simulationChat>(
  "simulation-chat"
)

/**
 * Creates the chat session and triggers its first run, then returns a
 * session-scoped token. Idempotent on (environment, chatId).
 */
export async function startSimulationChatSession(
  params: ChatStartSessionParams<typeof simulationChat>
) {
  const startedAt = performance.now()

  await authorizeSimulation(params.chatId, "startSimulationChatSession")

  try {
    const session = await startSession(params)

    Sentry.logger.info(
      Sentry.logger.fmt`Started chat session for simulation ${params.chatId}`,
      { "simulation.id": params.chatId, duration_ms: elapsed(startedAt) }
    )

    return session
  } catch (error) {
    Sentry.logger.error(
      Sentry.logger.fmt`Could not start chat session for simulation ${params.chatId}`,
      {
        "simulation.id": params.chatId,
        ...describeError(error),
        duration_ms: elapsed(startedAt),
      }
    )

    throw error
  }
}

/**
 * Pure mint — the transport calls this on a 401/403 to refresh an expired
 * token. Runs on the server, so `TRIGGER_SECRET_KEY` never reaches the browser.
 */
export async function mintSimulationChatAccessToken(chatId: string) {
  await authorizeSimulation(chatId, "mintSimulationChatAccessToken")

  Sentry.logger.debug(
    Sentry.logger.fmt`Minted a chat access token for simulation ${chatId}`,
    { "simulation.id": chatId }
  )

  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}
