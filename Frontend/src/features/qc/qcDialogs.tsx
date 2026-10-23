import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatDay, tankLabel } from '../../domain/format.ts'
import { ageAtSnapshot, retestDue, vesselVerdict, type StorageRow, type TruckRow, type VesselTicket } from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { useParam, VerdictBadge } from './qcChrome.tsx'
import { Identity, fill } from './qcVisual.tsx'

export function QcDetailDialog({
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

export function QcPanelOpen({
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

function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="stock-dialog__scroll">
      <table className="stock-dialog__table">{children}</table>
    </div>
  )
}

export function QcAttentionDetail({
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
          <Link className="prod-plant-link" to={item.to}>{t.view}</Link>
        </li>
      ))}
    </ul>
  )
}

export function StorageLatestDetail({ rows }: { rows: StorageRow[] }) {
  const { t, locale } = useLocale()
  const param = useParam()
  const ordered = [...rows].sort((left, right) => left.tankId.localeCompare(right.tankId))
  return (
    <ScrollTable>
      <thead>
        <tr>
          <th>{t.tank}</th>
          <th>{t.oilTypes}</th>
          <th className="num">{t.ffaPct}</th>
          <th className="num">{t.moisturePct}</th>
          <th>{t.analysisDate}</th>
          <th>{t.retestDue}</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((row) => (
          <tr key={row.tankId} className={retestDue(row) ? 'stock-dialog__row--alert' : undefined}>
            <td>{tankLabel(row.tankId)}</td>
            <td>{row.oil || '-'}</td>
            <td className="num">{param('ffa', row.ffa)}</td>
            <td className="num">{param('moisture', row.moisture)}</td>
            <td>{row.analysisDate ? formatDay(row.analysisDate, locale) : '-'}</td>
            <td>{retestDue(row) ? t.retestDue : '-'}</td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

export function TankQuickDetail({ row, storageLink }: { row: StorageRow | null; storageLink?: string }) {
  const { t, locale } = useLocale()
  const param = useParam()
  if (!row) return <p className="empty">{t.noQcRows}</p>
  return (
    <>
      <dl className="qty-stats">
        <div><dt>{t.tank}</dt><dd>{tankLabel(row.tankId)}</dd></div>
        <div><dt>{t.oilTypes}</dt><dd>{row.oil || '-'}</dd></div>
        <div><dt>{t.ffaPct}</dt><dd>{param('ffa', row.ffa)}</dd></div>
        <div><dt>{t.moisturePct}</dt><dd>{param('moisture', row.moisture)}</dd></div>
        <div><dt>{t.analysisDate}</dt><dd>{row.analysisDate ? formatDay(row.analysisDate, locale) : '-'}</dd></div>
        <div><dt>{t.ageDays}</dt><dd>{ageAtSnapshot(row.analysisDate, row.snapshotOn) ?? '-'}</dd></div>
      </dl>
      {storageLink ? <p className="page-note"><Link className="prod-plant-link" to={storageLink}>{t.view}</Link></p> : null}
    </>
  )
}

export function InboundSummaryDetail({
  rows,
}: {
  rows: Array<{ source: string; count: number; passed: number; rejected: number; pending: number; to: string }>
}) {
  const { t } = useLocale()
  return (
    <ScrollTable>
      <thead>
        <tr>
          <th>{t.incoming}</th>
          <th className="num">{t.movementCount}</th>
          <th className="num">{t.pass}</th>
          <th className="num">{t.rejected}</th>
          <th className="num">{t.specPending}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.source}>
            <td>{row.source}</td>
            <td className="num">{row.count}</td>
            <td className="num">{row.passed}</td>
            <td className="num">{row.rejected}</td>
            <td className="num">{row.pending}</td>
            <td><Link className="prod-plant-link" to={row.to}>{t.view}</Link></td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

export function TruckSamplesDetail({
  rows,
  verdicts,
}: {
  rows: TruckRow[]
  verdicts: Array<'pass' | 'rejected' | 'spec-pending'>
}) {
  const { t, locale } = useLocale()
  const param = useParam()
  return (
    <ScrollTable>
      <thead>
        <tr>
          <th>{t.colDate}</th>
          <th>{t.policeNo}</th>
          <th className="num">{t.ffaPct}</th>
          <th className="num">{t.moisturePct}</th>
          <th>{t.pass}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.policeNo}-${index}`}>
            <td>{row.sampledOn ? formatDay(row.sampledOn, locale) : '-'}</td>
            <td>{row.policeNo}</td>
            <td className="num">{param('ffa', row.ffa)}</td>
            <td className="num">{param('moisture', row.moisture)}</td>
            <td><VerdictBadge verdict={verdicts[index]} /></td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

export function VesselTicketsDetail({ tickets }: { tickets: VesselTicket[] }) {
  const { t, locale } = useLocale()
  const param = useParam()
  return (
    <ScrollTable>
      <thead>
        <tr>
          <th>{t.colDate}</th>
          <th>{t.ship}</th>
          <th>{t.commodity}</th>
          <th className="num">{t.ffaPct}</th>
          <th className="num">{t.moisturePct}</th>
          <th>{t.pass}</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket) => (
          <tr key={ticket.id}>
            <td>{ticket.arrival ? formatDay(ticket.arrival, locale) : '-'}</td>
            <td>{ticket.ship ?? ticket.id}</td>
            <td>{ticket.commodity}</td>
            <td className="num">{param('ffa', ticket.composite.ffa)}</td>
            <td className="num">{param('moisture', ticket.composite.moisture)}</td>
            <td><VerdictBadge verdict={vesselVerdict(ticket)} /></td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}

export function MovementDetail({
  rows,
}: {
  rows: Array<{
    vehicle: string | null
    commodity: string | null
    timeIn: string | null
    timeOut: string | null
    direction: string
  }>
}) {
  const { t } = useLocale()
  return (
    <ScrollTable>
      <thead>
        <tr>
          <th>{t.policeNo}</th>
          <th>{t.writtenAs}</th>
          <th>{t.timeIn}</th>
          <th>{t.timeOut}</th>
          <th>{t.direction}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.vehicle}-${index}`}>
            <td>{row.vehicle ?? '-'}</td>
            <td>{row.commodity ?? '-'}</td>
            <td>{row.timeIn ?? '-'}</td>
            <td>{row.timeOut ?? '-'}</td>
            <td>{row.direction}</td>
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  )
}
