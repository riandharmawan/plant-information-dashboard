import { NavLink, useSearchParams } from 'react-router-dom'
import { useProductionReport } from '../../data/ProductionContext.tsx'
import type { PlantKey } from '../../domain/dailyProduction.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { Messages } from '../../i18n/messages.ts'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const TABS: Array<{ path: string; label: keyof Messages; end?: boolean }> = [
  { path: '/daily-production', label: 'dailyProduction', end: true },
  { path: '/daily-production/refinery-500', label: 'refinery500' },
  { path: '/daily-production/refinery-150', label: 'refinery150' },
  { path: '/daily-production/fractionation-400', label: 'fract400' },
  { path: '/daily-production/fractionation-500', label: 'fract500' },
  { path: '/daily-production/separator', label: 'separator' },
  { path: '/daily-production/supporting-materials', label: 'supportingMaterials' },
]

export const PLANT_PATH: Record<PlantKey, string> = {
  refinery500: '/daily-production/refinery-500',
  refinery150: '/daily-production/refinery-150',
  fract400: '/daily-production/fractionation-400',
  fract500: '/daily-production/fractionation-500',
  separator: '/daily-production/separator',
}

function isIsoDate(value: string | null): value is string {
  if (!value) return false
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function productionSearch(start: string, end: string): string {
  const from = start <= end ? start : end
  const to = start <= end ? end : start
  return `?from=${from}&to=${to}`
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function useProductionRange() {
  const [params, setParams] = useSearchParams()
  const { dates } = useProductionReport()
  const fallbackStart = dates[0] ?? todayIso()
  const fallbackEnd = dates[dates.length - 1] ?? fallbackStart
  const from = params.get('from')
  const to = params.get('to')
  const start = isIsoDate(from) ? from : fallbackStart
  const end = isIsoDate(to) ? to : fallbackEnd

  const setRange = (nextStart: string, nextEnd: string) => {
    const next = new URLSearchParams(params)
    const fromDate = nextStart <= nextEnd ? nextStart : nextEnd
    const toDate = nextStart <= nextEnd ? nextEnd : nextStart
    next.set('from', fromDate)
    next.set('to', toDate)
    setParams(next, { replace: true })
  }

  return { start, end, setRange }
}

export function PlantTabs({ start, end }: { start: string; end: string }) {
  const { t } = useLocale()
  const search = productionSearch(start, end)
  return (
    <nav className="prod-tabs" aria-label={t.plantDetail}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={{ pathname: tab.path, search }}
          end={tab.end}
          className={({ isActive }) => (isActive ? 'prod-tab prod-tab--on' : 'prod-tab')}
        >
          {t[tab.label]}
        </NavLink>
      ))}
    </nav>
  )
}
