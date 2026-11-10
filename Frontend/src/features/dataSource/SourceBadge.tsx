import { ClipboardList, Gauge } from 'lucide-react'
import type { DataSource } from '../../domain/dataSource.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'

/**
 * Says where the figures on screen come from, by icon, colour and name together, so it never depends
 * on colour alone. The gauge system is teal and the logsheets violet, apart from the green, amber and
 * red used for status. The full text is also the tooltip, with a line on how the data arrives.
 * `compact` shows the icon alone with the name as its tooltip, for a table cell.
 */
export function SourceBadge({ source, compact = false }: { source: DataSource; compact?: boolean }) {
  const { t } = useLocale()
  // An unknown source shows nothing. Showing Logsheet by default would mislabel a gauge-fed site.
  if (source !== 'atg' && source !== 'logsheet') return null
  const name = source === 'atg' ? t.dsAtg : t.dsLogsheet
  const hint = source === 'atg' ? t.dsAtgHint : t.dsLogsheetHint
  const Icon = source === 'atg' ? Gauge : ClipboardList
  return (
    <span
      className={`ds-badge ds-badge--${source}${compact ? ' ds-badge--compact' : ''}`}
      title={`${t.dsSource}: ${name}. ${hint}`}
      role="img"
      aria-label={`${t.dsSource}: ${name}`}
    >
      <Icon size={compact ? 12 : 14} aria-hidden="true" />
      {compact ? null : <span className="ds-badge__name">{name}</span>}
    </span>
  )
}
