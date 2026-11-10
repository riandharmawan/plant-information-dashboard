import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth, type SessionSite } from './AuthContext.tsx'
import { useRepository } from './OperationsContext.tsx'

const STORAGE_KEY = 'pid.activeSite'
const PREFERRED_SITE = 'bekasi'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* the choice just does not survive a reload */
  }
}

interface ActiveSiteState {
  /** The site every screen reads. */
  siteId: string
  /** That site with its company and codes, when the session carries it. */
  site: SessionSite | null
  /** Every site the signed-in user may open. */
  sites: SessionSite[]
  setSiteId: (id: string) => void
}

const ActiveSiteContext = createContext<ActiveSiteState | null>(null)

/**
 * The site the user is looking at. It is chosen from the sites assigned to the user, remembered
 * in this browser, and handed to the data repository before any screen asks it for data.
 */
export function ActiveSiteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const repository = useRepository()
  const [chosen, setChosen] = useState<string | null>(readStored)
  const sites = useMemo(() => user?.sites ?? [], [user])

  const siteId = useMemo(
    () =>
      sites.find((site) => site.id === chosen)?.id ??
      sites.find((site) => site.id === PREFERRED_SITE)?.id ??
      sites[0]?.id ??
      PREFERRED_SITE,
    [sites, chosen],
  )

  // Set during render, before the screens below fetch, so none of them reads the previous site.
  useMemo(() => {
    repository.setSiteId?.(siteId)
  }, [repository, siteId])

  const setSiteId = useCallback(
    (id: string) => {
      if (!sites.some((site) => site.id === id)) return
      writeStored(id)
      setChosen(id)
    },
    [sites],
  )

  const value = useMemo<ActiveSiteState>(
    () => ({ siteId, site: sites.find((s) => s.id === siteId) ?? null, sites, setSiteId }),
    [siteId, sites, setSiteId],
  )

  return <ActiveSiteContext.Provider value={value}>{children}</ActiveSiteContext.Provider>
}

export function useActiveSite(): ActiveSiteState {
  const value = useContext(ActiveSiteContext)
  if (!value) throw new Error('useActiveSite must be used inside ActiveSiteProvider')
  return value
}
