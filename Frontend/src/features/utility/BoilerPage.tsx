import { useMemo, useState } from 'react'
import { formatDay } from '../../domain/format.ts'
import { hasLimit, sum, type ChemicalRow, type UtilityReading } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { SortHeader, sortRows, useColumnSort } from '../qc/qcNav.tsx'
import { Legend, fill } from '../qc/qcVisual.tsx'
import { ChemicalDetail, HoursOnDayDetail, UtilityDetailDialog, UtilityPanelOpen } from './utilityDialogs.tsx'
import { UtilityKpi } from './utilityKpi.tsx'
import { PrintedBullet, TagHistoryDialog, tagLabel, type OpenTag } from './utilityCharts.tsx'
import { UtilityChrome, useNumber, useUtility, useUtilityDay, useUtilityRange } from './utilityShell.tsx'
import { ReadingGrid, pivot } from './utilityTable.tsx'

type Place = 'F/UTI-001' | 'F/UTI-002'
type BoilerDialog = null | 'hours' | 'chemicals'

/** The three headline tags per panel, matched on the printed tag. */
const HEADLINE_TAGS: Record<Place, Array<{ name: string; pattern: RegExp }>> = {
  'F/UTI-001': [
    { name: 'Drum Pressure', pattern: /^Drum Pressure$/i },
    { name: 'TI101 - Furnace Outlet Gas Temp.', pattern: /^TI101\b/i },
    { name: 'Feed Water Pressure', pattern: /^Feed Water Pressure$/i },
  ],
  'F/UTI-002': [
    { name: 'Steam Drum Pressure 2', pattern: /^Steam Drum Pressure 2\b/i },
    { name: 'Boiler MSV Outlet Steam Temp', pattern: /^Boiler MSV Outlet Steam Temp\b/i },
    { name: 'Steam Distribution header Press', pattern: /^Steam Distribution header Press\b/i },
  ],
}

export function BoilerPage() {
  const { t, locale } = useLocale()
  const number = useNumber()
  const { summary, siteId } = useUtility()
  const { start, end } = useUtilityRange()
  const [place, setPlace] = useState<Place>('F/UTI-001')
  const [openTag, setOpenTag] = useState<OpenTag | null>(null)
  const [dialog, setDialog] = useState<BoilerDialog>(null)
  const { date, emptySheet, day, loading } = useUtilityDay(place)

  const readings = useMemo(() => day?.readings.filter((row) => row.tag) ?? [], [day])
  const { columns, rows } = useMemo(() => pivot(readings, 'time'), [readings])
  const latestOf = (pattern: RegExp) => [...readings].reverse().find((row) => row.value != null && pattern.test(row.tag ?? ''))
  const limited = columns.filter((column) => hasLimit(column.info))
  const lastValue = (key: string) => [...rows].reverse().map((row) => row.cells.get(key)).find((cell) => cell?.value != null)?.value ?? null
  const bands = openTag
    ? summary.boiler
      .filter((row) => row.form === openTag.form && row.tag === openTag.info.tag && row.group === openTag.group)
      .map((row) => ({ date: row.date, low: row.low, high: row.high, count: row.count }))
    : []
  const times = rows.map((row) => row.at).filter((time) => time !== '-')

  const openReading = (row: UtilityReading) => {
    setOpenTag({ form: place, info: row, group: row.group })
  }

  return (
    <UtilityChrome
      title={t.utilityBoiler}
      day={date}
      note={t.boilerNote}
      legend={<Legend items={['watch', 'missing']} labels={{ watch: t.outsidePrinted }} />}
    >
      <div className="section-head">
        <div className="view-toggle" role="group" aria-label={t.utilityBoiler}>
          <button type="button" aria-pressed={place === 'F/UTI-001'} onClick={() => setPlace('F/UTI-001')}>{t.controlRoom} · F/UTI-001</button>
          <button type="button" aria-pressed={place === 'F/UTI-002'} onClick={() => setPlace('F/UTI-002')}>{t.localPanel} · F/UTI-002</button>
        </div>
      </div>

      <section className="prod-kpis" aria-label={t.utilityBoiler}>
        <UtilityKpi label={t.hoursLogged} value={day ? String(rows.length) : '-'} onOpen={() => setDialog('hours')} disabled={!day} />
        {HEADLINE_TAGS[place].map((item) => {
          const row = latestOf(item.pattern)
          const label = row ? `${tagLabel(row)}${row.spec && hasLimit(row) ? ` · ${row.spec}` : ''}${row.time ? ` · ${row.time}` : ''}` : item.name
          return (
            <UtilityKpi
              key={item.name}
              label={label}
              value={number(row?.value ?? null)}
              onOpen={() => row && openReading(row)}
              disabled={!row}
            />
          )
        })}
      </section>

      {limited.length > 0 ? (
        <UtilityPanelOpen title={t.latestAgainstPrinted} onOpen={() => limited[0] && setOpenTag({ form: place, info: limited[0].info, group: limited[0].group })}>
          <div className="qc-bullets">
            {limited.map((column) => (
              <PrintedBullet
                key={column.key}
                info={column.info}
                value={lastValue(column.key)}
                values={[]}
                onOpen={() => setOpenTag({ form: place, info: column.info, group: column.group })}
              />
            ))}
          </div>
        </UtilityPanelOpen>
      ) : null}

      <section className="prod-panel">
        <h2 className="card__title">
          {t.hourlyLog}
          {date ? ` · ${formatDay(date, locale)}` : ''}
          {day?.shifts ? ` · ${t.shift} ${day.shifts}` : ''}
        </h2>
        {!date ? <p className="empty">{t.noUtilityRows}</p> : emptySheet ? <p className="empty">{t.noDataDay}</p> : loading && !day ? <p className="page-note">{t.loading}</p> : (
          <ReadingGrid
            readings={readings}
            by="time"
            firstLabel={t.time}
            onOpen={(column) => setOpenTag({ form: place, info: column.info, group: column.group })}
          />
        )}
      </section>

      <ChemicalPanel rows={summary.chemicals} onOpen={() => setDialog('chemicals')} />

      <UtilityDetailDialog open={dialog != null} title={dialog === 'hours' ? t.hoursLogged : t.boilerChemicals} start={start} end={end} onClose={() => setDialog(null)}>
        {dialog === 'hours' ? <HoursOnDayDetail times={times} /> : null}
        {dialog === 'chemicals' ? <ChemicalDetail rows={summary.chemicals} /> : null}
      </UtilityDetailDialog>

      <TagHistoryDialog open={openTag} bands={bands} start={start} end={end} siteId={siteId} onClose={() => setOpenTag(null)} />
    </UtilityChrome>
  )
}

function ChemicalPanel({ rows, onOpen }: { rows: ChemicalRow[]; onOpen: () => void }) {
  const { t, locale } = useLocale()
  const number = useNumber()
  const sort = useColumnSort()
  const materials = new Map<string, ChemicalRow[]>()
  for (const row of rows) materials.set(row.material ?? '-', [...(materials.get(row.material ?? '-') ?? []), row])
  const logDays = new Set(rows.map((row) => row.date)).size
  const lines = [...materials.entries()].map(([material, own]) => {
    const last = own[own.length - 1]
    return {
      material,
      remaining: last.remaining,
      lastDate: last.date,
      used: sum(own.map((row) => row.used)),
      received: sum(own.map((row) => row.received)),
      days: new Set(own.map((row) => row.date)).size,
    }
  })
  const sorted = sortRows(lines, sort.key, sort.dir, (row, key) => row[key as keyof typeof row] ?? null)
  return (
    <UtilityPanelOpen title={`${t.boilerChemicals} · F/UTI-005`} onOpen={onOpen}>
      <p className="page-note">{fill(t.chemicalNote, { count: logDays })}</p>
      {lines.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
        <div className="prod-scroll">
          <table className="prod-table prod-table--fit">
            <thead>
              <tr>
                <SortHeader label={t.chemical} column="material" sort={sort} />
                <SortHeader label={t.lastRemaining} column="remaining" sort={sort} align="right" />
                <SortHeader label={t.lastLog} column="lastDate" sort={sort} />
                <SortHeader label={t.usedOnLogDays} column="used" sort={sort} align="right" />
                <SortHeader label={t.received} column="received" sort={sort} align="right" />
                <SortHeader label={t.daysWithLog} column="days" sort={sort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.material}>
                  <td><span className="qc-product">{row.material}</span></td>
                  <td className={row.remaining == null ? 'num num--empty' : 'num'}>{number(row.remaining)}</td>
                  <td>{formatDay(row.lastDate, locale)}</td>
                  <td className={row.used == null ? 'num num--empty' : 'num'}>{number(row.used)}</td>
                  <td className={row.received == null ? 'num num--empty' : 'num'}>{number(row.received)}</td>
                  <td className="num">{row.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </UtilityPanelOpen>
  )
}
