import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { OperationsRepository } from './repository.ts'

const OperationsContext = createContext<OperationsRepository | null>(null)

export function OperationsProvider({
  repository,
  children,
}: {
  repository: OperationsRepository
  children: ReactNode
}) {
  return <OperationsContext value={repository}>{children}</OperationsContext>
}

export function useRepository(): OperationsRepository {
  const repository = useContext(OperationsContext)
  if (!repository) {
    throw new Error('useRepository must be used inside OperationsProvider')
  }
  return repository
}
