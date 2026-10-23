import { useEffect, useRef, useState } from 'react'
import { periodBounds } from '../domain/format.ts'

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, (day || 1) + days)
  return isoOf(date)
}

/** Last `days` calendar days, ending today, clipped to the data span. */
export function recentWindow(bounds: { start: string; end: string }, days: number): { start: string; end: string } {
  const today = isoOf(new Date())
  const end = today < bounds.start ? bounds.end : today < bounds.end ? today : bounds.end
  const start = addDays(end, -(Math.max(1, days) - 1))
  return { start: start < bounds.start ? bounds.start : start, end }
}

/** Starts on the logsheet span, or the last `recentDays` when that is set, then keeps the user's pick. */
export function usePeriodRange(periodLabel: string | null, recentDays?: number) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const touched = useRef(false)

  useEffect(() => {
    if (touched.current) return
    const bounds = periodBounds(periodLabel)
    if (!bounds) return
    const window = recentDays ? recentWindow(bounds, recentDays) : bounds
    setStart(window.start)
    setEnd(window.end)
  }, [periodLabel, recentDays])

  return {
    start,
    end,
    ready: start !== '' && end !== '',
    onChange: (nextStart: string, nextEnd: string) => {
      touched.current = true
      setStart(nextStart)
      setEnd(nextEnd)
    },
  }
}
