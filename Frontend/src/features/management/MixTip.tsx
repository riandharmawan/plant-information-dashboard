import { CLASS_ORDER, formatTonnes, type ClassTotals, type CommodityClass, type PortfolioSite } from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { ClassAtSiteCard } from './Cards.tsx'
import { HoverCardShell, useHoverCard } from './HoverCard.tsx'
import { useClassLabel } from './parts.tsx'
import { createPortal } from 'react-dom'

/**
 * The mix of stock by commodity class, one thin segment each. Pointing at a segment opens the same card
 * as the commodity rows of a site, and the card can be moved into to open a tank or the commodity.
 */
export function MixStrip({
  site,
  onOpenClass,
}: {
  site: PortfolioSite
  onOpenClass: (siteId: string, code: CommodityClass) => void
}) {
  const { locale } = useLocale()
  const label = useClassLabel()
  const hover = useHoverCard()

  const total = site.classes.reduce((sum, row) => sum + row.quantityKg, 0)
  const ordered = CLASS_ORDER.map((code) => site.classes.find((row) => row.code === code)).filter(
    (row): row is ClassTotals => row != null && row.quantityKg > 0,
  )
  const openCode = hover.state?.key as CommodityClass | undefined

  return (
    <div className="mg-mix" role="img" aria-label={ordered.map((row) => `${label(row.code)} ${formatTonnes(row.quantityKg, locale)} t`).join(', ')}>
      {total > 0
        ? ordered.map((row) => (
            <span
              key={row.code}
              className={`mg-mix__seg mg-c--${row.code}${openCode === row.code ? ' is-open' : ''}`}
              style={{ flexGrow: row.quantityKg }}
              onMouseEnter={(event) => hover.open(row.code, event.currentTarget)}
              onMouseLeave={hover.close}
              onClick={(event) => {
                // A tap on a touch screen shows the card first. A second tap, or a click, opens the commodity.
                event.stopPropagation()
                const touch = (event.nativeEvent as PointerEvent).pointerType === 'touch'
                if (touch && openCode !== row.code) {
                  hover.open(row.code, event.currentTarget, 0)
                  return
                }
                hover.hide()
                onOpenClass(site.id, row.code)
              }}
            />
          ))
        : null}
      {hover.state && openCode
        ? createPortal(
            <HoverCardShell state={hover.state} label={label(openCode)} onEnter={hover.keep} onLeave={hover.close}>
              <ClassAtSiteCard site={site} code={openCode} hide={hover.hide} />
            </HoverCardShell>,
            hover.state.root,
          )
        : null}
    </div>
  )
}
