import { ChevronRight } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CLASS_ORDER,
  compareTankIds,
  formatPercent,
  formatTonnes,
  type ClassTotals,
  type CommodityClass,
  type PortfolioSite,
  type TankStatus,
} from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { ClassDot, StatusChip, StockBar, fill, useClassLabel } from './parts.tsx'

const CARD_WIDTH = 300
const SHOW_DELAY = 90
const HIDE_DELAY = 160
const FLAGS: TankStatus[] = ['near-full', 'over', 'empty', 'no-data']

interface Tip {
  code: CommodityClass
  root: HTMLElement
  /** The segment's box, relative to the page root the card is placed in. */
  anchor: { left: number; top: number; width: number; height: number }
}

/**
 * The mix of stock by commodity class, one thin segment each. Pointing at a segment opens a card with
 * the detail behind it, and the card can be moved into: it lists the largest tanks and opens them.
 */
export function MixStrip({
  site,
  onOpenClass,
  onOpenTank,
}: {
  site: PortfolioSite
  onOpenClass: (siteId: string, code: CommodityClass) => void
  onOpenTank: (siteId: string, tankId: string) => void
}) {
  const { locale } = useLocale()
  const label = useClassLabel()
  const [tip, setTip] = useState<Tip | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const classes = site.classes
  const total = classes.reduce((sum, row) => sum + row.quantityKg, 0)
  const ordered = CLASS_ORDER.map((code) => classes.find((row) => row.code === code)).filter(
    (row): row is ClassTotals => row != null && row.quantityKg > 0,
  )

  const open = (code: CommodityClass, element: HTMLElement, delay: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const root = element.closest<HTMLElement>('.mg')
      if (!root) return
      const box = element.getBoundingClientRect()
      const page = root.getBoundingClientRect()
      setTip({ code, root, anchor: { left: box.left - page.left, top: box.top - page.top, width: box.width, height: box.height } })
    }, delay)
  }
  const close = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setTip(null), HIDE_DELAY)
  }
  const keep = () => window.clearTimeout(timer.current)

  return (
    <div className="mg-mix" role="img" aria-label={ordered.map((row) => `${label(row.code)} ${formatTonnes(row.quantityKg, locale)} t`).join(', ')}>
      {total > 0
        ? ordered.map((row) => (
            <span
              key={row.code}
              className={`mg-mix__seg mg-c--${row.code}${tip?.code === row.code ? ' is-open' : ''}`}
              style={{ flexGrow: row.quantityKg }}
              onMouseEnter={(event) => open(row.code, event.currentTarget, SHOW_DELAY)}
              onMouseLeave={close}
              onClick={(event) => {
                // A tap on a touch screen shows the card first. A second tap, or a click, opens the commodity.
                event.stopPropagation()
                const touch = (event.nativeEvent as PointerEvent).pointerType === 'touch'
                if (touch && tip?.code !== row.code) {
                  open(row.code, event.currentTarget, 0)
                  return
                }
                setTip(null)
                onOpenClass(site.id, row.code)
              }}
            />
          ))
        : null}
      {tip
        ? createPortal(
            <MixCard
              site={site}
              tip={tip}
              onEnter={keep}
              onLeave={close}
              onOpenClass={() => {
                setTip(null)
                onOpenClass(site.id, tip.code)
              }}
              onOpenTank={(tankId) => {
                setTip(null)
                onOpenTank(site.id, tankId)
              }}
            />,
            tip.root,
          )
        : null}
    </div>
  )
}

function MixCard({
  site,
  tip,
  onEnter,
  onLeave,
  onOpenClass,
  onOpenTank,
}: {
  site: PortfolioSite
  tip: Tip
  onEnter: () => void
  onLeave: () => void
  onOpenClass: () => void
  onOpenTank: (tankId: string) => void
}) {
  const { t, locale } = useLocale()
  const label = useClassLabel()
  const card = useRef<HTMLDivElement>(null)
  const [above, setAbove] = useState(false)

  const row = site.classes.find((item) => item.code === tip.code)
  const tanks = site.tanks.filter((tank) => tank.commodityClass === tip.code)
  const largest = [...tanks]
    .filter((tank) => tank.quantityKg != null)
    .sort((a, b) => (b.quantityKg ?? 0) - (a.quantityKg ?? 0) || compareTankIds(a.tankId, b.tankId))
    .slice(0, 4)
  const flagged = FLAGS.map((status) => ({ status, count: tanks.filter((tank) => tank.status === status).length })).filter((item) => item.count > 0)
  const share = row && site.quantityKg > 0 ? row.quantityKg / site.quantityKg : null

  // Open below the segment, or above it when there is no room below.
  useLayoutEffect(() => {
    const element = card.current
    if (!element) return
    const height = element.getBoundingClientRect().height
    const page = tip.root.getBoundingClientRect()
    const anchorBottom = page.top + tip.anchor.top + tip.anchor.height
    const anchorTop = page.top + tip.anchor.top
    setAbove(anchorBottom + 8 + height > window.innerHeight - 8 && anchorTop - 8 - height > 8)
  }, [tip])

  const width = Math.min(CARD_WIDTH, tip.root.clientWidth - 16)
  const center = tip.anchor.left + tip.anchor.width / 2
  const left = Math.max(8, Math.min(center - width / 2, tip.root.clientWidth - width - 8))
  const top = above ? undefined : tip.anchor.top + tip.anchor.height + 8
  const bottom = above ? tip.root.clientHeight - tip.anchor.top + 8 : undefined
  const arrow = Math.max(14, Math.min(center - left, width - 14))

  if (!row) return null
  return (
    <div
      ref={card}
      className={above ? 'mg-tip mg-tip--above' : 'mg-tip'}
      role="dialog"
      aria-label={label(tip.code)}
      style={{ left, top, bottom, width, ['--arrow' as string]: `${arrow}px` }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      // The card sits inside the site row in the React tree, so a click on it must not open the row too.
      onClick={(event) => event.stopPropagation()}
    >
      <header className="mg-tip__head">
        <ClassDot code={tip.code} />
        <strong>{label(tip.code)}</strong>
        <span className="mg-muted">· {site.name}</span>
      </header>

      <p className="mg-tip__big">
        {formatTonnes(row.quantityKg, locale)} <small>t</small>
        {share != null ? <span>{fill(t.mgTipShare, { pct: formatPercent(share, locale, 0) })}</span> : null}
      </p>

      <dl className="mg-tip__stats">
        <div>
          <dt>{t.mgColFill}</dt>
          <dd>{formatPercent(row.fillRatio, locale)}</dd>
        </div>
        <div>
          <dt>{t.mgColCap}</dt>
          <dd>{formatTonnes(row.capacityTotalKg, locale)}</dd>
        </div>
        <div>
          <dt>{t.mgColTanks}</dt>
          <dd>
            {row.reporting}/{row.tanks}
          </dd>
        </div>
      </dl>

      {flagged.length > 0 ? (
        <p className="mg-tip__flags">
          {flagged.map((item) => (
            <span key={item.status} className="mg-tip__flag">
              <StatusChip status={item.status} />
              <b>{item.count}</b>
            </span>
          ))}
        </p>
      ) : null}

      {largest.length > 0 ? (
        <>
          <h4 className="mg-tip__title">{t.mgTipLargest}</h4>
          <ul className="mg-tip__tanks">
            {largest.map((tank) => (
              <li key={tank.tankId}>
                <button type="button" onClick={() => onOpenTank(tank.tankId)}>
                  <span className="mg-tip__tank">
                    <b>{tank.tankId}</b>
                    <small>{tank.productName}</small>
                  </span>
                  <span className="mg-tip__fill">
                    {tank.capacityKg != null && tank.quantityKg != null ? (
                      <StockBar quantityKg={tank.quantityKg} capacityTotalKg={tank.capacityKg} scaleMax={tank.capacityKg} tick={0.9} />
                    ) : null}
                  </span>
                  <span className="mg-tip__pct">{formatPercent(tank.fillRatio, locale, 0)}</span>
                  <span className="mg-tip__qty">{formatTonnes(tank.quantityKg, locale)} t</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <button type="button" className="mg-tip__open" onClick={onOpenClass}>
        {fill(t.mgTipOpen, { cls: label(tip.code), site: site.name })}
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
