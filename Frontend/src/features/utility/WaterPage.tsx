import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDay } from '../../domain/format.ts'
import {
  BOILER_WATER,
  WTP_WATER,
  daysBetween,
  latestReadings,
  outsidePrinted,
  readingKey,
  type RoJob,
  type UtilityReading,
} from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SortHeader, sortRows, useColumnSort } from '../qc/qcNav.tsx'
import { Legend, fill } from '../qc/qcVisual.tsx'
import { ReadingRowsDetail, RoJobDetail, UtilityDetailDialog, UtilityPanelOpen } from './utilityDialogs.tsx'
import { UtilityKpi } from './utilityKpi.tsx'
import { PrintedBullet, ReadingHistoryDialog } from './utilityCharts.tsx'
import { UtilityChrome, useNumber, useUtility, useUtilityRange } from './utilityShell.tsx'

const WATER_FORMS = [BOILER_WATER, WTP_WATER] as const

export function WaterPage() {
  const { t, locale } = useLocale()
  const { summary } = useUtility()
  const { start, end } = useUtilityRange()
  const [params, setParams] = useSearchParams()
  const form = params.get('form') === WTP_WATER ? WTP_WATER : BOILER_WATER
  const focusGroup = params.get('group')
  const focusTest = params.get('test')
  const [history, setHistory] = useState<{ title: string; rows: UtilityReading[] } | null>(null)
  const [dialog, setDialog] = useState<'tests' | 'outside' | 'points' | 'ro' | null>(null)

  const inRange = summary.readings.filter((row) => row.form === form)
  const { date, rows } = latestReadings(summary, form)
  const recorded = rows.filter((row) => row.value != null || row.text)
  const outside = recorded.filter(outsidePrinted)
  const groups = [...new Set(inRange.map((row) => row.group ?? '-'))]
  const loggedGroups = new Set(recorded.map((row) => row.group ?? '-'))
  const [pickedGroup, setPickedGroup] = useState<string | null>(null)
  const group = pickedGroup && groups.includes(pickedGroup)
    ? pickedGroup
    : focusGroup && groups.includes(focusGroup) ? focusGroup : (groups.find((name) => loggedGroups.has(name)) ?? groups[0] ?? null)
  const roJob = summary.jobs[0] ?? null
  const roDate = roJob?.performedOn ?? roJob?.date ?? null

  const setForm = (next: string) => {
    const search = new URLSearchParams(params)
    search.set('form', next)
    search.delete('group')
    search.delete('test')
    setParams(search, { replace: true })
    setPickedGroup(null)
  }
  const openHistory = (reading: UtilityReading) => {
    const key = readingKey(reading)
    setHistory({
      title: `${reading.group ?? ''} · ${reading.name ?? reading.tag}`,
      rows: inRange.filter((row) => readingKey(row) === key),
    })
  }

  const tests = [...new Map(inRange.filter((row) => (row.group ?? '-') === group).map((row) => [row.tag, row])).values()]

  return (
    <UtilityChrome
      title={t.utilityWater}
      day={date}
      note={t.waterNote}
      legend={<Legend items={['watch', 'missing']} labels={{ watch: t.outsidePrinted }} />}
    >
      <div className="section-head">
        <div className="view-toggle" role="group" aria-label={t.utilityWater}>
          {WATER_FORMS.map((code) => (
            <button key={code} type="button" aria-pressed={form === code} onClick={() => setForm(code)}>
              {code === BOILER_WATER ? t.boilerWaterGroup : t.wtpGroup} · {code}
            </button>
          ))}
        </div>
      </div>

      <section className="prod-kpis" aria-label={t.utilityWater}>
        <UtilityKpi label={t.testsRecorded} value={date ? String(recorded.length) : '-'} onOpen={() => setDialog('tests')} disabled={!date} />
        <UtilityKpi label={t.outsidePrinted} value={date ? String(outside.length) : '-'} onOpen={() => setDialog('outside')} disabled={!date} />
        <UtilityKpi label={t.samplePointsLogged} value={date ? `${loggedGroups.size} / ${groups.length}` : '-'} onOpen={() => setDialog('points')} disabled={!date} />
        <UtilityKpi label={t.daysSinceRo} value={roDate && date ? String(Math.max(daysBetween(roDate, date), 0)) : '-'} onOpen={() => setDialog('ro')} />
      </section>

      <UtilityPanelOpen title={`${t.samplePoint}${date ? ` · ${formatDay(date, locale)}` : ''}`} onOpen={() => setDialog('tests')}>
        {groups.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
          <>
            <div className="view-toggle utility-points" role="group" aria-label={t.samplePoint}>
              {groups.map((name) => (
                <button key={name} type="button" aria-pressed={group === name} onClick={() => setPickedGroup(name)}>
                  {name}{loggedGroups.has(name) ? '' : ` · ${t.notRecorded}`}
                </button>
              ))}
            </div>
            <div className="qc-bullets">
              {tests.map((test) => {
                const own = inRange.filter((row) => readingKey(row) === readingKey(test))
                const latest = [...rows].reverse().find((row) => readingKey(row) === readingKey(test) && row.value != null)
                return (
                  <PrintedBullet
                    key={readingKey(test)}
                    info={test}
                    value={latest?.value ?? null}
                    values={own.flatMap((row) => (row.value == null ? [] : [row.value]))}
                    onOpen={() => openHistory(test)}
                  />
                )
              })}
            </div>
          </>
        )}
      </UtilityPanelOpen>

      <section className="prod-panel">
        <h2 className="card__title">{t.labRoster} · {form}{date ? ` · ${formatDay(date, locale)}` : ''}</h2>
        <LabRoster rows={rows} focusGroup={focusGroup} focusTest={focusTest} onOpen={openHistory} />
      </section>

      <RoCard job={roJob} onOpen={() => setDialog('ro')} />

      <UtilityDetailDialog
        open={dialog != null}
        title={dialog === 'ro' ? t.roCleaning : dialog === 'outside' ? t.outsidePrinted : dialog === 'points' ? t.samplePointsLogged : t.testsRecorded}
        start={start}
        end={end}
        onClose={() => setDialog(null)}
      >
        {dialog === 'ro' ? <RoJobDetail job={roJob} /> : null}
        {dialog === 'tests' || dialog === 'points' ? <ReadingRowsDetail rows={inRange} start={start} end={end} /> : null}
        {dialog === 'outside' ? <ReadingRowsDetail rows={inRange.filter(outsidePrinted)} start={start} end={end} /> : null}
      </UtilityDetailDialog>

      <ReadingHistoryDialog readings={history?.rows ?? null} title={history?.title ?? ''} start={start} end={end} onClose={() => setHistory(null)} />
    </UtilityChrome>
  )
}

export function LabRoster({
  rows,
  focusGroup,
  focusTest,
  onOpen,
}: {
  rows: UtilityReading[]
  focusGroup?: string | null
  focusTest?: string | null
  onOpen: (reading: UtilityReading) => void
}) {
  const { t } = useLocale()
  const number = useNumber()
  const sort = useColumnSort()
  const focusRef = useRef<HTMLTableRowElement>(null)
  const sorted = sortRows(rows, sort.key, sort.dir, (row, key) => {
    if (key === 'shift') return row.shift
    if (key === 'group') return row.group
    if (key === 'test') return row.name
    if (key === 'value') return row.value ?? row.text
    if (key === 'spec') return row.spec
    return row.remark
  })
  const focused = (row: UtilityReading) => Boolean(focusTest) && row.group === focusGroup && row.tag === focusTest

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusGroup, focusTest])

  if (rows.length === 0) return <p className="empty">{t.noUtilityRows}</p>
  let marked = false
  return (
    <div className="prod-scroll">
      <table className="prod-table">
        <thead>
          <tr>
            <SortHeader label={t.shift} column="shift" sort={sort} />
            <SortHeader label={t.samplePoint} column="group" sort={sort} />
            <SortHeader label={t.test} column="test" sort={sort} />
            <SortHeader label={t.resultValue} column="value" sort={sort} align="right" />
            <SortHeader label={t.printedSpec} column="spec" sort={sort} />
            <SortHeader label={t.remark} column="remark" sort={sort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => {
            const on = focused(row)
            const ref = on && !marked ? focusRef : undefined
            if (on) marked = true
            const names = ['num']
            if (row.value == null && !row.text) names.push('num--empty')
            else if (outsidePrinted(row)) names.push('num--watch')
            return (
              <tr key={`${row.shift}-${row.group}-${row.tag}-${index}`} ref={ref} className={on ? 'prod-row--on' : undefined}>
                <td>{row.shift ?? '-'}</td>
                <td>{row.group ?? '-'}</td>
                <td>{row.name ?? row.tag ?? '-'}{row.unit ? ` (${row.unit})` : ''}</td>
                <td className={names.join(' ')} title={outsidePrinted(row) ? t.outsidePrinted : undefined}>
                  {row.value != null ? (
                    <button type="button" className="qty-link" onClick={() => onOpen(row)}>{number(row.value)}</button>
                  ) : (row.text ?? '-')}
                </td>
                <td>{row.spec ?? '-'}</td>
                <td className="qc-wrap">{row.remark ?? '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RoCard({ job, onOpen }: { job: RoJob | null; onOpen?: () => void }) {
  const { t, locale } = useLocale()
  const body = (
    <>
      {!job ? <p className="empty">{t.noUtilityRows}</p> : (
        <>
          <dl className="tank-card__metrics">
            <div><dt>{t.period}</dt><dd>{job.period ?? '-'}</dd></div>
            <div><dt>{t.performedOn}</dt><dd>{job.performedOn ? formatDay(job.performedOn, locale) : '-'}</dd></div>
            <div><dt>{t.doneBy}</dt><dd>{job.doneBy ?? '-'}</dd></div>
          </dl>
          <ul className="qc-attention">
            {job.checks.map((check) => (
              <li key={check.item}>
                {check.result === 'no'
                  ? <span className="badge badge--warning">{t.checkNo}</span>
                  : check.result === 'yes' ? <span className="badge badge--pass">{t.checkYes}</span> : <span className="badge badge--muted">-</span>}
                <span>{check.item}</span>
                <span />
              </li>
            ))}
          </ul>
          <p className="page-note">{fill(t.roVerifications, { count: job.checks.length })}</p>
        </>
      )}
    </>
  )
  if (onOpen) {
    return (
      <UtilityPanelOpen title={`${t.roCleaning} · F/WTP-006`} onOpen={onOpen}>
        {body}
      </UtilityPanelOpen>
    )
  }
  return <section className="prod-panel"><h2 className="card__title">{t.roCleaning} · F/WTP-006</h2>{body}</section>
}
