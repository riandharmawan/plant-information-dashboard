import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  CLASS_ORDER,
  EXPANDABLE,
  formatTonnes,
  productTotals,
  tintOf,
  type CommodityClass,
  type PortfolioSite,
} from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { ClassAtSiteCard } from './Cards.tsx'
import { HoverCardShell, useHoverCard } from './HoverCard.tsx'
import { ClassDot, useClassLabel } from './parts.tsx'
import { useViewOptions } from './viewOptions.ts'

const SHORT = {
  cpo: 'mgShortCpo',
  refined: 'mgShortRefined',
  pfad: 'mgShortPfad',
  pome: 'mgShortPome',
  pkfad: 'mgShortPkfad',
  rpome: 'mgShortRpome',
  fame: 'mgShortFame',
  glycerin: 'mgShortGlycerin',
  limbah: 'mgShortLimbah',
  chemical: 'mgShortChemical',
  sludge: 'mgShortSludge',
  cpko: 'mgShortCpko',
  other: 'mgShortOther',
} as const

/** One segment of the strip: a commodity class, or one product of a class that is shown split. */
interface Segment {
  key: string
  code: CommodityClass
  product?: string
  quantityKg: number
  label: string
}

/**
 * The mix of stock by commodity class, one segment each. A class that can be opened up (Refined oils) is
 * one segment, or one per product when the page is set to show products. Pointing at a segment opens a
 * card with the detail, and the card can be moved into to open a tank or the commodity.
 */
export function MixStrip({
  site,
  onOpenClass,
}: {
  site: PortfolioSite
  onOpenClass: (siteId: string, code: CommodityClass, product?: string) => void
}) {
  const { t, locale } = useLocale()
  const label = useClassLabel()
  const { split } = useViewOptions()
  const hover = useHoverCard()
  const strip = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  // The strip's width decides which segments have room for their label.
  useLayoutEffect(() => {
    const element = strip.current
    if (!element) return
    setWidth(element.clientWidth)
    const watch = new ResizeObserver(() => setWidth(element.clientWidth))
    watch.observe(element)
    return () => watch.disconnect()
  }, [])

  const segments: Segment[] = CLASS_ORDER.flatMap((code): Segment[] => {
    const row = site.classes.find((item) => item.code === code)
    if (!row || row.quantityKg <= 0) return []
    if (split && EXPANDABLE.has(code)) {
      const products = productTotals(site.tanks.filter((tank) => tank.commodityClass === code)).filter((item) => item.quantityKg > 0)
      if (products.length > 0) {
        return products.map((item) => ({ key: `${code}|${item.key}`, code, product: item.key, quantityKg: item.quantityKg, label: item.key }))
      }
    }
    return [{ key: `${code}|`, code, quantityKg: row.quantityKg, label: t[SHORT[code]] }]
  })
  const total = segments.reduce((sum, segment) => sum + segment.quantityKg, 0)
  const open = segments.find((segment) => segment.key === hover.state?.key)

  // A label fits when its segment is wider than the text. The rest are listed under the strip.
  const inner = Math.max(0, width - 2 * Math.max(0, segments.length - 1))
  const fits = (segment: Segment) => {
    const number = formatTonnes(segment.quantityKg, locale).length * 7.2 + 10
    const name = segment.label.length * 6.2 + 10
    return total > 0 && (inner * segment.quantityKg) / total >= Math.max(number, name)
  }
  const hidden = width > 0 ? segments.filter((segment) => !fits(segment)) : []
  const style = (segment: Segment): CSSProperties => {
    const base: CSSProperties = { flexGrow: segment.quantityKg }
    if (!segment.product) return base
    const tint = tintOf(segment.product, segment.code)
    return { ...base, background: tint.background, color: tint.dark ? '#14201c' : '#fff' }
  }

  return (
    <div className="mg-mixwrap" data-label={t.mgColMix}>
      <div
        ref={strip}
        className="mg-mix"
        role="img"
        aria-label={segments.map((segment) => `${segment.product ?? label(segment.code)} ${formatTonnes(segment.quantityKg, locale)} t`).join(', ')}
      >
        {total > 0
          ? segments.map((segment) => (
              <span
                key={segment.key}
                className={`mg-mix__seg mg-c--${segment.code}${open?.key === segment.key ? ' is-open' : ''}`}
                style={style(segment)}
                onMouseEnter={(event) => hover.open(segment.key, event.currentTarget)}
                onMouseLeave={hover.close}
                onClick={(event) => {
                  // A tap on a touch screen shows the card first. A second tap, or a click, opens the commodity.
                  event.stopPropagation()
                  const touch = (event.nativeEvent as PointerEvent).pointerType === 'touch'
                  if (touch && open?.key !== segment.key) {
                    hover.open(segment.key, event.currentTarget, 0)
                    return
                  }
                  hover.hide()
                  onOpenClass(site.id, segment.code, segment.product)
                }}
              >
                {width > 0 && fits(segment) ? (
                  <>
                    <span className="mg-mix__name" aria-hidden="true">{segment.label}</span>
                    <b aria-hidden="true">{formatTonnes(segment.quantityKg, locale)}</b>
                  </>
                ) : null}
              </span>
            ))
          : null}
      </div>
      {hidden.length > 0 ? (
        <ul className="mg-mix__rest" aria-hidden="true">
          {hidden.map((segment) => (
            <li key={segment.key}>
              {segment.product ? <i className="mg-dot" style={{ background: tintOf(segment.product, segment.code).background }} /> : <ClassDot code={segment.code} />}
              {segment.product ?? label(segment.code)} <b>{formatTonnes(segment.quantityKg, locale)}</b>
            </li>
          ))}
        </ul>
      ) : null}
      {hover.state && open
        ? createPortal(
            <HoverCardShell state={hover.state} label={open.product ?? label(open.code)} onEnter={hover.keep} onLeave={hover.close}>
              <ClassAtSiteCard site={site} code={open.code} product={open.product} hide={hover.hide} />
            </HoverCardShell>,
            hover.state.root,
          )
        : null}
    </div>
  )
}
