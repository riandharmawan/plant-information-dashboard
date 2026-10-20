import { useMemo, useState } from 'react'
import { formatDay } from '../../domain/format.ts'
import {
  QC,
  contractText,
  dobiLow,
  inRange,
  ivOutside,
  overMax,
  vesselVerdict,
  type VesselTicket,
} from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, Num, QcChrome, VerdictBadge } from './qcChrome.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'

export function VesselPage() {
  const { t, locale } = useLocale()
  const { start, end, setRange } = useQcRange()
  const sort = useColumnSort()
  const tickets = useMemo(
    () => QC.vessels.filter((ticket) => inRange(ticket.arrival, start, end)),
    [start, end],
  )
  const [picked, setPicked] = useState<string | null>(null)
  const selectedId = tickets.some((ticket) => ticket.id === picked) ? picked : tickets[0]?.id ?? null
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null
  const verdicts = tickets.map(vesselVerdict)
  const passed = verdicts.filter((verdict) => verdict === 'pass').length
  const rejected = verdicts.filter((verdict) => verdict === 'rejected').length
  const samples = tickets.reduce((sum, ticket) => sum + ticket.samples.length, 0)
  const rows = sortRows(tickets, sort.key, sort.dir, (ticket, column) => ticketValue(ticket, column))

  return (
    <QcChrome title={t.qcVessel} start={start} end={end} setRange={setRange} note={t.palkaLimitNote}>
      <section className="prod-kpis" aria-label={t.qcVessel}>
        <Kpi label={t.vesselTickets} value={String(tickets.length)} />
        <Kpi label={t.pass} value={String(passed)} tone="yield" />
        <Kpi label={t.rejected} value={String(rejected)} tone={rejected > 0 ? 'alert' : undefined} />
        <Kpi label={t.palkaSamples} value={String(samples)} />
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{t.qcVessel}</h2>
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.ticketCode} column="id" sort={sort} />
                <SortHeader label={t.ship} column="ship" sort={sort} />
                <SortHeader label={t.supplier} column="supplier" sort={sort} />
                <SortHeader label={t.arrival} column="arrival" sort={sort} />
                <SortHeader label={t.quantity} column="quantity" sort={sort} />
                <SortHeader label={t.contractLimits} column="contract" sort={sort} />
                <SortHeader label="FFA" column="ffa" sort={sort} align="right" />
                <SortHeader label="M&I" column="moisture" sort={sort} align="right" />
                <SortHeader label="IV" column="iv" sort={sort} align="right" />
                <SortHeader label="DOBI" column="dobi" sort={sort} align="right" />
                <SortHeader label={t.pass} column="verdict" sort={sort} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={11}>{t.noQcRows}</td></tr>}
              {rows.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={ticket.id === selectedId ? 'qc-pick prod-row--on' : 'qc-pick'}
                  onClick={() => setPicked(ticket.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setPicked(ticket.id)
                    }
                  }}
                  tabIndex={0}
                >
                  <td>{ticket.id}</td>
                  <td>{ticket.ship ?? '-'}</td>
                  <td className="qc-wrap">{ticket.supplier ?? '-'}</td>
                  <td>{ticket.arrival ? formatDay(ticket.arrival, locale) : '-'}</td>
                  <td>{ticket.quantityLabel ?? '-'}</td>
                  <td>{contractText(ticket.ffaMax, ticket.moistureMax, ticket.dobiMin)}</td>
                  <Num value={ticket.composite.ffa} breach={overMax(ticket.composite.ffa, ticket.ffaMax)} />
                  <Num value={ticket.composite.moisture} breach={overMax(ticket.composite.moisture, ticket.moistureMax)} />
                  <Num value={ticket.composite.iv} watch={ivOutside(ticket.composite.iv)} />
                  <Num value={ticket.composite.dobi} watch={dobiLow(ticket.composite.dobi)} />
                  <td><VerdictBadge verdict={vesselVerdict(ticket)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && <TicketDetail ticket={selected} />}
    </QcChrome>
  )
}

function ticketValue(ticket: VesselTicket, column: string) {
  if (column === 'id') return ticket.id
  if (column === 'ship') return ticket.ship
  if (column === 'supplier') return ticket.supplier
  if (column === 'arrival') return ticket.arrival
  if (column === 'quantity') return ticket.quantityLabel
  if (column === 'contract') return contractText(ticket.ffaMax, ticket.moistureMax, ticket.dobiMin)
  if (column === 'ffa') return ticket.composite.ffa
  if (column === 'moisture') return ticket.composite.moisture
  if (column === 'iv') return ticket.composite.iv
  if (column === 'dobi') return ticket.composite.dobi
  const verdict = vesselVerdict(ticket)
  if (verdict === 'pass') return 0
  if (verdict === 'rejected') return 2
  return 1
}

function TicketDetail({ ticket }: { ticket: VesselTicket }) {
  const { t, locale } = useLocale()
  const sort = useColumnSort()
  const samples = sortRows(ticket.samples, sort.key, sort.dir, (sample, column) => {
    if (column === 'palka') return sample.palka
    if (column === 'sample') return sample.sampleNo
    if (column === 'ffa') return sample.ffa
    if (column === 'iv') return sample.iv
    if (column === 'dobi') return sample.dobi
    return sample.moisture
  })
  const compositeRows: Array<{ label: string; value: string; breach?: boolean; watch?: boolean }> = [
    { label: 'FFA', value: measure(ticket.composite.ffa), breach: overMax(ticket.composite.ffa, ticket.ffaMax) },
    { label: 'M&I', value: measure(ticket.composite.moisture), breach: overMax(ticket.composite.moisture, ticket.moistureMax) },
    { label: 'IV', value: measure(ticket.composite.iv), watch: ivOutside(ticket.composite.iv) },
    { label: 'DOBI', value: measure(ticket.composite.dobi), watch: dobiLow(ticket.composite.dobi) },
    { label: 'PV', value: measure(ticket.composite.pv) },
    { label: 'AnV', value: measure(ticket.composite.anv) },
    { label: t.triene, value: measure(ticket.composite.triene) },
    { label: t.totox, value: measure(ticket.composite.totox) },
    { label: t.carotene, value: measure(ticket.composite.carotene) },
    { label: t.mineralOil, value: ticket.composite.mineralOil ?? '-' },
  ]

  return (
    <div className="prod-layout">
      <section className="prod-panel">
        <h2 className="card__title">{ticket.id} · {ticket.ship ?? t.ship}</h2>
        {ticket.release && <p className="page-note">{ticket.release}</p>}
        <div className="prod-scroll">
          <table className="prod-table">
            <thead>
              <tr>
                <SortHeader label={t.palka} column="palka" sort={sort} />
                <SortHeader label={t.sampleNo} column="sample" sort={sort} align="right" />
                <SortHeader label="FFA" column="ffa" sort={sort} align="right" />
                <SortHeader label="IV" column="iv" sort={sort} align="right" />
                <SortHeader label="DOBI" column="dobi" sort={sort} align="right" />
                <SortHeader label="M&I" column="moisture" sort={sort} align="right" />
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={`${sample.palka}-${sample.sampleNo}`}>
                  <td>{sample.palka}</td>
                  <td className="num">{sample.sampleNo ?? '-'}</td>
                  <Num value={sample.ffa} breach={overMax(sample.ffa, ticket.ffaMax)} />
                  <Num value={sample.iv} watch={ivOutside(sample.iv)} />
                  <Num value={sample.dobi} watch={dobiLow(sample.dobi)} />
                  <Num value={sample.moisture} breach={overMax(sample.moisture, ticket.moistureMax)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{t.composite}</h2>
        <div className="prod-scroll">
          <table className="prod-table prod-table--fit">
            <thead>
              <tr>
                <th>{t.composite}</th>
                <th className="num">{t.resultValue}</th>
              </tr>
            </thead>
            <tbody>
              {compositeRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className={row.breach ? 'num num--neg' : row.watch ? 'num num--watch' : 'num'}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(ticket.leader || ticket.head) && (
          <p className="page-note">
            {[ticket.leader, ticket.leaderSigned ? formatDay(ticket.leaderSigned, locale) : null].filter(Boolean).join(' · ')}
            {ticket.head ? `${ticket.leader ? ' · ' : ''}${ticket.head}` : ''}
            {ticket.headSigned ? ` · ${formatDay(ticket.headSigned, locale)}` : ''}
          </p>
        )}
      </section>
    </div>
  )
}

function measure(value: number | null): string {
  if (value == null) return '-'
  return String(value)
}
