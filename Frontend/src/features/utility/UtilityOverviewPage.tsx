import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDay } from '../../domain/format.ts'
import {
  BOILER_WATER,
  WTP_WATER,
  WWTP,
  daysInRange,
  formOf,
  latestChecks,
  latestDate,
  latestReadings,
  outsidePrinted,
  readingKey,
  sum,
  type UtilityArea,
  type UtilityForm,
  type UtilityReading,
} from '../../domain/utility.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import type { Messages } from '../../i18n/messages.ts'
import { Identity, Legend, fill } from '../qc/qcVisual.tsx'
import { DailySeriesChart, axisDay } from './utilityCharts.tsx'
import {
  AttentionDetail,
  BoilerFormsDetail,
  CoalDailyDetail,
  FormCoverageDetail,
  RoJobDetail,
  UtilityDetailDialog,
  UtilityPanelOpen,
} from './utilityDialogs.tsx'
import { UtilityKpi } from './utilityKpi.tsx'
import { CoverageBar, UtilityChrome, useNumber, useUtility, useUtilityRange } from './utilityShell.tsx'

type Attention = {
  key: string
  severity: 2 | 1
  badge: 'outside' | 'no' | 'missing'
  place: string
  product?: string | null
  reason: string
  to: string
}

const ATTENTION_SHOWN = 8

export const AREA_LABEL: Record<UtilityArea, keyof Messages> = {
  boiler: 'utilityBoiler',
  coal: 'utilityCoal',
  water: 'utilityWater',
  effluent: 'utilityEffluent',
  loader: 'utilityLoader',
  power: 'utilityPower',
}

export const AREA_PATH: Partial<Record<UtilityArea, string>> = {
  boiler: '/utility/boiler',
  coal: '/utility/coal',
  water: '/utility/water',
  effluent: '/utility/effluent',
  loader: '/utility/loader',
}

const AREAS: UtilityArea[] = ['boiler', 'coal', 'water', 'effluent', 'loader', 'power']

type OverviewDialog =
  | null
  | 'boilerDays'
  | 'coalBuckets'
  | 'coalRatio'
  | 'attention'
  | 'coalPanel'
  | 'waterCoverage'
  | 'roCleaning'
  | { form: UtilityForm }

export function UtilityOverviewPage() {
  const { t, locale } = useLocale()
  const number = useNumber()
  const { summary } = useUtility()
  const { start, end, search } = useUtilityRange()
  const [dialog, setDialog] = useState<OverviewDialog>(null)
  const days = daysInRange(start, end)
  const snapshot = latestDate(summary.forms.flatMap((form) => (form.latest ? [form.latest] : [])))
  const boilerForms = summary.forms.filter((form) => form.code === 'F/UTI-001' || form.code === 'F/UTI-002')

  const attention: Attention[] = []
  for (const code of [BOILER_WATER, WTP_WATER, WWTP]) {
    const { date, rows } = latestReadings(summary, code)
    const outside = new Map<string, UtilityReading[]>()
    for (const row of rows.filter(outsidePrinted)) outside.set(readingKey(row), [...(outside.get(readingKey(row)) ?? []), row])
    for (const [key, hits] of outside) {
      const first = hits[0]
      const values = hits.map((row) => number(row.value)).join(', ')
      const tab = code === WWTP ? '/utility/effluent' : '/utility/water'
      attention.push({
        key: `outside-${code}-${key}`,
        severity: 2,
        badge: 'outside',
        place: first.group ?? code,
        product: first.name,
        reason: `${fill(t.reasonOutside, { value: values, spec: first.spec ?? '-' })} · ${formatDay(date, locale)}`,
        to: `${tab}${search}&form=${encodeURIComponent(code)}&group=${encodeURIComponent(first.group ?? '')}&test=${encodeURIComponent(first.tag ?? '')}`,
      })
    }
  }
  const checks = latestChecks(summary)
  checks.rows.filter((row) => row.result === 'no').forEach((row, index) => {
    attention.push({
      key: `check-${index}`,
      severity: 2,
      badge: 'no',
      place: row.item,
      reason: fill(t.reasonChecklistNo, { date: formatDay(row.date, locale) }),
      to: `/utility/loader${search}`,
    })
  })
  for (const form of summary.forms) {
    if (!form.daily || !snapshot || (form.logged.length === 0 && form.empty.length === 0)) continue
    const lastLogged = latestDate(form.logged)
    if (lastLogged === snapshot) continue
    const emptyOnSnapshot = form.empty.includes(snapshot)
    attention.push({
      key: `missing-${form.code}`,
      severity: 1,
      badge: 'missing',
      place: form.code,
      product: form.place,
      reason: emptyOnSnapshot
        ? fill(t.reasonEmpty, { date: formatDay(snapshot, locale) })
        : fill(t.reasonNotLogged, { date: lastLogged ? formatDay(lastLogged, locale) : '-' }),
      to: `${AREA_PATH[form.area] ?? '/utility'}${search}`,
    })
  }
  attention.sort((left, right) => right.severity - left.severity)

  const boilerDays = formOf(summary, 'F/UTI-001')?.logged.length ?? 0
  const buckets = sum(summary.coal.map((day) => day.buckets))
  const ratioDay = [...summary.coal].reverse().find((day) => day.ratio != null)
  const roJob = summary.jobs[0] ?? null

  const badgeFor = (item: Attention) => {
    if (item.badge === 'outside') return <span className="badge badge--warning">{t.outsidePrinted}</span>
    if (item.badge === 'no') return <span className="badge badge--warning">{t.checklistNo}</span>
    return <span className="badge badge--muted">{t.notLogged}</span>
  }
  const attentionItems = attention.map((item) => ({
    badge: badgeFor(item),
    place: item.place,
    product: item.product,
    reason: item.reason,
    to: item.to,
  }))
  const dialogTitle = () => {
    if (dialog === 'boilerDays') return t.boilerDaysLogged
    if (dialog === 'coalBuckets' || dialog === 'coalPanel') return t.coalAndRatio
    if (dialog === 'coalRatio') return t.coalRatio
    if (dialog === 'attention') return t.needsAttention
    if (dialog === 'waterCoverage') return t.waterCoverage
    if (dialog === 'roCleaning') return t.roCleaning
    if (dialog && typeof dialog === 'object') return dialog.form.code
    return ''
  }

  return (
    <UtilityChrome
      title={t.utility}
      day={snapshot}
      note={t.utilityNote}
      legend={<Legend items={['watch', 'nospec', 'missing']} labels={{ watch: t.outsidePrinted, nospec: t.notLogged, missing: t.notRecorded }} />}
    >
      <section className="prod-kpis" aria-label={t.utility}>
        <UtilityKpi
          label={t.boilerDaysLogged}
          value={`${boilerDays} / ${days}`}
          track={days === 0 ? null : boilerDays / days}
          onOpen={() => setDialog('boilerDays')}
        />
        <UtilityKpi label={t.coalBuckets} value={number(buckets)} onOpen={() => setDialog('coalBuckets')} />
        <UtilityKpi
          label={ratioDay ? `${t.coalRatio} · ${axisDay(ratioDay.date, locale)}` : t.coalRatio}
          value={number(ratioDay?.ratio ?? null)}
          onOpen={() => setDialog('coalRatio')}
        />
        <UtilityKpi
          label={t.attentionItems}
          value={String(attention.length)}
          tone={attention.length > 0 ? 'alert' : undefined}
          onOpen={() => setDialog('attention')}
        />
      </section>

      <UtilityPanelOpen
        title={`${t.needsAttention}${attention.length > 0 ? ` · ${attention.length}` : ''}`}
        onOpen={() => setDialog('attention')}
      >
        {attention.length === 0 ? (
          <p className="qc-attention__ok">{t.nothingNeedsAttention}</p>
        ) : (
          <ul className="qc-attention">
            {attention.slice(0, ATTENTION_SHOWN).map((item) => (
              <li key={item.key}>
                {badgeFor(item)}
                <Identity place={item.place} product={item.product} />
                <span>{item.reason}</span>
                <Link className="prod-plant-link" to={item.to}>{t.view}</Link>
              </li>
            ))}
          </ul>
        )}
        {attention.length > ATTENTION_SHOWN ? (
          <p className="page-note">{fill(t.moreItems, { count: attention.length - ATTENTION_SHOWN })}</p>
        ) : null}
      </UtilityPanelOpen>

      <SourceBoard forms={summary.forms} days={days} onForm={(form) => setDialog({ form })} />

      <div className="prod-layout">
        <UtilityPanelOpen title={t.coalAndRatio} onOpen={() => setDialog('coalPanel')}>
          {summary.coal.length === 0 ? <p className="empty">{t.noUtilityRows}</p> : (
            <figure className="qc-figure chart-frame qty-chart">
              <DailySeriesChart
                rows={summary.coal}
                start={start}
                end={end}
                height={200}
                series={[
                  { key: 'buckets', name: t.coalBuckets, kind: 'line', color: '#114C5A' },
                  { key: 'ratio', name: t.printedRatio, kind: 'line', color: '#10B981', axis: 'right' },
                ]}
              />
              <figcaption>{t.coalRatioCaption}</figcaption>
            </figure>
          )}
        </UtilityPanelOpen>

        <UtilityPanelOpen title={t.waterCoverage} onOpen={() => setDialog('waterCoverage')}>
          {[BOILER_WATER, WTP_WATER, WWTP].map((code) => {
            const form = formOf(summary, code)
            return (
              <button
                key={code}
                type="button"
                className="utility-coverage utility-coverage--button"
                onClick={() => form && setDialog({ form })}
              >
                <span className="utility-coverage__name">{code}</span>
                <CoverageBar logged={form?.logged.length ?? 0} empty={form?.empty.length ?? 0} days={days} />
              </button>
            )
          })}
          <button type="button" className="page-note prod-plant-link" onClick={() => setDialog('roCleaning')}>
            {t.roCleaning}: {roJob ? formatDay(roJob.performedOn ?? roJob.date, locale) : '-'}
          </button>
        </UtilityPanelOpen>
      </div>

      <UtilityDetailDialog open={dialog != null} title={dialogTitle()} start={start} end={end} onClose={() => setDialog(null)}>
        {dialog === 'boilerDays' ? <BoilerFormsDetail forms={boilerForms} start={start} end={end} /> : null}
        {dialog === 'coalBuckets' || dialog === 'coalPanel' || dialog === 'coalRatio' ? (
          <CoalDailyDetail coal={summary.coal} start={start} end={end} />
        ) : null}
        {dialog === 'attention' ? <AttentionDetail items={attentionItems} /> : null}
        {dialog === 'waterCoverage' ? (
          <>
            {[BOILER_WATER, WTP_WATER, WWTP].map((code) => {
              const form = formOf(summary, code)
              if (!form) return null
              return (
                <div key={code} className="utility-coverage">
                  <span className="utility-coverage__name">{code}</span>
                  <FormCoverageDetail form={form} start={start} end={end} />
                </div>
              )
            })}
          </>
        ) : null}
        {dialog === 'roCleaning' ? <RoJobDetail job={roJob} /> : null}
        {dialog && typeof dialog === 'object' ? (
          <>
            <FormCoverageDetail form={dialog.form} start={start} end={end} />
            {AREA_PATH[dialog.form.area] ? (
              <p className="page-note">
                <Link className="prod-plant-link" to={`${AREA_PATH[dialog.form.area]}${search}`}>{t.view}</Link>
              </p>
            ) : null}
          </>
        ) : null}
      </UtilityDetailDialog>
    </UtilityChrome>
  )
}

function SourceBoard({
  forms,
  days,
  onForm,
}: {
  forms: UtilityForm[]
  days: number
  onForm: (form: UtilityForm) => void
}) {
  const { t, locale } = useLocale()
  return (
    <section className="prod-panel qc-board" aria-label={t.sourceBoard}>
      <h2 className="card__title">{t.sourceBoard}</h2>
      <ul className="qc-board__list">
        {AREAS.map((area) => {
          const own = forms.filter((form) => form.area === area)
          if (own.length === 0) return null
          const submitted = own.filter((form) => form.logged.length + form.empty.length > 0).length
          return (
            <li key={area} className="qc-board__row">
              <div className="qc-board__head">
                <span className="qc-product">{t[AREA_LABEL[area]]}</span>
                <span className="qc-board__count">{fill(t.formsSubmitted, { submitted, total: own.length })}</span>
              </div>
              <div className="qc-board__chips">
                {own.map((form) => {
                  const share = days === 0 ? 0 : Math.min(form.logged.length / days, 1)
                  const silent = form.logged.length + form.empty.length === 0
                  const value = silent
                    ? t.notSubmitted
                    : `${fill(t.daysLoggedOf, { logged: form.logged.length, days })}${form.latest ? ` · ${axisDay(form.latest, locale)}` : ''}`
                  const body = (
                    <>
                      <span className="qc-chip__fill" aria-hidden="true"><span style={{ height: `${Math.round(share * 100)}%` }} /></span>
                      <span className="qc-chip__body">
                        <strong>{form.code.startsWith('utility-') ? form.name : form.code}</strong>
                        <span className="qc-chip__value">{form.place ? `${form.place} · ` : ''}{value}</span>
                      </span>
                    </>
                  )
                  const className = silent ? 'qc-chip utility-chip--silent' : 'qc-chip qc-chip--button'
                  return silent ? (
                    <span key={form.code} className={className} title={form.name}>{body}</span>
                  ) : (
                    <button key={form.code} type="button" className={className} title={form.name} onClick={() => onForm(form)}>{body}</button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
