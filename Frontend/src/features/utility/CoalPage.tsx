import { useState } from 'react'
import { formatDay } from '../../domain/format.ts'
import { sum } from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { CoalDailyDetail, UtilityDetailDialog, UtilityPanelOpen } from './utilityDialogs.tsx'
import { UtilityKpi } from './utilityKpi.tsx'
import { DailySeriesChart, axisDay } from './utilityCharts.tsx'
import { UtilityChrome, useNumber, useUtility, useUtilityDay, useUtilityRange } from './utilityShell.tsx'
import { ReadingGrid } from './utilityTable.tsx'

type CoalDialog = null | 'buckets' | 'steam' | 'ratio' | 'incoming' | 'coalChart' | 'steamChart'

export function CoalPage() {
  const { t, locale } = useLocale()
  const number = useNumber()
  const { summary } = useUtility()
  const { start, end } = useUtilityRange()
  const [dialog, setDialog] = useState<CoalDialog>(null)
  const coalDay = useUtilityDay('F/UTI-010')
  const fuelDay = useUtilityDay('F/UTI-004')
  const ratioDay = [...summary.coal].reverse().find((day) => day.ratio != null)
  const incomingDays = summary.coal.filter((day) => day.incomingKg != null).length

  const dialogTitle = () => {
    if (dialog === 'buckets') return t.coalBuckets
    if (dialog === 'steam' || dialog === 'steamChart') return t.steamDistribution
    if (dialog === 'ratio') return t.coalRatio
    if (dialog === 'incoming') return t.incomingCoalDays
    if (dialog === 'coalChart') return t.coalAndRatio
    return ''
  }

  return (
    <UtilityChrome title={t.utilityCoal} day={coalDay.date} note={t.coalSteamNote}>
      <section className="prod-kpis" aria-label={t.utilityCoal}>
        <UtilityKpi label={t.coalBuckets} value={number(sum(summary.coal.map((day) => day.buckets)))} onOpen={() => setDialog('buckets')} />
        <UtilityKpi label={t.steamDistribution} value={number(sum(summary.coal.map((day) => day.steamKg)), 0)} onOpen={() => setDialog('steam')} />
        <UtilityKpi
          label={ratioDay ? `${t.coalRatio} · ${axisDay(ratioDay.date, locale)}` : t.coalRatio}
          value={number(ratioDay?.ratio ?? null)}
          onOpen={() => setDialog('ratio')}
        />
        <UtilityKpi label={t.incomingCoalDays} value={String(incomingDays)} onOpen={() => setDialog('incoming')} />
      </section>

      <div className="prod-layout">
        <UtilityPanelOpen title={`${t.coalAndRatio} · F/UTI-010`} onOpen={() => setDialog('coalChart')}>
          {summary.coal.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
            <figure className="qc-figure chart-frame qty-chart">
              <DailySeriesChart
                rows={summary.coal}
                start={start}
                end={end}
                series={[
                  { key: 'buckets', name: t.coalBuckets, kind: 'bar', color: '#114C5A' },
                  { key: 'ratio', name: t.printedRatio, kind: 'line', color: '#10B981', axis: 'right' },
                ]}
              />
              <figcaption>{t.coalRatioCaption}</figcaption>
            </figure>
          )}
        </UtilityPanelOpen>
        <UtilityPanelOpen title={`${t.steamDistribution} · F/UTI-010`} onOpen={() => setDialog('steamChart')}>
          {summary.coal.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
            <figure className="qc-figure chart-frame qty-chart">
              <DailySeriesChart
                rows={summary.coal}
                start={start}
                end={end}
                series={[{ key: 'steamKg', name: t.steamDistribution, kind: 'line', color: '#114C5A' }]}
              />
              <figcaption>{t.steamMeterCaption}</figcaption>
            </figure>
          )}
        </UtilityPanelOpen>
      </div>

      <section className="prod-panel">
        <h2 className="card__title">{t.shiftLog} · F/UTI-010{coalDay.date ? ` · ${formatDay(coalDay.date, locale)}` : ''}</h2>
        {!coalDay.date ? <p className="empty">{t.noUtilityRows}</p> : coalDay.loading && !coalDay.day ? <p className="page-note">{t.loading}</p> : (
          <ReadingGrid readings={coalDay.day?.readings ?? []} by="shift" firstLabel={t.shift} />
        )}
      </section>

      <section className="prod-panel">
        <h2 className="card__title">{t.fuelClockLog} · F/UTI-004{fuelDay.date ? ` · ${formatDay(fuelDay.date, locale)}` : ''}</h2>
        {!fuelDay.date ? <p className="empty">{t.noUtilityRows}</p> : fuelDay.loading && !fuelDay.day ? <p className="page-note">{t.loading}</p> : (
          <ReadingGrid
            readings={fuelDay.day?.readings ?? []}
            by="time"
            firstLabel={t.time}
            label={(column) => (column.info.tag === 'Steam' ? t.steamMeter : column.info.tag ?? '-')}
          />
        )}
      </section>

      <UtilityDetailDialog open={dialog != null} title={dialogTitle()} start={start} end={end} onClose={() => setDialog(null)}>
        {dialog != null ? <CoalDailyDetail coal={summary.coal} start={start} end={end} /> : null}
      </UtilityDetailDialog>
    </UtilityChrome>
  )
}
