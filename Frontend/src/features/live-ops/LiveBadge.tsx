import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext.tsx'

/** A reading older than this is shown as stale rather than live. A poll runs every 15 minutes. */
const STALE_MINUTES = 60

function age(at: string, now: number, locale: string): { minutes: number; text: string } {
  const minutes = Math.max(0, Math.round((now - new Date(at).getTime()) / 60000))
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (minutes < 60) return { minutes, text: formatter.format(-minutes, 'minute') }
  if (minutes < 60 * 48) return { minutes, text: formatter.format(-Math.round(minutes / 60), 'hour') }
  return { minutes, text: formatter.format(-Math.round(minutes / 1440), 'day') }
}

/**
 * Says how fresh the gauge readings on screen are. Green while they are recent, amber when the
 * poller seems to have stopped, so a stale screen is never mistaken for a live one.
 */
export function LiveBadge({ readingAt }: { readingAt: string | null }) {
  const { t, locale } = useLocale()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  if (!readingAt) return null
  const { minutes, text } = age(readingAt, now, locale)
  const stale = minutes > STALE_MINUTES
  return (
    <span className={stale ? 'live-badge live-badge--stale' : 'live-badge'} title={new Date(readingAt).toLocaleString(locale)}>
      <i aria-hidden="true" />
      {stale ? `${t.lastReading} ${text}` : `${t.liveLabel} · ${text}`}
    </span>
  )
}
