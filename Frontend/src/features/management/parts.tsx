import { ArrowDown, ArrowUp, Ban, CircleHelp, Clock, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  EXPANDABLE,
  formatPercent,
  type CommodityClass,
  type PortfolioSite,
  type TankStatus,
} from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SourceBadge } from '../dataSource/SourceBadge.tsx'
import { HoverTarget } from './HoverCard.tsx'
import { Count } from './motion.tsx'
import { useViewOptions } from './viewOptions.ts'
import type { Messages } from '../../i18n/messages.ts'

export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

const CLASS_LABEL: Record<CommodityClass, keyof Messages> = {
  cpo: 'mgClassCpo',
  refined: 'mgClassRefined',
  pfad: 'mgClassPfad',
  pome: 'mgClassPome',
  pkfad: 'mgClassPkfad',
  rpome: 'mgClassRpome',
  fame: 'mgClassFame',
  glycerin: 'mgClassGlycerin',
  limbah: 'mgClassLimbah',
  chemical: 'mgClassChemical',
  sludge: 'mgClassSludge',
  cpko: 'mgClassCpko',
  other: 'mgClassOther',
}

const STATUS_LABEL: Record<TankStatus, keyof Messages> = {
  ok: 'mgStOk',
  'near-full': 'mgStNearFull',
  over: 'mgStOver',
  empty: 'mgStEmpty',
  'no-data': 'mgStNoData',
}

export function useClassLabel(): (code: CommodityClass) => string {
  const { t } = useLocale()
  return (code) => t[CLASS_LABEL[code]]
}

/** A class is told apart by a swatch and its name, never by colour alone. */
export function ClassDot({ code }: { code: CommodityClass }) {
  return <i className={`mg-dot mg-c--${code}`} aria-hidden="true" />
}

export function StatusChip({ status }: { status: TankStatus }) {
  const { t } = useLocale()
  const icon =
    status === 'near-full' || status === 'over' ? <TriangleAlert size={12} aria-hidden="true" />
    : status === 'empty' ? <Ban size={12} aria-hidden="true" />
    : status === 'no-data' ? <CircleHelp size={12} aria-hidden="true" />
    : null
  return (
    <span className={`mg-chip mg-chip--${status}`}>
      {icon}
      {t[STATUS_LABEL[status]]}
    </span>
  )
}

/**
 * Stock against capacity. The track is the capacity and its length is relative to the biggest row,
 * so rows compare in size as well as in fill. The tick marks where "near full" starts.
 */
export function StockBar({
  quantityKg,
  capacityTotalKg,
  scaleMax,
  tick,
}: {
  quantityKg: number
  capacityTotalKg: number
  scaleMax: number
  tick?: number
}) {
  const track = scaleMax > 0 ? Math.max(2, (capacityTotalKg / scaleMax) * 100) : 0
  const stock = capacityTotalKg > 0 ? Math.min(100, (quantityKg / capacityTotalKg) * 100) : 0
  return (
    <div className="mg-bar" aria-hidden="true">
      <div className="mg-bar__track" style={{ width: `${track}%` }}>
        <div className="mg-bar__fill" style={{ width: `${stock}%` }} />
        {tick != null ? <span className="mg-bar__tick" style={{ left: `${tick * 100}%` }} /> : null}
      </div>
    </div>
  )
}

function relative(locale: string, at: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000))
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (minutes < 60) return formatter.format(-minutes, 'minute')
  if (minutes < 60 * 48) return formatter.format(-Math.round(minutes / 60), 'hour')
  return formatter.format(-Math.round(minutes / 1440), 'day')
}

function dayText(locale: string, day: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
}

/** Where a site's numbers come from and how old they are, so a stale site is never read as current. */
export function DataBadge({ site }: { site: Pick<PortfolioSite, 'kind' | 'asOf' | 'stale'> }) {
  const { t, locale } = useLocale()
  if (!site.asOf) return <span className="mg-data mg-data--stale">{t.mgOldData}</span>
  if (site.kind === 'live') {
    const text = relative(locale, site.asOf)
    return (
      <span className={site.stale ? 'mg-data mg-data--stale' : 'mg-data mg-data--live'} title={new Date(site.asOf).toLocaleString(locale)}>
        <i aria-hidden="true" />
        {site.stale ? `${t.lastReading} ${text}` : `${t.liveLabel} · ${text}`}
      </span>
    )
  }
  const text = dayText(locale, site.asOf)
  return (
    <span className={site.stale ? 'mg-data mg-data--stale' : 'mg-data'}>
      <i aria-hidden="true" />
      {site.stale ? `${t.mgOldData} · ${text}` : `${t.mgRounds} · ${text}`}
    </span>
  )
}

/** The current time, refreshed every minute, so an age on screen keeps counting. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/**
 * Where a site's figures come from and how old they are, in the space of an icon and a few characters:
 * the source as an icon, then a clock and "3h ago". Green while a gauge is live, amber when it is old.
 * The full text is the tooltip.
 */
export function DataStamp({ site }: { site: Pick<PortfolioSite, 'kind' | 'asOf' | 'stale' | 'source'> }) {
  const { t, locale } = useLocale()
  const now = useNow()
  if (!site.asOf) return <SourceBadge source={site.source} compact />
  let text: string
  if (site.kind === 'live') {
    const minutes = Math.max(0, Math.round((now - new Date(site.asOf).getTime()) / 60000))
    text =
      minutes < 60 ? fill(t.mgAgoMin, { n: minutes })
      : minutes < 60 * 48 ? fill(t.mgAgoHour, { n: Math.round(minutes / 60) })
      : fill(t.mgAgoDay, { n: Math.round(minutes / 1440) })
  } else {
    const days = Math.floor((now - new Date(`${site.asOf}T12:00:00Z`).getTime()) / 86400000)
    text = days <= 0 ? t.mgAgoToday : fill(t.mgAgoDay, { n: days })
  }
  const name = site.source === 'atg' ? t.dsAtg : t.dsLogsheet
  const exact = site.kind === 'live' ? new Date(site.asOf).toLocaleString(locale) : dayText(locale, site.asOf)
  const tone = site.stale ? 'is-stale' : site.kind === 'live' ? 'is-live' : ''
  return (
    <span className="mg-stamp" title={`${name} · ${exact}`}>
      <SourceBadge source={site.source} compact />
      <span className={`mg-stamp__age ${tone}`}>
        <Clock size={12} aria-hidden="true" />
        {text}
      </span>
    </span>
  )
}

/** A change in tonnes with an arrow. Up is not good or bad for stock, so it is not coloured as such. */
export function Change({ kg }: { kg: number | null }) {
  const { locale } = useLocale()
  if (kg == null) return <span className="mg-muted">—</span>
  const rounded = Math.round(kg / 1000)
  const Arrow = rounded > 0 ? ArrowUp : rounded < 0 ? ArrowDown : null
  return (
    <span className="mg-change">
      {Arrow ? <Arrow size={12} aria-hidden="true" /> : null}
      {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(rounded))} t
    </span>
  )
}

export function FillText({ ratio }: { ratio: number | null }) {
  const { locale } = useLocale()
  return ratio == null ? <>—</> : <Count value={ratio} format={(n) => formatPercent(n, locale)} />
}

export function Kpi({
  label,
  value,
  unit,
  note,
  count,
  card,
}: {
  label: string
  value: string
  unit?: string
  note?: ReactNode
  count?: { value: number; format: (value: number) => string }
  /** The detail behind the figure, opened on hover or keyboard focus. */
  card?: (hide: () => void) => ReactNode
}) {
  const body = (
    <>
      <span className="mg-kpi__label">{label}</span>
      <span className="mg-kpi__value">
        {count ? <Count value={count.value} format={count.format} /> : value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {note ? <span className="mg-kpi__note">{note}</span> : null}
    </>
  )
  return card ? (
    <HoverTarget className="mg-kpi mg-kpi--card" cardKey={`kpi-${label}`} label={label} card={card}>
      {body}
    </HoverTarget>
  ) : (
    <div className="mg-kpi">{body}</div>
  )
}

/**
 * The commodity classes as a legend. Hovering or focusing one dims the others everywhere on the page,
 * and picking one opens that commodity across the sites, so the legend is also a way in.
 */
export function Legend({
  classes,
  onHighlight,
  onPick,
}: {
  classes: readonly CommodityClass[]
  onHighlight: (code: CommodityClass | null) => void
  onPick: (code: CommodityClass) => void
}) {
  const label = useClassLabel()
  const { t } = useLocale()
  const { split, toggleSplit } = useViewOptions()
  if (classes.length === 0) return null
  return (
    <ul className="mg-legend mg-noprint" aria-label="Commodity">
      {classes.map((code) => (
        <li key={code}>
          <button
            type="button"
            className="mg-legend__item"
            data-class={code}
            onMouseEnter={() => onHighlight(code)}
            onMouseLeave={() => onHighlight(null)}
            onFocus={() => onHighlight(code)}
            onBlur={() => onHighlight(null)}
            onClick={() => onPick(code)}
          >
            <ClassDot code={code} /> {label(code)}
          </button>
        </li>
      ))}
      {classes.some((code) => EXPANDABLE.has(code)) ? (
        <li className="mg-legend__split">
          <span>{t.mgSplitLabel}</span>
          <span className="mg-segmented" role="group" aria-label={t.mgSplitLabel}>
            <button type="button" aria-pressed={!split} onClick={() => split && toggleSplit()}>
              {t.mgSplitGrouped}
            </button>
            <button type="button" aria-pressed={split} onClick={() => !split && toggleSplit()}>
              {t.mgSplitProducts}
            </button>
          </span>
        </li>
      ) : null}
    </ul>
  )
}

/** Grey blocks in the shape of the page while it loads, so the layout does not jump when data arrives. */
export function Skeleton() {
  return (
    <div className="mg-skel" aria-busy="true" aria-live="polite">
      <span className="mg-skel__line mg-skel__line--wide" />
      <div className="mg-skel__kpis">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="mg-skel__block" />
        ))}
      </div>
      <span className="mg-skel__panel" />
      <span className="mg-skel__panel mg-skel__panel--tall" />
    </div>
  )
}
