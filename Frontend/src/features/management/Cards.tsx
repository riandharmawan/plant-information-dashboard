import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  CLASS_ORDER,
  EXPANDABLE,
  FILL_BIN_LABELS,
  classAcrossSites,
  closestToFull,
  compareTankIds,
  fillSpread,
  formatPercent,
  formatTonnes,
  productOf,
  productTotals,
  tintOf,
  uncountedCapacity,
  type CommodityClass,
  type PortfolioSite,
  type PortfolioSummary,
  type PortfolioTank,
  type TankStatus,
} from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SourceBadge } from '../dataSource/SourceBadge.tsx'
import { useCardActions } from './HoverCard.tsx'
import { Change, ClassDot, DataBadge, StatusChip, fill, useClassLabel } from './parts.tsx'

const FLAGS: TankStatus[] = ['near-full', 'over', 'empty', 'no-data']
const STATUSES: TankStatus[] = ['ok', 'near-full', 'over', 'empty', 'no-data']
const MAX_ROWS = 6

/* ------------------------------------------------------------------ building blocks */

function Title({ children }: { children: ReactNode }) {
  return <h4 className="mg-tip__title">{children}</h4>
}

function Big({ value, unit, side }: { value: string; unit?: string; side?: ReactNode }) {
  return (
    <p className="mg-tip__big">
      {value} {unit ? <small>{unit}</small> : null}
      {side ? <span>{side}</span> : null}
    </p>
  )
}

function Stats({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="mg-tip__stats" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A row with a small bar: a site, a commodity, a status. It opens whatever it names. */
function MiniRow({
  label,
  sub,
  ratio,
  tick,
  value,
  onClick,
}: {
  label: ReactNode
  sub?: ReactNode
  ratio: number | null
  tick?: number
  value: ReactNode
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="mg-tip__lab">
        <b>{label}</b>
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className="mg-tip__mini" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(1, ratio ?? 0)) * 100}%` }} />
        {tick != null ? <u style={{ left: `${tick * 100}%` }} /> : null}
      </span>
      <span className="mg-tip__val">{value}</span>
    </>
  )
  return onClick ? (
    <li>
      <button type="button" className="mg-tip__row" onClick={onClick}>
        {body}
      </button>
    </li>
  ) : (
    <li>
      <div className="mg-tip__row">{body}</div>
    </li>
  )
}

function Foot({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="mg-tip__open" onClick={onClick}>
      {children}
      <ChevronRight size={14} aria-hidden="true" />
    </button>
  )
}

/** Tanks by status as one stacked bar, then a chip each. A flagged chip opens that list. */
function StatusSplit({ counts, onPick }: { counts: Record<TankStatus, number>; onPick?: (status: TankStatus) => void }) {
  const total = STATUSES.reduce((sum, status) => sum + counts[status], 0)
  if (total === 0) return null
  return (
    <>
      <div className="mg-tip__stack" aria-hidden="true">
        {STATUSES.filter((status) => counts[status] > 0).map((status) => (
          <span key={status} className={`mg-st mg-st--${status}`} style={{ flexGrow: counts[status] }} />
        ))}
      </div>
      <p className="mg-tip__flags">
        {STATUSES.filter((status) => counts[status] > 0).map((status) => {
          const chip = (
            <span className="mg-tip__flag">
              <StatusChip status={status} />
              <b>{counts[status]}</b>
            </span>
          )
          return onPick && FLAGS.includes(status) ? (
            <button key={status} type="button" className="mg-tip__chipbtn" onClick={() => onPick(status)}>
              {chip}
            </button>
          ) : (
            <span key={status}>{chip}</span>
          )
        })}
      </p>
    </>
  )
}

/** Tank fill in five bands, so a site's average is seen next to how spread out its tanks are. */
function Spread({ tanks, nearFull }: { tanks: PortfolioTank[]; nearFull: number }) {
  const { t } = useLocale()
  const bins = fillSpread(tanks, nearFull)
  const top = Math.max(1, ...bins)
  if (bins.every((n) => n === 0)) return null
  return (
    <>
      <Title>{t.mgCardSpread}</Title>
      <div className="mg-tip__hist" role="img" aria-label={bins.map((n, i) => `${FILL_BIN_LABELS[i]} ${n}`).join(', ')}>
        {bins.map((n, index) => (
          <div key={FILL_BIN_LABELS[index]} className={index === 4 ? 'is-hot' : undefined}>
            <b>{n}</b>
            <i style={{ height: `${Math.max(n > 0 ? 8 : 2, (n / top) * 100)}%` }} />
            <small>{FILL_BIN_LABELS[index]}</small>
          </div>
        ))}
      </div>
    </>
  )
}

function TankList({ site, tanks, hide, title }: { site: PortfolioSite; tanks: PortfolioTank[]; hide: () => void; title: string }) {
  const { locale } = useLocale()
  const actions = useCardActions()
  if (tanks.length === 0) return null
  return (
    <>
      <Title>{title}</Title>
      <ul className="mg-tip__rows">
        {tanks.map((tank) => (
          <MiniRow
            key={tank.tankId}
            label={tank.tankId}
            sub={tank.productName}
            ratio={tank.fillRatio}
            tick={0.9}
            value={`${formatPercent(tank.fillRatio, locale, 0)} · ${formatTonnes(tank.quantityKg, locale)} t`}
            onClick={() => {
              hide()
              actions.openTank(site.id, tank.tankId)
            }}
          />
        ))}
      </ul>
    </>
  )
}

/* ------------------------------------------------------------------ a commodity at one site */

/**
 * The detail behind one commodity at one site, or behind one product of it. The mix strip and the commodity
 * rows of a site share it. A class that can be opened up also lists its products.
 */
export function ClassAtSiteCard({ site, code, product, hide }: { site: PortfolioSite; code: CommodityClass; product?: string; hide: () => void }) {
  const { t, locale } = useLocale()
  const label = useClassLabel()
  const actions = useCardActions()
  const row = site.classes.find((item) => item.code === code)
  if (!row) return null
  const inClass = site.tanks.filter((tank) => tank.commodityClass === code)
  const tanks = product ? inClass.filter((tank) => productOf(tank) === product) : inClass
  const totals = product ? productTotals(tanks)[0] : row
  if (!totals) return null
  const largest = [...tanks]
    .filter((tank) => tank.quantityKg != null)
    .sort((a, b) => (b.quantityKg ?? 0) - (a.quantityKg ?? 0) || compareTankIds(a.tankId, b.tankId))
    .slice(0, 4)
  const counts = Object.fromEntries(STATUSES.map((status) => [status, tanks.filter((tank) => tank.status === status).length])) as Record<TankStatus, number>
  const share = site.quantityKg > 0 ? totals.quantityKg / site.quantityKg : null
  const products = !product && EXPANDABLE.has(code) ? productTotals(inClass) : []
  const title = product ?? label(code)
  return (
    <>
      <header className="mg-tip__head">
        {product ? <i className="mg-dot" style={{ background: tintOf(product, code).background }} aria-hidden="true" /> : <ClassDot code={code} />}
        <strong>{title}</strong>
        <span className="mg-muted">· {product ? `${label(code)} · ` : ''}{site.name}</span>
        <SourceBadge source={site.source} compact />
      </header>
      <Big value={formatTonnes(totals.quantityKg, locale)} unit="t" side={share != null ? fill(t.mgTipShare, { pct: formatPercent(share, locale, 0) }) : null} />
      <Stats
        items={[
          { label: t.mgColFill, value: formatPercent(totals.fillRatio, locale) },
          { label: t.mgColCap, value: formatTonnes(totals.capacityTotalKg, locale) },
          { label: t.mgColTanks, value: `${totals.reporting}/${totals.tanks}` },
        ]}
      />
      <StatusSplit counts={counts} />
      {products.length > 1 ? (
        <>
          <Title>{t.mgCardProducts}</Title>
          <ul className="mg-tip__rows">
            {products.slice(0, MAX_ROWS).map((item) => (
              <MiniRow
                key={item.key}
                label={<><i className="mg-dot" style={{ background: tintOf(item.key, code).background }} aria-hidden="true" />{item.key}</>}
                ratio={row.quantityKg > 0 ? item.quantityKg / row.quantityKg : 0}
                value={`${formatTonnes(item.quantityKg, locale)} t · ${formatPercent(item.fillRatio, locale, 0)}`}
                onClick={() => {
                  hide()
                  actions.openClass(site.id, code, item.key)
                }}
              />
            ))}
          </ul>
        </>
      ) : null}
      <TankList site={site} tanks={largest} hide={hide} title={t.mgTipLargest} />
      <Foot
        onClick={() => {
          hide()
          actions.openClass(site.id, code, product)
        }}
      >
        {fill(t.mgTipOpen, { cls: title, site: site.name })}
      </Foot>
    </>
  )
}

/* ------------------------------------------------------------------ a site's stock against capacity */

export function SiteStockCard({ site, nearFull, hide }: { site: PortfolioSite; nearFull: number; hide: () => void }) {
  const { t, locale } = useLocale()
  const actions = useCardActions()
  const gap = uncountedCapacity(site)
  const fullest = closestToFull(site.tanks, 3)
  return (
    <>
      <header className="mg-tip__head">
        <strong>{site.name}</strong>
        <span className="mg-muted">· {t.mgColStockCap}</span>
        <SourceBadge source={site.source} compact />
      </header>
      <Big value={formatPercent(site.fillRatio, locale)} side={`${formatTonnes(site.quantityKg, locale)} / ${formatTonnes(site.capacityKg, locale)} t`} />
      <Stats
        items={[
          { label: t.mgCardFreeSpace, value: `${formatTonnes(Math.max(0, site.capacityKg - site.quantityKg), locale)} t` },
          { label: t.mgVsYesterday, value: <Change kg={site.changeKg} /> },
          { label: t.mgColTanks, value: `${site.tanksReporting}/${site.tanksTotal}` },
        ]}
      />
      {gap.tanks > 0 && gap.capacityKg > 0 ? (
        <p className="mg-tip__note">{fill(t.mgCardNotCounted, { tanks: gap.tanks, cap: formatTonnes(gap.capacityKg, locale) })}</p>
      ) : null}
      <StatusSplit
        counts={site.counts}
        onPick={(status) => {
          hide()
          actions.openStatus(status)
        }}
      />
      <Spread tanks={site.tanks} nearFull={nearFull} />
      <TankList site={site} tanks={fullest} hide={hide} title={t.mgCardFullest} />
      <p className="mg-tip__meta">
        <DataBadge site={site} />
      </p>
      <Foot
        onClick={() => {
          hide()
          actions.openSite(site.id)
        }}
      >
        {fill(t.mgCardOpenSite, { site: site.name })}
      </Foot>
    </>
  )
}

/* ------------------------------------------------------------------ a commodity across the sites */

export function CommodityCard({ code, sites, hide }: { code: CommodityClass; sites: PortfolioSite[]; hide: () => void }) {
  const { t, locale } = useLocale()
  const label = useClassLabel()
  const actions = useCardActions()
  const total = classAcrossSites(sites, code)
  const rows = sites
    .map((site) => ({ site, row: site.classes.find((item) => item.code === code) }))
    .filter((item): item is { site: PortfolioSite; row: NonNullable<typeof item.row> } => item.row != null)
    .sort((a, b) => b.row.quantityKg - a.row.quantityKg)
  const counts = Object.fromEntries(
    STATUSES.map((status) => [status, sites.reduce((sum, site) => sum + site.tanks.filter((tank) => tank.commodityClass === code && tank.status === status).length, 0)]),
  ) as Record<TankStatus, number>
  return (
    <>
      <header className="mg-tip__head">
        <ClassDot code={code} />
        <strong>{label(code)}</strong>
        <span className="mg-muted">· {t.mgAllSites}</span>
      </header>
      <Big value={formatTonnes(total.quantityKg, locale)} unit="t" side={`${formatPercent(total.fillRatio, locale)} · ${formatTonnes(total.capacityTotalKg, locale)} t`} />
      <Title>{t.mgBySite}</Title>
      <ul className="mg-tip__rows">
        {rows.slice(0, MAX_ROWS).map(({ site, row }) => (
          <MiniRow
            key={site.id}
            label={site.name}
            sub={<SourceBadge source={site.source} compact />}
            ratio={row.fillRatio}
            value={`${formatPercent(row.fillRatio, locale, 0)} · ${formatTonnes(row.quantityKg, locale)} t`}
            onClick={() => {
              hide()
              actions.openClass(site.id, code)
            }}
          />
        ))}
      </ul>
      <StatusSplit counts={counts} />
      <Foot
        onClick={() => {
          hide()
          actions.openCommodity(code)
        }}
      >
        {fill(t.mgCardOpenCommodity, { cls: label(code) })}
      </Foot>
    </>
  )
}

/* ------------------------------------------------------------------ the figures at the top */

type KpiKind = 'stock' | 'capacity' | 'fill' | 'tanks' | 'free'

/** One card per figure at the top. Each breaks the figure down by site, and the rows open the site. */
export function KpiCard({ kind, portfolio, sites, hide }: { kind: KpiKind; portfolio: PortfolioSummary; sites: PortfolioSite[]; hide: () => void }) {
  const { t, locale } = useLocale()
  const label = useClassLabel()
  const actions = useCardActions()
  const open = (siteId: string) => () => {
    hide()
    actions.openSite(siteId)
  }

  if (kind === 'stock') {
    const rows = [...sites].sort((a, b) => b.quantityKg - a.quantityKg)
    const classes = CLASS_ORDER.map((code) => classAcrossSites(sites, code)).filter((row) => row.quantityKg > 0).sort((a, b) => b.quantityKg - a.quantityKg)
    return (
      <>
        <Title>{t.mgCardStockTitle}</Title>
        <ul className="mg-tip__rows">
          {rows.slice(0, MAX_ROWS).map((site) => (
            <MiniRow
              key={site.id}
              label={site.name}
              sub={site.changeKg != null ? <Change kg={site.changeKg} /> : undefined}
              ratio={portfolio.quantityKg > 0 ? site.quantityKg / portfolio.quantityKg : 0}
              value={`${formatTonnes(site.quantityKg, locale)} t · ${formatPercent(portfolio.quantityKg > 0 ? site.quantityKg / portfolio.quantityKg : null, locale, 0)}`}
              onClick={open(site.id)}
            />
          ))}
        </ul>
        <Title>{t.mgByCommodity}</Title>
        <ul className="mg-tip__rows">
          {classes.slice(0, MAX_ROWS).map((row) => (
            <MiniRow
              key={row.code}
              label={<><ClassDot code={row.code} />{label(row.code)}</>}
              ratio={portfolio.quantityKg > 0 ? row.quantityKg / portfolio.quantityKg : 0}
              value={`${formatTonnes(row.quantityKg, locale)} t`}
              onClick={() => {
                hide()
                actions.openCommodity(row.code)
              }}
            />
          ))}
        </ul>
      </>
    )
  }

  if (kind === 'capacity') {
    const rows = [...sites].sort((a, b) => b.capacityTotalKg - a.capacityTotalKg)
    const top = Math.max(1, ...rows.map((site) => site.capacityTotalKg))
    const counted = portfolio.capacityKg
    const missing = Math.max(0, portfolio.capacityTotalKg - portfolio.capacityKg)
    return (
      <>
        <Title>{t.mgCardCapTitle}</Title>
        <ul className="mg-tip__rows">
          {rows.slice(0, MAX_ROWS).map((site) => (
            <MiniRow
              key={site.id}
              label={site.name}
              sub={fill(t.mgTanksReporting, { a: site.tanksReporting, b: site.tanksTotal })}
              ratio={site.capacityTotalKg / top}
              value={`${formatTonnes(site.capacityTotalKg, locale)} t`}
              onClick={open(site.id)}
            />
          ))}
        </ul>
        <Stats
          items={[
            { label: t.mgCardCounted, value: `${formatTonnes(counted, locale)} t` },
            { label: t.mgCardNoReading, value: `${formatTonnes(missing, locale)} t` },
          ]}
        />
        <p className="mg-tip__note">{t.mgCapacityNote}</p>
      </>
    )
  }

  if (kind === 'fill') {
    const rows = [...sites].filter((site) => site.fillRatio != null).sort((a, b) => (b.fillRatio ?? 0) - (a.fillRatio ?? 0))
    const classes = CLASS_ORDER.map((code) => classAcrossSites(sites, code)).filter((row) => row.fillRatio != null).sort((a, b) => (b.fillRatio ?? 0) - (a.fillRatio ?? 0))
    return (
      <>
        <Title>{t.mgCardFillTitle}</Title>
        <ul className="mg-tip__rows">
          {rows.slice(0, MAX_ROWS).map((site) => (
            <MiniRow key={site.id} label={site.name} ratio={site.fillRatio} tick={portfolio.nearFull} value={formatPercent(site.fillRatio, locale)} onClick={open(site.id)} />
          ))}
        </ul>
        <Title>{t.mgByCommodity}</Title>
        <ul className="mg-tip__rows">
          {classes.slice(0, MAX_ROWS).map((row) => (
            <MiniRow
              key={row.code}
              label={<><ClassDot code={row.code} />{label(row.code)}</>}
              ratio={row.fillRatio}
              tick={portfolio.nearFull}
              value={formatPercent(row.fillRatio, locale)}
              onClick={() => {
                hide()
                actions.openCommodity(row.code)
              }}
            />
          ))}
        </ul>
        <p className="mg-tip__note">{fill(t.mgNearFullFrom, { pct: Math.round(portfolio.nearFull * 100) })}</p>
      </>
    )
  }

  if (kind === 'tanks') {
    const rows = [...sites].sort((a, b) => b.counts['no-data'] - a.counts['no-data'] || b.tanksTotal - a.tanksTotal)
    return (
      <>
        <Title>{t.mgCardTanksTitle}</Title>
        <StatusSplit
          counts={portfolio.counts}
          onPick={(status) => {
            hide()
            actions.openStatus(status)
          }}
        />
        <Title>{t.mgBySite}</Title>
        <ul className="mg-tip__rows">
          {rows.slice(0, MAX_ROWS).map((site) => (
            <MiniRow
              key={site.id}
              label={site.name}
              sub={site.counts['no-data'] > 0 ? `${site.counts['no-data']} ${t.mgStNoData.toLowerCase()}` : undefined}
              ratio={site.tanksTotal > 0 ? site.tanksReporting / site.tanksTotal : 0}
              value={`${site.tanksReporting}/${site.tanksTotal}`}
              onClick={open(site.id)}
            />
          ))}
        </ul>
      </>
    )
  }

  // Free space: how much more could be received, tank by tank where there is a reading and a capacity.
  const free = (kg: number, capacityKg: number) => Math.max(0, capacityKg - kg)
  const siteRows = sites
    .map((site) => ({ site, free: free(site.quantityKg, site.capacityKg) }))
    .sort((left, right) => right.free - left.free)
  const classRows = CLASS_ORDER.map((code) => classAcrossSites(sites, code))
    .filter((row) => row.capacityKg > 0)
    .map((row) => ({ row, free: free(row.quantityKg, row.capacityKg) }))
    .sort((left, right) => right.free - left.free)
  const siteTop = Math.max(1, ...siteRows.map((item) => item.free))
  const classTop = Math.max(1, ...classRows.map((item) => item.free))
  return (
    <>
      <Title>{t.mgCardFreeTitle}</Title>
      <ul className="mg-tip__rows">
        {siteRows.slice(0, MAX_ROWS).map(({ site, free: room }) => (
          <MiniRow
            key={site.id}
            label={site.name}
            sub={`${formatPercent(site.fillRatio, locale, 0)} ${t.mgColFill.toLowerCase()}`}
            ratio={room / siteTop}
            value={`${formatTonnes(room, locale)} t`}
            onClick={open(site.id)}
          />
        ))}
      </ul>
      <Title>{t.mgByCommodity}</Title>
      <ul className="mg-tip__rows">
        {classRows.slice(0, MAX_ROWS).map(({ row, free: room }) => (
          <MiniRow
            key={row.code}
            label={<><ClassDot code={row.code} />{label(row.code)}</>}
            ratio={room / classTop}
            value={`${formatTonnes(room, locale)} t`}
            onClick={() => {
              hide()
              actions.openCommodity(row.code)
            }}
          />
        ))}
      </ul>
      <p className="mg-tip__note">{t.mgCardFreeNote}</p>
    </>
  )
}
