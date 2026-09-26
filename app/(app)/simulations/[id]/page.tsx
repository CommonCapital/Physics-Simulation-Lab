import { notFound } from "next/navigation"

import { getSimulation } from "@/lib/physics-lab/queries"
import { SimulationChat } from "@/components/simulation-chat"
import { SimulationMenu } from "@/components/simulation-menu"
import {
  DEFAULT_SIMULATION_MODEL_ID,
  isSimulationModelId,
} from "@/lib/physics-lab/model-catalog"

export default async function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ model?: string }>
}) {
  const { id } = await params
  const simulation = await getSimulation(id)

  if (!simulation) {
    notFound()
  }

  const { model } = await searchParams

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <span className="truncate font-heading text-sm font-medium">
          {simulation.title}
        </span>
        <SimulationMenu simulationId={simulation.id} title={simulation.title} />
      </header>
      <SimulationChat
        simulationId={simulation.id}
        initialMessages={simulation.messages}
        initialModelId={
          isSimulationModelId(model) ? model : DEFAULT_SIMULATION_MODEL_ID
        }
        sandboxId={simulation.sandboxId}
        initialSession={
          simulation.chatAccessToken
            ? {
                publicAccessToken: simulation.chatAccessToken,
                lastEventId: simulation.chatLastEventId ?? undefined,
              }
            : undefined
        }
      />
    </div>
  )
}
