"use client"

import { useState, useTransition } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Button } from "@/components/ui/button"
import { createSimulation } from "@/lib/physics-lab/actions"
import {
  DEFAULT_SIMULATION_MODEL_ID,
  type SimulationModelId,
} from "@/lib/physics-lab/model-catalog"
import { suggestions } from "@/lib/physics-lab/suggestions"

export function NewSimulationComposer() {
  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] = useState<SimulationModelId>(
    DEFAULT_SIMULATION_MODEL_ID
  )
  const [isPending, startTransition] = useTransition()

  function handleSubmit(value: string) {
    startTransition(async () => {
      await createSimulation(value, modelId)
    })
  }

  function handleSuggestion(suggestionPrompt: string) {
    setPrompt(suggestionPrompt)
    handleSubmit(suggestionPrompt)
  }

  return (
    <>
      <ChatComposer
        value={prompt}
        onValueChange={setPrompt}
        onSubmit={handleSubmit}
        modelId={modelId}
        onModelChange={setModelId}
        disabled={isPending}
      />
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.label}
            variant="outline"
            size="sm"
            className="rounded-full font-normal text-muted-foreground"
            disabled={isPending}
            onClick={() => handleSuggestion(suggestion.prompt)}
          >
            <suggestion.icon />
            {suggestion.label}
          </Button>
        ))}
      </div>
    </>
  )
}
