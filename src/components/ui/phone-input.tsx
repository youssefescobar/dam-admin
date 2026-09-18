import PhoneInput from 'react-phone-number-input'
import type { Value } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { cn } from '@/lib/utils'

type PhoneInputFieldProps = {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export function PhoneInputField({
  value,
  onChange,
  placeholder = 'Enter phone',
  className,
  id,
}: PhoneInputFieldProps) {
  return (
    <PhoneInput
      id={id}
      international
      defaultCountry="US"
      value={(value || undefined) as Value | undefined}
      onChange={(v) => onChange?.(v || '')}
      placeholder={placeholder}
      className={cn(
        'PhoneInput flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-within:ring-2 focus-within:ring-ring',
        className
      )}
    />
  )
}
