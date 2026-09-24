import { useEffect, useState } from 'react'

/**
 * True when the on-screen keyboard is likely open (iOS/Android PWA).
 * Uses visualViewport shrinkage vs layout viewport.
 */
export function useKeyboardOpen(threshold = 120) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const inset = window.innerHeight - vv.height - vv.offsetTop
      setOpen(inset > threshold)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('focusin', update)
      window.removeEventListener('focusout', update)
    }
  }, [threshold])

  return open
}
