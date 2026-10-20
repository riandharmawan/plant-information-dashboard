import { useMemo } from 'react'
import {
  QC,
  contractVerdict,
  inRange,
  latestStorage,
  movementDirection,
  retestDue,
  storageInRange,
  vesselVerdict,
} from '../../domain/qc.ts'
import { formatDay } from '../../domain/format.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, QcChrome } from './qcChrome.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'

export function QcOverviewPage() {
  const { t, locale } = useLocale()
  const { start, end, setRange } = useQcRange()
  const oilSort = useColumnSort()
  const inboundSort = useColumnSort()

  const latest = useMemo(() => latestStorage(storageInRange(start, end)), [start, end])
  const retests = latest.filter(retestDue).length
  const snapshotOn = latest[0]?.snapshotOn ?? null
  const revision = latest[0]?.revision ?? 1
  const revisionCount = new Set(
    storageInRange(start, end).filter((row) => row.snapshotOn === snapshotOn).map((row) => row.revision),
  ).size

  const trucks = QC.trucks.rows.filter((row) => inRange(row.sampledOn, start, end))
  const vessels = QC.vessels.filter((row) => inRange(row.arrival, start, end))
  const truckVerdicts = trucks.map((row) => contractVerdict(row.ffa, row.moisture, QC.trucks.ffaMax, QC.trucks.moistureMax))
  const vesselVerdicts = vessels.map(vesselVerdict)
  const passed = [...truckVerdicts, ...vesselVerdicts].filter((verdict) => verdict === 'pass').length
  const rejected = [...truckVerdicts, ...vesselVerdicts].filter((verdict) => verdict === 'rejected').length

  const oilRows = [...new Map(latest.map((row) => [row.oil || '—', { oil: row.oil || '—', tanks: 0, retest: 0 }])).values()]
  for (const row of latest) {
    const key = row.oil || '—'
    const bucket = oilRows.find((item) => item.oil === key)
    if (!bucket) continue
    bucket.tanks += 1
    if (retestDue(row)) bucket.retest += 1
  }
  const oils = sortRows(oilRows, oilSort.key, oilSort.dir, (row, column) => {
    if (column === 'oil') return row.oil
    if (column === 'tanks') return row.tanks
    return row.retest
  })

  const inboundRows = [
    {
      source: t.qcTruck,
      count: trucks.length,
      passed: truckVerdicts.filter((verdict) => verdict === 'pass').length,
      rejected: truckVerdicts.filter((verdict) => verdict === 'rejected').length,
      pending: truckVerdicts.filter((verdict) => verdict === 'spec-pending').length,
    },
    {
      source: t.qcVessel,
      count: vessels.length,
      passed: vesselVerdicts.filter((verdict) => verdict === 'pass').length,
      rejected: vesselVerdicts.filter((verdict) => verdict === 'rejected').length,
      pending: vesselVerdicts.filter((verdict) => verdict === 'spec-pending').length,
    },
  ]
  const inbound = sortRows(inboundRows, inboundSort.key, inboundSort.dir, (row, column) => {
    if (column === 'source') return row.source
    return row[column as 'count' | 'passed' | 'rejected' | 'pending']
  })

  const directions = { inbound: 0, outbound: 0, unknown: 0 }
  for (const row of QC.movements.rows) directions[movementDirection(row.sealIn, row.sealOut)] += 1
  const period = QC.movements.periodStart && QC.movements.periodEnd
    ? `${formatDay(QC.movements.periodStart, locale)} – ${formatDay(QC.movements.periodEnd, locale)}`
    : ''

  const families = new Set(latest.map((row) => row.oil).filter(Boolean)).size

  return (
    <QcChrome title={t.qcTitle} start={start} end={end} setRange={setRange}>
      <section className="prod-kpis" aria-label={t.qcTitle}>
        <Kpi label={t.tanksLogged} value={String(latest.length)} />
        <Kpi label={t.retestDue} value={String(retests)} tone={retests > 0 ? 'alert' : undefined} />
        <Kpi label={t.inboundPassed} value={String(passed)} tone="yield" />
        <Kpi label={t.inboundRejected} value={String(rejected)} tone={rejected > 0 ? 'alert' : undefined} />
      </section>

      <div className="prod-layout">
        <section className="prod-panel">
          <h2 className="card__title">
            {t.latestSnapshot}
            {snapshotOn ? ` · ${formatDay(snapshotOn, locale)}` : ''}
            {revisionCount > 1 ? ` · ${t.revisionShort} ${revision}` : ''}
          </h2>
          <p className="page-note">{t.oilTypes}: {families}</p>
          <div className="prod-scroll">
            <table className="prod-table prod-table--fit">
              <thead>
                <tr>
                  <SortHeader label={t.oilTypes} column="oil" sort={oilSort} />
                  <SortHeader label={t.tanksLogged} column="tanks" sort={oilSort} align="right" />
                  <SortHeader label={t.retestDue} column="retest" sort={oilSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {oils.length === 0 && (
                  <tr><td colSpan={3}>{t.noQcRows}</td></tr>
                )}
                {oils.map((row) => (
                  <tr key={row.oil}>
                    <td>{row.oil}</td>
                    <td className="num">{row.tanks}</td>
                    <td className={row.retest > 0 ? 'num num--neg' : 'num'}>{row.retest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="prod-panel">
          <h2 className="card__title">{t.qcMovements}</h2>
          <div className="prod-scroll">
            <table className="prod-table prod-table--fit">
              <thead>
                <tr>
                  <th>{t.direction}</th>
                  <th className="num">{t.movementCount}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t.inbound}</td>
                  <td className="num">{directions.inbound}</td>
                </tr>
                <tr>
                  <td>{t.outbound}</td>
                  <td className="num">{directions.outbound}</td>
                </tr>
                <tr>
                  <td>{t.notClassified}</td>
                  <td className="num">{directions.unknown}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="page-note">{t.gatePeriodNote.replace('{period}', period)}</p>
        </section>
      </div>

      <section className="prod-panel">
        <h2 className="card__title">{t.incoming}</h2>
        <div className="prod-scroll">
          <table className="prod-table prod-table--fit">
            <thead>
              <tr>
                <SortHeader label={t.incoming} column="source" sort={inboundSort} />
                <SortHeader label={t.movementCount} column="count" sort={inboundSort} align="right" />
                <SortHeader label={t.pass} column="passed" sort={inboundSort} align="right" />
                <SortHeader label={t.rejected} column="rejected" sort={inboundSort} align="right" />
                <SortHeader label={t.incomplete} column="pending" sort={inboundSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {inbound.map((row) => (
                <tr key={row.source}>
                  <td>{row.source}</td>
                  <td className="num">{row.count}</td>
                  <td className="num">{row.passed}</td>
                  <td className={row.rejected > 0 ? 'num num--neg' : 'num'}>{row.rejected}</td>
                  <td className="num">{row.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </QcChrome>
  )
}
