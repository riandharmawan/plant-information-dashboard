import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CalibrationProvider } from './data/CalibrationContext.tsx'
import { createRepository } from './data/createRepository.ts'
import { MasterProvider } from './data/MasterContext.tsx'
import { OperationsProvider } from './data/OperationsContext.tsx'
import { LocaleProvider } from './i18n/LocaleContext.tsx'
import { AppShell } from './layout/AppShell.tsx'
import { LiveOpsPage } from './features/live-ops/LiveOpsPage.tsx'
import { CommoditiesPage, CompaniesPage, PlantsPage, SitesPage, TankFarmPage } from './features/master/masterPages.tsx'
import { MasterMenuPage } from './features/master/MasterMenuPage.tsx'
import { CommoditiesCalibrationPage } from './features/master/CommoditiesCalibrationPage.tsx'
import { TankCalibrationPage } from './features/master/TankCalibrationPage.tsx'
import { OpsAnalyticsPage } from './features/ops-analytics/OpsAnalyticsPage.tsx'
import { DailyProductionPage } from './features/daily-production/DailyProductionPage.tsx'
import { MovementPage } from './features/qc/MovementPage.tsx'
import { QcOverviewPage } from './features/qc/QcOverviewPage.tsx'
import { StoragePage } from './features/qc/StoragePage.tsx'
import { TruckPage } from './features/qc/TruckPage.tsx'
import { VesselPage } from './features/qc/VesselPage.tsx'
import {
  Fractionation400Page,
  Fractionation500Page,
  Refinery150Page,
  Refinery500Page,
  SeparatorPage,
  SupportingMaterialsPage,
} from './features/daily-production/PlantSectionPage.tsx'

const repository = createRepository()

export default function App() {
  return (
    <LocaleProvider>
      <OperationsProvider repository={repository}>
        <CalibrationProvider>
          <MasterProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<LiveOpsPage />} />
                  <Route path="ops-analytics" element={<OpsAnalyticsPage />} />
                  <Route path="daily-production" element={<DailyProductionPage />} />
                  <Route path="daily-production/refinery-500" element={<Refinery500Page />} />
                  <Route path="daily-production/refinery-150" element={<Refinery150Page />} />
                  <Route path="daily-production/fractionation-400" element={<Fractionation400Page />} />
                  <Route path="daily-production/fractionation-500" element={<Fractionation500Page />} />
                  <Route path="daily-production/separator" element={<SeparatorPage />} />
                  <Route path="daily-production/supporting-materials" element={<SupportingMaterialsPage />} />
                  <Route path="qc" element={<QcOverviewPage />} />
                  <Route path="qc/storage" element={<StoragePage />} />
                  <Route path="qc/vessel" element={<VesselPage />} />
                  <Route path="qc/truck" element={<TruckPage />} />
                  <Route path="qc/movements" element={<MovementPage />} />
                  <Route path="master" element={<MasterMenuPage />} />
                  <Route path="master/companies" element={<CompaniesPage />} />
                  <Route path="master/sites" element={<SitesPage />} />
                  <Route path="master/plants" element={<PlantsPage />} />
                  <Route path="master/commodities" element={<CommoditiesPage />} />
                  <Route path="master/commodities-calibration" element={<CommoditiesCalibrationPage />} />
                  <Route path="master/tank-farm" element={<TankFarmPage />} />
                  <Route path="master/tank-farm/:tankId" element={<TankCalibrationPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </MasterProvider>
        </CalibrationProvider>
      </OperationsProvider>
    </LocaleProvider>
  )
}
