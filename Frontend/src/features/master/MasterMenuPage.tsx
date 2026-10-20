import { Link } from 'react-router-dom'
import { useLocale } from '../../i18n/LocaleContext.tsx'

export function MasterMenuPage() {
  const { t } = useLocale()

  return (
    <div className="page">
      <header className="page-title-row">
        <h1 className="page-title">{t.masterMenuTitle}</h1>
      </header>
      <p className="page-note">{t.masterIntro}</p>

      <section className="master-section" aria-label={t.datahubGroup}>
        <h2>{t.datahubGroup}</h2>
        <p className="page-note">{t.datahubGroupNote}</p>
        <div className="master-card-grid">
          <MasterCard to="/master/companies" badge={t.badgeDatahub} title={t.company} text={t.companyBlurb} open={t.openPage} />
          <MasterCard to="/master/sites" badge={t.badgeDatahub} title={t.site} text={t.siteBlurb} open={t.openPage} />
          <MasterCard to="/master/plants" badge={t.badgeDatahub} title={t.plants} text={t.plantsBlurb} open={t.openPage} />
          <MasterCard to="/master/commodities" badge={t.badgeDatahub} title={t.commodities} text={t.commoditiesBlurb} open={t.openPage} />
        </div>
      </section>

      <section className="master-section" aria-label={t.plantGroup}>
        <h2>{t.plantGroup}</h2>
        <p className="page-note">{t.plantGroupNote}</p>
        <div className="master-card-grid">
          <MasterCard to="/master/commodities-calibration" badge={t.badgeThisPlant} title={t.commoditiesCalibration} text={t.commoditiesCalibrationBlurb} open={t.openPage} />
          <MasterCard to="/master/tank-farm" badge={t.badgeThisPlant} title={t.tankFarm} text={t.tankFarmBlurb} open={t.openPage} />
        </div>
      </section>
    </div>
  )
}

function MasterCard({
  to,
  badge,
  title,
  text,
  open,
}: {
  to: string
  badge: string
  title: string
  text: string
  open: string
}) {
  return (
    <Link className="master-link-card" to={to}>
      <span className="master-badge">{badge}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="master-open">{open}</span>
    </Link>
  )
}
