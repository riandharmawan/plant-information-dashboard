import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatDay } from '../../domain/format.ts'
import type { CheckRow, CoalDay, ChemicalRow, LoaderRun, UtilityForm, UtilityReading } from '../../domain/utility.ts'
import { daysInRange } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Identity, fill } from '../qc/qcVisual.tsx'
import { DailySeriesChart, rangeDays } from './utilityCharts.tsx'
import { useNumber } from './utilityShell.tsx'

export function UtilityDetailDialog({
  open,
  title,
  start,
  end,
  onClose,
  children,
}: {
  open: boolean
  title: string
  start: string
  end: string
  onClose: () => void
  children: ReactNode
}) {
  const { t, locale } = useLocale()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="stock-dialog stock-dialog--wide kpi-dialog" onClose={onClose}>
      {open ? (
        <>
          <h2>{title}</h2>
          <p className="stock-dialog__updated">
            {fill(t.utilityPeriod, { start: formatDay(start, locale), end: formatDay(end, locale) })}
          </p>
          {children}
          <div className="stock-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>{t.close}</button>
          </div>
        </>
      ) : null}
    </dialog>
  )
}

export function UtilityPanelOpen({
  title,
  onOpen,
  children,
}: {
  title: ReactNode
  onOpen: () => void
  children: ReactNode
}) {
  const { t } = useLocale()
  return (
    <section className="prod-panel">
      <button type="button" className="prod-panel__open" onClick={onOpen} title={t.kpiDetailHint}>
        <h2 className="card__title">{title}</h2>
        <ChevronRight className="prod-panel__go" size={18} aria-hidden="true" />
      </button>
      {children}
    </section>
  )
}

function DialogTable({ children }: { children: ReactNode }) {
  return (
    <div className="stock-dialog__scroll">
      <table className="stock-dialog__table">{children}</table>
    </div>
  )
}

export function CoalDailyDetail({ coal, start, end }: { coal: CoalDay[]; start: string; end: string }) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const byDate = new Map(coal.map((row) => [row.date, row]))
  const rows = rangeDays(start, end).map((date) => ({ date, ...byDate.get(date) }))
  return (
    <>
      {coal.length > 0 ? (
        <figure className="qc-figure chart-frame qty-chart">
          <DailySeriesChart
            rows={coal}
            start={start}
            end={end}
            height={200}
            series={[
              { key: 'buckets', name: t.coalBuckets, kind: 'bar', color: '#114C5A' },
              { key: 'ratio', name: t.printedRatio, kind: 'line', color: '#10B981', axis: 'right' },
            ]}
          />
        </figure>
      ) : null}
      <DialogTable>
        <thead>
          <tr>
            <th>{t.date}</th>
            <th className="num">{t.coalBuckets}</th>
            <th className="num">{t.steamDistribution}</th>
            <th className="num">{t.coalRatio}</th>
            <th className="num">{t.incomingCoal}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{formatDay(row.date, locale)}</td>
              <td className={row.buckets == null ? 'num num--empty' : 'num'}>{number(row.buckets)}</td>
              <td className={row.steamKg == null ? 'num num--empty' : 'num'}>{number(row.steamKg, 0)}</td>
              <td className={row.ratio == null ? 'num num--empty' : 'num'}>{number(row.ratio)}</td>
              <td className={row.incomingKg == null ? 'num num--empty' : 'num'}>{number(row.incomingKg, 0)}</td>
            </tr>
          ))}
        </tbody>
      </DialogTable>
    </>
  )
}

export function FormCoverageDetail({ form, start, end }: { form: UtilityForm; start: string; end: string }) {
  const { t, locale } = useLocale()
  const logged = new Set(form.logged)
  const empty = new Set(form.empty)
  const rows = rangeDays(start, end).map((date) => {
    let status = t.notSubmitted
    if (logged.has(date)) status = t.logged
    else if (empty.has(date)) status = t.emptySheet
    return { date, status }
  })
  return (
    <DialogTable>
      <thead>
        <tr>
          <th>{t.date}</th>
          <th>{t.status}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date}>
            <td>{formatDay(row.date, locale)}</td>
            <td>{row.status}</td>
          </tr>
        ))}
      </tbody>
    </DialogTable>
  )
}

export function BoilerFormsDetail({ forms, start, end }: { forms: UtilityForm[]; start: string; end: string }) {
  const { t, locale } = useLocale()
  const days = daysInRange(start, end)
  return (
    <DialogTable>
      <thead>
        <tr>
          <th>{t.form}</th>
          <th className="num">{t.daysLogged}</th>
          <th className="num">{t.emptySheet}</th>
          <th>{t.latestDay}</th>
        </tr>
      </thead>
      <tbody>
        {forms.map((form) => (
          <tr key={form.code}>
            <td>{form.code}{form.place ? ` · ${form.place}` : ''}</td>
            <td className="num">{form.logged.length} / {days}</td>
            <td className="num">{form.empty.length}</td>
            <td>{form.latest ? formatDay(form.latest, locale) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </DialogTable>
  )
}

export function AttentionDetail({
  items,
}: {
  items: Array<{ badge: ReactNode; place: string; product?: string | null; reason: string; to: string }>
}) {
  const { t } = useLocale()
  if (items.length === 0) return <p className="qc-attention__ok">{t.nothingNeedsAttention}</p>
  return (
    <ul className="qc-attention">
      {items.map((item) => (
        <li key={item.to + item.reason}>
          {item.badge}
          <Identity place={item.place} product={item.product} />
          <span>{item.reason}</span>
          <Link className="prod-plant-link" to={item.to} onClick={(event) => event.stopPropagation()}>{t.view}</Link>
        </li>
      ))}
    </ul>
  )
}

export function LoaderRunsDetail({ runs }: { runs: LoaderRun[] }) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const ordered = [...runs].reverse()
  return (
    <DialogTable>
      <thead>
        <tr>
          <th>{t.date}</th>
          <th>{t.shift}</th>
          <th className="num">{t.printedTotal}</th>
          <th className="num">{t.fuelL}</th>
          <th className="num">{t.oilL}</th>
          <th>{t.remark}</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((run, index) => (
          <tr key={`${run.date}-${run.shift}-${index}`}>
            <td>{formatDay(run.date, locale)}</td>
            <td>{run.shift ?? '-'}</td>
            <td className={run.hoursTotal == null ? 'num num--empty' : 'num'}>{number(run.hoursTotal)}</td>
            <td className={run.fuel == null ? 'num num--empty' : 'num'}>{number(run.fuel)}</td>
            <td className={run.oil == null ? 'num num--empty' : 'num'}>{number(run.oil)}</td>
            <td className="qc-wrap">{run.remark ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </DialogTable>
  )
}

export function ChecklistDetail({ rows, date }: { rows: CheckRow[]; date: string | null }) {
  const { t, locale } = useLocale()
  const sorted = [...rows].sort((left, right) => (left.result === 'no' ? -1 : 1) - (right.result === 'no' ? -1 : 1))
  return (
    <>
      {date ? <p className="page-note">{formatDay(date, locale)}</p> : null}
      <ul className="qc-attention">
        {sorted.map((row) => (
          <li key={row.item}>
            <span className={row.result === 'no' ? 'badge badge--warning' : 'badge badge--pass'}>
              {row.result === 'no' ? t.checkNo : t.checkYes}
            </span>
            <span>{row.item}</span>
            <span />
          </li>
        ))}
      </ul>
    </>
  )
}

export function ChemicalDetail({ rows }: { rows: ChemicalRow[] }) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const ordered = [...rows].sort((left, right) => left.date.localeCompare(right.date) || (left.material ?? '').localeCompare(right.material ?? ''))
  return (
    <DialogTable>
      <thead>
        <tr>
          <th>{t.date}</th>
          <th>{t.chemical}</th>
          <th className="num">{t.usedOnLogDays}</th>
          <th className="num">{t.received}</th>
          <th className="num">{t.lastRemaining}</th>
          <th>{t.remark}</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((row, index) => (
          <tr key={`${row.date}-${row.material}-${index}`}>
            <td>{formatDay(row.date, locale)}</td>
            <td>{row.material ?? '-'}</td>
            <td className={row.used == null ? 'num num--empty' : 'num'}>{number(row.used)}</td>
            <td className={row.received == null ? 'num num--empty' : 'num'}>{number(row.received)}</td>
            <td className={row.remaining == null ? 'num num--empty' : 'num'}>{number(row.remaining)}</td>
            <td className="qc-wrap">{row.remark ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </DialogTable>
  )
}

export function ReadingRowsDetail({ rows }: { rows: UtilityReading[]; start?: string; end?: string }) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const ordered = [...rows].sort((left, right) => left.date.localeCompare(right.date) || (left.shift ?? '').localeCompare(right.shift ?? ''))
  return (
    <>
      <dl className="qty-stats">
        <div><dt>{t.testsRecorded}</dt><dd>{ordered.filter((row) => row.value != null).length}</dd></div>
        <div><dt>{t.daysLogged}</dt><dd>{new Set(ordered.map((row) => row.date)).size}</dd></div>
      </dl>
      <DialogTable>
        <thead>
          <tr>
            <th>{t.date}</th>
            <th>{t.shift}</th>
            <th>{t.samplePoint}</th>
            <th>{t.test}</th>
            <th className="num">{t.resultValue}</th>
            <th>{t.printedRange}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((row, index) => (
            <tr key={`${row.date}-${row.tag}-${index}`}>
              <td>{formatDay(row.date, locale)}</td>
              <td>{row.shift ?? row.time ?? '-'}</td>
              <td>{row.group ?? '-'}</td>
              <td>{row.name ?? row.tag ?? '-'}</td>
              <td className={row.value == null ? 'num num--empty' : 'num'}>{number(row.value)}</td>
              <td>{row.spec ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </DialogTable>
    </>
  )
}

export function DailyHoursDetail({
  daily,
  start,
  end,
}: {
  daily: Array<{ date: string; hours: number | null; fuel: number | null }>
  start: string
  end: string
}) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const byDate = new Map(daily.map((row) => [row.date, row]))
  const rows = rangeDays(start, end).map((date) => byDate.get(date) ?? { date, hours: null, fuel: null })
  return (
    <>
      <figure className="qc-figure chart-frame qty-chart">
        <DailySeriesChart
          rows={daily}
          start={start}
          end={end}
          series={[
            { key: 'hours', name: t.hoursRun, kind: 'bar', color: '#114C5A' },
            { key: 'fuel', name: t.fuelWritten, kind: 'line', color: '#10B981', axis: 'right' },
          ]}
        />
      </figure>
      <DialogTable>
        <thead>
          <tr>
            <th>{t.date}</th>
            <th className="num">{t.hoursRun}</th>
            <th className="num">{t.fuelL}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date}>
              <td>{formatDay(row.date, locale)}</td>
              <td className={row.hours == null ? 'num num--empty' : 'num'}>{number(row.hours)}</td>
              <td className={row.fuel == null ? 'num num--empty' : 'num'}>{number(row.fuel)}</td>
            </tr>
          ))}
        </tbody>
      </DialogTable>
    </>
  )
}

export function HoursOnDayDetail({ times }: { times: string[] }) {
  const { t } = useLocale()
  return (
    <DialogTable>
      <thead>
        <tr><th>{t.time}</th></tr>
      </thead>
      <tbody>
        {times.map((time) => (
          <tr key={time}><td>{time}</td></tr>
        ))}
      </tbody>
    </DialogTable>
  )
}

export function RoJobDetail({ job }: { job: { period: string | null; performedOn: string | null; doneBy: string | null; checks: Array<{ item: string; result: string | null }> } | null }) {
  const { t, locale } = useLocale()
  if (!job) return <p className="empty">{t.noUtilityRows}</p>
  return (
    <>
      <dl className="qty-stats">
        <div><dt>{t.roCleaning}</dt><dd>{job.performedOn ? formatDay(job.performedOn, locale) : '-'}</dd></div>
        <div><dt>{t.doneBy}</dt><dd>{job.doneBy ?? '-'}</dd></div>
      </dl>
      <ul className="qc-attention">
        {job.checks.map((row) => (
          <li key={row.item}>
            <span className={row.result === 'no' ? 'badge badge--warning' : 'badge badge--pass'}>{row.result ?? '-'}</span>
            <span>{row.item}</span>
            <span />
          </li>
        ))}
      </ul>
    </>
  )
}
