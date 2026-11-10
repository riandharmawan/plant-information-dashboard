import { useEffect, useRef, useState, type CSSProperties } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Eases a figure toward its target. A refresh moves from where the figure was, not from zero, so a
 * live number glides to its new value. With reduced motion it simply shows the target.
 */
export function useCountUp(target: number, ms = 650): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  const from = useRef(value)
  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = target
      setValue(target)
      return
    }
    const origin = from.current
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = origin + (target - origin) * eased
      from.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])
  return value
}

export function Count({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(useCountUp(value))}</>
}

/** Rows and chips rise in one after another. The delay is capped so a long list is never slow. */
export function stagger(index: number): CSSProperties {
  return { ['--i' as string]: Math.min(index, 12) }
}
