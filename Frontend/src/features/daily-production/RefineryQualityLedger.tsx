import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../data/api.ts'
import { useAuth } from '../../data/AuthContext.tsx'
import { ledgerFor, type LedgerRow } from '../../domain/refineryQuality.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { useProductionRange } from './productionNav.tsx'

const useApi = import.meta.env.VITE_DATA_SOURCE === 'api'

function datesBetween(start: string, end: string): string[] {
  const from = start <= end ? start : end
  const to = start <= end ? end : start
  const dates: string[] = []
  let cursor = from
  while (cursor <= to && dates.length < 400) {
    dates.push(cursor)
    const next = new Date(`${cursor}T00:00:00`)
    next.setDate(next.getDate() + 1)
    const month = String(next.getMonth() + 1).padStart(2, '0')
    const day = String(next.getDate()).padStart(2, '0')
    cursor = `${next.getFullYear()}-${month}-${day}`
  }
  return dates
}

function blankRow(date: string): LedgerRow {
  return {
    date, feedOil: null, feedFfa: null, feedMoisture: null, feedDobi: null,
    finishedOil: null, finishedFfa: null, colour: null, toTank: null, byproductFfa: null, byproductMoisture: null,
  }
}

export function RefineryQualityLedger() {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const { start, end } = useProductionRange()
  const dates = datesBetween(start, end)
  const [remote, setRemote] = useState<LedgerRow[] | null>(null)
  const siteId = user?.sites[0]?.id ?? 'bekasi'
  useEffect(() => {
    if (!useApi) return
    let cancelled = false
    api<LedgerRow[]>(`/api/v1/sites/${siteId}/qc/refinery/ledger?from=${start}&to=${end}`)
      .then((rows) => { if (!cancelled) setRemote(rows) })
      .catch(() => { if (!cancelled) setRemote([]) })
    return () => { cancelled = true }
  }, [siteId, start, end])
  const rows = useApi
    ? dates.flatMap((date) => {
        const found = (remote ?? []).filter((row) => row.date === date)
        return found.length > 0 ? found : [blankRow(date)]
      })
    : ledgerFor(start, end, dates)
  const formatDay = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  const cell = (value: string | null) => value ?? '-'
  return (
    <section className="prod-panel">
      <h2 className="card__title">{t.quality}</h2>
      <div className="prod-scroll">
        <table className="prod-table">
          <thead>
            <tr>
              <th>{t.colDate}</th>
              <th>{t.feedOil}</th>
              <th className="num">{t.feedFfa}</th>
              <th className="num">{t.moisture}</th>
              <th className="num">{t.dobi}</th>
              <th>{t.finishedOil}</th>
              <th>{t.finishedFfa}</th>
              <th>{t.colour}</th>
              <th>{t.toTank}</th>
              <th className="num">{t.byproductFfa}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.date}-${row.finishedOil ?? 'none'}`}>
                <td>{formatDay(row.date)}</td>
                <td>{cell(row.feedOil)}</td>
                <td className="num">{cell(row.feedFfa)}</td>
                <td className="num">{cell(row.feedMoisture)}</td>
                <td className="num">{cell(row.feedDobi)}</td>
                <td>
                  {row.finishedOil ? (
                    <Link className="prod-plant-link" to={`/qc/refinery?from=${row.date}&to=${row.date}`}>{row.finishedOil}</Link>
                  ) : '-'}
                </td>
                <td>{cell(row.finishedFfa)}</td>
                <td>{cell(row.colour)}</td>
                <td>{cell(row.toTank)}</td>
                <td className="num">{cell(row.byproductFfa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
