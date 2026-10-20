import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import {
  type CalibrationIssue,
  type TankProfile,
  canonicalTankId,
  cloneProfile,
  emptyProfile,
  isProfile,
  mergeProfiles,
  validateProfile,
} from '../domain/tankCalibration.ts'
import { SEED_PROFILES, setTankProfiles } from '../domain/tankStock.ts'

const STORAGE_KEY = 'pid.tankCalibration.v1'

interface StoredCalibration {
  tanks?: Record<string, TankProfile>
}

interface CalibrationApi {
  profiles: TankProfile[]
  revision: number
  isCustom: (tankId: string) => boolean
  profileOf: (tankId: string) => TankProfile
  seedOf: (tankId: string) => TankProfile | null
  saveProfile: (profile: TankProfile) => CalibrationIssue | null
  resetTank: (tankId: string) => void
}

const CalibrationContext = createContext<CalibrationApi | null>(null)

function loadOverrides(): Record<string, TankProfile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredCalibration
    if (!parsed?.tanks || typeof parsed.tanks !== 'object') return {}
    const next: Record<string, TankProfile> = {}
    for (const [tankId, profile] of Object.entries(parsed.tanks)) {
      if (!isProfile(profile)) continue
      const id = canonicalTankId(tankId)
      next[id] = { ...profile, tankId: id }
    }
    return next
  } catch {
    return {}
  }
}

function persist(overrides: Record<string, TankProfile>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tanks: overrides,
    updatedAt: new Date().toISOString(),
  }))
}

export function CalibrationProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, TankProfile>>(() => {
    const loaded = loadOverrides()
    setTankProfiles(mergeProfiles(SEED_PROFILES, loaded))
    return loaded
  })
  const [revision, setRevision] = useState(0)
  const profiles = useMemo(() => mergeProfiles(SEED_PROFILES, overrides), [overrides])

  useLayoutEffect(() => {
    setTankProfiles(profiles)
  }, [profiles])

  const api = useMemo<CalibrationApi>(() => ({
    profiles,
    revision,
    isCustom(tankId) {
      return canonicalTankId(tankId) in overrides
    },
    profileOf(tankId) {
      const id = canonicalTankId(tankId)
      return cloneProfile(profiles.find((tank) => tank.tankId === id) ?? emptyProfile(id))
    },
    seedOf(tankId) {
      const seed = SEED_PROFILES.find((tank) => tank.tankId === canonicalTankId(tankId))
      return seed ? cloneProfile(seed) : null
    },
    saveProfile(profile) {
      const next = {
        ...profile,
        tankId: canonicalTankId(profile.tankId),
      }
      const issue = validateProfile(next)
      if (issue) return issue
      setOverrides((current) => {
        const updated = { ...current, [next.tankId]: next }
        persist(updated)
        return updated
      })
      setRevision((value) => value + 1)
      return null
    },
    resetTank(tankId) {
      const id = canonicalTankId(tankId)
      setOverrides((current) => {
        if (!(id in current)) return current
        const updated = { ...current }
        delete updated[id]
        persist(updated)
        return updated
      })
      setRevision((value) => value + 1)
    },
  }), [overrides, profiles, revision])

  return <CalibrationContext value={api}>{children}</CalibrationContext>
}

export function useCalibration(): CalibrationApi {
  const api = useContext(CalibrationContext)
  if (!api) throw new Error('useCalibration must be used within CalibrationProvider')
  return api
}
