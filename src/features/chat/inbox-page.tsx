import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { connectAdminSocket } from '@/lib/socket'
import { useAuth } from '@/features/auth/auth-context'
import type { ChatMessage, Conversation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

function toThreadMessages(messages: ChatMessage[]): ThreadMessageLike[] {
  return messages
    .filter((m) => m.sender === 'customer' || m.sender === 'ai' || m.sender === 'admin' || m.sender === 'system')
    .map((m) => {
      const role =
        m.sender === 'customer' ? 'user' : m.sender === 'system' ? 'system' : 'assistant'
      return {
        role,
        content: [{ type: 'text', text: m.text }],
        id: m._id,
        createdAt: new Date(m.createdAt),
      } satisfies ThreadMessageLike
    })
}

function ConversationThread({
  conversationId,
  canReply,
}: {
  conversationId: string
  canReply: boolean
}) {
  const queryClient = useQueryClient()
  const { admin } = useAuth()

  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      api<{ conversation: Conversation; messages: ChatMessage[] }>(
        `/conversations/${conversationId}/messages`
      ),
  })

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (messagesQuery.data?.messages) {
      setLocalMessages(messagesQuery.data.messages)
    }
  }, [messagesQuery.data])

  useEffect(() => {
    const socket = connectAdminSocket()
    const onNew = (payload: { sender?: string; text?: string; conversationId?: string }) => {
      if (payload.conversationId && payload.conversationId !== conversationId) return
      if (!payload.text) return
      setLocalMessages((prev) => [
        ...prev,
        {
          _id: `live-${Date.now()}`,
          conversationId,
          sender: (payload.sender as ChatMessage['sender']) || 'system',
          text: payload.text!,
          createdAt: new Date().toISOString(),
        },
      ])
    }
    socket.on('message:new', onNew)
    socket.emit('join:conversation', { conversationId })
    return () => {
      socket.off('message:new', onNew)
    }
  }, [conversationId])

  const sendAdmin = useCallback(
    async (text: string) => {
      const socket = connectAdminSocket()
      await new Promise<void>((resolve, reject) => {
        socket.emit(
          'admin:message',
          { conversationId, adminId: admin?.id, text },
          (ack: { ok?: boolean; error?: string; message?: ChatMessage }) => {
            if (!ack?.ok) {
              reject(new Error(ack?.error || 'Send failed'))
              return
            }
            if (ack.message) {
              setLocalMessages((prev) => [...prev, ack.message!])
            }
            resolve()
          }
        )
      })
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
    [admin?.id, conversationId, queryClient]
  )

  const threadMessages = useMemo(() => toThreadMessages(localMessages), [localMessages])

  const runtime = useExternalStoreRuntime({
    messages: threadMessages,
    convertMessage: (message) => message,
    isRunning: false,
    onNew: async (message) => {
      if (!canReply) {
        toast.error('Claim this conversation before replying')
        throw new Error('Not claimed')
      }
      const text = message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n')
        .trim()
      if (!text) return
      await sendAdmin(text)
    },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full flex-col">
        <ThreadPrimitive.Root className="flex h-full flex-col">
          <ThreadPrimitive.Viewport className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messagesQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading thread…</p>
            )}
            <ThreadPrimitive.Messages
              components={{
                UserMessage: () => (
                  <MessagePrimitive.Root className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                      <MessagePrimitive.Content />
                    </div>
                  </MessagePrimitive.Root>
                ),
                AssistantMessage: () => (
                  <MessagePrimitive.Root className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-md border bg-card px-3 py-2 text-sm">
                      <MessagePrimitive.Content />
                    </div>
                  </MessagePrimitive.Root>
                ),
                SystemMessage: () => (
                  <MessagePrimitive.Root className="flex justify-center">
                    <div className="max-w-[90%] rounded-lg bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
                      <MessagePrimitive.Content />
                    </div>
                  </MessagePrimitive.Root>
                ),
              }}
            />
          </ThreadPrimitive.Viewport>
          <div className="border-t p-3">
            {canReply ? (
              <ComposerPrimitive.Root className="flex gap-2">
                <ComposerPrimitive.Input
                  placeholder="Reply as admin…"
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <ComposerPrimitive.Send asChild>
                  <Button type="button">Send</Button>
                </ComposerPrimitive.Send>
              </ComposerPrimitive.Root>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Claim this conversation to reply as a human agent.
              </p>
            )}
          </div>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  )
}

export function InboxPage() {
  const { admin } = useAuth()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('needs_human')

  const listQuery = useQuery({
    queryKey: ['conversations', statusFilter],
    queryFn: () =>
      api<{ conversations: Conversation[] }>(
        `/conversations?status=${statusFilter}`
      ),
  })

  useEffect(() => {
    const socket = connectAdminSocket()
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
    socket.on('conversation:escalated', refresh)
    socket.on('conversation:claimed', refresh)
    socket.on('conversation:closed', refresh)
    socket.on('quote:new', refresh)
    return () => {
      socket.off('conversation:escalated', refresh)
      socket.off('conversation:claimed', refresh)
      socket.off('conversation:closed', refresh)
      socket.off('quote:new', refresh)
    }
  }, [queryClient])

  const claimMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const socket = connectAdminSocket()
      return new Promise<void>((resolve, reject) => {
        socket.emit('admin:claim', { conversationId }, (ack: { ok?: boolean; error?: string }) => {
          if (!ack?.ok) reject(new Error(ack?.error || 'Claim failed'))
          else resolve()
        })
      })
    },
    onSuccess: (_, conversationId) => {
      toast.success('Conversation claimed')
      setStatusFilter('claimed')
      setSelectedId(conversationId)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const closeMutation = useMutation({
    mutationFn: (conversationId: string) =>
      api<{ conversation: Conversation }>(`/conversations/${conversationId}`, {
        method: 'PATCH',
        body: { status: 'closed' },
      }),
    onSuccess: () => {
      toast.success('Conversation closed')
      setStatusFilter('closed')
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedId] })
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const selected = listQuery.data?.conversations.find((c) => c._id === selectedId)
  const canReply =
    selected?.status === 'claimed' &&
    (!selected.assignedAdminId || String(selected.assignedAdminId) === String(admin?.id))

  return (
    <div className="flex h-[calc(100vh)] min-h-0 flex-1">
      <div className="flex w-80 flex-col border-r">
        <div className="space-y-3 border-b p-4">
          <div>
            <h1 className="text-xl font-semibold">Inbox</h1>
            <p className="text-xs text-muted-foreground">Escalations & claimed chats</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['needs_human', 'claimed', 'ai_handling', 'closed'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                type="button"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'needs_human'
                  ? 'Needs human'
                  : s === 'claimed'
                    ? 'Claimed'
                    : s === 'ai_handling'
                      ? 'AI'
                      : 'Closed'}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {(listQuery.data?.conversations ?? []).map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => setSelectedId(c._id)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  selectedId === c._id ? 'border-primary bg-accent' : 'hover:bg-muted/60'
                )}
              >
                <div className="font-medium">{c.customer?.name || 'Guest'}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.customer?.contact} · {c.status}
                </div>
              </button>
            ))}
            {!listQuery.isLoading && !(listQuery.data?.conversations.length) && (
              <p className="p-4 text-center text-sm text-muted-foreground">No conversations.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedId && selected ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <div className="font-medium">{selected.customer?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.customer?.contact} · {selected.status}
                </div>
              </div>
              <div className="flex gap-2">
                {selected.status === 'needs_human' && (
                  <Button
                    type="button"
                    onClick={() => claimMutation.mutate(selected._id)}
                    disabled={claimMutation.isPending}
                  >
                    Claim
                  </Button>
                )}
                {selected.status !== 'closed' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => closeMutation.mutate(selected._id)}
                    disabled={closeMutation.isPending}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ConversationThread conversationId={selectedId} canReply={Boolean(canReply)} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to open the thread.
          </div>
        )}
      </div>
    </div>
  )
}
