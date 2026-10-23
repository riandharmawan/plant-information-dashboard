import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { QC, type QcFile } from '../domain/qc.ts'

const QcFileContext = createContext<QcFile>(QC)

export function useQcFile(): QcFile {
  return useContext(QcFileContext)
}

function apiBase(): string {
  return (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3010/api/v1').replace(/\/$/, '')
}

export function QcLayout({ children }: { children?: ReactNode }) {
  const useApi = import.meta.env.VITE_DATA_SOURCE === 'api'
  const [file, setFile] = useState<QcFile | null>(useApi ? null : QC)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!useApi) return
    const base = apiBase()
    let cancelled = false
    const load = async (path: string) => {
      const response = await fetch(`${base}${path}`)
      if (!response.ok) throw new Error(`API ${response.status} for ${path}`)
      return response.json()
    }
    Promise.all([
      load('/sites/bekasi/qc/storage'),
      load('/sites/bekasi/qc/vessels'),
      load('/sites/bekasi/qc/trucks'),
      load('/sites/bekasi/qc/movements'),
    ])
      .then(([storage, vessels, trucks, movements]) => {
        if (!cancelled) setFile({ storage, vessels, trucks, movements })
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Quality control data failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [useApi])

  if (error) return <p className="page-note">{error}</p>
  if (!file) return <p className="page-note">Loading quality control…</p>
  return (
    <QcFileContext.Provider value={file}>
      {children ?? <Outlet />}
    </QcFileContext.Provider>
  )
}
