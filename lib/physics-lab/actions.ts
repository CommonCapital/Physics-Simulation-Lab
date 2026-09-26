"use server"

import { anthropic } from "@ai-sdk/anthropic"
import * as Sentry from "@sentry/nextjs"
import { generateText } from "ai"
import { eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { redirect } from "next/navigation"

import { deleteSimulationSandboxes } from "@/lib/daytona/utils"
import { db, simulations } from "@/lib/db"
import { authorizeSimulation } from "@/lib/physics-lab/authorize"
import { endSimulationChatSession } from "@/lib/physics-lab/chat-session"
import { generateMessageId } from "@/lib/physics-lab/messages"
import {
  DEFAULT_SIMULATION_MODEL_ID,
  type SimulationModelId,
  isSimulationModelId,
} from "@/lib/physics-lab/model-catalog"
import { truncateTitle } from "@/lib/physics-lab/title"
import { describeError, elapsed } from "@/lib/observability"

const TITLE_MODEL = "claude-haiku-4-5"

/**
 * Names a simulation after the prompt it was created from.
 */
async function generateTitle(prompt: string) {
  const startedAt = performance.now()

  try {
    const { text } = await generateText({
      model: anthropic(TITLE_MODEL),
      instructions:
        "You name physics simulations from the prompt that created them. " +
        "Reply with a title of at most four words in title case. No quotes, " +
        "no punctuation at the end, no explanation — the title only.",
      prompt,
      maxOutputTokens: 32,
    })

    const title = text.trim().replace(/^["'""]+|["'""]+$/g, "")

    if (!title) {
      Sentry.logger.warn("Title model returned nothing usable", {
        "gen_ai.operation.name": "generate_content",
        "gen_ai.request.model": TITLE_MODEL,
        duration_ms: elapsed(startedAt),
      })
    }

    return title || truncateTitle(prompt)
  } catch (error) {
    Sentry.logger.warn(
      "Title generation failed, falling back to the prompt",
      {
        "gen_ai.operation.name": "generate_content",
        "gen_ai.request.model": TITLE_MODEL,
        ...describeError(error),
        duration_ms: elapsed(startedAt),
      }
    )

    return truncateTitle(prompt)
  }
}

/**
 * Creates a simulation from the composer prompt and navigates to it.
 */
export async function createSimulation(
  prompt: string,
  modelId: SimulationModelId
) {
  const startedAt = performance.now()

  const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : ""

  if (!trimmedPrompt) {
    return
  }

  const model = isSimulationModelId(modelId)
    ? modelId
    : DEFAULT_SIMULATION_MODEL_ID

  const [simulation] = await db
    .insert(simulations)
    .values({
      title: truncateTitle(await generateTitle(trimmedPrompt)),
      messages: [
        {
          id: generateMessageId(),
          role: "user",
          parts: [{ type: "text", text: trimmedPrompt }],
        },
      ],
    })
    .returning({ id: simulations.id })

  Sentry.logger.info(
    Sentry.logger.fmt`Created simulation ${simulation.id}`,
    {
      "app.action": "createSimulation",
      "simulation.id": simulation.id,
      "prompt.length": trimmedPrompt.length,
      "simulation.model": model,
      duration_ms: elapsed(startedAt),
    }
  )

  refresh()

  redirect(
    model === DEFAULT_SIMULATION_MODEL_ID
      ? `/simulations/${simulation.id}`
      : `/simulations/${simulation.id}?model=${model}`
  )
}

/**
 * Renames a simulation.
 */
export async function renameSimulation(simulationId: string, title: string) {
  const { simulation } = await authorizeSimulation(
    simulationId,
    "renameSimulation"
  )

  const trimmed =
    typeof title === "string" ? truncateTitle(title.trim()) : ""

  if (!trimmed || trimmed === simulation.title) {
    return
  }

  await db
    .update(simulations)
    .set({ title: trimmed })
    .where(eq(simulations.id, simulationId))

  Sentry.logger.info(
    Sentry.logger.fmt`Renamed simulation ${simulationId}`,
    {
      "app.action": "renameSimulation",
      "simulation.id": simulationId,
      "title.length": trimmed.length,
    }
  )

  refresh()
}

/**
 * Deletes a simulation, its Daytona sandbox, and its chat session,
 * then returns to the home page if requested.
 */
export async function deleteSimulation(
  simulationId: string,
  returnHome: boolean
) {
  const startedAt = performance.now()
  const { simulation } = await authorizeSimulation(
    simulationId,
    "deleteSimulation"
  )

  await endSimulationChatSession(simulationId)

  const sandboxes = await deleteSimulationSandboxes(
    simulationId,
    simulation.sandboxId
  )

  await db.delete(simulations).where(eq(simulations.id, simulationId))

  try {
    await deleteSimulationSandboxes(simulationId)
  } catch (error) {
    Sentry.logger.error(
      Sentry.logger.fmt`Could not sweep sandboxes after deleting simulation ${simulationId}`,
      {
        "app.action": "deleteSimulation",
        "simulation.id": simulationId,
        ...describeError(error),
      }
    )
  }

  Sentry.logger.info(
    Sentry.logger.fmt`Deleted simulation ${simulationId}`,
    {
      "app.action": "deleteSimulation",
      "simulation.id": simulationId,
      "sandbox.deleted": sandboxes,
      duration_ms: elapsed(startedAt),
    }
  )

  refresh()

  if (returnHome) {
    redirect("/")
  }
}
