"use client"

import type { ChatSessionPersistedState } from "@trigger.dev/sdk/chat"
import type { UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { ChatPreview } from "@/components/chat-preview"
import { ChatThread } from "@/components/chat-thread"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { SimulationModelId } from "@/lib/physics-lab/model-catalog"

export function SimulationChat({
  simulationId,
  initialMessages,
  initialModelId,
  initialSession,
  sandboxId,
}: {
  simulationId: string
  initialMessages: UIMessage[]
  initialModelId: SimulationModelId
  initialSession?: ChatSessionPersistedState
  sandboxId: string | null
}) {
  const [previewRevision, setPreviewRevision] = useState(0)
  const [hasSandbox, setHasSandbox] = useState(sandboxId !== null)
  const router = useRouter()

  const handleTurnComplete = useCallback(() => {
    setPreviewRevision((revision) => revision + 1)
    setHasSandbox(true)
    router.refresh()
  }, [router])

  const thread = (
    <ChatThread
      simulationId={simulationId}
      initialMessages={initialMessages}
      initialModelId={initialModelId}
      initialSession={initialSession}
      onTurnComplete={handleTurnComplete}
    />
  )

  return (
    <div className="min-h-0 flex-1">
      <ResizablePanelGroup>
        <ResizablePanel
          defaultSize="40"
          minSize="25"
          className="flex h-full flex-col"
        >
          {thread}
        </ResizablePanel>
        {hasSandbox && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize="60"
              minSize="30"
              className="flex h-full flex-col"
            >
              <ChatPreview
                key={simulationId}
                simulationId={simulationId}
                revision={previewRevision}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
