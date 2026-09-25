import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const THRESHOLD = 64
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
 * Vertical scrolls pass through; a drag suppresses the child click.
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
  const offsetRef = useRef(0)
  const openRef = useRef(false)
  const movedRef = useRef(false)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  const applyOffset = (value: number, animate = false) => {
    offsetRef.current = value
    setAnimating(animate)
    setOffset(value)
  }

  const reset = (animate = true) => {
    openRef.current = false
    applyOffset(0, animate)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragging.current = true
    movedRef.current = false
    axisLocked.current = null
    startX.current = e.clientX
    startY.current = e.clientY
    setAnimating(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || disabled) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (!axisLocked.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axisLocked.current = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y'
      if (axisLocked.current === 'y') {
        dragging.current = false
        try {
          e.currentTarget.releasePointerCapture(e.pointerId)
        } catch {
          /* already released */
        }
        return
      }
    }

    if (axisLocked.current !== 'x') return

    e.preventDefault()
    e.stopPropagation()
    movedRef.current = true

    const base = openRef.current ? -MAX_REVEAL : 0
    const next = Math.min(0, Math.max(-MAX_REVEAL, base + dx))
    applyOffset(next, false)
  }

  const finishGesture = () => {
    const wasHorizontal = axisLocked.current === 'x'
    const wasDragging = dragging.current
    dragging.current = false
    axisLocked.current = null

    if (!wasDragging || !wasHorizontal) return

    if (offsetRef.current <= -THRESHOLD) {
      openRef.current = true
      applyOffset(-MAX_REVEAL, true)
    } else {
      reset(true)
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    finishGesture()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-lg select-none', className)}
      data-swipe-open={offset < 0 ? 'true' : 'false'}
    >
      <div
        className="absolute inset-y-0 right-0 z-0 flex w-[88px] items-stretch justify-end"
        aria-hidden={offset === 0}
      >
        <button
          type="button"
          className="flex w-full flex-col items-center justify-center gap-1 bg-destructive px-2 text-xs font-medium text-white"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            reset(false)
            onDelete()
          }}
        >
          <Trash2 className="size-4" />
          {label}
        </button>
      </div>
      <div
        className="relative z-10 bg-card will-change-transform"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: animating ? 'transform 160ms ease-out' : 'none',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={finishGesture}
        onClickCapture={(e) => {
          if (movedRef.current) {
            e.preventDefault()
            e.stopPropagation()
            movedRef.current = false
            return
          }
          if (openRef.current) {
            e.preventDefault()
            e.stopPropagation()
            reset(true)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
