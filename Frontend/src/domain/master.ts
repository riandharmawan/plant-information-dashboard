/** Organization masters. DataHub will send these later; the mockup keeps a local copy. */
export interface CompanyRecord {
  id: string
  code: string
  name: string
}

export interface SiteRecord {
  id: string
  companyId: string
  name: string
  timezone: string
}

export interface PlantRecord {
  id: string
  siteId: string
  name: string
  /** Report span of the logsheets loaded for this plant. Empty when none are loaded. */
  logsheetPeriod: string | null
}

export interface CommodityRecord {
  id: string
  code: string
  name: string
}

/** Tank master is owned by this application. Capacity stays blank until a unit is entered. */
export interface TankRecord {
  id: string
  plantId: string
  code: string
  capacity: string
  capacityUnit: string
}

export interface MasterData {
  companies: CompanyRecord[]
  sites: SiteRecord[]
  plants: PlantRecord[]
  commodities: CommodityRecord[]
  tanks: TankRecord[]
}

export type SaveResult = { ok: true } | { ok: false; reason: 'missing' | 'duplicate' | 'in-use' }
