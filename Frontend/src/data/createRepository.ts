import { HttpOperationsRepository } from './httpRepository.ts'
import { LocalOperationsRepository } from './localRepository.ts'
import type { OperationsRepository } from './repository.ts'

export function createRepository(): OperationsRepository {
  const source = import.meta.env.VITE_DATA_SOURCE ?? 'local'
  if (source === 'api') {
    const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3010/api/v1').replace(/\/$/, '')
    return new HttpOperationsRepository(baseUrl)
  }
  return new LocalOperationsRepository()
}
