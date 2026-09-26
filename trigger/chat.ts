import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { stepCountIs, streamText } from "ai"
import { z } from "zod"

import type { SimulationModelId } from "@/lib/physics-lab/model-catalog"
import { simulationModelSettings } from "@/lib/physics-lab/agent"
import {
  loadSimulationMessages,
  saveSimulationMessages,
  saveSimulationTurn,
} from "@/lib/physics-lab/chat-store"
import { simulationInstructions } from "@/lib/physics-lab/instructions"
import {
  DEFAULT_SIMULATION_MODEL_ID,
  SIMULATION_MODELS,
} from "@/lib/physics-lab/model-catalog"
import { createSimulationSandbox } from "@/lib/daytona/utils"
import { describeError, elapsed, logger } from "@/lib/observability"
import { createSimulationTools } from "@/lib/physics-lab/tools"
import { priceStep } from "@/lib/billing/pricing"
import { chargeStep } from "@/lib/billing/ledger"

const simulationClientDataSchema = z
  .object({
    modelId: z
      .enum(SIMULATION_MODELS.map((model) => model.id) as [string, ...string[]])
      .optional(),
  })
  .optional()

const MAX_STEPS = 48

/**
 * A simulation's chat thread, run as one long-lived task per conversation.
 *
 * The simulation id is the chat id, so the `simulations` row stays the
 * source of truth for history.
 */
export const simulationChat = chat.agent({
  id: "simulation-chat",
  clientDataSchema: simulationClientDataSchema,
  hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
    const startedAt = performance.now()
    const stored = await loadSimulationMessages(chatId)

    const appended = upsertIncomingMessage(stored, {
      trigger,
      incomingMessages,
    })

    logger.info(logger.fmt`Chat turn starting for simulation ${chatId}`, {
      "simulation.id": chatId,
      "chat.stored_messages": stored.length,
      "chat.incoming_messages": incomingMessages.length,
      "chat.appended_incoming": appended,
      duration_ms: elapsed(startedAt),
    })

    return stored
  },
  onChatStart: async ({ chatId }) => {
    try {
      await createSimulationSandbox(chatId)
    } catch (error) {
      logger.error(
        logger.fmt`Could not create the sandbox for simulation ${chatId}`,
        { "simulation.id": chatId, ...describeError(error) }
      )

      throw error
    }
  },
  onTurnStart: async ({ chatId, uiMessages }) => {
    await saveSimulationMessages({ simulationId: chatId, messages: uiMessages })
  },
  onTurnComplete: async ({
    chatId,
    uiMessages,
    chatAccessToken,
    lastEventId,
    clientData,
  }) => {
    const startedAt = performance.now()

    try {
      await saveSimulationTurn({
        simulationId: chatId,
        messages: uiMessages,
        chatAccessToken,
        chatLastEventId: lastEventId,
      })
    } catch (error) {
      logger.error(
        logger.fmt`Could not persist the finished turn for simulation ${chatId}`,
        {
          "simulation.id": chatId,
          "chat.messages": uiMessages.length,
          "chat.has_cursor": lastEventId !== undefined,
          ...describeError(error),
        }
      )

      throw error
    }

    logger.info(logger.fmt`Chat turn complete for simulation ${chatId}`, {
      "simulation.id": chatId,
      "gen_ai.request.model":
        clientData?.modelId ?? DEFAULT_SIMULATION_MODEL_ID,
      "chat.messages": uiMessages.length,
      "chat.has_cursor": lastEventId !== undefined,
      duration_ms: elapsed(startedAt),
    })
  },
  tools: ({ chatId }) => createSimulationTools(chatId),
  run: async ({ messages, tools, signal, clientData, chatId }) => {
    const modelId = (clientData?.modelId ??
      DEFAULT_SIMULATION_MODEL_ID) as SimulationModelId

    if (messages.at(-1)?.role === "assistant") {
      logger.warn(
        logger.fmt`Skipped a turn with nothing to answer for simulation ${chatId}`,
        {
          "simulation.id": chatId,
          "chat.messages": messages.length,
        }
      )

      return
    }

    return streamText({
      ...chat.toStreamTextOptions({ tools }),
      ...simulationModelSettings(modelId),
      instructions: simulationInstructions,
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(MAX_STEPS),
      onStepEnd: async ({ usage, response }) => {
        try {
          await chargeStep({
            orgId: chatId, // use simulationId as key — billing is per-simulation in open-source mode
            responseId: response.id,
            amount: priceStep({ modelId, usage }),
          })
        } catch (error) {
          logger.error(
            logger.fmt`Could not record step cost for simulation ${chatId}`,
            {
              "simulation.id": chatId,
              "gen_ai.request.model": modelId,
              "gen_ai.response.id": response.id,
              ...describeError(error),
            }
          )
        }
      },
    })
  },
})

// Backward-compatible export so any remaining references to gameChat still compile.
export const gameChat = simulationChat
