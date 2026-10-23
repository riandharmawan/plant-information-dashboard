import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { tankLabel } from '../../domain/format.ts'
import { ageAtSnapshot, retestDue, tankFill, type ProductRange, type StorageRow } from '../../domain/qc.ts'
import { RETEST_AFTER_DAYS } from '../../domain/qualitySpec.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { useParam, type ParamCode } from './qcChrome.tsx'

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}

export function ProductPill({ name }: { name: string | null | undefined }) {
  return <span className="qc-product">{name || '-'}</span>
}

export function Identity({ place, product }: { place: ReactNode; product?: string | null }) {
  return (
    <span className="qc-identity">
      <strong>{place}</strong>
      {product !== undefined ? <ProductPill name={product} /> : null}
    </span>
  )
}

export function AgeDot({ age }: { age: number | null }) {
  const { t } = useLocale()
  if (age == null) return <span className="qc-age qc-age--none">-</span>
  const old = age > RETEST_AFTER_DAYS
  return (
    <span className={old ? 'qc-age qc-age--old' : 'qc-age'} title={old ? t.retestDue : t.ageDays}>
      <span className="qc-age__dot" aria-hidden="true" />
      {fill(t.ageDaysShort, { days: age })}
    </span>
  )
}

type BulletContext =
  | { kind: 'limit'; max?: number | null; min?: number | null; tone: 'breach' | 'watch' }
  | { kind: 'range'; range: ProductRange | null; caption: string }

type BulletState = 'ok' | 'breach' | 'watch' | 'neutral' | 'none'

function position(value: number, low: number, high: number): number {
  if (high <= low) return 50
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100))
}

export function Bullet({
  code,
  label,
  value,
  unit,
  context,
}: {
  code: ParamCode
  label: string
  value: number | null
  unit?: string
  context: BulletContext
}) {
  const { t, locale } = useLocale()
  const param = useParam()
  const text = param(code, value)
  const unitText = unit ? ` ${unit}` : ''
  const plain = (limit: number) => limit.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')

  if (context.kind === 'range' && (!context.range || context.range.count < 3)) {
    return (
      <div className="qc-bullet qc-bullet--plain">
        <div className="qc-bullet__head">
          <span className="qc-bullet__label">{label}</span>
          <strong>{text}{value == null ? '' : unitText}</strong>
        </div>
        <p className="qc-bullet__caption">{value == null ? t.notRecorded : t.tooFewToCompare}</p>
      </div>
    )
  }

  let low = 0
  let high = 1
  let bandFrom = 0
  let bandTo = 0
  let tick: number | null = null
  let state: BulletState = 'neutral'
  let caption = ''

  if (context.kind === 'range' && context.range) {
    const span = context.range.high - context.range.low
    const pad = span > 0 ? span * 0.15 : Math.max(Math.abs(context.range.high) * 0.05, 0.01)
    low = Math.min(context.range.low, value ?? context.range.low) - pad
    high = Math.max(context.range.high, value ?? context.range.high) + pad
    bandFrom = context.range.low
    bandTo = context.range.high
    caption = context.caption
  } else if (context.kind === 'limit') {
    const { min, max } = context
    if (min != null && max != null) {
      const span = max - min
      low = Math.min(min - span, value ?? min)
      high = Math.max(max + span, value ?? max)
      bandFrom = min
      bandTo = max
      caption = fill(t.watchBand, { low: plain(min), high: plain(max) })
      if (value != null) state = value < min || value > max ? context.tone : 'ok'
    } else if (max != null) {
      high = Math.max(max * 1.25, (value ?? 0) * 1.05)
      bandFrom = 0
      bandTo = max
      tick = max
      caption = fill(t.contractMax, { value: `${plain(max)}${unitText}` })
      if (value != null) state = value > max ? context.tone : 'ok'
    } else if (min != null) {
      high = Math.max(min * 2, (value ?? 0) * 1.1)
      bandFrom = min
      bandTo = high
      tick = min
      caption = fill(t.floorAbove, { value: plain(min) })
      if (value != null) state = value <= min ? context.tone : 'ok'
    }
  }
  if (value == null) state = 'none'

  const left = position(bandFrom, low, high)
  const width = position(bandTo, low, high) - left
  const showPass = state === 'ok' && context.kind === 'limit' && context.tone === 'breach'
  const statusWord = state === 'breach' ? t.overMax : state === 'watch' ? t.watch : showPass ? t.pass : null
  const aria = `${label} ${value == null ? t.notRecorded : `${text}${unitText}`}, ${caption}${statusWord ? `, ${statusWord}` : ''}`

  return (
    <div className={`qc-bullet qc-bullet--${state}`} role="img" aria-label={aria}>
      <div className="qc-bullet__head">
        <span className="qc-bullet__label">{label}</span>
        <strong>{text}{value == null ? '' : unitText}</strong>
        {state === 'breach' && <span className="badge badge--danger">{statusWord}</span>}
        {state === 'watch' && <span className="badge badge--warning">{statusWord}</span>}
        {showPass && <span className="badge badge--pass">{statusWord}</span>}
      </div>
      <div className="qc-bullet__track" aria-hidden="true">
        <span className="qc-bullet__band" style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }} />
        {tick != null && <span className="qc-bullet__tick" style={{ left: `${position(tick, low, high)}%` }} />}
        {value != null && <span className="qc-bullet__mark" style={{ left: `${position(value, low, high)}%` }} />}
      </div>
      <p className="qc-bullet__caption">{caption}</p>
    </div>
  )
}

export function TankChip({
  tankId,
  row,
  onOpen,
  to,
}: {
  tankId: string
  row: StorageRow
  onOpen?: (tankId: string) => void
  to?: string
}) {
  const { t } = useLocale()
  const param = useParam()
  const ratio = tankFill(row)
  const age = ageAtSnapshot(row.analysisDate, row.snapshotOn)
  const retest = retestDue(row)
  const fillText = ratio == null ? t.unavailable : `${Math.round(ratio * 100)}%`
  const aria = `${tankLabel(tankId)}, ${row.oil || '-'}, FFA ${param('ffa', row.ffa)} %, ${t.tankFill} ${fillText}${retest ? `, ${t.retestDue}` : ''}`
  const body = (
    <>
      <span className="qc-chip__fill" aria-hidden="true" title={`${t.tankFill} ${fillText}`}>
        <span style={{ height: `${ratio == null ? 0 : Math.round(ratio * 100)}%` }} />
      </span>
      <span className="qc-chip__body">
        <strong>{tankLabel(tankId)}</strong>
        <span className="qc-chip__value">FFA {param('ffa', row.ffa)}</span>
      </span>
      <AgeDot age={age} />
    </>
  )
  const className = retest ? 'qc-chip qc-chip--retest' : 'qc-chip'
  if (to) return <Link to={to} className={className} aria-label={aria}>{body}</Link>
  return (
    <button type="button" className={className} aria-label={aria} onClick={() => onOpen?.(tankId)}>
      {body}
    </button>
  )
}

export type FlowStep = {
  kicker: string
  place?: string | null
  product?: string | null
  value?: string | null
}

export function Flow({ steps, label, compact = false }: { steps: FlowStep[]; label: string; compact?: boolean }) {
  return (
    <ol className={compact ? 'qc-flow qc-flow--compact' : 'qc-flow'} aria-label={label}>
      {steps.map((step, index) => (
        <li key={`${step.kicker}-${index}`} className="qc-flow__step">
          <span className="qc-flow__kicker">{step.kicker}</span>
          {step.place !== undefined && <strong className="qc-flow__place">{step.place || '-'}</strong>}
          {step.product !== undefined && <ProductPill name={step.product} />}
          {step.value ? <span className="qc-flow__value">{step.value}</span> : null}
        </li>
      ))}
    </ol>
  )
}

export function Split({ pass, pending, rejected }: { pass: number; pending: number; rejected: number }) {
  const { t } = useLocale()
  const total = pass + pending + rejected
  const share = (count: number) => (total === 0 ? 0 : (count / total) * 100)
  const aria = `${t.pass} ${pass}, ${t.incomplete} ${pending}, ${t.rejected} ${rejected}`
  return (
    <div className="qc-split">
      <div className="qc-split__bar" role="img" aria-label={aria}>
        {total === 0 ? <span className="qc-split__seg qc-split__seg--empty" style={{ width: '100%' }} /> : null}
        <span className="qc-split__seg qc-split__seg--pass" style={{ width: `${share(pass)}%` }} />
        <span className="qc-split__seg qc-split__seg--pending" style={{ width: `${share(pending)}%` }} />
        <span className="qc-split__seg qc-split__seg--rejected" style={{ width: `${share(rejected)}%` }} />
      </div>
      <span className="qc-split__counts">
        <span>{t.pass} {pass}</span>
        <span>{t.incomplete} {pending}</span>
        <span className={rejected > 0 ? 'qc-split__rejected' : undefined}>{t.rejected} {rejected}</span>
      </span>
    </div>
  )
}

export function DirectionTrack({ inbound, outbound, unknown }: { inbound: number; outbound: number; unknown: number }) {
  const { t } = useLocale()
  const total = inbound + outbound + unknown
  const share = (count: number) => (total === 0 ? 0 : (count / total) * 100)
  const aria = `${t.inbound} ${inbound}, ${t.outbound} ${outbound}, ${t.notClassified} ${unknown}`
  return (
    <div className="qc-split">
      <div className="qc-split__bar" role="img" aria-label={aria}>
        <span className="qc-split__seg qc-split__seg--in" style={{ width: `${share(inbound)}%` }} />
        <span className="qc-split__seg qc-split__seg--out" style={{ width: `${share(outbound)}%` }} />
        <span className="qc-split__seg qc-split__seg--pending" style={{ width: `${share(unknown)}%` }} />
      </div>
      <span className="qc-split__counts">
        <span><i className="qc-key qc-key--in" aria-hidden="true" />{t.inbound} {inbound}</span>
        <span><i className="qc-key qc-key--out" aria-hidden="true" />{t.outbound} {outbound}</span>
        <span><i className="qc-key qc-key--pending" aria-hidden="true" />{t.notClassified} {unknown}</span>
      </span>
    </div>
  )
}

export type LegendItem = 'over' | 'watch' | 'retest' | 'nospec' | 'missing'

export function Legend({ items }: { items: LegendItem[] }) {
  const { t } = useLocale()
  if (items.length === 0) return null
  const labels: Record<LegendItem, string> = {
    over: t.overMax,
    watch: t.watch,
    retest: t.retestDue,
    nospec: t.noSpec,
    missing: t.notRecorded,
  }
  return (
    <ul className="qc-legend" aria-label={t.legend}>
      {items.map((item) => (
        <li key={item}>
          <span className={`qc-legend__swatch qc-legend__swatch--${item}`} aria-hidden="true">{item === 'missing' ? '-' : ''}</span>
          {labels[item]}
        </li>
      ))}
    </ul>
  )
}

export function ProductBoard({
  rows,
  slots,
  onOpen,
  linkFor,
  subtitle,
}: {
  rows: StorageRow[]
  slots: number
  onOpen?: (tankId: string) => void
  linkFor?: (tankId: string) => string
  subtitle?: string | null
}) {
  const { t } = useLocale()
  const groups = new Map<string, StorageRow[]>()
  for (const row of rows) {
    const key = row.oil || '-'
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const ordered = [...groups.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
  const empty = Math.max(slots - rows.length, 0)

  return (
    <section className="prod-panel qc-board" aria-label={t.productsInTanks}>
      <h2 className="card__title">{t.productsInTanks}{subtitle ? ` · ${subtitle}` : ''}</h2>
      {ordered.length === 0 ? <p className="empty">{t.noQcRows}</p> : (
        <ul className="qc-board__list">
          {ordered.map(([oil, tanks]) => {
            const retests = tanks.filter(retestDue).length
            const share = rows.length === 0 ? 0 : Math.round((tanks.length / rows.length) * 100)
            return (
              <li key={oil} className="qc-board__row">
                <div className="qc-board__head">
                  <ProductPill name={oil} />
                  <span className="qc-board__track" role="img" aria-label={`${share}%`}>
                    <span style={{ width: `${share}%` }} />
                  </span>
                  <span className="qc-board__count">{tanks.length === 1 ? t.tankCountOne : fill(t.tankCount, { count: tanks.length })}</span>
                  {retests > 0 ? <span className="badge badge--warning">{fill(t.retestCount, { count: retests })}</span> : null}
                </div>
                <div className="qc-board__chips">
                  {[...tanks].sort((left, right) => left.tankId.localeCompare(right.tankId)).map((row) => (
                    <TankChip key={row.tankId} tankId={row.tankId} row={row} onOpen={onOpen} to={linkFor?.(row.tankId)} />
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {empty > 0 ? <p className="page-note qc-board__empty">{fill(t.tanksWithoutResult, { count: empty })}</p> : null}
    </section>
  )
}
