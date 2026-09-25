import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject } from 'react'
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
import { ArrowDownIcon, Bot, RotateCcw, SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInputField } from '@/components/ui/phone-input'
import { StatusChip } from '@/components/ui/status-chip'

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

type VisitorIdentity = {
  name: string
  email: string
  phone: string
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
      if (!conversationIdRef.current) {
        return {
          content: [
            {
              type: 'text',
              text: 'Start a session with name, email, and phone first.',
            },
          ],
        }
      }

      try {
        const data = await api<ChatReply>('/chat/message', {
          method: 'POST',
          auth: false,
          signal: abortSignal,
          body: {
            text,
            conversationId: conversationIdRef.current,
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
          const handoff =
            data.systemMessage ||
            "I'm connecting you with a team member who can help."
          return {
            content: [
              {
                type: 'text',
                text: `${handoff}\n\nA human agent has been notified.`,
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
    <div className="flex flex-wrap justify-center gap-2">
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
                    Customer chat preview
                  </h2>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Tap a topic for a quick answer, or type any question to try the
                    assistant.
                  </p>
                </div>
                <div className="w-full max-w-lg">
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



            <ComposerPrimitive.Root className="flex items-end gap-2 rounded-2xl border bg-muted/30 p-2">
              <ComposerPrimitive.Input
                placeholder="Or type a free question…"
                rows={1}
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base outline-none placeholder:text-muted-foreground"
              />
              <ComposerPrimitive.Send asChild>
                <Button type="button" size="icon" className="size-11 shrink-0 rounded-full md:size-9">
                  <SendHorizonal className="size-4" />
                </Button>
              </ComposerPrimitive.Send>
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
  const [ready, setReady] = useState(false)
  const [starting, setStarting] = useState(false)
  const [identity, setIdentity] = useState<VisitorIdentity>({
    name: '',
    email: '',
    phone: '',
  })
  const [meta, setMeta] = useState<SessionMeta>({
    conversationId: null,
    status: null,
    escalated: false,
    options: [],
  })

  useEffect(() => {
    if (!ready) return
    void api<{ options: ChatOption[] }>('/chat/options', { auth: false })
      .then((data) => {
        setMeta((m) => ({ ...m, options: data.options ?? [] }))
      })
      .catch(() => {
        /* ignore until backend is up */
      })
  }, [sessionKey, ready])

  const onMeta = useCallback((next: SessionMeta) => setMeta(next), [])

  const startSession = async (e: FormEvent) => {
    e.preventDefault()
    setStarting(true)
    try {
      const data = await api<{
        conversationId: string
        status: string
        customer: { name: string }
      }>('/chat/session', {
        method: 'POST',
        auth: false,
        body: identity,
      })
      conversationIdRef.current = data.conversationId
      setMeta({
        conversationId: data.conversationId,
        status: data.status,
        escalated: false,
        options: [],
      })
      setReady(true)
      setSessionKey((k) => k + 1)
      toast.success(`Chat started as ${data.customer?.name || identity.name}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Couldn’t start chat')
    } finally {
      setStarting(false)
    }
  }

  const useTestVisitor = () => {
    setIdentity({
      name: 'Test Visitor',
      email: `test-${Date.now()}@damac.local`,
      phone: '+15555550100',
    })
  }

  const reset = () => {
    conversationIdRef.current = null
    setReady(false)
    setMeta({ conversationId: null, status: null, escalated: false, options: [] })
    setSessionKey((k) => k + 1)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">AI chat</h1>
          <p className="text-xs text-muted-foreground">
            Try the customer experience. Identity first, then guided topics or free questions.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta.status ? (
            <StatusChip
              kind="conversation"
              status={meta.escalated ? 'needs_human' : meta.status}
            />
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" />
            New chat
          </Button>
        </div>
      </header>

      {!ready ? (
        <div className="flex flex-1 items-start justify-center overflow-auto p-4 sm:p-8">
          <form
            onSubmit={(e) => void startSession(e)}
            className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-sm"
          >
            <div>
              <h2 className="text-lg font-semibold">Before we chat</h2>
              <p className="text-sm text-muted-foreground">
                Customers must share name, email, and phone so agents can tell them apart.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitor-name">Name</Label>
              <Input
                id="visitor-name"
                required
                value={identity.name}
                onChange={(e) => setIdentity((s) => ({ ...s, name: e.target.value }))}
                placeholder="Jordan Lee"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitor-email">Email</Label>
              <Input
                id="visitor-email"
                type="email"
                required
                value={identity.email}
                onChange={(e) => setIdentity((s) => ({ ...s, email: e.target.value }))}
                placeholder="jordan@example.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visitor-phone">Phone</Label>
              <PhoneInputField
                id="visitor-phone"
                value={identity.phone}
                onChange={(phone) => setIdentity((s) => ({ ...s, phone }))}
                placeholder="Mobile number"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                className="h-11 flex-1 md:h-9"
                disabled={starting || !identity.name.trim() || !identity.email.trim() || !identity.phone.trim()}
              >
                {starting ? 'Starting…' : 'Start chat'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                onClick={useTestVisitor}
              >
                Fill test visitor
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-2.5">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Visitor
              </div>
              <div className="truncate text-sm font-medium">{identity.name}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </div>
              <div className="truncate text-sm">{identity.email}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Phone
              </div>
              <div className="truncate text-sm">{identity.phone || '—'}</div>
            </div>
            {meta.status ? (
              <div className="ms-auto sm:hidden">
                <StatusChip
                  kind="conversation"
                  status={meta.escalated ? 'needs_human' : meta.status}
                />
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <AiThread
              key={sessionKey}
              conversationIdRef={conversationIdRef}
              options={meta.options}
              onMeta={onMeta}
            />
          </div>
        </div>
      )}
    </div>
  )
}
