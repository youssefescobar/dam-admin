import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { api, downloadPrivateFile } from '@/lib/api'
import { connectAdminSocket, emitWithAck, joinAdminConversation } from '@/lib/socket'
import { useAuth } from '@/features/auth/auth-context'
import type { ChatMessage, Conversation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ListPanelSkeleton, ThreadSkeleton } from '@/components/loading/skeletons'
import { QueryError } from '@/components/ui/query-error'
import { StatusChip } from '@/components/ui/status-chip'
import { CONVERSATION_STATUS_LABEL } from '@/lib/labels'
import { SwipeToDelete } from '@/components/ui/swipe-to-delete'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ArrowLeft, MessageCircle, Paperclip } from 'lucide-react'

const SENDER_LABEL: Record<ChatMessage['sender'], string> = {
  customer: 'Customer',
  ai: 'Durra AI',
  admin: 'Agent',
  system: 'System',
}

/** The server returns at most this many chats per filter. */
const LIST_LIMIT = 100

type Thread = { conversation: Conversation; messages: ChatMessage[] }

/** Add a message to the cached thread unless it's already there (the ack and the room broadcast both deliver it). */
function appendMessage(thread: Thread | undefined, message: ChatMessage): Thread | undefined {
  if (!thread || thread.messages.some((m) => m._id === message._id)) return thread
  return { ...thread, messages: [...thread.messages, message] }
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { sender } = message
  const file = message.attachment
  return (
    <div
      className={cn(
        'flex',
        sender === 'customer' ? 'justify-end' : sender === 'system' ? 'justify-center' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'whitespace-pre-wrap break-words text-sm',
          sender === 'customer' && 'max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground',
          (sender === 'ai' || sender === 'admin') && 'max-w-[80%] rounded-2xl rounded-bl-md border bg-card px-3 py-2',
          sender === 'system' && 'max-w-[90%] rounded-lg bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground'
        )}
        dir="auto"
      >
        <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70">{SENDER_LABEL[sender]}</div>
        {file?.key ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 underline underline-offset-2"
            onClick={() =>
              downloadPrivateFile({ key: file.key, name: file.name || message.text }).catch((err: Error) =>
                toast.error(err.message)
              )
            }
          >
            <Paperclip className="size-3.5 shrink-0" />
            {file.name || message.text}
          </button>
        ) : (
          message.text
        )}
      </div>
    </div>
  )
}

function ConversationThread({
  conversationId,
  canReply,
}: {
  conversationId: string
  canReply: boolean
}) {
  const queryClient = useQueryClient()
  const queryKey = ['messages', conversationId]
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const messagesQuery = useQuery({
    queryKey,
    queryFn: () => api<Thread>(`/conversations/${conversationId}/messages`),
  })
  const messages = messagesQuery.data?.messages

  useEffect(() => {
    const socket = connectAdminSocket()
    const onNew = (payload: {
      sender?: ChatMessage['sender']
      text?: string
      conversationId?: string
      messageId?: string
    }) => {
      // The socket stays in every room this agent opened; only this thread's messages belong here.
      if (payload.conversationId !== conversationId || !payload.text) return
      const message: ChatMessage = {
        _id: payload.messageId || `live-${Date.now()}`,
        conversationId,
        sender: payload.sender || 'system',
        text: payload.text,
        createdAt: new Date().toISOString(),
      }
      queryClient.setQueryData<Thread>(['messages', conversationId], (t) => appendMessage(t, message))
    }
    // After a reconnect, refetch to catch messages sent while the socket was down.
    const onConnect = () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    socket.on('message:new', onNew)
    socket.on('connect', onConnect)
    joinAdminConversation(conversationId)
    return () => {
      socket.off('message:new', onNew)
      socket.off('connect', onConnect)
    }
  }, [conversationId, queryClient])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length])

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const { message } = await emitWithAck<{ ok?: boolean; error?: string; message?: ChatMessage }>(
        'admin:message',
        { conversationId, text }
      )
      if (message) queryClient.setQueryData<Thread>(['messages', conversationId], (t) => appendMessage(t, message))
      setDraft('')
    } catch (err) {
      // Keep the text in the box so the agent can press Send again.
      toast.error(`Not sent: ${(err as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messagesQuery.isLoading ? <ThreadSkeleton /> : null}
        {messagesQuery.isError ? (
          <QueryError error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} />
        ) : null}
        {messages?.map((m) => <MessageBubble key={m._id} message={m} />)}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {canReply ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <textarea
              aria-label="Reply"
              placeholder="Reply as admin…"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" className="h-11 shrink-0 md:h-9" disabled={sending || !draft.trim()}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </form>
        ) : (
          <p className="py-1 text-center text-sm text-muted-foreground">Claim this chat to reply as a team member.</p>
        )}
      </div>
    </div>
  )
}

export function InboxPage() {
  const { admin } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  // The open chat lives in the URL (?c=), so alerts and other pages can link straight to it.
  const selectedId = searchParams.get('c')
  const [statusFilter, setStatusFilter] = useState('needs_human')
  // Stores the conversation ID pending deletion; null = dialog closed.
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  const listPath =
    statusFilter === 'mine'
      ? '/conversations?mine=1'
      : `/conversations?status=${statusFilter}`

  const listQuery = useQuery({
    queryKey: ['conversations', statusFilter],
    queryFn: () => api<{ conversations: Conversation[] }>(listPath),
    // Safety net if the socket is silently down; react-query pauses this in hidden tabs.
    refetchInterval: 20_000,
  })

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
    socket.on('connect', refresh)
    return () => {
      socket.off('connect', refresh)
      socket.off('conversation:escalated', refresh)
      socket.off('conversation:claimed', refresh)
      socket.off('conversation:closed', refresh)
      socket.off('conversation:deleted', refresh)
      socket.off('conversation:customer_message', refresh)
      socket.off('quote:new', refresh)
    }
  }, [queryClient])

  const claimMutation = useMutation({
    mutationFn: (conversationId: string) => emitWithAck('admin:claim', { conversationId }),
    onSuccess: (_, conversationId) => {
      toast.success('You’re on this chat')
      setStatusFilter('mine')
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
        setSearchParams({}, { replace: true })
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.removeQueries({ queryKey: ['messages', conversationId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // A deep-linked chat may sit under another filter; fall back to the thread's own fetch.
  const threadQuery = useQuery({
    queryKey: ['messages', selectedId],
    queryFn: () => api<Thread>(`/conversations/${selectedId}/messages`),
    enabled: Boolean(selectedId),
  })
  const selected =
    listQuery.data?.conversations.find((c) => c._id === selectedId) ??
    (threadQuery.data?.conversation._id === selectedId ? threadQuery.data.conversation : undefined)
  const canReply =
    selected?.status === 'claimed' &&
    (!selected.assignedAdminId || String(selected.assignedAdminId) === String(admin?.id))

  const filters = ['needs_human', 'mine', 'claimed', 'ai_handling', 'closed'] as const

  const selectConversation = (id: string) => {
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
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-hide">
            {filters.map((s) => (
              <Button
                key={s}
                size="sm"
                className="h-8 shrink-0 px-2.5 text-xs md:h-7"
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
            {listQuery.isError && (
              <QueryError error={listQuery.error} onRetry={() => void listQuery.refetch()} />
            )}
            {listQuery.isSuccess &&
              (listQuery.data?.conversations ?? []).map((c) => (
                <SwipeToDelete
                  key={c._id}
                  disabled={deleteMutation.isPending}
                  onDelete={() =>
                    setDeleteConfirm({
                      id: c._id,
                      name: c.customer?.name || 'this customer',
                    })
                  }
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
            {listQuery.isSuccess && listQuery.data.conversations.length >= LIST_LIMIT && (
              <p className="px-2 pt-2 text-center text-[11px] text-muted-foreground">
                Showing the latest {LIST_LIMIT}. Older chats in this filter aren’t listed.
              </p>
            )}
            {listQuery.isSuccess && !listQuery.data.conversations.length && (
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
        {selectedId ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b px-3 py-2.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 md:hidden"
                  aria-label="Back to list"
                  onClick={() => {
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

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title="Delete conversation?"
        description={`Delete chat with ${deleteConfirm?.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id)
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
