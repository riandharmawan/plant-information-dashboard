import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQcFile } from '../../data/QcContext.tsx'
import { formatDay } from '../../domain/format.ts'
import { contractText, contractVerdict, inRange, overMax, truckKey, type TruckRow } from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Num, QcChrome, VerdictBadge } from './qcChrome.tsx'
import { QcDetailDialog, QcPanelOpen, TruckSamplesDetail } from './qcDialogs.tsx'
import { QcKpi } from './qcKpi.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'
import { ContractScatter, type ContractPoint } from './qcCharts.tsx'
import { Legend, type LegendItem } from './qcVisual.tsx'

type TruckDialog = null | 'sampled' | 'pass' | 'reject' | 'remarks' | 'scatter' | 'table'

export function TruckPage() {
  const { t, locale } = useLocale()
  const qc = useQcFile()
  const { start, end, setRange } = useQcRange()
  const [params, setParams] = useSearchParams()
  const focus = params.get('focus')
  const [dialog, setDialog] = useState<TruckDialog>(null)
  const sort = useColumnSort()
  const sheet = qc.trucks
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
  const note = [sheet.vessel, contractText(sheet.ffaMax, sheet.moistureMax, null)].filter(Boolean).join(' · ')
  const points: ContractPoint[] = rows
    .filter((row): row is TruckRow & { ffa: number; moisture: number } => row.ffa != null && row.moisture != null)
    .map((row) => ({
      key: truckKey(row),
      title: row.policeNo,
      detail: row.sampledOn ? formatDay(row.sampledOn, locale) : null,
      ffa: row.ffa,
      moisture: row.moisture,
      ffaMax: sheet.ffaMax,
      moistureMax: sheet.moistureMax,
    }))

  const pick = (key: string) => {
    const next = new URLSearchParams(params)
    next.set('focus', key)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!focus) return
    document.getElementById(`truck-${focus}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus, rows])

  const legend: LegendItem[] = []
  if (rejected > 0) legend.push('over')
  legend.push('missing')

  return (
    <QcChrome title={t.qcTruck} start={start} end={end} setRange={setRange} note={note} legend={<Legend items={legend} />}>
      <section className="prod-kpis" aria-label={t.qcTruck}>
        <QcKpi label={t.trucksSampled} value={String(rows.length)} onOpen={() => setDialog('sampled')} />
        <QcKpi label={t.pass} value={String(passed)} tone="yield" onOpen={() => setDialog('pass')} />
        <QcKpi label={t.rejected} value={String(rejected)} tone={rejected > 0 ? 'alert' : undefined} onOpen={() => setDialog('reject')} />
        <QcKpi label={t.unloadRemarks} value={String(remarks)} onOpen={() => setDialog('remarks')} />
      </section>
      <QcPanelOpen title={`${sheet.material} · ${t.ffaPct} / ${t.moisturePct}`} onOpen={() => setDialog('scatter')}>
        <ContractScatter
          points={points}
          ffaMax={sheet.ffaMax}
          moistureMax={sheet.moistureMax}
          caption={t.truckScatter}
          selectedKey={focus}
          onPick={pick}
        />
      </QcPanelOpen>
      <QcPanelOpen title={`${t.qcTruck} · ${sheet.material}`} onOpen={() => setDialog('table')}>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.colDate} column="date" sort={sort} />
                <SortHeader label={t.policeNo} column="police" sort={sort} />
                <SortHeader label={t.ffaPct} column="ffa" sort={sort} align="right" />
                <SortHeader label={t.moisturePct} column="moisture" sort={sort} align="right" />
                <SortHeader label="IV" column="iv" sort={sort} align="right" />
                <SortHeader label="DOBI" column="dobi" sort={sort} align="right" />
                <SortHeader label="PV" column="pv" sort={sort} align="right" />
                <SortHeader label={t.colourRLov} column="colorR" sort={sort} align="right" />
                <SortHeader label={t.colourYLov} column="colorY" sort={sort} align="right" />
                <SortHeader label={t.analyst} column="analyst" sort={sort} />
                <SortHeader label={t.remark} column="remark" sort={sort} />
                <SortHeader label={t.pass} column="verdict" sort={sort} />
              </tr>
            </thead>
            <tbody>
              {ordered.length === 0 && <tr><td colSpan={12}>{t.noQcRows}</td></tr>}
              {ordered.map((row, index) => {
                const key = truckKey(row)
                return (
                  <tr
                    key={`${key}-${index}`}
                    id={`truck-${key}`}
                    className={key === focus ? 'qc-pick prod-row--on' : 'qc-pick'}
                    onClick={() => pick(key)}
                  >
                    <td>{row.sampledOn ? formatDay(row.sampledOn, locale) : '-'}</td>
                    <td>{row.policeNo}</td>
                    <Num value={row.ffa} code="ffa" breach={overMax(row.ffa, sheet.ffaMax)} />
                    <Num value={row.moisture} code="moisture" breach={overMax(row.moisture, sheet.moistureMax)} />
                    <Num value={row.iv} code="iv" />
                    <Num value={row.dobi} code="dobi" />
                    <Num value={row.pv} code="pv" />
                    <Num value={row.colorR} code="colorR" />
                    <Num value={row.colorY} code="colorY" />
                    <td>{row.analyst ?? '-'}</td>
                    <td>{row.remark ?? '-'}</td>
                    <td><VerdictBadge verdict={contractVerdict(row.ffa, row.moisture, sheet.ffaMax, sheet.moistureMax)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </QcPanelOpen>
      <QcDetailDialog
        open={dialog != null}
        title={dialog === 'pass' ? t.pass : dialog === 'reject' ? t.rejected : dialog === 'remarks' ? t.unloadRemarks : t.qcTruck}
        start={start}
        end={end}
        onClose={() => setDialog(null)}
      >
        {dialog != null ? (
          <TruckSamplesDetail
            rows={dialog === 'pass'
              ? rows.filter((_, index) => verdicts[index] === 'pass')
              : dialog === 'reject'
                ? rows.filter((_, index) => verdicts[index] === 'rejected')
                : dialog === 'remarks'
                  ? rows.filter((row) => row.remark)
                  : rows}
            verdicts={dialog === 'pass'
              ? verdicts.filter((verdict) => verdict === 'pass')
              : dialog === 'reject'
                ? verdicts.filter((verdict) => verdict === 'rejected')
                : dialog === 'remarks'
                  ? rows.filter((row) => row.remark).map((row) => contractVerdict(row.ffa, row.moisture, sheet.ffaMax, sheet.moistureMax))
                  : verdicts}
          />
        ) : null}
      </QcDetailDialog>
      {undated.length > 0 && (
        <section className="prod-panel">
          <h2 className="card__title">{t.noSampleDate}</h2>
          <div className="prod-scroll">
            <table className="prod-table prod-table--fit">
              <thead>
                <tr>
                  <th>{t.policeNo}</th>
                  <th className="num">{t.ffaPct}</th>
                  <th className="num">{t.moisturePct}</th>
                  <th>{t.analyst}</th>
                  <th>{t.remark}</th>
                  <th>{t.pass}</th>
                </tr>
              </thead>
              <tbody>
                {undated.map((row) => (
                  <tr key={`${row.policeNo}-${row.ffa}-${row.moisture}`}>
                    <td>{row.policeNo}</td>
                    <Num value={row.ffa} code="ffa" breach={overMax(row.ffa, sheet.ffaMax)} />
                    <Num value={row.moisture} code="moisture" breach={overMax(row.moisture, sheet.moistureMax)} />
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
