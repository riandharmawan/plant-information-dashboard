import type { OperationsRepository } from './repository.ts'
import type {
  AnalyticsSummary,
  LabHistoryPoint,
  LogisticsVehicle,
  MovementTotal,
  SiteContext,
  SnapshotMeta,
  SoundingPoint,
  TankLive,
} from '../domain/types.ts'

const PREFERRED_SITE = 'bekasi'

export class HttpOperationsRepository implements OperationsRepository {
  private readonly baseUrl: string
  private resolvedSiteId: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`)
    if (!response.ok) {
      throw new Error(`API ${response.status} for ${path}`)
    }
    return response.json() as Promise<T>
  }

  private async siteId(): Promise<string> {
    if (this.resolvedSiteId) return this.resolvedSiteId
    const sites = await this.get<Array<{ id: string }>>('/sites')
    const match = sites.find((site) => site.id === PREFERRED_SITE) ?? sites[0]
    if (!match) throw new Error('API returned no sites')
    this.resolvedSiteId = match.id
    return match.id
  }

  async getSnapshotMeta() {
    const siteId = await this.siteId()
    return this.get<SnapshotMeta>(`/sites/${siteId}/snapshot`)
  }

  async getSite() {
    const siteId = await this.siteId()
    return this.get<SiteContext>(`/sites/${siteId}`)
  }

  async getLiveTanks(on?: string | null, range?: { start: string; end: string }) {
    const siteId = await this.siteId()
    const params = new URLSearchParams()
    if (on) params.set('on', on)
    if (range?.start) params.set('from', range.start)
    if (range?.end) params.set('to', range.end)
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return this.get<TankLive[]>(`/sites/${siteId}/live/tanks${query}`)
  }

  async getLiveLogistics() {
    const siteId = await this.siteId()
    return this.get<LogisticsVehicle[]>(`/sites/${siteId}/live/logistics`)
  }

  async getSoundingHistory(tankId: string) {
    const siteId = await this.siteId()
    return this.get<SoundingPoint[]>(`/sites/${siteId}/tanks/${encodeURIComponent(tankId)}/soundings`)
  }

  async getLabHistory(tankId: string) {
    const siteId = await this.siteId()
    return this.get<LabHistoryPoint[]>(`/sites/${siteId}/tanks/${encodeURIComponent(tankId)}/labs`)
  }

  async getMovementSummary() {
    const siteId = await this.siteId()
    return this.get<MovementTotal[]>(`/sites/${siteId}/analytics/movements`)
  }

  async getAnalyticsSummary(tankId: string | null) {
    const siteId = await this.siteId()
    const query = tankId ? `?tankId=${encodeURIComponent(tankId)}` : ''
    return this.get<AnalyticsSummary>(`/sites/${siteId}/analytics/summary${query}`)
  }
}
