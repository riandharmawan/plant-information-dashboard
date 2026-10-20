import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCalibration } from '../../data/CalibrationContext.tsx'
import { formatKg, formatMeasure, tankLabel } from '../../domain/format.ts'
import {
  DENSITY_GROUPS,
  type CalibrationIssue,
  type TankProfile,
  canonicalTankId,
  emptyProfile,
  parseCsvPairs,
  parseCsvTriples,
  parseCsvValues,
  serializeCsvPairs,
  serializeCsvTriples,
  serializeCsvValues,
  sortVolume,
} from '../../domain/tankCalibration.ts'
import { previewNotice, stockFromProfile, type PreviewNotice } from '../../domain/tankStock.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { PairTable, TripleTable, ValueTable } from './CalibrationTableEditor.tsx'

const METHODS = ['ISI LK', 'ISI LB', 'K LK', 'K LB', 'EMPTY'] as const

function fieldNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function downloadCsv(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function TankCalibrationPage() {
  const { tankId: rawId } = useParams()
  const tankId = canonicalTankId(decodeURIComponent(rawId ?? ''))
  const { t } = useLocale()
  const calibration = useCalibration()
  const [activeId, setActiveId] = useState(tankId)
  const [draft, setDraft] = useState<TankProfile>(() => calibration.profileOf(tankId))
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [level, setLevel] = useState('')
  const [temp, setTemp] = useState('')
  const [method, setMethod] = useState<string>('ISI LK')

  if (activeId !== tankId) {
    setActiveId(tankId)
    setDraft(calibration.profileOf(tankId))
    setError(null)
    setNotice(null)
  }

  const levelM = fieldNumber(level)
  const tempC = fieldNumber(temp)
  const preview = useMemo(
    () => stockFromProfile(draft, levelM, tempC, method),
    [draft, levelM, tempC, method],
  )
  const rangeNotice = useMemo(
    () => previewNotice(draft, levelM, tempC, method),
    [draft, levelM, tempC, method],
  )

  function patch(partial: Partial<TankProfile>): void {
    setDraft((current) => ({ ...current, ...partial, tankId }))
    setNotice(null)
  }

  function issueMessage(issue: CalibrationIssue): string {
    if (issue === 'invalidCapacity') return t.invalidCapacity
    if (issue === 'invalidVolumeHeights') return t.invalidVolumeHeights
    if (issue === 'invalidDensityGroup') return t.invalidDensityGroup
    if (issue === 'tableTempRequired') return t.tableTempRequired
    return t.invalidRingBand
  }

  function save(): void {
    const next = { ...draft, tankId, volume: sortVolume(draft.volume) }
    const issue = calibration.saveProfile(next)
    if (issue) {
      setError(issueMessage(issue))
      setNotice(null)
      return
    }
    setDraft(next)
    setError(null)
    setNotice(t.savedCalibration)
  }

  function reset(): void {
    calibration.resetTank(tankId)
    setDraft(calibration.seedOf(tankId) ?? emptyProfile(tankId))
    setNotice(t.resetCalibration)
    setError(null)
  }

  async function readFile(file: File): Promise<string> {
    return file.text()
  }

  return (
    <div className="page">
      <header className="page-title-row">
        <h1 className="page-title">{t.tankCalibration} {tankLabel(tankId)}</h1>
        <span className={`calib-badge ${calibration.isCustom(tankId) ? 'calib-badge--custom' : ''}`}>
          {calibration.isCustom(tankId) ? t.calibrationCustom : t.calibrationDefault}
        </span>
      </header>
      <p className="page-note">{t.tankCalibrationBlurb}</p>
      <Link className="master-back" to="/master/tank-farm">{t.backToTankFarm}</Link>

      <div className="calib-layout">
        <section className="calib-card" aria-labelledby="calib-constants">
          <h2 id="calib-constants">{t.calibrationConstants}</h2>
          <div className="calib-fields">
            <NumberField label={t.capacity} suffix="kg" value={draft.capacityKg} onChange={(value) => patch({ capacityKg: value })} />
            <NumberField label={t.bottomStock} suffix="kg" value={draft.bottomStockKg} onChange={(value) => patch({ bottomStockKg: value })} />
            <NumberField label={t.dipOffset} suffix="mm" value={draft.dipOffsetMm} onChange={(value) => patch({ dipOffsetMm: value ?? 0 })} />
            <NumberField label={t.ullageLk} suffix="mm" value={draft.ullageLkMm} onChange={(value) => patch({ ullageLkMm: value })} />
            <NumberField label={t.ullageLb} suffix="mm" value={draft.ullageLbMm} onChange={(value) => patch({ ullageLbMm: value })} />
            <NumberField label={t.tableTemp} suffix="°C" value={draft.tableTempC} onChange={(value) => patch({ tableTempC: value })} />
            <label>
              {t.densityGroup}
              <select
                value={draft.densityGroup ?? ''}
                onChange={(event) => patch({ densityGroup: event.target.value || null })}
              >
                <option value="">{t.unavailable}</option>
                {DENSITY_GROUPS.map((group) => (
                  <option key={group} value={group}>{group.toUpperCase()}</option>
                ))}
              </select>
            </label>
            <label>
              {t.lookupMode}
              <select
                value={draft.volumeApprox ? 'approx' : 'exact'}
                onChange={(event) => patch({ volumeApprox: event.target.value === 'approx' })}
              >
                <option value="exact">{t.lookupExact}</option>
                <option value="approx">{t.lookupApprox}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="calib-card" aria-labelledby="calib-preview">
          <h2 id="calib-preview">{t.preview}</h2>
          <div className="calib-fields">
            <label>
              {t.levelAxis}
              <input value={level} onChange={(event) => setLevel(event.target.value)} />
            </label>
            <label>
              {t.tempAxis}
              <input value={temp} onChange={(event) => setTemp(event.target.value)} />
            </label>
            <label>
              {t.soundingMethod}
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <dl className="calib-preview">
            <div><dt>{t.quantity}</dt><dd>{preview.quantityKg == null ? t.unavailable : `${formatKg(preview.quantityKg)} kg`}</dd></div>
            <div><dt>{t.emptySpace}</dt><dd>{preview.emptySpaceKg == null ? t.unavailable : `${formatKg(preview.emptySpaceKg)} kg`}</dd></div>
            <div><dt>{t.loadable}</dt><dd>{preview.loadableKg == null ? t.unavailable : `${formatKg(preview.loadableKg)} kg`}</dd></div>
            <div><dt>{t.tankLevelPct}</dt><dd>{preview.levelRatio == null ? t.unavailable : `${(preview.levelRatio * 100).toFixed(1)}%`}</dd></div>
          </dl>
          {rangeNotice && <p className="calib-preview-alert" role="status">{noticeText(t, rangeNotice)}</p>}
        </section>
      </div>

      <section className="calib-card" aria-labelledby="calib-volume">
        <h2 id="calib-volume">{t.volumeTable}</h2>
        <PairTable
          rows={draft.volume}
          headers={[t.heightM, t.liters]}
          filterPlaceholder={`${t.filterBy} ${t.heightM}`}
          onChange={(volume) => patch({ volume })}
          onImport={async (file) => {
            const parsed = parseCsvPairs(await readFile(file))
            if (parsed.error) {
              setError(t.csvParseError)
              return
            }
            patch({ volume: sortVolume(parsed.rows) })
            setError(null)
          }}
          onExport={() => downloadCsv(`${tankId}-volume.csv`, serializeCsvPairs(draft.volume, ['height', 'liters']))}
        />
      </section>

      <div className="calib-layout">
        <section className="calib-card" aria-labelledby="calib-rings">
          <h2 id="calib-rings">{t.ringVolumes}</h2>
          <ValueTable
            values={draft.ringVolumes}
            headers={[t.ringIndex, t.liters]}
            onChange={(ringVolumes) => patch({ ringVolumes })}
            onImport={async (file) => {
              const parsed = parseCsvValues(await readFile(file))
              if (parsed.error) {
                setError(t.csvParseError)
                return
              }
              patch({ ringVolumes: parsed.values })
              setError(null)
            }}
            onExport={() => downloadCsv(`${tankId}-ring-volumes.csv`, serializeCsvValues(draft.ringVolumes, ['index', 'liters']))}
          />
        </section>
        <section className="calib-card" aria-labelledby="calib-bands">
          <h2 id="calib-bands">{t.ringBands}</h2>
          <TripleTable
            rows={draft.ringBands}
            headers={[t.bandLow, t.bandHigh, t.bandOffset]}
            onChange={(ringBands) => patch({ ringBands })}
            onImport={async (file) => {
              const parsed = parseCsvTriples(await readFile(file))
              if (parsed.error) {
                setError(t.csvParseError)
                return
              }
              patch({ ringBands: parsed.rows })
              setError(null)
            }}
            onExport={() => downloadCsv(`${tankId}-ring-bands.csv`, serializeCsvTriples(draft.ringBands, ['low', 'high', 'offset']))}
          />
        </section>
      </div>

      {error && <p className="master-error">{error}</p>}
      {notice && <p className="calib-notice">{notice}</p>}
      <div className="calib-actions">
        <button type="button" className="btn btn--secondary" onClick={reset}>{t.resetTank}</button>
        <button type="button" className="btn btn--primary" onClick={save}>{t.save}</button>
      </div>
    </div>
  )
}

function noticeText(t: ReturnType<typeof useLocale>['t'], notice: PreviewNotice): string {
  if (notice.kind === 'no-table') return t.previewNoTable
  if (notice.kind === 'height') {
    return t.previewHeightOutOfRange
      .replace('{lookup}', formatMeasure(notice.lookupM, 2))
      .replace('{min}', formatMeasure(notice.minM, 2))
      .replace('{max}', formatMeasure(notice.maxM, 2))
  }
  return t.previewDensityOutOfRange
    .replace('{temp}', formatMeasure(notice.tempC, 1))
    .replace('{group}', notice.group)
    .replace('{min}', formatMeasure(notice.minC, 0))
    .replace('{max}', formatMeasure(notice.maxC, 0))
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string
  suffix: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <label>
      {label} ({suffix})
      <input
        value={value == null || Number.isNaN(value) ? '' : String(value)}
        onChange={(event) => {
          const next = fieldNumber(event.target.value)
          if (event.target.value.trim() !== '' && Number.isNaN(next)) return
          onChange(next)
        }}
      />
    </label>
  )
}
