import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api as http, ApiError } from './api.ts'
import { useAuth } from './AuthContext.tsx'
import type {
  CommodityRecord,
  CompanyRecord,
  PlantRecord,
  MasterData,
  SaveResult,
  SiteRecord,
  TankRecord,
} from '../domain/master.ts'
import { MASTER_SEED } from './masterSeed.ts'

interface MasterApi {
  data: MasterData
  refresh: () => void
  /** Switch a company or site on or off. Resolves to an error code, or null when it worked. */
  setActivation: (entityType: 'company' | 'site', id: string, activated: boolean) => Promise<string | null>
  saveCompany: (input: { code: string; name: string }, id: string | null) => SaveResult
  removeCompany: (id: string) => SaveResult
  saveSite: (input: { companyId: string; name: string; timezone: string }, id: string | null) => SaveResult
  removeSite: (id: string) => SaveResult
  savePlant: (input: { siteId: string; name: string }, id: string | null) => SaveResult
  removePlant: (id: string) => SaveResult
  saveCommodity: (input: { code: string; name: string }, id: string | null) => SaveResult
  removeCommodity: (id: string) => SaveResult
  saveTank: (input: { plantId: string; code: string; capacity: string; capacityUnit: string }, id: string | null) => SaveResult
  removeTank: (id: string) => SaveResult
}

const MasterContext = createContext<MasterApi | null>(null)

interface OrgPayload {
  companies: CompanyRecord[]
  sites: SiteRecord[]
  plants: Array<Omit<PlantRecord, 'logsheetPeriod'>>
}

function cloneSeed(): MasterData {
  return structuredClone(MASTER_SEED)
}

function same(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase()
}

function normalizeTankCode(code: string): string {
  const trimmed = code.trim()
  const numbered = /^t\.?(\d+)$/i.exec(trimmed)
  if (numbered) return `T${numbered[1]}`
  return trimmed.toUpperCase()
}

export function MasterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<MasterData>(cloneSeed)

  // Company, Site and Plant come from the database, which DataHub fills.
  // The logsheet period is not stored there, so it is carried over from the seed by id.
  const loadOrg = useCallback(async () => {
    try {
      const org = await http<OrgPayload>('/api/v1/master/org')
      const period = new Map(MASTER_SEED.plants.map((plant) => [plant.id, plant.logsheetPeriod]))
      setData((current) => ({
        ...current,
        companies: org.companies,
        sites: org.sites,
        plants: org.plants.map((plant) => ({ ...plant, logsheetPeriod: period.get(plant.id) ?? null })),
      }))
    } catch {
      /* keep what is already shown */
    }
  }, [])

  const userId = user?.id ?? null
  useEffect(() => {
    if (userId != null) void loadOrg()
  }, [userId, loadOrg])

  const api: MasterApi = {
    data,
    refresh: () => {
      setData(cloneSeed())
      void loadOrg()
    },
    async setActivation(entityType, id, activated) {
      try {
        await http('/api/v1/master/org/activation', {
          method: 'PUT',
          body: JSON.stringify({ entityType, id, activated }),
        })
        await loadOrg()
        return null
      } catch (error) {
        return error instanceof ApiError ? error.code : 'request_failed'
      }
    },
    saveCompany(input, id) {
      const code = input.code.trim().toUpperCase()
      const name = input.name.trim()
      if (!code || !name) return { ok: false, reason: 'missing' }
      if (data.companies.some((row) => row.id !== id && same(row.code, code))) {
        return { ok: false, reason: 'duplicate' }
      }
      setData((current) => ({
        ...current,
        companies: id
          ? current.companies.map((row) => (row.id === id ? { ...row, code, name } : row))
          : [...current.companies, { id: crypto.randomUUID(), code, name }],
      }))
      return { ok: true }
    },
    removeCompany(id) {
      if (data.sites.some((row) => row.companyId === id)) return { ok: false, reason: 'in-use' }
      setData((current) => ({ ...current, companies: current.companies.filter((row) => row.id !== id) }))
      return { ok: true }
    },
    saveSite(input, id) {
      const name = input.name.trim()
      const timezone = input.timezone.trim()
      if (!input.companyId || !name || !timezone) return { ok: false, reason: 'missing' }
      if (data.sites.some((row) => row.id !== id && row.companyId === input.companyId && same(row.name, name))) {
        return { ok: false, reason: 'duplicate' }
      }
      const next: SiteRecord = { id: id ?? crypto.randomUUID(), companyId: input.companyId, name, timezone }
      setData((current) => ({
        ...current,
        sites: id ? current.sites.map((row) => (row.id === id ? next : row)) : [...current.sites, next],
      }))
      return { ok: true }
    },
    removeSite(id) {
      if (data.plants.some((row) => row.siteId === id)) return { ok: false, reason: 'in-use' }
      setData((current) => ({ ...current, sites: current.sites.filter((row) => row.id !== id) }))
      return { ok: true }
    },
    savePlant(input, id) {
      const name = input.name.trim()
      if (!input.siteId || !name) return { ok: false, reason: 'missing' }
      if (data.plants.some((row) => row.id !== id && row.siteId === input.siteId && same(row.name, name))) {
        return { ok: false, reason: 'duplicate' }
      }
      setData((current) => ({
        ...current,
        plants: id
          ? current.plants.map((row) => (row.id === id ? { ...row, siteId: input.siteId, name } : row))
          : [...current.plants, { id: crypto.randomUUID(), siteId: input.siteId, name, logsheetPeriod: null }],
      }))
      return { ok: true }
    },
    removePlant(id) {
      if (data.tanks.some((row) => row.plantId === id)) return { ok: false, reason: 'in-use' }
      setData((current) => ({ ...current, plants: current.plants.filter((row) => row.id !== id) }))
      return { ok: true }
    },
    saveCommodity(input, id) {
      const code = input.code.trim().toUpperCase()
      const name = input.name.trim()
      if (!code || !name) return { ok: false, reason: 'missing' }
      if (data.commodities.some((row) => row.id !== id && same(row.code, code))) {
        return { ok: false, reason: 'duplicate' }
      }
      const next: CommodityRecord = { id: id ?? crypto.randomUUID(), code, name }
      setData((current) => ({
        ...current,
        commodities: id
          ? current.commodities.map((row) => (row.id === id ? next : row))
          : [...current.commodities, next],
      }))
      return { ok: true }
    },
    removeCommodity(id) {
      setData((current) => ({ ...current, commodities: current.commodities.filter((row) => row.id !== id) }))
      return { ok: true }
    },
    saveTank(input, id) {
      const code = normalizeTankCode(input.code)
      if (!input.plantId || !code) return { ok: false, reason: 'missing' }
      if (data.tanks.some((row) => row.id !== id && row.plantId === input.plantId && same(row.code, code))) {
        return { ok: false, reason: 'duplicate' }
      }
      const next: TankRecord = {
        id: id ?? crypto.randomUUID(),
        plantId: input.plantId,
        code,
        capacity: input.capacity.trim(),
        capacityUnit: input.capacityUnit.trim(),
      }
      setData((current) => ({
        ...current,
        tanks: id ? current.tanks.map((row) => (row.id === id ? next : row)) : [...current.tanks, next],
      }))
      return { ok: true }
    },
    removeTank(id) {
      setData((current) => ({ ...current, tanks: current.tanks.filter((row) => row.id !== id) }))
      return { ok: true }
    },
  }

  return <MasterContext.Provider value={api}>{children}</MasterContext.Provider>
}

export function useMaster(): MasterApi {
  const api = useContext(MasterContext)
  if (!api) throw new Error('useMaster must be used within MasterProvider')
  return api
}
