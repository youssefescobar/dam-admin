import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from 'next-themes'

export function Toaster({ ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme()
  return <Sonner theme={theme as ToasterProps['theme']} className="toaster group" {...props} />
}
