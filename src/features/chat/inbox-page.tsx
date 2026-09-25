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
import { useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { connectAdminSocket } from '@/lib/socket'
import { useAuth } from '@/features/auth/auth-context'
import type { ChatMessage, Conversation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ListPanelSkeleton, ThreadSkeleton } from '@/components/loading/skeletons'
import { StatusChip, CONVERSATION_STATUS_LABEL } from '@/components/ui/status-chip'
import { SwipeToDelete } from '@/components/ui/swipe-to-delete'
import { ArrowLeft, MessageCircle } from 'lucide-react'

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
        toast.error('Claim this chat first to reply')
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
      <div className="flex h-full min-h-0 flex-col">
        <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
          <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messagesQuery.isLoading && <ThreadSkeleton />}
            {!messagesQuery.isLoading && (
              <div className="animate-fade-in flex flex-1 flex-col gap-3">
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
              </div>
            )}
          </ThreadPrimitive.Viewport>
          <div className="shrink-0 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
            {canReply ? (
              <ComposerPrimitive.Root className="flex items-end gap-2">
                <ComposerPrimitive.Input
                  placeholder="Reply as admin…"
                  rows={1}
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <ComposerPrimitive.Send asChild>
                  <Button type="button" className="h-11 shrink-0 md:h-9">
                    Send
                  </Button>
                </ComposerPrimitive.Send>
              </ComposerPrimitive.Root>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Claim this chat to reply as a team member.
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
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkId = searchParams.get('c')
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId)
  const [statusFilter, setStatusFilter] = useState('needs_human')

  const listPath =
    statusFilter === 'mine'
      ? '/conversations?mine=1'
      : `/conversations?status=${statusFilter}`

  const listQuery = useQuery({
    queryKey: ['conversations', statusFilter],
    queryFn: () => api<{ conversations: Conversation[] }>(listPath),
  })

  useEffect(() => {
    if (!deepLinkId) return
    setSelectedId(deepLinkId)
  }, [deepLinkId])

  useEffect(() => {
    if (!deepLinkId || !listQuery.data) return
    const found = listQuery.data.conversations.some((c) => c._id === deepLinkId)
    if (found) return
    // Deep-linked chat may be in another filter — still select it via messages fetch
    setSelectedId(deepLinkId)
  }, [deepLinkId, listQuery.data])

  useEffect(() => {
    const socket = connectAdminSocket()
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
    socket.on('conversation:escalated', refresh)
    socket.on('conversation:claimed', refresh)
    socket.on('conversation:closed', refresh)
    socket.on('conversation:deleted', refresh)
    socket.on('conversation:customer_message', refresh)
    socket.on('quote:new', refresh)
    return () => {
      socket.off('conversation:escalated', refresh)
      socket.off('conversation:claimed', refresh)
      socket.off('conversation:closed', refresh)
      socket.off('conversation:deleted', refresh)
      socket.off('conversation:customer_message', refresh)
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
      toast.success('You’re on this chat')
      setStatusFilter('mine')
      setSelectedId(conversationId)
      setSearchParams({ c: conversationId }, { replace: true })
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
      toast.message('Chat closed')
      setStatusFilter('closed')
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (selectedId) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedId] })
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (conversationId: string) =>
      api(`/conversations/${conversationId}`, { method: 'DELETE' }),
    onSuccess: (_, conversationId) => {
      toast.message('Chat deleted')
      if (selectedId === conversationId) {
        setSelectedId(null)
        setSearchParams({}, { replace: true })
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.removeQueries({ queryKey: ['messages', conversationId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const selected = listQuery.data?.conversations.find((c) => c._id === selectedId)
  const canReply =
    selected?.status === 'claimed' &&
    (!selected.assignedAdminId || String(selected.assignedAdminId) === String(admin?.id))

  const filters = ['needs_human', 'mine', 'claimed', 'ai_handling', 'closed'] as const

  const selectConversation = (id: string) => {
    setSelectedId(id)
    setSearchParams({ c: id }, { replace: true })
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          'flex h-full min-h-0 w-full flex-col overflow-hidden border-r md:w-80 md:shrink-0',
          selectedId ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="shrink-0 space-y-3 border-b p-4">
          <div>
            <h1 className="text-xl font-semibold">Inbox</h1>
            <p className="text-xs text-muted-foreground">
              Live chats that need a person. Claim and reply here.
            </p>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((s) => (
              <Button
                key={s}
                size="sm"
                className="h-10 shrink-0 px-3 md:h-8"
                variant={statusFilter === s ? 'default' : 'outline'}
                type="button"
                onClick={() => setStatusFilter(s)}
              >
                {CONVERSATION_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <div className="space-y-1.5 p-2 pb-4">
            {listQuery.isLoading && <ListPanelSkeleton rows={6} />}
            {!listQuery.isLoading &&
              (listQuery.data?.conversations ?? []).map((c) => (
                <SwipeToDelete
                  key={c._id}
                  disabled={deleteMutation.isPending}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Delete chat with ${c.customer?.name || 'this customer'}? This cannot be undone.`
                      )
                    ) {
                      deleteMutation.mutate(c._id)
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => selectConversation(c._id)}
                    className={cn(
                      'w-full border px-3 py-2.5 pr-3 text-left text-sm transition-colors md:pr-10',
                      'rounded-lg bg-card',
                      selectedId === c._id
                        ? 'border-primary bg-accent'
                        : c.status === 'needs_human'
                          ? 'border-orange-200 bg-orange-50/60 hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30'
                          : 'hover:bg-muted/60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {c.hasUnreadCustomerReply ? (
                          <span
                            className="size-2 shrink-0 rounded-full bg-primary"
                            title="New customer reply"
                          />
                        ) : null}
                        <div className="min-w-0 font-medium">
                          {c.customer?.name || 'Guest'}
                        </div>
                      </div>
                      <StatusChip
                        kind="conversation"
                        status={c.status}
                        className="shrink-0"
                      />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.customer?.contact || 'No contact'}
                    </div>
                  </button>
                </SwipeToDelete>
              ))}
            {!listQuery.isLoading && !(listQuery.data?.conversations.length) && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
                <MessageCircle className="size-8 opacity-50" />
                <p className="text-sm font-medium text-foreground">Nothing in this filter</p>
                <p className="text-xs">
                  When a chat needs a human, it lands under “Needs you”.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          selectedId ? 'flex' : 'hidden md:flex'
        )}
      >
        {selectedId && (selected || deepLinkId === selectedId) ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                  aria-label="Back to list"
                  onClick={() => {
                    setSelectedId(null)
                    setSearchParams({}, { replace: true })
                  }}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">
                      {selected?.customer?.name || 'Conversation'}
                    </span>
                    {selected ? (
                      <StatusChip kind="conversation" status={selected.status} />
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {selected?.customer?.contact}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {selected?.status === 'needs_human' && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => claimMutation.mutate(selected._id)}
                    disabled={claimMutation.isPending}
                  >
                    {claimMutation.isPending ? 'Claiming…' : 'Claim chat'}
                  </Button>
                )}
                {selected && selected.status !== 'closed' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => closeMutation.mutate(selected._id)}
                    disabled={closeMutation.isPending}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ConversationThread
                conversationId={selectedId}
                canReply={Boolean(canReply)}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <MessageCircle className="size-10 opacity-40" />
            <p className="text-sm font-medium text-foreground">Select a conversation</p>
            <p className="max-w-xs text-xs">
              Pick a chat on the left to read the thread and reply.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
