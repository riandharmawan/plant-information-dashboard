import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api.ts'

export interface SessionSite {
  id: string
  name: string
  timezone: string
}

export interface PageRight {
  view: boolean
  edit: boolean
  delete: boolean
}

export interface SessionUser {
  id: number
  username: string
  displayName: string | null
  email: string | null
  sites: SessionSite[]
  permissions: Record<string, PageRight>
}

interface AuthState {
  user: SessionUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  can: (page: string, action: 'view' | 'edit' | 'delete') => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api<SessionUser>('/api/v1/auth/me')
      .then((next) => {
        if (active) setUser(next)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const next = await api<SessionUser>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setUser(next)
  }, [])

  const logout = useCallback(async () => {
    await api('/api/v1/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api('/api/v1/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }, [])

  const can = useCallback((page: string, action: 'view' | 'edit' | 'delete') => {
    return user?.permissions[page]?.[action] === true
  }, [user])

  const value = useMemo(
    () => ({ user, loading, login, logout, changePassword, can }),
    [user, loading, login, logout, changePassword, can],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
