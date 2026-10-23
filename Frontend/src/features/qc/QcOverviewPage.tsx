import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  STORAGE_TANK_IDS,
  ageAtSnapshot,
  contractVerdict,
  dobiLow,
  inRange,
  ivOutside,
  latestStorage,
  movementDirection,
  overMax,
  retestDue,
  storageInRange,
  truckKey,
  vesselVerdict,
} from '../../domain/qc.ts'
import { useQcFile } from '../../data/QcContext.tsx'
import { formatDay, tankLabel } from '../../domain/format.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, QcChrome, useParam } from './qcChrome.tsx'
import { SortHeader, qcSearch, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'
import { DirectionTrack, Identity, Legend, ProductBoard, Split, fill, type LegendItem } from './qcVisual.tsx'

type Attention = {
  key: string
  severity: 2 | 1
  badge: 'over' | 'watch' | 'retest'
  place: string
  product: string | null
  reason: string
  to: string
}

const ATTENTION_SHOWN = 8

export function QcOverviewPage() {
  const { t, locale } = useLocale()
  const param = useParam()
  const qc = useQcFile()
  const { start, end, setRange } = useQcRange()
  const search = qcSearch(start, end)
  const inboundSort = useColumnSort()

  const latest = useMemo(() => latestStorage(storageInRange(start, end, qc)), [qc, start, end])
  const retests = latest.filter(retestDue).length
  const snapshotOn = latest[0]?.snapshotOn ?? null
  const revision = latest[0]?.revision ?? 1
  const revisionCount = new Set(
    storageInRange(start, end, qc).filter((row) => row.snapshotOn === snapshotOn).map((row) => row.revision),
  ).size

  const trucks = qc.trucks.rows.filter((row) => inRange(row.sampledOn, start, end))
  const vessels = qc.vessels.filter((row) => inRange(row.arrival, start, end))
  const truckVerdicts = trucks.map((row) => contractVerdict(row.ffa, row.moisture, qc.trucks.ffaMax, qc.trucks.moistureMax))
  const vesselVerdicts = vessels.map(vesselVerdict)
  const passed = [...truckVerdicts, ...vesselVerdicts].filter((verdict) => verdict === 'pass').length
  const rejected = [...truckVerdicts, ...vesselVerdicts].filter((verdict) => verdict === 'rejected').length

  const attention: Attention[] = []
  trucks.forEach((row, index) => {
    if (truckVerdicts[index] !== 'rejected') return
    const reasons: string[] = []
    if (overMax(row.ffa, qc.trucks.ffaMax)) reasons.push(fill(t.reasonOver, { param: 'FFA', value: param('ffa', row.ffa), max: qc.trucks.ffaMax ?? '-' }))
    if (overMax(row.moisture, qc.trucks.moistureMax)) reasons.push(fill(t.reasonOver, { param: 'M&I', value: param('moisture', row.moisture), max: qc.trucks.moistureMax ?? '-' }))
    attention.push({
      key: `truck-${truckKey(row)}-${index}`,
      severity: 2,
      badge: 'over',
      place: row.policeNo,
      product: qc.trucks.material,
      reason: `${reasons.join(' · ')}${row.sampledOn ? ` · ${formatDay(row.sampledOn, locale)}` : ''}`,
      to: `/qc/truck${search}&focus=${encodeURIComponent(truckKey(row))}`,
    })
  })
  for (const ticket of vessels) {
    const to = `/qc/vessel${search}&ticket=${encodeURIComponent(ticket.id)}`
    const place = ticket.ship ?? ticket.id
    const over: string[] = []
    if (overMax(ticket.composite.ffa, ticket.ffaMax)) over.push(fill(t.reasonOver, { param: 'FFA', value: param('ffa', ticket.composite.ffa), max: ticket.ffaMax ?? '-' }))
    if (overMax(ticket.composite.moisture, ticket.moistureMax)) over.push(fill(t.reasonOver, { param: 'M&I', value: param('moisture', ticket.composite.moisture), max: ticket.moistureMax ?? '-' }))
    for (const sample of ticket.samples) {
      if (overMax(sample.ffa, ticket.ffaMax)) over.push(`${sample.palka} ${fill(t.reasonOver, { param: 'FFA', value: param('ffa', sample.ffa), max: ticket.ffaMax ?? '-' })}`)
      if (overMax(sample.moisture, ticket.moistureMax)) over.push(`${sample.palka} ${fill(t.reasonOver, { param: 'M&I', value: param('moisture', sample.moisture), max: ticket.moistureMax ?? '-' })}`)
    }
    if (over.length > 0) {
      attention.push({ key: `vessel-over-${ticket.id}`, severity: 2, badge: 'over', place, product: ticket.commodity, reason: over.join(' · '), to })
    }
    const watch: string[] = []
    if (ivOutside(ticket.composite.iv)) watch.push(fill(t.reasonWatch, { param: 'IV', value: param('iv', ticket.composite.iv) }))
    if (dobiLow(ticket.composite.dobi)) watch.push(fill(t.reasonWatch, { param: 'DOBI', value: param('dobi', ticket.composite.dobi) }))
    if (watch.length > 0) {
      attention.push({ key: `vessel-watch-${ticket.id}`, severity: 1, badge: 'watch', place, product: ticket.commodity, reason: watch.join(' · '), to })
    }
  }
  for (const row of latest) {
    if (!retestDue(row)) continue
    attention.push({
      key: `tank-${row.tankId}`,
      severity: 1,
      badge: 'retest',
      place: tankLabel(row.tankId),
      product: row.oil || null,
      reason: fill(t.reasonRetest, { days: ageAtSnapshot(row.analysisDate, row.snapshotOn) ?? '-' }),
      to: `/qc/storage${search}&tank=${row.tankId}`,
    })
  }
  attention.sort((left, right) => right.severity - left.severity)

  const inboundRows = [
    {
      source: t.qcTruck,
      to: `/qc/truck${search}`,
      count: trucks.length,
      passed: truckVerdicts.filter((verdict) => verdict === 'pass').length,
      rejected: truckVerdicts.filter((verdict) => verdict === 'rejected').length,
      pending: truckVerdicts.filter((verdict) => verdict === 'spec-pending').length,
    },
    {
      source: t.qcVessel,
      to: `/qc/vessel${search}`,
      count: vessels.length,
      passed: vesselVerdicts.filter((verdict) => verdict === 'pass').length,
      rejected: vesselVerdicts.filter((verdict) => verdict === 'rejected').length,
      pending: vesselVerdicts.filter((verdict) => verdict === 'spec-pending').length,
    },
  ]
  const inbound = sortRows(inboundRows, inboundSort.key, inboundSort.dir, (row, column) => {
    if (column === 'source') return row.source
    if (column === 'mix') return row.count === 0 ? null : row.passed / row.count
    return row[column as 'count']
  })

  const movements = qc.movements.rows.filter((row) => row.movementDate == null || inRange(row.movementDate, start, end))
  const directions = { inbound: 0, outbound: 0, unknown: 0 }
  for (const row of movements) directions[movementDirection(row.sealIn, row.sealOut)] += 1
  const period = qc.movements.periodStart && qc.movements.periodEnd
    ? `${formatDay(qc.movements.periodStart, locale)} – ${formatDay(qc.movements.periodEnd, locale)}`
    : ''

  const legend: LegendItem[] = []
  if (attention.some((item) => item.badge === 'over')) legend.push('over')
  if (attention.some((item) => item.badge === 'watch')) legend.push('watch')
  if (retests > 0) legend.push('retest')
  legend.push('nospec')

  const badgeFor = (item: Attention) => {
    if (item.badge === 'over') return <span className="badge badge--danger">{t.overMax}</span>
    if (item.badge === 'watch') return <span className="badge badge--warning">{t.watch}</span>
    return <span className="badge badge--warning">{t.retest}</span>
  }

  return (
    <QcChrome title={t.qcTitle} start={start} end={end} setRange={setRange} legend={<Legend items={legend} />}>
      <section className="prod-kpis" aria-label={t.qcTitle}>
        <Kpi label={t.tanksLogged} value={String(latest.length)} />
        <Kpi label={t.retestDue} value={String(retests)} tone={retests > 0 ? 'alert' : undefined} />
        <Kpi label={t.inboundPassed} value={String(passed)} tone="yield" />
        <Kpi label={t.inboundRejected} value={String(rejected)} tone={rejected > 0 ? 'alert' : undefined} />
      </section>

      <section className="prod-panel" aria-label={t.needsAttention}>
        <h2 className="card__title">{t.needsAttention}{attention.length > 0 ? ` · ${attention.length}` : ''}</h2>
        {attention.length === 0 ? (
          <p className="qc-attention__ok">{t.nothingNeedsAttention}</p>
        ) : (
          <ul className="qc-attention">
            {attention.slice(0, ATTENTION_SHOWN).map((item) => (
              <li key={item.key}>
                {badgeFor(item)}
                <Identity place={item.place} product={item.product} />
                <span>{item.reason}</span>
                <Link className="prod-plant-link" to={item.to}>{t.view}</Link>
              </li>
            ))}
          </ul>
        )}
        {attention.length > ATTENTION_SHOWN ? (
          <p className="page-note">{fill(t.moreItems, { count: attention.length - ATTENTION_SHOWN })}</p>
        ) : null}
      </section>

      <ProductBoard
        rows={latest}
        slots={STORAGE_TANK_IDS.length}
        linkFor={(tankId) => `/qc/storage${search}&tank=${tankId}`}
        subtitle={snapshotOn
          ? `${t.latestSnapshot} ${formatDay(snapshotOn, locale)}${revisionCount > 1 ? ` · ${t.revisionShort} ${revision}` : ''}`
          : null}
      />

      <div className="prod-layout">
        <section className="prod-panel">
          <h2 className="card__title">{t.incoming}</h2>
          <div className="prod-scroll">
            <table className="prod-table prod-table--fit">
              <thead>
                <tr>
                  <SortHeader label={t.incoming} column="source" sort={inboundSort} />
                  <SortHeader label={t.movementCount} column="count" sort={inboundSort} align="right" />
                  <SortHeader label={t.passMix} column="mix" sort={inboundSort} />
                </tr>
              </thead>
              <tbody>
                {inbound.map((row) => (
                  <tr key={row.source}>
                    <td><Link className="prod-plant-link" to={row.to}>{row.source}</Link></td>
                    <td className="num">{row.count}</td>
                    <td><Split pass={row.passed} pending={row.pending} rejected={row.rejected} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="prod-panel">
          <h2 className="card__title">
            <Link className="prod-plant-link" to={`/qc/movements${search}`}>{t.qcMovements}</Link>
            {` · ${movements.length}`}
          </h2>
          <DirectionTrack inbound={directions.inbound} outbound={directions.outbound} unknown={directions.unknown} />
          <p className="page-note">{t.gatePeriodNote.replace('{period}', period)}</p>
        </section>
      </div>
    </QcChrome>
  )
}
