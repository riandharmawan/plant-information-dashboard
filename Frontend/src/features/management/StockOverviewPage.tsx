import { ChevronRight, Link2, Printer } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../data/api.ts'
import {
  CLASS_ORDER,
  EXPANDABLE,
  classAcrossSites,
  compareTankIds,
  formatPercent,
  formatTonnes,
  productOf,
  productTotals,
  tintOf,
  type AttentionItem,
  type ClassTotals,
  type CommodityClass,
  type PortfolioPayload,
  type PortfolioSite,
  type PortfolioTank,
  type TankStatus,
} from '../../domain/management.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { TankDialog } from './TankDialog.tsx'
import { SourceBadge } from '../dataSource/SourceBadge.tsx'
import { ClassAtSiteCard, CommodityCard, KpiCard, SiteStockCard } from './Cards.tsx'
import { CardActionsContext, HoverTarget } from './HoverCard.tsx'
import { MixStrip } from './MixTip.tsx'
import { ViewOptionsContext, useViewOptions } from './viewOptions.ts'
import { Count, stagger } from './motion.tsx'
import { Change, ClassDot, DataBadge, DataStamp, FillText, Kpi, Legend, Skeleton, StatusChip, StockBar, fill, useClassLabel } from './parts.tsx'

const REFRESH_MS = 60000
const FLAG_KINDS: TankStatus[] = ['near-full', 'over', 'empty', 'no-data']

/** Where the user is in the drill-down. It lives in the URL, so Back works and a link can be shared. */
interface Nav {
  site: string | null
  cls: CommodityClass | null
  status: string | null
  view: 'site' | 'commodity'
  tank: string | null
  /** One product of the class being looked at, such as RBDPO under Refined oils. */
  prod: string | null
}

function readNav(params: URLSearchParams): Nav {
  const cls = params.get('cls')
  return {
    site: params.get('site'),
    cls: cls && (CLASS_ORDER as readonly string[]).includes(cls) ? (cls as CommodityClass) : null,
    status: params.get('status'),
    view: params.get('view') === 'commodity' ? 'commodity' : 'site',
    tank: params.get('tank'),
    prod: params.get('prod'),
  }
}

function usePortfolio() {
  const [data, setData] = useState<PortfolioPayload | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    const load = () =>
      api<PortfolioPayload>('/api/v1/portfolio/stock')
        .then((payload) => {
          if (!alive) return
          setData(payload)
          setFailed(false)
        })
        .catch(() => alive && setFailed(true))
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])
  return { data, failed }
}

export function StockOverviewPage() {
  const { t } = useLocale()
  const label = useClassLabel()
  const [params, setParams] = useSearchParams()
  const { data, failed } = usePortfolio()
  const [copied, setCopied] = useState(false)
  const [highlight, setHighlight] = useState<CommodityClass | null>(null)
  const nav = readNav(params)

  // Refined oils shown as one group or split into products. The last choice is remembered, and the link carries it.
  const [splitPref] = useState(() => {
    try {
      return window.localStorage.getItem('pid.mgSplit') === '1'
    } catch {
      return false
    }
  })
  const split = params.has('split') ? params.get('split') === 'refined' : splitPref
  const toggleSplit = () => {
    const next = !split
    try {
      window.localStorage.setItem('pid.mgSplit', next ? '1' : '0')
    } catch {
      // Storage can be blocked. The choice still holds for this visit.
    }
    setParams((previous) => {
      const query = new URLSearchParams(previous)
      query.set('split', next ? 'refined' : 'none')
      return query
    })
  }

  // Drilling in slides the new level in from the right, going back from the left, and a tab switch just fades.
  const depth = nav.status ? 1 : (nav.site ? 1 : 0) + (nav.cls ? 1 : 0)
  const levelKey = [nav.site, nav.cls, nav.status].join('|')
  const [level, setLevel] = useState<{ key: string; depth: number; direction: 'forward' | 'back' | 'same' }>({ key: levelKey, depth, direction: 'same' })
  if (level.key !== levelKey) {
    setLevel({ key: levelKey, depth, direction: depth > level.depth ? 'forward' : depth < level.depth ? 'back' : 'same' })
  }

  const go = useCallback(
    (next: Partial<Nav>) => {
      const merged = { site: null, cls: null, status: null, view: 'site' as const, tank: null, prod: null, ...next }
      const query = new URLSearchParams()
      if (merged.site) query.set('site', merged.site)
      if (merged.cls) query.set('cls', merged.cls)
      if (merged.status) query.set('status', merged.status)
      if (merged.view === 'commodity') query.set('view', 'commodity')
      if (merged.tank) query.set('tank', merged.tank)
      if (merged.prod) query.set('prod', merged.prod)
      const keep = params.get('split')
      if (keep) query.set('split', keep)
      setParams(query)
    },
    [params, setParams],
  )

  const sites = useMemo(() => data?.sites ?? [], [data])
  const site = nav.site ? sites.find((item) => item.id === nav.site) ?? null : null
  const nearFullPct = Math.round((data?.portfolio.nearFull ?? 0.9) * 100)

  const dialog = useMemo(() => {
    if (!nav.tank) return null
    const [siteId, tankId] = nav.tank.split('/')
    const owner = sites.find((item) => item.id === siteId)
    const tank = owner?.tanks.find((item) => item.tankId === tankId)
    return owner && tank ? { site: owner, tank } : null
  }, [nav.tank, sites])

  const copyLink = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  const openTank = (siteId: string, tankId: string) => go({ ...nav, tank: `${siteId}/${tankId}` })
  const cardActions = {
    openSite: (siteId: string) => go({ site: siteId }),
    openClass: (siteId: string, cls: CommodityClass, product?: string) => go({ site: siteId, cls, prod: product ?? null }),
    openCommodity: (cls: CommodityClass) => go({ cls, view: 'commodity' }),
    openTank: (siteId: string, tankId: string) => go({ tank: `${siteId}/${tankId}` }),
    openStatus: (status: string) => go({ status }),
  }
  const closeTank = () => go({ ...nav, tank: null })

  // The breadcrumb follows the path taken: through a site, or through a commodity.
  const crumbs: Array<{ text: string; to: Partial<Nav> | null }> = [{ text: t.mgAllSites, to: nav.site || nav.cls || nav.status ? {} : null }]
  if (nav.status) {
    crumbs.push({ text: statusTitle(t, nav.status), to: null })
  } else if (nav.view === 'commodity' && nav.cls) {
    crumbs.push({ text: label(nav.cls), to: site ? { cls: nav.cls, view: 'commodity' } : null })
    if (site) crumbs.push({ text: site.name, to: null })
  } else {
    if (site) crumbs.push({ text: site.name, to: nav.cls ? { site: site.id } : null })
    if (nav.cls) crumbs.push({ text: label(nav.cls), to: nav.prod && site ? { site: site.id, cls: nav.cls } : null })
    if (nav.cls && nav.prod) crumbs.push({ text: nav.prod, to: null })
  }

  const body = !data ? (
    failed ? <p className="mg-muted">{t.mgLoadFailed}</p> : <Skeleton />
  ) : sites.length === 0 ? (
    <p className="mg-muted">{t.mgNoSites}</p>
  ) : nav.status ? (
    <FlaggedView sites={sites} status={nav.status} onTank={openTank} onSite={(id) => go({ site: id })} />
  ) : nav.site && nav.cls && site ? (
    <TankTable rows={tanksOf(site, nav.cls, nav.prod)} onTank={openTank} />
  ) : nav.site && site ? (
    <SiteView site={site} nearFull={data?.portfolio.nearFull ?? 0.9} onClass={(cls) => go({ site: site.id, cls })} onProduct={(cls, product) => go({ site: site.id, cls, prod: product })} onHighlight={setHighlight} />
  ) : nav.cls ? (
    <SitesForClass sites={sites} cls={nav.cls} onSite={(id) => go({ site: id, cls: nav.cls, view: 'commodity' })} />
  ) : (
    <Overview data={data} view={nav.view} nearFullPct={nearFullPct} go={go} onHighlight={setHighlight} />
  )

  return (
    <CardActionsContext value={cardActions}>
    <ViewOptionsContext value={{ split, toggleSplit }}>
    <div className="page mg" data-hl={highlight ?? undefined}>
      <header className="mg-head">
        <div>
          <h1 className="page-title">{t.stockOverview}</h1>
        </div>
        <div className="mg-head__actions mg-noprint">
          <button type="button" className="mg-btn" onClick={copyLink}>
            <Link2 size={14} aria-hidden="true" /> {copied ? t.mgLinkCopied : t.mgCopyLink}
          </button>
          <button type="button" className="mg-btn" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" /> {t.mgPrint}
          </button>
        </div>
      </header>

      {crumbs.length > 1 ? (
        <nav className="mg-crumbs mg-noprint" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.text}-${index}`} className="mg-crumbs__item">
              {index > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
              {crumb.to ? (
                <button type="button" className="mg-link" onClick={() => go(crumb.to as Partial<Nav>)}>
                  {crumb.text}
                </button>
              ) : (
                <strong aria-current="page">{crumb.text}</strong>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      {data?.failed.map((item) => (
        <p key={item.id} className="mg-alert" role="status">
          {fill(t.mgSiteFailed, { site: item.name })}
        </p>
      ))}

      <div key={levelKey} className={`mg-level mg-level--${level.direction}`}>
        {body}
      </div>

      {data ? <p className="mg-foot">{t.mgCapacityNote}</p> : null}

      {dialog ? <TankDialog site={dialog.site} tank={dialog.tank} onClose={closeTank} /> : null}
    </div>
    </ViewOptionsContext>
    </CardActionsContext>
  )
}

function statusTitle(t: ReturnType<typeof useLocale>['t'], status: string): string {
  if (status === 'near-full') return t.mgStNearFull
  if (status === 'over') return t.mgStOver
  if (status === 'empty') return t.mgStEmpty
  if (status === 'no-data') return t.mgStNoData
  return t.mgOldData
}

function tanksOf(site: PortfolioSite, cls: CommodityClass, product: string | null): Array<{ site: PortfolioSite; tank: PortfolioTank }> {
  return site.tanks
    .filter((tank) => tank.commodityClass === cls && (product == null || productOf(tank) === product))
    .sort((a, b) => compareTankIds(a.tankId, b.tankId))
    .map((tank) => ({ site, tank }))
}

/* ------------------------------------------------------------------ level 0 */

function Overview({
  data,
  view,
  nearFullPct,
  go,
  onHighlight,
}: {
  data: PortfolioPayload
  view: 'site' | 'commodity'
  nearFullPct: number
  go: (next: Partial<Nav>) => void
  onHighlight: (cls: CommodityClass | null) => void
}) {
  const { t, locale } = useLocale()
  const { split } = useViewOptions()
  const { portfolio, sites } = data
  const scaleMax = Math.max(1, ...sites.map((site) => site.capacityTotalKg))
  const classScaleMax = Math.max(1, ...CLASS_ORDER.map((code) => classAcrossSites(sites, code).capacityTotalKg))

  return (
    <>
      <div className="mg-kpis">
        <Kpi
          label={t.mgKpiStock}
          value={formatTonnes(portfolio.quantityKg, locale)}
          unit="t"
          count={{ value: portfolio.quantityKg, format: (n) => formatTonnes(n, locale) }}
          note={portfolio.changeKg != null ? <><Change kg={portfolio.changeKg} /> {t.mgVsYesterday}</> : undefined}
          card={(hide) => <KpiCard kind="stock" portfolio={portfolio} sites={sites} hide={hide} />}
        />
        <Kpi label={t.mgKpiCapacity} value={formatTonnes(portfolio.capacityTotalKg, locale)} unit="t" count={{ value: portfolio.capacityTotalKg, format: (n) => formatTonnes(n, locale) }} card={(hide) => <KpiCard kind="capacity" portfolio={portfolio} sites={sites} hide={hide} />} />
        <Kpi label={t.mgKpiFill} value={formatPercent(portfolio.fillRatio, locale)} count={portfolio.fillRatio == null ? undefined : { value: portfolio.fillRatio, format: (n) => formatPercent(n, locale) }} card={(hide) => <KpiCard kind="fill" portfolio={portfolio} sites={sites} hide={hide} />} />
        <Kpi label={t.mgKpiTanks} value={`${portfolio.tanksReporting} / ${portfolio.tanksTotal}`} count={{ value: portfolio.tanksReporting, format: (n) => `${Math.round(n)} / ${portfolio.tanksTotal}` }} card={(hide) => <KpiCard kind="tanks" portfolio={portfolio} sites={sites} hide={hide} />} />
        <Kpi
          label={t.mgKpiFree}
          value={formatTonnes(Math.max(0, portfolio.capacityKg - portfolio.quantityKg), locale)}
          unit="t"
          count={{ value: Math.max(0, portfolio.capacityKg - portfolio.quantityKg), format: (n) => formatTonnes(n, locale) }}
          card={(hide) => <KpiCard kind="free" portfolio={portfolio} sites={sites} hide={hide} />}
        />
      </div>

      <Attention items={portfolio.attention} nearFullPct={nearFullPct} onOpen={(status) => go({ status })} />

      <div className="mg-tabs mg-noprint" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'site'} className={view === 'site' ? 'is-active' : undefined} onClick={() => go({ view: 'site' })}>
          {t.mgBySite}
        </button>
        <button type="button" role="tab" aria-selected={view === 'commodity'} className={view === 'commodity' ? 'is-active' : undefined} onClick={() => go({ view: 'commodity' })}>
          {t.mgByCommodity}
        </button>
      </div>

      <div key={view} className="mg-level mg-level--same">
      <Legend
        classes={CLASS_ORDER.filter((code) => sites.some((site) => site.classes.some((row) => row.code === code && row.quantityKg > 0)))}
        onHighlight={onHighlight}
        onPick={(cls) => go({ cls, view: 'commodity' })}
      />
      {view === 'site' ? (
        <ul className="mg-list">
          <li className="mg-row mg-row--site mg-row--head" aria-hidden="true">
            <span>{t.mgColSite}</span>
            <span>{t.mgColStockCap}</span>
            <span className="num">{t.mgColFill}</span>
            <span>{t.mgColMix}</span>
            <span className="num">{t.mgColChange}</span>
            <span>{t.mgColData}</span>
          </li>
          {sites.map((site, index) => (
            <li key={site.id} style={stagger(index)}>
              <button type="button" className="mg-row mg-row--site" onClick={() => go({ site: site.id })}>
                <span className="mg-name">
                  <strong>{site.name}</strong>
                  <small>{fill(t.mgTanksReporting, { a: site.tanksReporting, b: site.tanksTotal })}</small>
                </span>
                <HoverTarget
                  as="span"
                  className="mg-stock"
                  focusable={false}
                  cardKey={`site-${site.id}`}
                  label={`${site.name} ${t.mgColStockCap}`}
                  card={(hide) => <SiteStockCard site={site} nearFull={portfolio.nearFull} hide={hide} />}
                >
                  <StockBar quantityKg={site.quantityKg} capacityTotalKg={site.capacityTotalKg} scaleMax={scaleMax} />
                  <small>
                    <Count value={site.quantityKg} format={(n) => formatTonnes(n, locale)} /> / {formatTonnes(site.capacityTotalKg, locale)} t
                  </small>
                </HoverTarget>
                <span className="num mg-fill"><FillText ratio={site.fillRatio} /></span>
                <MixStrip
                  site={site}
                  onOpenClass={(siteId, cls) => go({ site: siteId, cls })}
                />
                <span className="num">
                  <Change kg={site.changeKg} />
                </span>
                <DataStamp site={site} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mg-list">
          <li className="mg-row mg-row--class mg-row--head" aria-hidden="true">
            <span>{t.mgColClass}</span>
            <span>{t.mgColStockCap}</span>
            <span className="num">{t.mgColFill}</span>
            <span className="num">{t.mgColTanks}</span>
          </li>
          {CLASS_ORDER.map((code) => ({ code, totals: classAcrossSites(sites, code) }))
            .filter((row) => row.totals.tanks > 0)
            .map(({ code, totals }, index) => (
              <Fragment key={code}>
              <li style={stagger(index)}>
                <ExpandToggle code={code} />
                <button type="button" className="mg-row mg-row--class" data-class={code} onClick={() => go({ cls: code, view: 'commodity' })}>
                  <ClassName code={code} />
                  <ClassStock totals={totals} scaleMax={classScaleMax} cardKey={`class-${code}`} card={(hide) => <CommodityCard code={code} sites={sites} hide={hide} />} />
                  <span className="num mg-fill"><FillText ratio={totals.fillRatio} /></span>
                  <span className="num">{totals.tanks}</span>
                </button>
              </li>
              {split && EXPANDABLE.has(code) ? (
                <ProductRows code={code} tanks={sites.flatMap((item) => item.tanks.filter((tank) => tank.commodityClass === code))} scaleMax={classScaleMax} />
              ) : null}
              </Fragment>
            ))}
        </ul>
      )}
      </div>
    </>
  )
}

function ClassName({ code }: { code: CommodityClass }) {
  const label = useClassLabel()
  return (
    <span className="mg-name">
      <strong>
        <ClassDot code={code} /> {label(code)}
      </strong>
    </span>
  )
}

function ClassStock({ totals, scaleMax, cardKey, card }: { totals: ClassTotals; scaleMax: number; cardKey: string; card: (hide: () => void) => ReactNode }) {
  const { locale } = useLocale()
  const label = useClassLabel()
  return (
    <HoverTarget as="span" className="mg-stock" focusable={false} cardKey={cardKey} label={label(totals.code)} card={card}>
      <StockBar quantityKg={totals.quantityKg} capacityTotalKg={totals.capacityTotalKg} scaleMax={scaleMax} />
      <small>
        <Count value={totals.quantityKg} format={(n) => formatTonnes(n, locale)} /> / {formatTonnes(totals.capacityTotalKg, locale)} t
      </small>
    </HoverTarget>
  )
}

function Attention({ items, nearFullPct, onOpen }: { items: AttentionItem[]; nearFullPct: number; onOpen: (status: string) => void }) {
  const { t } = useLocale()
  const text = (item: AttentionItem): string => {
    if (item.kind === 'near-full') return fill(t.mgAttNearFull, { count: item.count, pct: nearFullPct })
    if (item.kind === 'over') return fill(t.mgAttOver, { count: item.count })
    if (item.kind === 'empty') return fill(t.mgAttEmpty, { count: item.count })
    if (item.kind === 'no-data') return fill(t.mgAttNoData, { count: item.count })
    return fill(t.mgAttStale, { count: item.count })
  }
  return (
    <section className="mg-attention" aria-label={t.mgNeedsAttention}>
      <h2>{t.mgNeedsAttention}</h2>
      {items.length === 0 ? (
        <p className="mg-muted">{t.mgNothingToFlag}</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={item.kind} style={stagger(index)}>
              <button type="button" className={`mg-flag mg-flag--${item.kind}`} onClick={() => onOpen(item.kind)}>
                {item.kind === 'stale' ? null : <StatusChip status={item.kind} />}
                <span>{text(item)}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ deeper levels */

function SiteView({ site, nearFull, onClass, onProduct, onHighlight }: { site: PortfolioSite; nearFull: number; onClass: (cls: CommodityClass) => void; onProduct: (cls: CommodityClass, product: string) => void; onHighlight: (cls: CommodityClass | null) => void }) {
  const { t, locale } = useLocale()
  const { split } = useViewOptions()
  const siteCard = (hide: () => void) => <SiteStockCard site={site} nearFull={nearFull} hide={hide} />
  const scaleMax = Math.max(1, ...site.classes.map((row) => row.capacityTotalKg))
  return (
    <>
      <div className="mg-kpis">
        <Kpi label={t.mgKpiStock} value={formatTonnes(site.quantityKg, locale)} unit="t" count={{ value: site.quantityKg, format: (n) => formatTonnes(n, locale) }} note={site.changeKg != null ? <><Change kg={site.changeKg} /> {t.mgVsYesterday}</> : undefined} card={siteCard} />
        <Kpi label={t.mgKpiCapacity} value={formatTonnes(site.capacityTotalKg, locale)} unit="t" count={{ value: site.capacityTotalKg, format: (n) => formatTonnes(n, locale) }} card={siteCard} />
        <Kpi label={t.mgKpiFill} value={formatPercent(site.fillRatio, locale)} count={site.fillRatio == null ? undefined : { value: site.fillRatio, format: (n) => formatPercent(n, locale) }} card={siteCard} />
        <Kpi label={t.mgKpiTanks} value={`${site.tanksReporting} / ${site.tanksTotal}`} count={{ value: site.tanksReporting, format: (n) => `${Math.round(n)} / ${site.tanksTotal}` }} card={siteCard} />
        <div className="mg-kpi">
          <span className="mg-kpi__label">{t.mgColData}</span>
          <span className="mg-datacell">
            <SourceBadge source={site.source} />
            <DataBadge site={site} />
          </span>
        </div>
      </div>
      <Legend classes={site.classes.filter((row) => row.quantityKg > 0).map((row) => row.code)} onHighlight={onHighlight} onPick={onClass} />
      <ul className="mg-list">
        <li className="mg-row mg-row--class mg-row--head" aria-hidden="true">
          <span>{t.mgColClass}</span>
          <span>{t.mgColStockCap}</span>
          <span className="num">{t.mgColFill}</span>
          <span className="num">{t.mgColTanks}</span>
        </li>
        {CLASS_ORDER.map((code) => site.classes.find((row) => row.code === code))
          .filter((row): row is ClassTotals => row != null)
          .map((row, index) => (
            <Fragment key={row.code}>
            <li style={stagger(index)}>
              <ExpandToggle code={row.code} />
              <button type="button" className="mg-row mg-row--class" data-class={row.code} onClick={() => onClass(row.code)}>
                <ClassName code={row.code} />
                <ClassStock totals={row} scaleMax={scaleMax} cardKey={`site-class-${row.code}`} card={(hide) => <ClassAtSiteCard site={site} code={row.code} hide={hide} />} />
                <span className="num mg-fill"><FillText ratio={row.fillRatio} /></span>
                <span className="num">{row.tanks}</span>
              </button>
            </li>
            {split && EXPANDABLE.has(row.code) ? (
              <ProductRows code={row.code} tanks={site.tanks.filter((tank) => tank.commodityClass === row.code)} scaleMax={scaleMax} onOpen={(product) => onProduct(row.code, product)} />
            ) : null}
            </Fragment>
          ))}
      </ul>
    </>
  )
}

/** The commodity-first path: one commodity, site by site. */
function SitesForClass({ sites, cls, onSite }: { sites: PortfolioSite[]; cls: CommodityClass; onSite: (id: string) => void }) {
  const { t } = useLocale()
  const rows = sites
    .map((site) => ({ site, totals: site.classes.find((row) => row.code === cls) }))
    .filter((row): row is { site: PortfolioSite; totals: ClassTotals } => row.totals != null)
  const scaleMax = Math.max(1, ...rows.map((row) => row.totals.capacityTotalKg))
  return (
    <ul className="mg-list">
      <li className="mg-row mg-row--class mg-row--head" aria-hidden="true">
        <span>{t.mgColSite}</span>
        <span>{t.mgColStockCap}</span>
        <span className="num">{t.mgColFill}</span>
        <span className="num">{t.mgColTanks}</span>
      </li>
      {rows.map(({ site, totals }, index) => (
        <li key={site.id} style={stagger(index)}>
          <button type="button" className="mg-row mg-row--class" onClick={() => onSite(site.id)}>
            <span className="mg-name">
              <strong>{site.name}</strong>
              <small className="mg-datacell">
                <SourceBadge source={site.source} />
                <DataBadge site={site} />
              </small>
            </span>
            <ClassStock totals={totals} scaleMax={scaleMax} cardKey={`class-site-${site.id}`} card={(hide) => <ClassAtSiteCard site={site} code={cls} hide={hide} />} />
            <span className="num mg-fill"><FillText ratio={totals.fillRatio} /></span>
            <span className="num">{totals.tanks}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function FlaggedView({
  sites,
  status,
  onTank,
  onSite,
}: {
  sites: PortfolioSite[]
  status: string
  onTank: (siteId: string, tankId: string) => void
  onSite: (siteId: string) => void
}) {
  const { t } = useLocale()
  if (status === 'stale') {
    const stale = sites.filter((site) => site.stale)
    return (
      <ul className="mg-list">
        {stale.length === 0 ? <li className="mg-muted">{t.mgNoTanks}</li> : null}
        {stale.map((site, index) => (
          <li key={site.id} style={stagger(index)}>
            <button type="button" className="mg-row mg-row--flat" onClick={() => onSite(site.id)}>
              <span className="mg-name"><strong>{site.name}</strong></span>
              <span className="mg-datacell">
                <SourceBadge source={site.source} />
                <DataBadge site={site} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }
  const wanted = FLAG_KINDS.includes(status as TankStatus) ? (status as TankStatus) : 'near-full'
  const rows = sites
    .flatMap((site) => site.tanks.filter((tank) => tank.status === wanted).map((tank) => ({ site, tank })))
    .sort((a, b) => (b.tank.fillRatio ?? 0) - (a.tank.fillRatio ?? 0) || compareTankIds(a.tank.tankId, b.tank.tankId))
  return <TankTable rows={rows} showSite onTank={onTank} />
}

function TankTable({
  rows,
  showSite,
  onTank,
}: {
  rows: Array<{ site: PortfolioSite; tank: PortfolioTank }>
  showSite?: boolean
  onTank: (siteId: string, tankId: string) => void
}) {
  const { t, locale } = useLocale()
  const label = useClassLabel()
  if (rows.length === 0) return <p className="mg-muted">{t.mgNoTanks}</p>
  return (
    <div className="mg-table-wrap">
      <table className="mg-table">
        <thead>
          <tr>
            {showSite ? <th>{t.mgColSite}</th> : null}
            <th>{t.mgColTank}</th>
            <th>{t.mgColProduct}</th>
            <th>{t.mgColFill}</th>
            <th className="num">{t.mgColQty}</th>
            <th className="num">{t.mgColCap}</th>
            <th className="num">{t.mgColTemp}</th>
            <th>{t.mgColStatus}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ site, tank }, index) => (
            <tr key={`${site.id}/${tank.tankId}`} className="mg-tr" style={stagger(index)} tabIndex={0} onClick={() => onTank(site.id, tank.tankId)} onKeyDown={(event) => event.key === 'Enter' && onTank(site.id, tank.tankId)}>
              {showSite ? (
                <td>
                  <span className="mg-sitecell">
                    <SourceBadge source={tank.source} compact />
                    {site.name}
                  </span>
                </td>
              ) : null}
              <td>
                <strong>{tank.tankId}</strong>
              </td>
              <td>
                <ClassDot code={tank.commodityClass} /> {tank.productName || label(tank.commodityClass)}
              </td>
              <td className="mg-td-fill">
                {tank.capacityKg != null && tank.quantityKg != null ? (
                  <span className="mg-fillcell">
                    <StockBar quantityKg={tank.quantityKg} capacityTotalKg={tank.capacityKg} scaleMax={tank.capacityKg} tick={0.9} />
                    <b>{formatPercent(tank.fillRatio, locale)}</b>
                  </span>
                ) : (
                  <span className="mg-muted">—</span>
                )}
              </td>
              <td className="num">{formatTonnes(tank.quantityKg, locale)}</td>
              <td className="num">{formatTonnes(tank.capacityKg, locale)}</td>
              <td className="num">{tank.temperatureC == null ? '—' : tank.temperatureC.toFixed(1)}</td>
              <td>
                <StatusChip status={tank.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The chevron beside a class that can be opened into its products. It flips the same switch as the legend. */
function ExpandToggle({ code }: { code: CommodityClass }) {
  const { t } = useLocale()
  const { split, toggleSplit } = useViewOptions()
  if (!EXPANDABLE.has(code)) return null
  return (
    <button type="button" className={split ? 'mg-expand is-open' : 'mg-expand'} aria-expanded={split} aria-label={split ? t.mgSplitHide : t.mgSplitShow} title={split ? t.mgSplitHide : t.mgSplitShow} onClick={toggleSplit}>
      <ChevronRight size={14} aria-hidden="true" />
    </button>
  )
}

/** A class's products as indented rows under it. Each can open its own tank list when `onOpen` is given. */
function ProductRows({ code, tanks, scaleMax, onOpen }: { code: CommodityClass; tanks: PortfolioTank[]; scaleMax: number; onOpen?: (product: string) => void }) {
  const { locale } = useLocale()
  return (
    <>
      {/* A product with no stock and no capacity has nothing to show, so it stays out of the list. */}
      {productTotals(tanks)
        .filter((item) => item.quantityKg > 0 || item.capacityTotalKg > 0)
        .map((item, index) => {
        const body = (
          <>
            <span className="mg-name">
              <strong>
                <i className="mg-dot" style={{ background: tintOf(item.key, code).background }} aria-hidden="true" /> {item.key}
              </strong>
            </span>
            <span className="mg-stock">
              <StockBar quantityKg={item.quantityKg} capacityTotalKg={item.capacityTotalKg} scaleMax={scaleMax} />
              <small>
                {formatTonnes(item.quantityKg, locale)} / {formatTonnes(item.capacityTotalKg, locale)} t
              </small>
            </span>
            <span className="num mg-fill"><FillText ratio={item.fillRatio} /></span>
            <span className="num">{item.tanks}</span>
          </>
        )
        return (
          <li key={item.key} className="mg-sub" style={stagger(index)}>
            {onOpen ? (
              <button type="button" className="mg-row mg-row--class mg-row--sub" onClick={() => onOpen(item.key)}>
                {body}
              </button>
            ) : (
              <div className="mg-row mg-row--class mg-row--sub">{body}</div>
            )}
          </li>
        )
      })}
    </>
  )
}
