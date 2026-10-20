import { FlaskConical, Ship, Truck, Building2, ChevronLeft, ChevronRight, ClipboardList, Droplets, Factory, Filter, Layers, LayoutGrid, MapPin, Package, Radio, Scale, Warehouse } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext.tsx'

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapsed: () => void
}) {
  const { t } = useLocale()
  const className = [
    'sidebar',
    mobileOpen ? 'open' : '',
    collapsed ? 'sidebar--collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <aside className={className}>
      <button
        type="button"
        className="sidebar__collapse-fab"
        aria-expanded={!collapsed}
        aria-label={collapsed ? t.expandSidebar : t.collapseSidebar}
        title={collapsed ? t.expandSidebar : t.collapseSidebar}
        onClick={onToggleCollapsed}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
      <div className="sidebar__scroll">
        <div className="sidebar__inner">
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark" aria-hidden="true">{t.brandMark}</div>
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-title">{t.brandTitle}</span>
            <span className="sidebar__brand-sub">{t.brandSub}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-nav__section">{t.tankFarm}</p>
          <NavLink to="/" end title={t.liveOps} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <Radio className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.liveOps}</span>
          </NavLink>
          <p className="sidebar-nav__section">{t.qualityControl}</p>
          <NavLink to="/qc" end title={t.qcTitle} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <FlaskConical className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.qcTitle}</span>
          </NavLink>
          <div className="sidebar-nav__children">
            <NavLink to="/qc/storage" title={t.qcStorage} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Warehouse className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.qcStorage}</span>
            </NavLink>
            <NavLink to="/qc/vessel" title={t.qcVessel} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Ship className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.qcVessel}</span>
            </NavLink>
            <NavLink to="/qc/truck" title={t.qcTruck} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Truck className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.qcTruck}</span>
            </NavLink>
          </div>
          <p className="sidebar-nav__section">{t.productionGroup}</p>
          <NavLink to="/daily-production" end title={t.dailyProduction} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <ClipboardList className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.dailyProduction}</span>
          </NavLink>
          <div className="sidebar-nav__children">
            <NavLink to="/daily-production/refinery-500" title={t.refinery500} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Factory className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.refinery500}</span>
            </NavLink>
            <NavLink to="/daily-production/refinery-150" title={t.refinery150} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Factory className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.refinery150}</span>
            </NavLink>
            <NavLink to="/daily-production/fractionation-400" title={t.fract400} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Layers className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.fract400}</span>
            </NavLink>
            <NavLink to="/daily-production/fractionation-500" title={t.fract500} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Layers className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.fract500}</span>
            </NavLink>
            <NavLink to="/daily-production/separator" title={t.separator} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Filter className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.separator}</span>
            </NavLink>
            <NavLink to="/daily-production/supporting-materials" title={t.supportingMaterials} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Package className="sidebar-nav__icon" size={16} aria-hidden="true" />
              <span className="sidebar-nav__label">{t.supportingMaterials}</span>
            </NavLink>
          </div>
          <p className="sidebar-nav__section">{t.masterMenu}</p>
          <NavLink to="/master" end title={t.masterMenuTitle} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <LayoutGrid className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.masterMenuTitle}</span>
          </NavLink>
          <NavLink to="/master/companies" title={t.company} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <Building2 className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.company}</span>
          </NavLink>
          <NavLink to="/master/sites" title={t.site} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <MapPin className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.site}</span>
          </NavLink>
          <NavLink to="/master/plants" title={t.plants} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <Factory className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.plants}</span>
          </NavLink>
          <NavLink to="/master/commodities" title={t.commodities} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <Droplets className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.commodities}</span>
          </NavLink>
          <NavLink to="/master/commodities-calibration" title={t.commoditiesCalibration} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <Scale className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.commoditiesCalibration}</span>
          </NavLink>
          <NavLink to="/master/tank-farm" title={t.tankFarm} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <Warehouse className="sidebar-nav__icon" size={16} aria-hidden="true" />
            <span className="sidebar-nav__label">{t.tankFarm}</span>
          </NavLink>
        </nav>
        </div>
      </div>
    </aside>
  )
}
