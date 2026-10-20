import { useCalibration } from '../../data/CalibrationContext.tsx'
import { useMaster } from '../../data/MasterContext.tsx'
import { formatMeasure, formatPeriod, tankLabel } from '../../domain/format.ts'
import { canonicalTankId, emptyProfile } from '../../domain/tankCalibration.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { MasterRecordPage } from './MasterRecordPage.tsx'

function nameOf(rows: Array<{ id: string; name: string }>, id: string, fallback: string): string {
  return rows.find((row) => row.id === id)?.name ?? fallback
}

export function CompaniesPage() {
  const { t } = useLocale()
  const master = useMaster()
  return (
    <MasterRecordPage
      title={`${t.masterDash} ${t.company}`}
      description={t.companyBlurb}
      listTitle={t.companies}
      entityLabel={t.company}
      columns={[
        { key: 'code', label: t.code, value: (row) => row.code },
        { key: 'name', label: t.recordName, value: (row) => row.name },
      ]}
      rows={master.data.companies}
      fields={[
        { key: 'code', label: t.code, required: true },
        { key: 'name', label: t.recordName, required: true },
      ]}
      draftFrom={(row) => ({ code: row?.code ?? '', name: row?.name ?? '' })}
      onSave={(draft, id) => master.saveCompany({ code: draft.code ?? '', name: draft.name ?? '' }, id)}
      onDelete={master.removeCompany}
      onRefresh={master.refresh}
    />
  )
}

export function SitesPage() {
  const { t } = useLocale()
  const master = useMaster()
  return (
    <MasterRecordPage
      title={`${t.masterDash} ${t.site}`}
      description={t.siteBlurb}
      listTitle={t.sites}
      entityLabel={t.site}
      columns={[
        { key: 'name', label: t.recordName, value: (row) => row.name },
        { key: 'company', label: t.company, value: (row) => nameOf(master.data.companies, row.companyId, t.unavailable) },
        { key: 'timezone', label: t.timezone, value: (row) => row.timezone },
      ]}
      rows={master.data.sites}
      fields={[
        {
          key: 'companyId',
          label: t.company,
          required: true,
          options: master.data.companies.map((company) => ({ value: company.id, label: company.name })),
        },
        { key: 'name', label: t.recordName, required: true },
        { key: 'timezone', label: t.timezone, required: true },
      ]}
      draftFrom={(row) => ({
        companyId: row?.companyId ?? master.data.companies[0]?.id ?? '',
        name: row?.name ?? '',
        timezone: row?.timezone ?? 'Asia/Jakarta',
      })}
      onSave={(draft, id) => master.saveSite({
        companyId: draft.companyId ?? '',
        name: draft.name ?? '',
        timezone: draft.timezone ?? '',
      }, id)}
      onDelete={master.removeSite}
      onRefresh={master.refresh}
    />
  )
}

export function PlantsPage() {
  const { t, locale } = useLocale()
  const master = useMaster()
  return (
    <MasterRecordPage
      title={`${t.masterDash} ${t.plants}`}
      description={t.plantsBlurb}
      listTitle={t.plants}
      entityLabel={t.plant}
      columns={[
        { key: 'name', label: t.recordName, value: (row) => row.name },
        { key: 'site', label: t.site, value: (row) => nameOf(master.data.sites, row.siteId, t.unavailable) },
        {
          key: 'logsheets',
          label: t.logsheets,
          value: (row) => (row.logsheetPeriod ? formatPeriod(row.logsheetPeriod, locale) : t.unavailable),
        },
      ]}
      rows={master.data.plants}
      fields={[
        {
          key: 'siteId',
          label: t.site,
          required: true,
          options: master.data.sites.map((site) => ({ value: site.id, label: site.name })),
        },
        { key: 'name', label: t.recordName, required: true },
      ]}
      draftFrom={(row) => ({
        siteId: row?.siteId ?? master.data.sites[0]?.id ?? '',
        name: row?.name ?? '',
      })}
      onSave={(draft, id) => master.savePlant({ siteId: draft.siteId ?? '', name: draft.name ?? '' }, id)}
      onDelete={master.removePlant}
      onRefresh={master.refresh}
    />
  )
}

export function CommoditiesPage() {
  const { t } = useLocale()
  const master = useMaster()
  return (
    <MasterRecordPage
      title={`${t.masterDash} ${t.commodities}`}
      description={t.commoditiesBlurb}
      listTitle={t.commodities}
      entityLabel={t.commodity}
      columns={[
        { key: 'code', label: t.code, value: (row) => row.code },
        { key: 'name', label: t.recordName, value: (row) => row.name },
      ]}
      rows={master.data.commodities}
      fields={[
        { key: 'code', label: t.code, required: true },
        { key: 'name', label: t.recordName, required: true },
      ]}
      draftFrom={(row) => ({ code: row?.code ?? '', name: row?.name ?? '' })}
      onSave={(draft, id) => master.saveCommodity({ code: draft.code ?? '', name: draft.name ?? '' }, id)}
      onDelete={master.removeCommodity}
      onRefresh={master.refresh}
    />
  )
}

export function TankFarmPage() {
  const { t } = useLocale()
  const master = useMaster()
  const calibration = useCalibration()
  const blank = t.unavailable
  return (
    <MasterRecordPage
      title={`${t.masterDash} ${t.tankFarm}`}
      description={t.tankFarmBlurb}
      listTitle={t.tanks}
      entityLabel={t.tank}
      columns={[
        { key: 'code', label: t.tank, value: (row) => tankLabel(row.code) },
        { key: 'plant', label: t.plant, value: (row) => nameOf(master.data.plants, row.plantId, blank) },
        {
          key: 'capacity',
          label: t.capacity,
          value: (row) => {
            const profile = calibration.profiles.find((tank) => tank.tankId === canonicalTankId(row.code))
            return profile?.capacityKg != null ? `${formatMeasure(profile.capacityKg, 0)} kg` : blank
          },
        },
        {
          key: 'densityGroup',
          label: t.densityGroup,
          value: (row) => {
            const profile = calibration.profiles.find((tank) => tank.tankId === canonicalTankId(row.code))
            return profile?.densityGroup?.toUpperCase() ?? blank
          },
        },
        {
          key: 'volumeRows',
          label: t.volumeRows,
          value: (row) => {
            const profile = calibration.profiles.find((tank) => tank.tankId === canonicalTankId(row.code)) ?? emptyProfile(row.code)
            return String(profile.volume.length)
          },
        },
        {
          key: 'status',
          label: t.calibrationStatus,
          value: (row) => (calibration.isCustom(row.code) ? t.calibrationCustom : t.calibrationDefault),
        },
      ]}
      rows={master.data.tanks}
      fields={[
        { key: 'code', label: t.tank, required: true },
        {
          key: 'plantId',
          label: t.plant,
          required: true,
          options: master.data.plants.map((plant) => ({ value: plant.id, label: plant.name })),
        },
      ]}
      draftFrom={(row) => ({
        code: row?.code ?? '',
        plantId: row?.plantId ?? 'priscolin-proj-bekasi',
      })}
      onSave={(draft, id) => master.saveTank({
        code: draft.code ?? '',
        plantId: draft.plantId ?? '',
        capacity: '',
        capacityUnit: '',
      }, id)}
      onDelete={master.removeTank}
      onRefresh={master.refresh}
      editHref={(row) => `/master/tank-farm/${encodeURIComponent(canonicalTankId(row.code))}`}
      identityLabel={t.identity}
    />
  )
}
