import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type DateRangePickerProps = {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  className?: string
  placeholder?: string
}

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = 'Pick a date range',
}: DateRangePickerProps) {
  const [months, setMonths] = useState(1)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setMonths(mq.matches ? 2 : 1)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <div className={cn('grid w-full gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              'h-11 w-full justify-start text-left font-normal md:h-9 md:w-[280px]',
              !value?.from && 'text-muted-foreground'
            )}
          >
            <CalendarIcon />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, 'LLL dd, y')} – {format(value.to, 'LLL dd, y')}
                </>
              ) : (
                format(value.from, 'LLL dd, y')
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={months}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
