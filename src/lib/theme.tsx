import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Replaces next-themes, which renders a <script> inside React (React 19 console error).
// Initial paint is handled by the inline script in index.html. Same storage key/values.
type Theme = 'light' | 'dark' | 'system'

const KEY = 'theme'
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
})

const read = (): Theme => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const apply = (t: Theme) => {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(read)

  useEffect(() => {
    apply(theme)
    if (theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* private mode: theme just won't persist */
    }
    setThemeState(t)
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
