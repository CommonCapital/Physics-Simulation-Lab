"use client"

import { useChat } from "@ai-sdk/react"
import * as Sentry from "@sentry/nextjs"
import type { ChatSessionPersistedState } from "@trigger.dev/sdk/chat"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import type {
  DynamicToolUIPart,
  ToolUIPart,
  UIMessage,
  UIMessageChunk,
} from "ai"
import {
  CheckIcon,
  CircleAlertIcon,
  CircleQuestionMarkIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import { Spinner } from "@/components/ui/spinner"
import {
  mintSimulationChatAccessToken,
  startSimulationChatSession,
} from "@/lib/physics-lab/chat-actions"
import type { SimulationModelId } from "@/lib/physics-lab/model-catalog"
import { describeError } from "@/lib/observability"
import { cn } from "@/lib/utils"
// Type-only: the agent module reaches the server bundle, never the browser.
import type { simulationChat } from "@/trigger/chat"

const ASK_USER = "ask_user"

export function ChatThread({
  simulationId,
  initialMessages,
  initialModelId,
  initialSession,
  onTurnComplete,
}: {
  simulationId: string
  initialMessages: UIMessage[]
  initialModelId: SimulationModelId
  initialSession?: ChatSessionPersistedState
  onTurnComplete: () => void
}) {
  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] =
    useState<SimulationModelId>(initialModelId)

  const clientData = useMemo(() => ({ modelId }), [modelId])

  const transport = useTriggerChatTransport<typeof simulationChat>({
    task: "simulation-chat",
    accessToken: ({ chatId }) => mintSimulationChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startSimulationChatSession({ chatId, clientData }),
    // Merged into every turn's metadata, and handed to `startSession` for the
    // first one, so the agent reads the current pick rather than the one the
    // thread opened on. The agent validates it against the same catalog.
    clientData,
    // What the last turn persisted: the session token and the stream cursor, so
    // a fresh tab reconnects without a round-trip to create a session.
    sessions: initialSession ? { [simulationId]: initialSession } : undefined,
  })

  // The message a resumed stream might be continuing, read once. Only a thread
  // that was already sitting on an agent message when the page rendered has
  // one, and the resume happens on mount, so nothing that arrives later can
  // change the answer.
  const [resumedHeadId] = useState(() => {
    const last = initialMessages.at(-1)

    return last?.role === "assistant" ? last.id : undefined
  })

  // The transport `useChat` actually talks to: the one above, with the chunk
  // that would erase the question the player just answered filtered out of a
  // resumed stream. Everything else passes through untouched, and `handleStop`
  // below still reaches for the real transport, which is where the session
  // lives.
  const chatTransport = useMemo(
    () => ({
      sendMessages: transport.sendMessages,
      reconnectToStream: async (
        options: Parameters<typeof transport.reconnectToStream>[0]
      ) => {
        const stream = await transport.reconnectToStream(options)

        return stream && resumedHeadId
          ? stream.pipeThrough(withoutContinuationOf(resumedHeadId))
          : stream
      },
    }),
    [transport, resumedHeadId]
  )

  // Read inside `onError`, which `useChat` holds from the render it was created
  // in — reading `messages` there directly would report the thread as it was
  // when the callback was made rather than when the turn failed.
  const messageCount = useRef(0)

  const {
    messages,
    sendMessage,
    addToolOutput,
    stop: stopStream,
    status,
    error,
  } = useChat({
    id: simulationId,
    messages: initialMessages,
    transport: chatTransport,
    // answering `ask_user` resolves the tool call the paused turn is sitting
    // on, and that answer is only useful to the agent if it goes back — this
    // submits the thread again the moment the last message has no tool call
    // left waiting, so the player never has to press send to be understood.
    //
    // It reads the last *step* only, so an ordinary turn (tool calls, then a
    // closing message) doesn't retrigger itself: that step has no tool calls
    // in it at all.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // Only a game that has already had a turn has a stream to rejoin.
    resume: Boolean(initialSession),
    // The end of the agent's stream is the end of its turn, so this is where
    // the browser learns that `onTurnComplete` has run on the other side and
    // the sandbox now holds the build the turn produced.
    //
    // Called however the turn ended. A turn stopped halfway, or one that died
    // on an error, still leaves every file it wrote on disk — that is what the
    // player is running now, so it is what the preview should show.
    onFinish: onTurnComplete,
    // A turn that dies — the run failing, the transport losing the stream,
    // a token that could not be refreshed — settles the status back to ready
    // and leaves the thread looking like the agent simply had nothing to say.
    // Nothing else in the app sees this: the worker's own failure is logged on
    // its side only when the run itself failed, and a transport error never
    // gets that far.
    onError: (error) => {
      Sentry.logger.error(
        Sentry.logger.fmt`Chat turn failed for simulation ${simulationId}`,
        {
          "simulation.id": simulationId,
          "chat.messages": messageCount.current,
          "chat.resumed": Boolean(initialSession),
          ...describeError(error),
        }
      )

      Sentry.captureException(error, {
        tags: { "simulation.id": simulationId },
      })
    },
  })

  // The balance as of the last server render, so this closes the composer
  // before a turn is attempted rather than after one is refused. It cannot
  // notice a balance emptied by the turn now streaming — `onTurnComplete`
  // refreshes the page, and the agent refuses the next turn regardless.
  useEffect(() => {
    messageCount.current = messages.length
  }, [messages])

  const submittedSimulationId = useRef<string | null>(null)

  useEffect(() => {
    if (submittedSimulationId.current === simulationId) {
      return
    }

    submittedSimulationId.current = simulationId

    if (initialMessages.at(-1)?.role === "user") {
      sendMessage()
    }
  }, [simulationId, initialMessages, sendMessage])

  function handleSubmit(value: string) {
    sendMessage({ text: value })
    setPrompt("")
  }

  // Two halves of one cancel: `stopGeneration` signals the run so the agent
  // aborts its `streamText` (the run itself stays alive for the next message),
  // and `stopStream` settles the local status back to ready. `useChat`'s stop
  // alone never reaches the backend on a resumed stream, which is every stream
  // this thread rejoins after a refresh.
  const handleStop = useCallback(() => {
    void transport.stopGeneration(simulationId)
    stopStream()
  }, [transport, simulationId, stopStream])

  // A question the agent is still waiting on. The turn paused on a tool call
  // with no result, so the thread can only move once that call is answered:
  // anything else sent now would ask the model to carry on from a question it
  // never heard back about. The composer closes until they pick.
  //
  // Only the last message is ever in this state, which is also the only
  // message `addToolOutput` can patch — so it doubles as which card is live.
  const lastMessage = messages.at(-1)
  const pendingQuestion = Boolean(
    lastMessage?.parts.some(
      (part) =>
        isToolUIPart(part) &&
        getToolName(part) === ASK_USER &&
        part.state === "input-available"
    )
  )

  return (
    <div className="flex h-full flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-8">
              {messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message align={message.role === "user" ? "end" : "start"}>
                    {message.role === "assistant" && (
                      <MessageAvatar className="size-8 self-start rounded-lg bg-transparent">
                        <Image
                          src="/logo.svg"
                          alt="Sandbox"
                          width={32}
                          height={32}
                          className="size-8"
                        />
                      </MessageAvatar>
                    )}
                    <MessageContent>
                      <Bubble
                        variant={
                          message.role === "user" ? "secondary" : "ghost"
                        }
                        align={message.role === "user" ? "end" : "start"}
                      >
                        {/* A turn arrives as alternating text and tool parts,
                            one per step, so they stack rather than run together
                            on one line. */}
                        <BubbleContent className="flex flex-col items-start gap-2">
                          {message.parts.map((part, index) => {
                            if (part.type === "text") {
                              return <span key={index}>{part.text}</span>
                            }

                            // The one tool the player answers rather than
                            // the sandbox: it gets a question card, not a
                            // line in the log.
                            if (
                              isToolUIPart(part) &&
                              getToolName(part) === ASK_USER
                            ) {
                              return (
                                <AskUserCard
                                  key={part.toolCallId}
                                  part={part}
                                  // Answerable only on the last message, the
                                  // only one `addToolOutput` writes to. An
                                  // older card is history and renders as such.
                                  onAnswer={
                                    message.id === lastMessage?.id
                                      ? (answer) =>
                                          void addToolOutput({
                                            tool: ASK_USER,
                                            toolCallId: part.toolCallId,
                                            output: answer,
                                          })
                                      : undefined
                                  }
                                />
                              )
                            }

                            // Covers both halves of a call: the part starts as
                            // the tool call and becomes the result in place, so
                            // one marker tracks it from start to finish.
                            if (isToolUIPart(part)) {
                              return (
                                <ToolCallMarker
                                  key={part.toolCallId}
                                  part={part}
                                />
                              )
                            }

                            return null
                          })}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 px-4 pb-4">
        {error ? (
          <Alert>
            <CircleAlertIcon />
            <AlertTitle>That turn didn&apos;t finish</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        <ChatComposer
          value={prompt}
          onValueChange={setPrompt}
          onSubmit={handleSubmit}
          onStop={handleStop}
          modelId={modelId}
          onModelChange={setModelId}
          streaming={status === "submitted" || status === "streaming"}
          disabled={status !== "ready" || pendingQuestion}
          placeholder={
            pendingQuestion
              ? "Answer the question above…"
              : "Ask for a change…"
          }
        />
      </div>
    </div>
  )
}

/**
 * Takes the chunk that would erase a message out of the stream a reload
 * resumes.
 *
 * Answering an `ask_user` question doesn't open a new agent message: the
 * agent carries on writing into the one that asked, so the turn it wakes
 * opens by naming that message's id. A tab that reloads while that turn is
 * running rejoins the stream part way through — from the cursor the *question*
 * was saved at — and the AI SDK reads the id as "this is that message", then
 * swaps the thread's copy for the one it has built out of the stream. That
 * copy starts empty and only ever holds what arrived after the cursor, so the
 * question, and the answer under it, are what the swap drops.
 *
 * Without the id the AI SDK stays on the one it generated itself, so the rest
 * of the turn lands beside the question rather than on top of it. One turn
 * reads as two messages until the next reload takes the merged one back off
 * the row; nothing is lost either way.
 */
function withoutContinuationOf(messageId: string) {
  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === "start" && chunk.messageId === messageId) {
        return
      }

      controller.enqueue(chunk)
    },
  })
}

/** One line per tool call: what the agent is doing to the game, and how it went. */
function ToolCallMarker({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const status = toolCallStatus(part.state)
  const verbs = TOOL_VERBS[getToolName(part)] ?? FALLBACK_VERBS
  const target = toolCallTarget(part.input)

  return (
    <Marker
      className={cn("w-fit", status === "failed" && "text-destructive")}
      // The error text can be a paragraph — the line stays one line, and the
      // detail is a hover away.
      title={part.state === "output-error" ? part.errorText : undefined}
    >
      <MarkerIcon>
        {status === "active" ? (
          <Spinner />
        ) : status === "done" ? (
          <CheckIcon />
        ) : (
          <CircleAlertIcon />
        )}
      </MarkerIcon>
      <MarkerContent>
        {status === "active" ? verbs.active : verbs.done}
        {target && <span className="ml-1 text-foreground">{target}</span>}
        {status === "failed" && " — failed"}
      </MarkerContent>
    </Marker>
  )
}

/**
 * The three states worth showing, out of the seven a tool part moves through.
 *
 * Everything before an output exists — streaming input, a complete call still
 * waiting, an approval round-trip — reads the same way to someone watching:
 * the agent is working on it. A denied call is a call that produced nothing,
 * so it lands with the errors.
 */
function toolCallStatus(
  state: ToolUIPart["state"] | DynamicToolUIPart["state"]
): "active" | "done" | "failed" {
  switch (state) {
    case "output-available":
      return "done"
    case "output-error":
    case "output-denied":
      return "failed"
    default:
      return "active"
  }
}

// Present tense while the call is in flight, past tense once it has landed —
// a finished call reads wrong as a frozen "Reading".
const TOOL_VERBS: Record<string, { active: string; done: string }> = {
  read_file: { active: "Reading", done: "Read" },
  write_file: { active: "Writing", done: "Wrote" },
  replace_text: { active: "Editing", done: "Edited" },
  list_files: { active: "Listing files", done: "Listed files" },
  delete_file: { active: "Deleting", done: "Deleted" },
  [ASK_USER]: { active: "Asking", done: "Asked" },
}

const FALLBACK_VERBS = { active: "Working", done: "Ran tool" }

/**
 * The file a call is about, when it names one.
 *
 * The thread is rendered from untyped `UIMessage`s, so the input arrives as
 * `unknown` — and mid-stream it is a partial object that may not have reached
 * `path` yet, which is the same "no target to show" case as a tool that takes
 * none.
 */
function toolCallTarget(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("path" in input)) {
    return undefined
  }

  const { path } = input as { path?: unknown }

  return typeof path === "string" && path !== "" ? path : undefined
}

const ASK_ITEM = "answer"

const ASK_DIMENSIONS: Record<string, string> = {
  purpose: "the purpose",
  phenomenon: "the physical phenomenon",
  geometry: "the geometry",
  properties: "the physical properties",
  conditions: "the conditions",
  outputs: "the desired outputs",
  fidelity: "the fidelity",
}

const ASK_DIMENSION_KEYS = new Set(Object.keys(ASK_DIMENSIONS))
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

type AskUserChoice = { id: string; label: string; description?: string }

type AskUserQuestion =
  | {
      answerType: "choice"
      dimension: string
      question: string
      options: AskUserChoice[]
    }
  | {
      answerType: "number"
      dimension: string
      question: string
      unit?: string
      minimum?: number
      maximum?: number
    }
  | {
      answerType: "short_text"
      dimension: string
      question: string
      placeholder: string
    }

type AskUserAnswer =
  | { answerType: "choice"; optionId: string; label: string }
  | { answerType: "number"; value: string; unit?: string }
  | { answerType: "short_text"; value: string }

type AskUserAnswerResult = { answer: AskUserAnswer } | { error: string }

function AskUserCard({
  part,
  onAnswer,
}: {
  part: ToolUIPart | DynamicToolUIPart
  onAnswer?: (answer: AskUserAnswer) => void
}) {
  const asked = askUserInput(part.input)

  if (!asked || part.state === "input-streaming") {
    return <ToolCallMarker part={part} />
  }

  if (part.state === "output-error" || part.state === "output-denied") {
    return <ToolCallMarker part={part} />
  }

  const dimension = asked.dimension && ASK_DIMENSIONS[asked.dimension]
  const answered =
    part.state === "output-available" ? askUserAnswer(part.output) : undefined

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Marker>
        <MarkerIcon>
          <CircleQuestionMarkIcon />
        </MarkerIcon>
        <MarkerContent>
          {dimension ? `A question about ${dimension}` : "A question"}
        </MarkerContent>
      </Marker>

      {onAnswer && part.state === "input-available" ? (
        <AskUserQuestionForm question={asked} onAnswer={onAnswer} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-heading text-base leading-snug font-medium text-pretty">
            {asked.question}
          </p>
          <Marker>
            <MarkerIcon>
              {answered ? <CheckIcon /> : <CircleAlertIcon />}
            </MarkerIcon>
            <MarkerContent>
              {answered ? (
                <span className="text-foreground">{answered}</span>
              ) : (
                "Left unanswered"
              )}
            </MarkerContent>
          </Marker>
        </div>
      )}
    </div>
  )
}

function AskUserQuestionForm({
  question,
  onAnswer,
}: {
  question: AskUserQuestion
  onAnswer: (answer: AskUserAnswer) => void
}) {
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = new FormData(event.currentTarget).get(ASK_ITEM)
    const result = askUserAnswerFromValue(
      question,
      typeof value === "string" ? value : ""
    )

    if ("error" in result) {
      setError(result.error)
      return
    }

    onAnswer(result.answer)
  }

  return (
    <Questionnaire
      shortcuts={question.answerType === "choice" ? "letters" : undefined}
      noValidate
      onSubmit={handleSubmit}
    >
      <QuestionnaireItem name={ASK_ITEM} required invalid={Boolean(error)}>
        <QuestionnaireTitle>{question.question}</QuestionnaireTitle>
        {question.answerType === "choice" ? (
          <QuestionnaireChoices>
            {question.options.map((option) => (
              <QuestionnaireChoice key={option.id} value={option.id}>
                {option.label}
                {option.description && (
                  <QuestionnaireChoiceDescription>
                    {option.description}
                  </QuestionnaireChoiceDescription>
                )}
              </QuestionnaireChoice>
            ))}
          </QuestionnaireChoices>
        ) : (
          <>
            {question.answerType === "number" &&
              numberQuestionDescription(question) && (
                <QuestionnaireDescription>
                  {numberQuestionDescription(question)}
                </QuestionnaireDescription>
              )}
            <div className="flex items-center gap-2">
              <QuestionnaireInput
                type="text"
                inputMode={
                  question.answerType === "number" ? "decimal" : "text"
                }
                placeholder={
                  question.answerType === "number"
                    ? "Enter a number"
                    : question.placeholder
                }
                maxLength={
                  question.answerType === "short_text" ? 240 : undefined
                }
                aria-invalid={Boolean(error)}
                autoFocus
              />
              {question.answerType === "number" && question.unit && (
                <span className="shrink-0 text-sm text-muted-foreground">
                  {question.unit}
                </span>
              )}
            </div>
          </>
        )}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        ) : (
          <QuestionnaireError />
        )}
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnaireSubmit size="sm">Continue</QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  )
}

export function askUserAnswerFromValue(
  question: AskUserQuestion,
  value: string
): AskUserAnswerResult {
  if (question.answerType === "choice") {
    const option = question.options.find(({ id }) => id === value)

    return option
      ? {
          answer: {
            answerType: "choice",
            optionId: option.id,
            label: option.label,
          },
        }
      : { error: "Choose an option." }
  }

  if (question.answerType === "short_text") {
    const answer = value.trim()

    return answer
      ? { answer: { answerType: "short_text", value: answer } }
      : { error: "Enter a short answer." }
  }

  const numericText = value.trim()

  if (!NUMBER_PATTERN.test(numericText)) {
    return { error: "Enter a valid number." }
  }

  const numericValue = Number(numericText)

  if (!Number.isFinite(numericValue)) {
    return { error: "Enter a finite number." }
  }

  if (question.minimum !== undefined && numericValue < question.minimum) {
    return {
      error: `Enter a value greater than or equal to ${formatBound(
        question.minimum,
        question.unit
      )}.`,
    }
  }

  if (question.maximum !== undefined && numericValue > question.maximum) {
    return {
      error: `Enter a value less than or equal to ${formatBound(
        question.maximum,
        question.unit
      )}.`,
    }
  }

  return {
    answer: {
      answerType: "number",
      value,
      ...(question.unit ? { unit: question.unit } : {}),
    },
  }
}

function formatBound(value: number, unit?: string) {
  return unit ? `${value} ${unit}` : String(value)
}

function numberQuestionDescription(
  question: Extract<AskUserQuestion, { answerType: "number" }>
) {
  const limits = [
    question.minimum !== undefined ? `minimum ${question.minimum}` : null,
    question.maximum !== undefined ? `maximum ${question.maximum}` : null,
  ].filter(Boolean)
  const parts = [
    question.unit ? `Use ${question.unit}` : null,
    limits.length > 0 ? limits.join(", ") : null,
  ].filter(Boolean)

  return parts.length > 0 ? `${parts.join(" · ")}.` : null
}

export function askUserInput(input: unknown): AskUserQuestion | null {
  if (typeof input !== "object" || input === null) {
    return null
  }

  const { answerType, dimension, question } = input as {
    answerType?: unknown
    dimension?: unknown
    question?: unknown
  }

  if (
    typeof dimension !== "string" ||
    !ASK_DIMENSION_KEYS.has(dimension) ||
    typeof question !== "string" ||
    question === ""
  ) {
    return null
  }

  if (answerType === "choice") {
    const { options } = input as { options?: unknown }
    const parsed = (Array.isArray(options) ? options : []).flatMap(
      (option): AskUserChoice[] => {
        if (typeof option !== "object" || option === null) {
          return []
        }

        const { id, label, description } = option as {
          id?: unknown
          label?: unknown
          description?: unknown
        }

        if (
          typeof id !== "string" ||
          id === "" ||
          typeof label !== "string" ||
          label === ""
        ) {
          return []
        }

        return [
          {
            id,
            label,
            description:
              typeof description === "string" && description !== ""
                ? description
                : undefined,
          },
        ]
      }
    )

    return parsed.length >= 2 && parsed.length <= 4
      ? { answerType, dimension, question, options: parsed }
      : null
  }

  if (answerType === "number") {
    const { unit, minimum, maximum } = input as {
      unit?: unknown
      minimum?: unknown
      maximum?: unknown
    }

    const parsedMinimum = finiteNumber(minimum)
    const parsedMaximum = finiteNumber(maximum)

    if (
      (minimum !== undefined && parsedMinimum === undefined) ||
      (maximum !== undefined && parsedMaximum === undefined) ||
      (parsedMinimum !== undefined &&
        parsedMaximum !== undefined &&
        parsedMinimum > parsedMaximum)
    ) {
      return null
    }

    return {
      answerType,
      dimension,
      question,
      ...(typeof unit === "string" && unit !== "" ? { unit } : {}),
      ...(parsedMinimum !== undefined ? { minimum: parsedMinimum } : {}),
      ...(parsedMaximum !== undefined ? { maximum: parsedMaximum } : {}),
    }
  }

  if (answerType === "short_text") {
    const { placeholder } = input as { placeholder?: unknown }

    return typeof placeholder === "string" &&
      placeholder !== "" &&
      placeholder.length <= 80
      ? { answerType, dimension, question, placeholder }
      : null
  }

  return null
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function askUserAnswer(output: unknown): string | undefined {
  if (typeof output !== "object" || output === null) {
    return undefined
  }

  const { answerType } = output as { answerType?: unknown }

  if (answerType === "choice") {
    const { label } = output as { label?: unknown }

    return typeof label === "string" && label !== "" ? label : undefined
  }

  if (answerType === "number") {
    const { value, unit } = output as { value?: unknown; unit?: unknown }

    if (typeof value !== "string" || value === "") {
      return undefined
    }

    return typeof unit === "string" && unit !== "" ? `${value} ${unit}` : value
  }

  if (answerType === "short_text") {
    const { value } = output as { value?: unknown }

    return typeof value === "string" && value !== "" ? value : undefined
  }

  return undefined
}
