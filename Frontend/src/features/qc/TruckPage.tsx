import { useMemo } from 'react'
import { formatDay } from '../../domain/format.ts'
import { QC, contractText, contractVerdict, inRange, overMax, type TruckRow } from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, Num, QcChrome, VerdictBadge } from './qcChrome.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'

export function TruckPage() {
  const { t, locale } = useLocale()
  const { start, end, setRange } = useQcRange()
  const sort = useColumnSort()
  const sheet = QC.trucks
  const rows = useMemo(
    () => sheet.rows.filter((row) => inRange(row.sampledOn, start, end)),
    [sheet.rows, start, end],
  )
  const undated = useMemo(() => sheet.rows.filter((row) => row.sampledOn == null), [sheet.rows])
  const verdicts = rows.map((row) => contractVerdict(row.ffa, row.moisture, sheet.ffaMax, sheet.moistureMax))
  const passed = verdicts.filter((verdict) => verdict === 'pass').length
  const rejected = verdicts.filter((verdict) => verdict === 'rejected').length
  const remarks = new Set(rows.map((row) => row.remark).filter((remark): remark is string => Boolean(remark))).size
  const ordered = sortRows(rows, sort.key, sort.dir, (row, column) => truckValue(row, column, sheet.ffaMax, sheet.moistureMax))
  const note = [sheet.material, sheet.vessel, contractText(sheet.ffaMax, sheet.moistureMax, null)].filter(Boolean).join(' · ')

  return (
    <QcChrome title={t.qcTruck} start={start} end={end} setRange={setRange} note={note}>
      <section className="prod-kpis" aria-label={t.qcTruck}>
        <Kpi label={t.trucksSampled} value={String(rows.length)} />
        <Kpi label={t.pass} value={String(passed)} tone="yield" />
        <Kpi label={t.rejected} value={String(rejected)} tone={rejected > 0 ? 'alert' : undefined} />
        <Kpi label={t.unloadRemarks} value={String(remarks)} />
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{t.qcTruck}</h2>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.colDate} column="date" sort={sort} />
                <SortHeader label={t.policeNo} column="police" sort={sort} />
                <SortHeader label="FFA" column="ffa" sort={sort} align="right" />
                <SortHeader label="M&I" column="moisture" sort={sort} align="right" />
                <SortHeader label="IV" column="iv" sort={sort} align="right" />
                <SortHeader label="DOBI" column="dobi" sort={sort} align="right" />
                <SortHeader label="PV" column="pv" sort={sort} align="right" />
                <SortHeader label={t.colourR} column="colorR" sort={sort} align="right" />
                <SortHeader label={t.colourY} column="colorY" sort={sort} align="right" />
                <SortHeader label={t.analyst} column="analyst" sort={sort} />
                <SortHeader label={t.remark} column="remark" sort={sort} />
                <SortHeader label={t.pass} column="verdict" sort={sort} />
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 && <tr><td colSpan={12}>{t.noQcRows}</td></tr>}
              {ordered.map((row) => (
                <tr key={`${row.sampledOn}-${row.policeNo}-${row.ffa}-${row.moisture}`}>
                  <td>{row.sampledOn ? formatDay(row.sampledOn, locale) : '-'}</td>
                  <td>{row.policeNo}</td>
                  <Num value={row.ffa} breach={overMax(row.ffa, sheet.ffaMax)} />
                  <Num value={row.moisture} breach={overMax(row.moisture, sheet.moistureMax)} />
                  <Num value={row.iv} />
                  <Num value={row.dobi} />
                  <Num value={row.pv} />
                  <Num value={row.colorR} />
                  <Num value={row.colorY} />
                  <td>{row.analyst ?? '-'}</td>
                  <td>{row.remark ?? '-'}</td>
                  <td><VerdictBadge verdict={contractVerdict(row.ffa, row.moisture, sheet.ffaMax, sheet.moistureMax)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {undated.length > 0 && (
        <section className="prod-panel">
          <h2 className="card__title">{t.noSampleDate}</h2>
          <div className="prod-scroll">
            <table className="prod-table prod-table--fit">
              <thead>
                <tr>
                  <th>{t.policeNo}</th>
                  <th className="num">FFA</th>
                  <th className="num">M&I</th>
                  <th>{t.analyst}</th>
                  <th>{t.remark}</th>
                  <th>{t.pass}</th>
                </tr>
              </thead>
              <tbody>
                {undated.map((row) => (
                  <tr key={`${row.policeNo}-${row.ffa}-${row.moisture}`}>
                    <td>{row.policeNo}</td>
                    <Num value={row.ffa} breach={overMax(row.ffa, sheet.ffaMax)} />
                    <Num value={row.moisture} breach={overMax(row.moisture, sheet.moistureMax)} />
                    <td>{row.analyst ?? '-'}</td>
                    <td>{row.remark ?? '-'}</td>
                    <td><VerdictBadge verdict={contractVerdict(row.ffa, row.moisture, sheet.ffaMax, sheet.moistureMax)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </QcChrome>
  )
}

function truckValue(row: TruckRow, column: string, ffaMax: number | null, moistureMax: number | null) {
  if (column === 'date') return row.sampledOn
  if (column === 'police') return row.policeNo
  if (column === 'ffa') return row.ffa
  if (column === 'moisture') return row.moisture
  if (column === 'iv') return row.iv
  if (column === 'dobi') return row.dobi
  if (column === 'pv') return row.pv
  if (column === 'colorR') return row.colorR
  if (column === 'colorY') return row.colorY
  if (column === 'analyst') return row.analyst
  if (column === 'remark') return row.remark
  const verdict = contractVerdict(row.ffa, row.moisture, ffaMax, moistureMax)
  if (verdict === 'pass') return 0
  if (verdict === 'rejected') return 2
  return 1
}
