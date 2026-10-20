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

/**
 * The only door between screens and data.
 *
 * LocalOperationsRepository serves the mock from parsed logsheets.
 * HttpOperationsRepository calls the same paths on Express:
 *
 *   GET /api/site
 *   GET /api/site/snapshot
 *   GET /api/live/tanks
 *   GET /api/live/logistics
 *   GET /api/tanks/:tankId/soundings
 *   GET /api/tanks/:tankId/labs
 *   GET /api/analytics/summary?tankId=
 *   GET /api/analytics/movements
 *
 * Screens keep using these methods when the backend arrives.
 */
export interface OperationsRepository {
  getSnapshotMeta(): Promise<SnapshotMeta>
  getSite(): Promise<SiteContext>
  getLiveTanks(on?: string | null, range?: { start: string; end: string }): Promise<TankLive[]>
  getLiveLogistics(): Promise<LogisticsVehicle[]>
  getSoundingHistory(tankId: string): Promise<SoundingPoint[]>
  getLabHistory(tankId: string): Promise<LabHistoryPoint[]>
  getMovementSummary(): Promise<MovementTotal[]>
  getAnalyticsSummary(tankId: string | null): Promise<AnalyticsSummary>
}
