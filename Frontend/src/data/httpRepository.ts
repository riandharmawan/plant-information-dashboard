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

export class HttpOperationsRepository implements OperationsRepository {
  private readonly baseUrl: string

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

  getSnapshotMeta() {
    return this.get<SnapshotMeta>('/site/snapshot')
  }

  getSite() {
    return this.get<SiteContext>('/site')
  }

  getLiveTanks(on?: string | null, range?: { start: string; end: string }) {
    const params = new URLSearchParams()
    if (on) params.set('on', on)
    if (range?.start) params.set('from', range.start)
    if (range?.end) params.set('to', range.end)
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return this.get<TankLive[]>(`/live/tanks${query}`)
  }

  getLiveLogistics() {
    return this.get<LogisticsVehicle[]>('/live/logistics')
  }

  getSoundingHistory(tankId: string) {
    return this.get<SoundingPoint[]>(`/tanks/${encodeURIComponent(tankId)}/soundings`)
  }

  getLabHistory(tankId: string) {
    return this.get<LabHistoryPoint[]>(`/tanks/${encodeURIComponent(tankId)}/labs`)
  }

  getMovementSummary() {
    return this.get<MovementTotal[]>('/analytics/movements')
  }

  getAnalyticsSummary(tankId: string | null) {
    const query = tankId ? `?tankId=${encodeURIComponent(tankId)}` : ''
    return this.get<AnalyticsSummary>(`/analytics/summary${query}`)
  }
}
