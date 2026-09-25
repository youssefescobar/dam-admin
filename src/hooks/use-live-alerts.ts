import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { connectAdminSocket } from '@/lib/socket'
import { useAuth } from '@/features/auth/auth-context'

/**
 * Live toasts for new quotes, escalations, and claimed-chat customer replies.
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
      const title = q?.customerName ? `New quote · ${q.customerName}` : 'New quote request'
      const body =
        q?.pickup && q?.dropoff ? `${q.pickup} → ${q.dropoff}` : 'Open Quotes to review'
      toast(title, {
        description: body,
        action: {
          label: 'View',
          onClick: () => navigate('/quotes'),
        },
      })
    }

    const onEscalated = (payload: { conversationId?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast('Chat needs you', {
        description: 'A customer is waiting for a human reply.',
        action: {
          label: 'Open inbox',
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

      toast('New message', {
        description: payload.customerName
          ? `${payload.customerName}: ${payload.preview || 'Sent a message'}`
          : payload.preview || 'Customer replied in your chat',
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
