import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from 'next-themes'

export function Toaster({ ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme()
  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      offset={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
      mobileOffset={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
      toastOptions={{
        classNames: {
          toast: 'border shadow-md',
        },
      }}
      {...props}
    />
  )
}
