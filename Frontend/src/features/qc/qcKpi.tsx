import { ChevronRight } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleContext.tsx'

/** Tank & Stock style figure: opens a detail dialog on click. */
export function QcKpi({
  label,
  value,
  tone,
  sub,
  track,
  onOpen,
  disabled,
}: {
  label: string
  value: string
  tone?: 'yield' | 'alert'
  sub?: string
  track?: number | null
  onOpen: () => void
  disabled?: boolean
}) {
  const { t } = useLocale()
  const className = ['prod-kpi', 'prod-kpi--button', tone ? `prod-kpi--${tone}` : ''].filter(Boolean).join(' ')
  const percent = track == null ? null : Math.min(100, Math.max(0, track * 100))
  return (
    <button type="button" className={className} title={t.kpiDetailHint} onClick={onOpen} disabled={disabled}>
      <ChevronRight className="prod-kpi__go" size={16} aria-hidden="true" />
      <strong>{value}</strong>
      <span>{label}</span>
      {sub ? <small className="prod-kpi__sub">{sub}</small> : null}
      {percent != null ? (
        <span className="prod-kpi__track" aria-hidden="true">
          <span className="prod-kpi__fill" style={{ width: `${percent}%` }} />
        </span>
      ) : null}
    </button>
  )
}
