import * as Sentry from "@sentry/nextjs"

import {
  PREVIEW_PORT,
  PREVIEW_URL_TTL_SECONDS,
  startGameServer,
} from "@/lib/daytona/utils"
import { getSimulation } from "@/lib/physics-lab/queries"
import { elapsed } from "@/lib/observability"

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const startedAt = performance.now()
  const { id } = await ctx.params

  Sentry.getIsolationScope().setTags({
    "app.route": "GET /api/simulations/[id]/preview",
    "simulation.id": id,
  })

  const simulation = await getSimulation(id)

  if (!simulation) {
    Sentry.logger.warn(
      Sentry.logger.fmt`Preview requested for simulation ${id}, which does not exist`,
      { "simulation.id": id, "http.response.status_code": 404 }
    )

    return Response.json({ error: "Simulation not found" }, { status: 404 })
  }

  if (!simulation.sandboxId) {
    Sentry.logger.info(
      Sentry.logger.fmt`Preview requested for simulation ${id} before it has a sandbox`,
      { "simulation.id": id, "http.response.status_code": 409 }
    )

    return Response.json(
      { error: "Simulation has no sandbox yet" },
      { status: 409 }
    )
  }

  const { sandbox } = await startGameServer(simulation.sandboxId)
  const { url } = await sandbox.getSignedPreviewUrl(
    PREVIEW_PORT,
    PREVIEW_URL_TTL_SECONDS
  )

  Sentry.logger.info(
    Sentry.logger.fmt`Served preview url for simulation ${id}`,
    {
      "simulation.id": id,
      "sandbox.id": simulation.sandboxId,
      "http.response.status_code": 200,
      duration_ms: elapsed(startedAt),
    }
  )

  return Response.json({ url })
}
