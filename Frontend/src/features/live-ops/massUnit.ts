import { createContext, useContext, useState } from 'react'
import { formatKg, formatKgCompact, formatMeasure } from '../../domain/format.ts'

export type MassUnit = 'ton' | 'kg'

const STORAGE_KEY = 'pid.massUnit'

function storedUnit(): MassUnit {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'kg' ? 'kg' : 'ton'
  } catch {
    return 'ton'
  }
}

/** The user's last pick, defaulting to tonnes. */
export function useMassUnitState(): [MassUnit, (unit: MassUnit) => void] {
  const [unit, setUnit] = useState<MassUnit>(storedUnit)
  const choose = (next: MassUnit) => {
    setUnit(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be blocked; the pick still holds for this visit.
    }
  }
  return [unit, choose]
}

export const MassUnitContext = createContext<MassUnit>('ton')

export interface MassFormat {
  unit: MassUnit
  symbol: string
  /** Precise amount without the symbol: 2 decimals in kg, 3 in tonnes. */
  amount: (kg: number | null) => string
  /** Whole figure for capacities, without the symbol. */
  whole: (kg: number | null) => string
  /** Short figure for cards, without the symbol. */
  compact: (kg: number | null) => string
  /** Chart axis tick. */
  axis: (kg: number) => string
}

export function massFormat(unit: MassUnit): MassFormat {
  if (unit === 'kg') {
    return {
      unit,
      symbol: 'kg',
      amount: formatKg,
      whole: (kg) => formatMeasure(kg, 0),
      compact: formatKgCompact,
      axis: (kg) => formatKg(kg).replace(/\.00$/, ''),
    }
  }
  return {
    unit,
    symbol: 't',
    amount: (kg) => (kg == null ? '—' : (kg / 1000).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })),
    whole: (kg) => (kg == null ? '—' : formatMeasure(kg / 1000, 3)),
    compact: (kg) => (kg == null ? '—' : formatMeasure(kg / 1000, Math.abs(kg) >= 100_000 ? 0 : 1)),
    axis: (kg) => formatMeasure(kg / 1000, 0),
  }
}

export function useMass(): MassFormat {
  return massFormat(useContext(MassUnitContext))
}
