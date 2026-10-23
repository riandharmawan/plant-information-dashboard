import { useState } from 'react'
import { formatDay } from '../../domain/format.ts'
import { latestChecks, sum, type LoaderRun } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SortHeader, sortRows, useColumnSort } from '../qc/qcNav.tsx'
import { fill } from '../qc/qcVisual.tsx'
import { ChecklistDetail, DailyHoursDetail, LoaderRunsDetail, UtilityDetailDialog, UtilityPanelOpen } from './utilityDialogs.tsx'
import { UtilityKpi } from './utilityKpi.tsx'
import { DailySeriesChart } from './utilityCharts.tsx'
import { UtilityChrome, useNumber, useUtility, useUtilityRange } from './utilityShell.tsx'

type LoaderDialog = null | 'hours' | 'runs' | 'fuel' | 'checklist' | 'dailyChart' | 'runTable' | 'checkPanel'

export function LoaderPage() {
  const { t, locale } = useLocale()
  const number = useNumber()
  const { summary } = useUtility()
  const { start, end } = useUtilityRange()
  const [dialog, setDialog] = useState<LoaderDialog>(null)
  const sort = useColumnSort()
  const runs = summary.loaderRuns
  const checks = latestChecks(summary)
  const no = checks.rows.filter((row) => row.result === 'no')
  const yes = checks.rows.filter((row) => row.result === 'yes')
  const fuelRuns = runs.filter((run) => run.fuel != null).length

  const daily = new Map<string, { date: string; hours: number | null; fuel: number | null }>()
  for (const run of runs) {
    const day = daily.get(run.date) ?? { date: run.date, hours: null, fuel: null }
    if (run.hoursTotal != null) day.hours = (day.hours ?? 0) + run.hoursTotal
    if (run.fuel != null) day.fuel = (day.fuel ?? 0) + run.fuel
    daily.set(run.date, day)
  }
  const ordered = sort.key ? runs : [...runs].reverse()
  const sorted = sortRows(ordered, sort.key, sort.dir, (run, key) => run[key as keyof LoaderRun] ?? null)

  const dialogTitle = () => {
    if (dialog === 'hours' || dialog === 'dailyChart') return t.dailyHours
    if (dialog === 'runs' || dialog === 'runTable') return t.runRoster
    if (dialog === 'fuel') return t.fuelWritten
    if (dialog === 'checklist' || dialog === 'checkPanel') return t.checklist
    return ''
  }

  return (
    <UtilityChrome title={t.utilityLoader} day={checks.date ?? runs.at(-1)?.date ?? null} note={t.loaderNote}>
      <section className="prod-kpis" aria-label={t.utilityLoader}>
        <UtilityKpi label={t.hoursRun} value={number(sum(runs.map((run) => run.hoursTotal)))} onOpen={() => setDialog('hours')} />
        <UtilityKpi label={t.runs} value={String(runs.length)} onOpen={() => setDialog('runs')} />
        <UtilityKpi
          label={`${t.fuelWritten} · ${fill(t.fuelRuns, { count: fuelRuns })}`}
          value={number(sum(runs.map((run) => run.fuel)))}
          onOpen={() => setDialog('fuel')}
        />
        <UtilityKpi label={t.checklistNoItems} value={checks.date ? String(no.length) : '-'} tone={no.length > 0 ? 'alert' : undefined} onOpen={() => setDialog('checklist')} />
      </section>

      <UtilityPanelOpen title={`${t.dailyHours} · F/UTI-011(b)`} onOpen={() => setDialog('dailyChart')}>
        {runs.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
          <figure className="qc-figure chart-frame qty-chart">
            <DailySeriesChart
              rows={[...daily.values()]}
              start={start}
              end={end}
              series={[
                { key: 'hours', name: t.hoursRun, kind: 'bar', color: '#114C5A' },
                { key: 'fuel', name: t.fuelWritten, kind: 'line', color: '#10B981', axis: 'right' },
              ]}
            />
            <figcaption>{t.loaderCaption}</figcaption>
          </figure>
        )}
      </UtilityPanelOpen>

      <div className="prod-layout">
        <UtilityPanelOpen title={`${t.runRoster} · F/UTI-011(b)`} onOpen={() => setDialog('runTable')}>
          {runs.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
            <div className="prod-scroll">
              <table className="prod-table prod-table--fit">
                <thead>
                  <tr>
                    <SortHeader label={t.date} column="date" sort={sort} />
                    <SortHeader label={t.shift} column="shift" sort={sort} />
                    <SortHeader label={t.hourStart} column="hourStart" sort={sort} align="right" />
                    <SortHeader label={t.hourEnd} column="hourEnd" sort={sort} align="right" />
                    <SortHeader label={t.printedTotal} column="hoursTotal" sort={sort} align="right" />
                    <SortHeader label={t.fuelL} column="fuel" sort={sort} align="right" />
                    <SortHeader label={t.oilL} column="oil" sort={sort} align="right" />
                    <SortHeader label={t.remark} column="remark" sort={sort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((run, index) => (
                    <tr key={`${run.date}-${run.shift}-${index}`}>
                      <td>{formatDay(run.date, locale)}</td>
                      <td>{run.shift ?? '-'}</td>
                      <td className={run.hourStart == null ? 'num num--empty' : 'num'}>{number(run.hourStart)}</td>
                      <td className={run.hourEnd == null ? 'num num--empty' : 'num'}>{number(run.hourEnd)}</td>
                      <td className={run.hoursTotal == null ? 'num num--empty' : 'num'}>{number(run.hoursTotal)}</td>
                      <td className={run.fuel == null ? 'num num--empty' : 'num'}>{number(run.fuel)}</td>
                      <td className={run.oil == null ? 'num num--empty' : 'num'}>{number(run.oil)}</td>
                      <td className="qc-wrap">{run.remark ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </UtilityPanelOpen>

        <UtilityPanelOpen title={`${t.checklist} · F/UTI-011(a)${checks.date ? ` · ${formatDay(checks.date, locale)}` : ''}`} onOpen={() => setDialog('checkPanel')}>
          {checks.rows.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
            <>
              {no.length === 0 ? <p className="qc-attention__ok">{t.checklistAllYes}</p> : (
                <ul className="qc-attention">
                  {no.map((row) => (
                    <li key={row.item}>
                      <span className="badge badge--warning">{t.checkNo}</span>
                      <span>{row.item}</span>
                      <span />
                    </li>
                  ))}
                </ul>
              )}
              <details className="utility-yes">
                <summary>{fill(t.yesItems, { count: yes.length })}</summary>
                <ul className="qc-attention">
                  {yes.map((row) => (
                    <li key={row.item}>
                      <span className="badge badge--pass">{t.checkYes}</span>
                      <span>{row.item}</span>
                      <span />
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </UtilityPanelOpen>
      </div>

      <UtilityDetailDialog open={dialog != null} title={dialogTitle()} start={start} end={end} onClose={() => setDialog(null)}>
        {dialog === 'hours' || dialog === 'dailyChart' ? (
          <DailyHoursDetail daily={[...daily.values()]} start={start} end={end} />
        ) : null}
        {dialog === 'runs' || dialog === 'runTable' || dialog === 'fuel' ? <LoaderRunsDetail runs={runs} /> : null}
        {dialog === 'checklist' || dialog === 'checkPanel' ? <ChecklistDetail rows={checks.rows} date={checks.date} /> : null}
      </UtilityDetailDialog>
    </UtilityChrome>
  )
}
