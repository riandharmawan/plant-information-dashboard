import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { MESSAGES } from './messages.ts'
import type { Locale, Messages } from './messages.ts'

interface LocaleState {
  locale: Locale
  t: Messages
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleState | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')
  const value = useMemo(
    () => ({ locale, t: MESSAGES[locale], setLocale }),
    [locale],
  )
  return <LocaleContext value={value}>{children}</LocaleContext>
}

export function useLocale(): LocaleState {
  const state = useContext(LocaleContext)
  if (!state) throw new Error('useLocale must be used inside LocaleProvider')
  return state
}
