import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProductionLayout } from './data/ProductionContext.tsx'
import { QcLayout } from './data/QcContext.tsx'
import { AuthProvider } from './data/AuthContext.tsx'
import { CalibrationProvider } from './data/CalibrationContext.tsx'
import { createRepository } from './data/createRepository.ts'
import { MasterProvider } from './data/MasterContext.tsx'
import { OperationsProvider } from './data/OperationsContext.tsx'
import { LocaleProvider } from './i18n/LocaleContext.tsx'
import { AppShell } from './layout/AppShell.tsx'
import { AdminMenuPage } from './features/admin/AdminMenuPage.tsx'
import { RolesPage } from './features/admin/RolesPage.tsx'
import { UsersPage } from './features/admin/UsersPage.tsx'
import { PageGate, RequireAuth, SiteRequired } from './features/auth/guards.tsx'
import { LoginPage } from './features/login/LoginPage.tsx'
import { LiveOpsPage } from './features/live-ops/LiveOpsPage.tsx'
import { CommoditiesPage, CompaniesPage, PlantsPage, SitesPage, TankFarmPage } from './features/master/masterPages.tsx'
import { MasterMenuPage } from './features/master/MasterMenuPage.tsx'
import { CommoditiesCalibrationPage } from './features/master/CommoditiesCalibrationPage.tsx'
import { TankCalibrationPage } from './features/master/TankCalibrationPage.tsx'
import { OpsAnalyticsPage } from './features/ops-analytics/OpsAnalyticsPage.tsx'
import { DailyProductionPage } from './features/daily-production/DailyProductionPage.tsx'
import { MovementPage } from './features/qc/MovementPage.tsx'
import { RefineryQualityPage } from './features/qc/RefineryQualityPage.tsx'
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
      <AuthProvider>
        <OperationsProvider repository={repository}>
          <CalibrationProvider>
            <MasterProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<RequireAuth />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<SiteRequired />}>
                        <Route element={<PageGate page="live-ops" />}>
                          <Route index element={<LiveOpsPage />} />
                        </Route>
                        <Route element={<PageGate page="ops-analytics" />}>
                          <Route path="ops-analytics" element={<OpsAnalyticsPage />} />
                        </Route>
                        <Route element={<PageGate page="daily-production" />}>
                          <Route element={<ProductionLayout />}>
                            <Route path="daily-production" element={<DailyProductionPage />} />
                            <Route path="daily-production/refinery-500" element={<Refinery500Page />} />
                            <Route path="daily-production/refinery-150" element={<Refinery150Page />} />
                            <Route path="daily-production/fractionation-400" element={<Fractionation400Page />} />
                            <Route path="daily-production/fractionation-500" element={<Fractionation500Page />} />
                            <Route path="daily-production/separator" element={<SeparatorPage />} />
                            <Route path="daily-production/supporting-materials" element={<SupportingMaterialsPage />} />
                          </Route>
                        </Route>
                        <Route element={<PageGate page="qc" />}>
                          <Route path="qc/refinery" element={<RefineryQualityPage />} />
                          <Route path="qc" element={<QcLayout />}>
                            <Route index element={<QcOverviewPage />} />
                            <Route path="storage" element={<StoragePage />} />
                            <Route path="vessel" element={<VesselPage />} />
                            <Route path="truck" element={<TruckPage />} />
                            <Route path="movements" element={<MovementPage />} />
                          </Route>
                        </Route>
                        <Route element={<PageGate page="master-companies" />}>
                          <Route path="master" element={<MasterMenuPage />} />
                          <Route path="master/companies" element={<CompaniesPage />} />
                        </Route>
                        <Route element={<PageGate page="master-sites" />}>
                          <Route path="master/sites" element={<SitesPage />} />
                        </Route>
                        <Route element={<PageGate page="master-plants" />}>
                          <Route path="master/plants" element={<PlantsPage />} />
                        </Route>
                        <Route element={<PageGate page="master-commodities" />}>
                          <Route path="master/commodities" element={<CommoditiesPage />} />
                        </Route>
                        <Route element={<PageGate page="master-calibration" />}>
                          <Route path="master/commodities-calibration" element={<CommoditiesCalibrationPage />} />
                        </Route>
                        <Route element={<PageGate page="master-tanks" />}>
                          <Route path="master/tank-farm" element={<TankFarmPage />} />
                          <Route path="master/tank-farm/:tankId" element={<TankCalibrationPage />} />
                        </Route>
                      </Route>
                      <Route path="admin" element={<AdminMenuPage />} />
                      <Route element={<PageGate page="admin-users" />}>
                        <Route path="admin/users" element={<UsersPage />} />
                      </Route>
                      <Route element={<PageGate page="admin-roles" />}>
                        <Route path="admin/roles" element={<RolesPage />} />
                      </Route>
                    </Route>
                  </Route>
                </Routes>
              </BrowserRouter>
            </MasterProvider>
          </CalibrationProvider>
        </OperationsProvider>
      </AuthProvider>
    </LocaleProvider>
  )
}
