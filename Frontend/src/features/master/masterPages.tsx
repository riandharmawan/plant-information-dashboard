import type { MasterData } from '../../domain/master.ts'
import { useCalibration } from '../../data/CalibrationContext.tsx'
import { useMaster } from '../../data/MasterContext.tsx'
import { formatMeasure, tankLabel } from '../../domain/format.ts'
import { canonicalTankId, emptyProfile } from '../../domain/tankCalibration.ts'
import { useLocale } from '../../i18n/LocaleContext.tsx'
import { MasterRecordPage } from './MasterRecordPage.tsx'

/** The site a plant row belongs to. Plants are an internal key, so screens show the site. */
function siteOfPlant(data: MasterData, plantId: string): string {
  return data.plants.find((plant) => plant.id === plantId)?.siteId ?? ''
}

/** The plant row that carries a site's tanks and logsheets. */
function internalPlantOf(data: MasterData, siteId: string): string {
  const withTanks = data.tanks.find((tank) => siteOfPlant(data, tank.plantId) === siteId)
  return withTanks?.plantId ?? data.plants.find((plant) => plant.siteId === siteId)?.id ?? ''
}

function nameOf(rows: Array<{ id: string; name: string }>, id: string, fallback: string): string {
  return rows.find((row) => row.id === id)?.name ?? fallback
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
        { key: 'site', label: t.site, value: (row) => nameOf(master.data.sites, siteOfPlant(master.data, row.plantId), blank) },
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
          label: t.site,
          required: true,
          options: master.data.sites
            .filter((site) => site.isActivated)
            .map((site) => ({ value: internalPlantOf(master.data, site.id), label: site.name }))
            .filter((option) => option.value),
        },
      ]}
      draftFrom={(row) => ({
        code: row?.code ?? '',
        plantId: row?.plantId ?? master.data.tanks[0]?.plantId ?? '',
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
