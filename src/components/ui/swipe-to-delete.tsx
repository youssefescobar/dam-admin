import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const THRESHOLD = 72
const MAX_REVEAL = 88

type SwipeToDeleteProps = {
  children: ReactNode
  onDelete: () => void
  disabled?: boolean
  className?: string
  label?: string
}

/**
 * Horizontal swipe reveals a delete action (touch + mouse).
 * Tap children normally when not swiped open.
 */
export function SwipeToDelete({
  children,
  onDelete,
  disabled,
  className,
  label = 'Delete',
}: SwipeToDeleteProps) {
  const startX = useRef(0)
  const startY = useRef(0)
  const dragging = useRef(false)
  const axisLocked = useRef<'x' | 'y' | null>(null)
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState(false)

  const reset = () => {
    setOffset(0)
    setOpen(false)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    dragging.current = true
    axisLocked.current = null
    startX.current = e.clientX
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || disabled) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (!axisLocked.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axisLocked.current === 'y') {
        dragging.current = false
        return
      }
    }

    if (axisLocked.current !== 'x') return
    e.preventDefault()
    const next = Math.min(0, Math.max(-MAX_REVEAL, open ? -MAX_REVEAL + dx : dx))
    setOffset(next)
  }

  const onPointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    if (axisLocked.current !== 'x') {
      axisLocked.current = null
      return
    }
    axisLocked.current = null
    if (offset <= -THRESHOLD) {
      setOffset(-MAX_REVEAL)
      setOpen(true)
    } else {
      reset()
    }
  }

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      <div
        className="absolute inset-y-0 right-0 flex w-[88px] items-stretch justify-end"
        aria-hidden={offset === 0}
      >
        <button
          type="button"
          className="flex w-full flex-col items-center justify-center gap-1 bg-destructive px-2 text-xs font-medium text-white"
          onClick={() => {
            reset()
            onDelete()
          }}
        >
          <Trash2 className="size-4" />
          {label}
        </button>
      </div>
      <div
        className="relative touch-pan-y bg-card transition-transform duration-150 ease-out will-change-transform"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (dragging.current) onPointerUp()
        }}
      >
        {children}
      </div>
    </div>
  )
}
