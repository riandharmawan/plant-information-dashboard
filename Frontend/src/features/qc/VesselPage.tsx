import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQcFile } from '../../data/QcContext.tsx'
import { formatDay } from '../../domain/format.ts'
import {
  PALKA_DOBI_ABOVE,
  PALKA_IV_MAX,
  PALKA_IV_MIN,
  contractText,
  dobiLow,
  inRange,
  ivOutside,
  overMax,
  vesselVerdict,
  type VesselTicket,
} from '../../domain/qc.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { Kpi, Num, QcChrome, VerdictBadge, useParam, type ParamCode } from './qcChrome.tsx'
import { SortHeader, sortRows, useColumnSort, useQcRange } from './qcNav.tsx'
import { ContractScatter, HoldStrip, type ContractPoint } from './qcCharts.tsx'
import { Bullet, Legend, type LegendItem } from './qcVisual.tsx'

export function VesselPage() {
  const { t, locale } = useLocale()
  const qc = useQcFile()
  const { start, end, setRange } = useQcRange()
  const [params, setParams] = useSearchParams()
  const sort = useColumnSort()
  const tickets = useMemo(
    () => qc.vessels.filter((ticket) => inRange(ticket.arrival, start, end)),
    [qc, start, end],
  )
  const picked = params.get('ticket')
  const selectedId = tickets.some((ticket) => ticket.id === picked) ? picked : tickets[0]?.id ?? null
  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null
  const verdicts = tickets.map(vesselVerdict)
  const passed = verdicts.filter((verdict) => verdict === 'pass').length
  const rejected = verdicts.filter((verdict) => verdict === 'rejected').length
  const samples = tickets.reduce((sum, ticket) => sum + ticket.samples.length, 0)
  const rows = sortRows(tickets, sort.key, sort.dir, (ticket, column) => ticketValue(ticket, column))
  const products = [...new Set(tickets.map((ticket) => ticket.commodity).filter(Boolean))].join(', ')
  const watched = tickets.some((ticket) => ivOutside(ticket.composite.iv) || dobiLow(ticket.composite.dobi))
  const points: ContractPoint[] = tickets
    .filter((ticket) => ticket.composite.ffa != null && ticket.composite.moisture != null)
    .map((ticket) => ({
      key: ticket.id,
      title: `${ticket.ship ?? ticket.id} · ${ticket.commodity}`,
      detail: ticket.arrival ? formatDay(ticket.arrival, locale) : null,
      ffa: ticket.composite.ffa as number,
      moisture: ticket.composite.moisture as number,
      ffaMax: ticket.ffaMax,
      moistureMax: ticket.moistureMax,
    }))

  const pick = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('ticket', id)
    setParams(next, { replace: true })
  }

  const legend: LegendItem[] = []
  if (rejected > 0) legend.push('over')
  if (watched) legend.push('watch')
  legend.push('missing')

  return (
    <QcChrome title={t.qcVessel} start={start} end={end} setRange={setRange} note={t.palkaLimitNote} legend={<Legend items={legend} />}>
      <section className="prod-kpis" aria-label={t.qcVessel}>
        <Kpi label={t.vesselTickets} value={String(tickets.length)} />
        <Kpi label={t.pass} value={String(passed)} tone="yield" />
        <Kpi label={t.rejected} value={String(rejected)} tone={rejected > 0 ? 'alert' : undefined} />
        <Kpi label={t.palkaSamples} value={String(samples)} />
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{products || t.qcVessel} · {t.composite} {t.ffaPct} / {t.moisturePct}</h2>
        <ContractScatter
          points={points}
          ffaMax={selected?.ffaMax ?? null}
          moistureMax={selected?.moistureMax ?? null}
          caption={t.vesselScatter}
          selectedKey={selectedId}
          onPick={pick}
          height={220}
        />
      </section>
      <section className="prod-panel">
        <h2 className="card__title">{t.qcVessel}{products ? ` · ${products}` : ''}</h2>
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
                <SortHeader label={t.ffaPct} column="ffa" sort={sort} align="right" />
                <SortHeader label={t.moisturePct} column="moisture" sort={sort} align="right" />
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
                  onClick={() => pick(ticket.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      pick(ticket.id)
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
                  <Num value={ticket.composite.ffa} code="ffa" breach={overMax(ticket.composite.ffa, ticket.ffaMax)} />
                  <Num value={ticket.composite.moisture} code="moisture" breach={overMax(ticket.composite.moisture, ticket.moistureMax)} />
                  <Num value={ticket.composite.iv} code="iv" watch={ivOutside(ticket.composite.iv)} />
                  <Num value={ticket.composite.dobi} code="dobi" watch={dobiLow(ticket.composite.dobi)} />
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
  const param = useParam()
  const sort = useColumnSort()
  const samples = sortRows(ticket.samples, sort.key, sort.dir, (sample, column) => {
    if (column === 'palka') return sample.palka
    if (column === 'sample') return sample.sampleNo
    if (column === 'ffa') return sample.ffa
    if (column === 'iv') return sample.iv
    if (column === 'dobi') return sample.dobi
    return sample.moisture
  })
  const holdPoints = (field: 'ffa' | 'moisture') => ticket.samples
    .map((sample, index) => ({ sample, index }))
    .filter(({ sample }) => sample[field] != null)
    .map(({ sample, index }) => ({
      key: `${sample.palka}-${sample.sampleNo ?? index}-${field}`,
      hold: sample.palka,
      sample: sample.sampleNo,
      value: sample[field] as number,
    }))
  const otherRows: Array<{ label: string; code?: ParamCode; value: number | string | null }> = [
    { label: 'PV', code: 'pv', value: ticket.composite.pv },
    { label: 'AnV', code: 'anv', value: ticket.composite.anv },
    { label: t.triene, code: 'triene', value: ticket.composite.triene },
    { label: t.totox, code: 'totox', value: ticket.composite.totox },
    { label: t.carotene, code: 'carotene', value: ticket.composite.carotene },
    { label: t.mineralOil, value: ticket.composite.mineralOil },
  ]

  return (
    <>
      <section className="prod-panel">
        <h2 className="card__title">{ticket.id} · {ticket.ship ?? t.ship} · {ticket.commodity} · {t.composite}</h2>
        {ticket.release && <p className="page-note">{ticket.release}</p>}
        <div className="qc-bullets">
          <Bullet code="ffa" label={t.ffaPct} value={ticket.composite.ffa} unit="%" context={{ kind: 'limit', max: ticket.ffaMax, tone: 'breach' }} />
          <Bullet code="moisture" label={t.moisturePct} value={ticket.composite.moisture} unit="%" context={{ kind: 'limit', max: ticket.moistureMax, tone: 'breach' }} />
          <Bullet code="iv" label="IV" value={ticket.composite.iv} context={{ kind: 'limit', min: PALKA_IV_MIN, max: PALKA_IV_MAX, tone: 'watch' }} />
          <Bullet code="dobi" label="DOBI" value={ticket.composite.dobi} context={{ kind: 'limit', min: ticket.dobiMin ?? PALKA_DOBI_ABOVE, tone: 'watch' }} />
        </div>
        <div className="qc-holds">
          <HoldStrip
            points={holdPoints('ffa')}
            max={ticket.ffaMax}
            label={`${t.palka} · ${t.ffaPct}`}
            code="ffa"
            caption={t.palkaStrip}
          />
          <HoldStrip
            points={holdPoints('moisture')}
            max={ticket.moistureMax}
            label={`${t.palka} · ${t.moisturePct}`}
            code="moisture"
            caption={t.palkaStrip.replace('FFA', 'M&I')}
          />
        </div>
      </section>
      <div className="prod-layout">
        <section className="prod-panel">
          <h2 className="card__title">{t.palka} · {ticket.id}</h2>
          <div className="prod-scroll">
            <table className="prod-table">
              <thead>
                <tr>
                  <SortHeader label={t.palka} column="palka" sort={sort} />
                  <SortHeader label={t.sampleNo} column="sample" sort={sort} align="right" />
                  <SortHeader label={t.ffaPct} column="ffa" sort={sort} align="right" />
                  <SortHeader label="IV" column="iv" sort={sort} align="right" />
                  <SortHeader label="DOBI" column="dobi" sort={sort} align="right" />
                  <SortHeader label={t.moisturePct} column="moisture" sort={sort} align="right" />
                </tr>
              </thead>
              <tbody>
                {samples.map((sample, index) => (
                  <tr key={`${sample.palka}-${sample.sampleNo}-${index}`}>
                    <td>{sample.palka}</td>
                    <td className="num">{sample.sampleNo ?? '-'}</td>
                    <Num value={sample.ffa} code="ffa" breach={overMax(sample.ffa, ticket.ffaMax)} />
                    <Num value={sample.iv} code="iv" watch={ivOutside(sample.iv)} />
                    <Num value={sample.dobi} code="dobi" watch={dobiLow(sample.dobi)} />
                    <Num value={sample.moisture} code="moisture" breach={overMax(sample.moisture, ticket.moistureMax)} />
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
                {otherRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={row.value == null ? 'num num--empty' : 'num'}>
                      {row.code && typeof row.value === 'number' ? param(row.code, row.value) : (row.value ?? '-')}
                    </td>
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
    </>
  )
}
