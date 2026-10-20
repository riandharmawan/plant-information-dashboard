import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCalibration } from '../../data/CalibrationContext.tsx'
import { tankLabel } from '../../domain/format.ts'
import { DENSITY_GROUPS } from '../../domain/tankCalibration.ts'
import { DENSITY_TABLES } from '../../domain/tankStock.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'

function densityAt(group: string, tempC: number): number | null {
  const hit = DENSITY_TABLES[group]?.find(([temp]) => temp === tempC)
  return hit ? hit[1] : null
}

function formatDensity(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

export function CommoditiesCalibrationPage() {
  const { t } = useLocale()
  const calibration = useCalibration()
  const [group, setGroup] = useState<string>(DENSITY_GROUPS[0])
  const [tempText, setTempText] = useState('')
  const rows = DENSITY_TABLES[group] ?? []
  const typedTemp = tempText.trim()
  const parsedTemp = typedTemp === '' ? null : Number(typedTemp)
  const tempC = parsedTemp != null && Number.isFinite(parsedTemp) ? parsedTemp : null
  const lookedUp = tempC != null && Number.isInteger(tempC) ? densityAt(group, tempC) : null
  const range = rows.length === 0
    ? null
    : { min: rows[0][0], max: rows[rows.length - 1][0] }

  const tanks = useMemo(
    () => calibration.profiles
      .filter((tank) => tank.densityGroup === group)
      .map((tank) => tank.tankId)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
    [calibration.profiles, group],
  )

  return (
    <div className="page">
      <header className="page-title-row">
        <h1 className="page-title">{t.commoditiesCalibration}</h1>
      </header>
      <p className="page-note">{t.commoditiesCalibrationBlurb}</p>
      <Link className="master-back" to="/master">{t.backToMaster}</Link>

      <div className="calib-group-row" role="tablist" aria-label={t.densityGroup}>
        {DENSITY_GROUPS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === group}
            className={item === group ? 'btn btn--primary' : 'btn btn--secondary'}
            onClick={() => setGroup(item)}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      <section className="calib-card" aria-labelledby="density-lookup">
        <h2 id="density-lookup">{t.densityLookup}</h2>
        <p className="page-note">{t.densityLookupNote}</p>
        <label className="calib-lookup-field">
          {t.tempAxis}
          <input
            value={tempText}
            inputMode="numeric"
            onChange={(event) => setTempText(event.target.value)}
          />
        </label>
        {typedTemp === '' ? null : lookedUp == null ? (
          <p className="calib-preview-alert" role="status">
            {t.previewDensityOutOfRange
              .replace('{temp}', tempC == null ? typedTemp : String(tempC))
              .replace('{group}', group.toUpperCase())
              .replace('{min}', range ? String(range.min) : '—')
              .replace('{max}', range ? String(range.max) : '—')}
          </p>
        ) : (
          <p className="calib-notice" role="status">
            {t.densityAtTemp
              .replace('{group}', group.toUpperCase())
              .replace('{temp}', String(tempC))
              .replace('{density}', formatDensity(lookedUp))}
          </p>
        )}
      </section>

      <section className="calib-card" aria-labelledby="density-table">
        <h2 id="density-table">{group.toUpperCase()}</h2>
        <div className="calib-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th scope="col">{t.tempAxis}</th>
                <th scope="col">{t.density}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([temp, density]) => (
                <tr key={temp} className={temp === tempC ? 'calib-row--hit' : undefined}>
                  <td>{temp}</td>
                  <td>{formatDensity(density)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="calib-card" aria-labelledby="density-tanks">
        <h2 id="density-tanks">{t.tanksUsingGroup}</h2>
        <p>{tanks.length === 0 ? t.noMasterRows : tanks.map((tankId) => tankLabel(tankId)).join(', ')}</p>
      </section>
    </div>
  )
}
