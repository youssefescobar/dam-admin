import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const THRESHOLD = 56
const MAX_REVEAL = 80

type SwipeToDeleteProps = {
  children: ReactNode
  onDelete: () => void
  disabled?: boolean
  className?: string
  label?: string
}

/**
 * Swipe left on touch to reveal delete. On desktop, hover the row for a trash control.
 */
export function SwipeToDelete({
  children,
  onDelete,
  disabled,
  className,
  label = 'Delete',
}: SwipeToDeleteProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'x' | 'y' | null>(null)
  const active = useRef(false)
  const offsetRef = useRef(0)
  const openRef = useRef(false)
  const suppressClick = useRef(false)
  const [offset, setOffset] = useState(0)

  const setX = (value: number) => {
    offsetRef.current = value
    setOffset(value)
    const el = trackRef.current
    if (el) el.style.transform = `translate3d(${value}px,0,0)`
  }

  const close = () => {
    openRef.current = false
    setX(0)
  }

  const open = () => {
    openRef.current = true
    setX(-MAX_REVEAL)
  }

  const settle = () => {
    if (offsetRef.current <= -THRESHOLD) open()
    else close()
  }

  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (disabled || e.touches.length !== 1) return
      active.current = true
      axis.current = null
      suppressClick.current = false
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      el.style.transition = 'none'
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!active.current || disabled || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - startX.current
      const dy = e.touches[0].clientY - startY.current

      if (!axis.current) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (axis.current === 'y') {
          active.current = false
          return
        }
      }

      if (axis.current !== 'x') return

      e.preventDefault()
      suppressClick.current = true
      const base = openRef.current ? -MAX_REVEAL : 0
      const next = Math.min(0, Math.max(-MAX_REVEAL, base + dx))
      setX(next)
    }

    const onTouchEnd = () => {
      const wasX = axis.current === 'x'
      active.current = false
      axis.current = null
      if (!wasX) return
      el.style.transition = 'transform 160ms ease-out'
      settle()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [disabled])

  const onDeleteClick = () => {
    close()
    onDelete()
  }

  return (
    <div className={cn('group relative overflow-hidden rounded-lg', className)}>
      <div className="absolute inset-y-0 right-0 z-0 flex w-20 items-stretch">
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className="flex w-full flex-col items-center justify-center gap-1 bg-destructive text-xs font-medium text-destructive-foreground"
          onClick={onDeleteClick}
        >
          <Trash2 className="size-4" />
          {label}
        </button>
      </div>

      <div
        ref={trackRef}
        className="relative z-10 bg-background"
        style={{
          transform: `translate3d(${offset}px,0,0)`,
          touchAction: 'pan-y',
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault()
            e.stopPropagation()
            suppressClick.current = false
            return
          }
          if (openRef.current) {
            e.preventDefault()
            e.stopPropagation()
            const el = trackRef.current
            if (el) el.style.transition = 'transform 160ms ease-out'
            close()
          }
        }}
      >
        <div className="relative">
          {children}
          <button
            type="button"
            disabled={disabled}
            aria-label={label}
            title={label}
            className={cn(
              'absolute top-1/2 right-2 z-20 hidden size-8 -translate-y-1/2 items-center justify-center rounded-md',
              'text-muted-foreground opacity-0 transition-opacity',
              'hover:bg-destructive/10 hover:text-destructive',
              'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'md:inline-flex md:group-hover:opacity-100'
            )}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDeleteClick()
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
