import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { connectAdminSocket } from '@/lib/socket'

/**
 * Live toasts for new quotes & chat escalations while an admin is signed in.
 */
export function useLiveAlerts(enabled: boolean) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

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
          onClick: () => navigate('/inbox'),
        },
      })
      if (payload.conversationId) {
        void queryClient.invalidateQueries({
          queryKey: ['messages', payload.conversationId],
        })
      }
    }

    socket.on('quote:new', onQuote)
    socket.on('conversation:escalated', onEscalated)

    return () => {
      socket.off('quote:new', onQuote)
      socket.off('conversation:escalated', onEscalated)
    }
  }, [enabled, navigate, queryClient])
}
