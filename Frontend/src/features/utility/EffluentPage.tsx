import { useState } from 'react'
import { formatDay } from '../../domain/format.ts'
import { WWTP, daysInRange, formOf, latestReadings, readingKey, type UtilityReading } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SortHeader, sortRows, useColumnSort } from '../qc/qcNav.tsx'
import { fill } from '../qc/qcVisual.tsx'
import { FormCoverageDetail, ReadingRowsDetail, UtilityDetailDialog, UtilityPanelOpen } from './utilityDialogs.tsx'
import { UtilityKpi } from './utilityKpi.tsx'
import { PrintedBullet, ReadingHistoryDialog, axisDay } from './utilityCharts.tsx'
import { CoverageBar, UtilityChrome, useNumber, useUtility, useUtilityRange } from './utilityShell.tsx'

const INLET = 'INLET WASTE WATER'
const OUTLET = 'OUTLET WASTE WATER'
const SIDE_TESTS = ['pH', 'COD', 'TSS', 'TDS', 'Turbidity']

type EffluentDialog = null | 'inletCod' | 'outletCod' | 'outletTss' | 'coverage' | 'inletOutlet'

export function EffluentPage() {
  const { t, locale } = useLocale()
  const number = useNumber()
  const { summary } = useUtility()
  const { start, end } = useUtilityRange()
  const [history, setHistory] = useState<{ title: string; rows: UtilityReading[] } | null>(null)
  const [dialog, setDialog] = useState<EffluentDialog>(null)
  const sort = useColumnSort()
  const form = formOf(summary, WWTP)
  const days = daysInRange(start, end)
  const inRange = summary.readings.filter((row) => row.form === WWTP)
  const { date, rows } = latestReadings(summary, WWTP)

  const latestOf = (group: string, test: string) => [...inRange].reverse().find((row) => row.group === group && row.tag === test && row.value != null) ?? null
  const valuesOf = (group: string, test: string) => inRange.flatMap((row) => (row.group === group && row.tag === test && row.value != null ? [row.value] : []))
  const openHistory = (reading: UtilityReading) => {
    const key = readingKey(reading)
    setHistory({ title: `${reading.group ?? ''} · ${reading.tag}`, rows: inRange.filter((row) => readingKey(row) === key) })
  }
  const openTest = (group: string, test: string) => {
    const row = latestOf(group, test)
    if (row) openHistory(row)
    else setDialog('inletOutlet')
  }
  const general = rows.filter((row) => row.group !== INLET && row.group !== OUTLET)
  const sortedGeneral = sortRows(general, sort.key, sort.dir, (row, key) => {
    if (key === 'group') return row.group
    if (key === 'test') return row.tag
    if (key === 'value') return row.value ?? row.text
    return row.remark
  })
  const sideTests = SIDE_TESTS.filter((test) => latestOf(INLET, test) || latestOf(OUTLET, test))

  const dialogTitle = () => {
    if (dialog === 'inletCod') return t.inletCod
    if (dialog === 'outletCod') return t.outletCod
    if (dialog === 'outletTss') return t.outletTss
    if (dialog === 'coverage') return t.wwtpCoverage
    if (dialog === 'inletOutlet') return t.inletVsOutlet
    return ''
  }

  return (
    <UtilityChrome title={t.utilityEffluent} day={date} note={fill(t.effluentCoverage, { logged: form?.logged.length ?? 0, days })}>
      <section className="prod-kpis" aria-label={t.utilityEffluent}>
        <UtilityKpi
          label={latestOf(INLET, 'COD') ? `${t.inletCod} · ${axisDay(latestOf(INLET, 'COD')!.date, locale)}` : t.inletCod}
          value={number(latestOf(INLET, 'COD')?.value ?? null)}
          onOpen={() => openTest(INLET, 'COD')}
        />
        <UtilityKpi
          label={latestOf(OUTLET, 'COD') ? `${t.outletCod} · ${axisDay(latestOf(OUTLET, 'COD')!.date, locale)}` : t.outletCod}
          value={number(latestOf(OUTLET, 'COD')?.value ?? null)}
          onOpen={() => openTest(OUTLET, 'COD')}
        />
        <UtilityKpi
          label={latestOf(OUTLET, 'TSS') ? `${t.outletTss} · ${axisDay(latestOf(OUTLET, 'TSS')!.date, locale)}` : t.outletTss}
          value={number(latestOf(OUTLET, 'TSS')?.value ?? null)}
          onOpen={() => openTest(OUTLET, 'TSS')}
        />
        <UtilityKpi
          label={t.daysLogged}
          value={`${form?.logged.length ?? 0} / ${days}`}
          track={days === 0 ? null : (form?.logged.length ?? 0) / days}
          onOpen={() => setDialog('coverage')}
        />
      </section>

      <UtilityPanelOpen title={`${t.wwtpCoverage} · ${WWTP}`} onOpen={() => setDialog('coverage')}>
        <CoverageBar logged={form?.logged.length ?? 0} empty={form?.empty.length ?? 0} days={days} />
      </UtilityPanelOpen>

      <UtilityPanelOpen title={t.inletVsOutlet} onOpen={() => setDialog('inletOutlet')}>
        {sideTests.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
          <div className="prod-layout">
            {[INLET, OUTLET].map((group) => (
              <div key={group}>
                <h3 className="qc-dialog__chart-title">{group === INLET ? t.inlet : t.outlet}</h3>
                <div className="qc-bullets">
                  {sideTests.map((test) => {
                    const row = latestOf(group, test)
                    if (!row) return <PrintedBullet key={test} info={{ tag: test, name: test, spec: null, unit: null, min: null, max: null }} value={null} values={[]} />
                    return (
                      <PrintedBullet
                        key={test}
                        info={row}
                        label={`${test}${row.valueUnit ? ` (${row.valueUnit})` : ''} · ${axisDay(row.date, locale)}`}
                        value={row.value}
                        values={valuesOf(group, test)}
                        onOpen={() => openHistory(row)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </UtilityPanelOpen>

      <section className="prod-panel">
        <h2 className="card__title">{t.generalLevels}{date ? ` · ${formatDay(date, locale)}` : ''}</h2>
        {general.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
          <div className="prod-scroll">
            <table className="prod-table prod-table--fit">
              <thead>
                <tr>
                  <SortHeader label={t.samplePoint} column="group" sort={sort} />
                  <SortHeader label={t.test} column="test" sort={sort} />
                  <SortHeader label={t.resultValue} column="value" sort={sort} align="right" />
                  <SortHeader label={t.remark} column="remark" sort={sort} />
                </tr>
              </thead>
              <tbody>
                {sortedGeneral.map((row, index) => (
                  <tr key={`${row.group}-${row.tag}-${index}`}>
                    <td>{row.group ?? '-'}</td>
                    <td>{row.tag ?? '-'}</td>
                    <td className={row.value == null && !row.text ? 'num num--empty' : 'num'}>
                      {row.value != null ? (
                        <button type="button" className="qty-link" onClick={() => openHistory(row)}>
                          {number(row.value)}{row.valueUnit ? ` ${row.valueUnit}` : ''}
                        </button>
                      ) : (row.text ?? '-')}
                    </td>
                    <td className="qc-wrap">{row.remark ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <UtilityDetailDialog open={dialog != null} title={dialogTitle()} start={start} end={end} onClose={() => setDialog(null)}>
        {dialog === 'coverage' && form ? <FormCoverageDetail form={form} start={start} end={end} /> : null}
        {dialog === 'inletOutlet' ? <ReadingRowsDetail rows={inRange.filter((row) => row.group === INLET || row.group === OUTLET)} start={start} end={end} /> : null}
      </UtilityDetailDialog>

      <ReadingHistoryDialog readings={history?.rows ?? null} title={history?.title ?? ''} start={start} end={end} onClose={() => setHistory(null)} />
    </UtilityChrome>
  )
}
