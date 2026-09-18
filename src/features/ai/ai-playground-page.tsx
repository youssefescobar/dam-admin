import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ErrorPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from '@assistant-ui/react'
import { ArrowDownIcon, Bot, RotateCcw, SendHorizonal, Square } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ChatOption = { id: string; label: string }

type ChatReply = {
  conversationId: string
  status: string
  escalated: boolean
  answer: string | null
  reason: string | null
  systemMessage: string | null
  options?: ChatOption[]
}

type SessionMeta = {
  conversationId: string | null
  status: string | null
  escalated: boolean
  options: ChatOption[]
}

function messageText(message: ThreadMessage): string {
  if (message.role !== 'user' && message.role !== 'assistant') return ''
  return message.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function createChatAdapter(
  conversationIdRef: MutableRefObject<string | null>,
  onMeta: (meta: SessionMeta) => void
): ChatModelAdapter {
  return {
    async run({ messages, abortSignal }) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const text = lastUser ? messageText(lastUser) : ''
      if (!text) {
        return { content: [{ type: 'text', text: 'Please pick an option or send a message.' }] }
      }

      try {
        const data = await api<ChatReply>('/chat/message', {
          method: 'POST',
          auth: false,
          signal: abortSignal,
          body: {
            text,
            conversationId: conversationIdRef.current ?? undefined,
            customerName: 'Admin AI Test',
            customerContact: 'ai-test@damic.local',
          },
        })

        conversationIdRef.current = data.conversationId
        onMeta({
          conversationId: data.conversationId,
          status: data.status,
          escalated: data.escalated,
          options: data.options ?? [],
        })

        if (data.escalated) {
          const reason = data.reason ? ` (${data.reason})` : ''
          const handoff =
            data.systemMessage ||
            "I'm connecting you with a team member who can help."
          return {
            content: [
              {
                type: 'text',
                text: `${handoff}\n\nEscalated to human queue${reason}.`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: data.answer?.trim() || '(Empty response)',
            },
          ],
        }
      } catch (err) {
        if (abortSignal.aborted) throw err
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Chat request failed'
        toast.error(message)
        onMeta({
          conversationId: conversationIdRef.current,
          status: null,
          escalated: false,
          options: [],
        })
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          status: { type: 'incomplete', reason: 'error', error: message },
        }
      }
    },
  }
}

function GuidedOptions({ options }: { options: ChatOption[] }) {
  if (!options.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <ThreadPrimitive.Suggestion
          key={opt.id}
          prompt={opt.label}
          send
          className="rounded-full border bg-background px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-accent"
        >
          {opt.label}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  )
}

function AiThread({
  conversationIdRef,
  options,
  onMeta,
}: {
  conversationIdRef: MutableRefObject<string | null>
  options: ChatOption[]
  onMeta: (meta: SessionMeta) => void
}) {
  const adapter = useMemo(
    () => createChatAdapter(conversationIdRef, onMeta),
    [conversationIdRef, onMeta]
  )
  const runtime = useLocalRuntime(adapter)

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <ThreadPrimitive.Viewport className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col px-4 pt-6 pb-4">
            <ThreadPrimitive.Empty>
              <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
                  <Bot className="size-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Guided customer chat
                  </h2>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Tap a topic for instant answers (no AI). Or type a free question
                    for RAG.
                  </p>
                </div>
                <div className="w-full max-w-lg text-left">
                  <GuidedOptions options={options} />
                </div>
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.Messages
              components={{
                UserMessage: () => (
                  <MessagePrimitive.Root className="mb-4 flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
                      <MessagePrimitive.Content />
                    </div>
                  </MessagePrimitive.Root>
                ),
                AssistantMessage: () => (
                  <MessagePrimitive.Root className="mb-4 flex justify-start">
                    <div className="max-w-[85%] space-y-2">
                      <div className="rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                        <MessagePrimitive.Content />
                      </div>
                      <MessagePrimitive.Error>
                        <ErrorPrimitive.Root className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          <ErrorPrimitive.Message />
                        </ErrorPrimitive.Root>
                      </MessagePrimitive.Error>
                    </div>
                  </MessagePrimitive.Root>
                ),
              }}
            />
          </div>
        </ThreadPrimitive.Viewport>

        <div className="shrink-0 border-t bg-background px-4 py-3">
          <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-3">
            <ThreadPrimitive.ScrollToBottom asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="absolute -top-12 left-1/2 size-8 -translate-x-1/2 rounded-full disabled:invisible"
              >
                <ArrowDownIcon className="size-4" />
              </Button>
            </ThreadPrimitive.ScrollToBottom>

            <ThreadPrimitive.If empty={false}>
              <div className="max-h-28 overflow-y-auto">
                <GuidedOptions options={options} />
              </div>
            </ThreadPrimitive.If>

            <ComposerPrimitive.Root className="flex items-end gap-2 rounded-2xl border bg-muted/30 p-2">
              <ComposerPrimitive.Input
                placeholder="Or type a free question…"
                rows={1}
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <ThreadPrimitive.If running={false}>
                <ComposerPrimitive.Send asChild>
                  <Button type="button" size="icon" className="size-9 shrink-0 rounded-full">
                    <SendHorizonal className="size-4" />
                  </Button>
                </ComposerPrimitive.Send>
              </ThreadPrimitive.If>
              <ThreadPrimitive.If running>
                <ComposerPrimitive.Cancel asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-9 shrink-0 rounded-full"
                  >
                    <Square className="size-3.5 fill-current" />
                  </Button>
                </ComposerPrimitive.Cancel>
              </ThreadPrimitive.If>
            </ComposerPrimitive.Root>
          </div>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}

export function AiPlaygroundPage() {
  const conversationIdRef = useRef<string | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [meta, setMeta] = useState<SessionMeta>({
    conversationId: null,
    status: null,
    escalated: false,
    options: [],
  })

  useEffect(() => {
    void api<{ options: ChatOption[] }>('/chat/options', { auth: false })
      .then((data) => {
        setMeta((m) => ({ ...m, options: data.options ?? [] }))
      })
      .catch(() => {
        /* ignore until backend is up */
      })
  }, [sessionKey])

  const onMeta = useCallback((next: SessionMeta) => setMeta(next), [])

  const reset = () => {
    conversationIdRef.current = null
    setMeta({ conversationId: null, status: null, escalated: false, options: [] })
    setSessionKey((k) => k + 1)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">AI playground</h1>
          <p className="text-xs text-muted-foreground">
            DAMAC guided chat + free-text RAG via{' '}
            <code className="rounded bg-muted px-1 py-0.5">POST /chat/message</code>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta.status && (
            <span
              className={cn(
                'hidden rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex',
                meta.escalated
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {meta.status}
              {meta.conversationId ? ` · ${meta.conversationId.slice(-6)}` : null}
            </span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" />
            New chat
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <AiThread
          key={sessionKey}
          conversationIdRef={conversationIdRef}
          options={meta.options}
          onMeta={onMeta}
        />
      </div>
    </div>
  )
}
