import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { connectAdminSocket } from '@/lib/socket'
import { useAuth } from '@/features/auth/auth-context'

function clip(text: string | undefined, max = 100) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned
}

/**
 * Live toasts for new quotes, waiting chats, and claimed-chat replies.
 */
export function useLiveAlerts(enabled: boolean) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { admin } = useAuth()

  useEffect(() => {
    if (!enabled) return

    const socket = connectAdminSocket()

    const onQuote = (payload: {
      quote?: { customerName?: string; pickup?: string; dropoff?: string }
    }) => {
      void queryClient.invalidateQueries({ queryKey: ['quotes'] })
      const q = payload.quote
      const name = q?.customerName?.trim()
      const route =
        q?.pickup && q?.dropoff ? `${q.pickup} → ${q.dropoff}` : null

      toast(name ? `New quote · ${name}` : 'New quote', {
        description: route || 'Open Quotes to review the request.',
        action: {
          label: 'View',
          onClick: () => navigate('/quotes'),
        },
      })
    }

    const onEscalated = (payload: {
      conversationId?: string
      customerName?: string
    }) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      const name = payload.customerName?.trim()
      toast('Chat waiting', {
        description: name
          ? `${name} asked to speak with someone.`
          : 'A customer is waiting for a reply.',
        action: {
          label: 'Open',
          onClick: () =>
            navigate(
              payload.conversationId
                ? `/inbox?c=${payload.conversationId}`
                : '/inbox'
            ),
        },
      })
      if (payload.conversationId) {
        void queryClient.invalidateQueries({
          queryKey: ['messages', payload.conversationId],
        })
      }
    }

    const onCustomerMessage = (payload: {
      conversationId?: string
      assignedAdminId?: string
      preview?: string
      customerName?: string
    }) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (payload.conversationId) {
        void queryClient.invalidateQueries({
          queryKey: ['messages', payload.conversationId],
        })
      }

      const mine =
        payload.assignedAdminId &&
        admin?.id &&
        String(payload.assignedAdminId) === String(admin.id)

      if (!mine) return

      const name = payload.customerName?.trim() || 'Customer'
      const preview = clip(payload.preview)

      toast(`${name} replied`, {
        description: preview || 'Open the chat to read their message.',
        action: {
          label: 'Open',
          onClick: () =>
            navigate(
              payload.conversationId
                ? `/inbox?c=${payload.conversationId}`
                : '/inbox'
            ),
        },
      })
    }

    socket.on('quote:new', onQuote)
    socket.on('conversation:escalated', onEscalated)
    socket.on('conversation:customer_message', onCustomerMessage)

    return () => {
      socket.off('quote:new', onQuote)
      socket.off('conversation:escalated', onEscalated)
      socket.off('conversation:customer_message', onCustomerMessage)
    }
  }, [enabled, navigate, queryClient, admin?.id])
}
