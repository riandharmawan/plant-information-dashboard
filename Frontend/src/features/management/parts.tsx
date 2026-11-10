import { ArrowDown, ArrowUp, Ban, CircleHelp, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  formatPercent,
  type CommodityClass,
  type PortfolioSite,
  type TankStatus,
} from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Count } from './motion.tsx'
import type { Messages } from '../../i18n/messages.ts'

export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template)
}

const CLASS_LABEL: Record<CommodityClass, keyof Messages> = {
  crude: 'mgClassCrude',
  refined: 'mgClassRefined',
  byproduct: 'mgClassByproduct',
  biodiesel: 'mgClassBiodiesel',
  glycerin: 'mgClassGlycerin',
  chemical: 'mgClassChemical',
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
}: {
  label: string
  value: string
  unit?: string
  note?: ReactNode
  count?: { value: number; format: (value: number) => string }
}) {
  return (
    <div className="mg-kpi">
      <span className="mg-kpi__label">{label}</span>
      <span className="mg-kpi__value">
        {count ? <Count value={count.value} format={count.format} /> : value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {note ? <span className="mg-kpi__note">{note}</span> : null}
    </div>
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
