import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleContext.tsx'

interface CommodityFilterProps {
  families: string[]
  selected: string[] | null
  onChange: (selected: string[] | null) => void
}

export function CommodityFilter({ families, selected, onChange }: CommodityFilterProps) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const allChecked = selected == null || (families.length > 0 && selected.length === families.length)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function setAll(checked: boolean) {
    onChange(checked ? null : [])
  }

  function toggleFamily(family: string, checked: boolean) {
    const current = selected ?? families
    const next = checked ? [...current, family] : current.filter((item) => item !== family)
    const ordered = families.filter((item) => next.includes(item))
    onChange(ordered.length === families.length ? null : ordered)
  }

  const label = allChecked
    ? t.allCommodities
    : selected && selected.length > 0
      ? selected.join(', ')
      : t.noCommodity

  return (
    <div className="commodity-filter" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="commodity-filter__trigger"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="commodity-filter__label">{label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="commodity-filter__menu" id={menuId} role="group" aria-label={t.commodities}>
          <label className="commodity-filter__option">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(event) => setAll(event.target.checked)}
            />
            <span>{t.allCommodities}</span>
          </label>
          {families.map((family) => (
            <label key={family} className="commodity-filter__option">
              <input
                type="checkbox"
                checked={selected == null || selected.includes(family)}
                onChange={(event) => toggleFamily(family, event.target.checked)}
              />
              <span>{family}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
