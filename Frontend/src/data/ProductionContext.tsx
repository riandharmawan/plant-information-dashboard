import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { api } from './api.ts'
import { useAuth } from './AuthContext.tsx'
import { useLocale } from '../i18n/LocaleContext.tsx'
import { dayHasData, PRODUCTION_DAYS, type ProductionDay } from '../domain/dailyProduction.ts'

const useApi = import.meta.env.VITE_DATA_SOURCE === 'api'

interface ProductionReport {
  days: ProductionDay[]
  dates: string[]
}

const ProductionContext = createContext<ProductionReport | null>(null)

export function useProductionReport(): ProductionReport {
  const report = useContext(ProductionContext)
  if (!report) throw new Error('Daily production is outside its data layout')
  return report
}

export function ProductionLayout({ children }: { children?: ReactNode }) {
  const { t, locale } = useLocale()
  const { user } = useAuth()
  const siteId = user?.sites[0]?.id ?? 'bekasi'
  const [days, setDays] = useState<ProductionDay[] | null>(useApi ? null : PRODUCTION_DAYS)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!useApi) return
    let cancelled = false
    api<{ days: ProductionDay[] }>(`/api/v1/sites/${siteId}/production`)
      .then((body) => {
        if (!cancelled) setDays(body.days)
      })
      .catch(() => {
        if (!cancelled) setError(locale === 'id' ? 'Laporan produksi harian gagal dimuat.' : 'Daily production failed to load.')
      })
    return () => {
      cancelled = true
    }
  }, [locale, siteId])

  const dates = useMemo(() => (days ?? []).filter(dayHasData).map((day) => day.id), [days])

  if (error) return <p className="page-note">{error}</p>
  if (!days) return <p className="page-note">{t.loading}</p>
  return (
    <ProductionContext.Provider value={{ days, dates }}>
      {children ?? <Outlet />}
    </ProductionContext.Provider>
  )
}
