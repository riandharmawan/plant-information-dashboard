export type Locale = 'en' | 'id'

export interface Messages {
  appTitle: string
  tagline: string
  brandMark: string
  brandTitle: string
  brandSub: string
  corpName: string
  loginPitch: string
  welcomeBack: string
  signInContinue: string
  loginUsername: string
  loginUsernamePlaceholder: string
  loginPassword: string
  loginPasswordPlaceholder: string
  showPassword: string
  hidePassword: string
  signIn: string
  signInViaDwsHub: string
  backToSignIn: string
  ssoErrorTitle: string
  ssoErrorFallback: string
  loginRequired: string
  copyright: string
  liveOps: string
  opsAnalytics: string
  analyticsTitle: string
  siteLabel: string
  notifications: string
  noNotifications: string
  expandSidebar: string
  collapseSidebar: string
  openMenu: string
  gridView: string
  tableView: string
  commodityStock: string
  utilizationOf: string
  stockSources: string
  close: string
  gatekeeper: string
  liveLogistics: string
  noSounding: string
  noVehicles: string
  morningRounds: string
  noHistory: string
  lastUpdated: string
  showGatekeeper: string
  hideGatekeeper: string
  quantity: string
  soundingDay: string
  analysisDay: string
  qualityAge: string
  levelFillHint: string
  tempSpikeHint: string
  ffaAgeHint: string
  emptySpace: string
  loadable: string
  rangeAverage: string
  rangeMax: string
  rangeMin: string
  tankLevelPct: string
  totalQuantity: string
  avgLevel: string
  avgTemp: string
  storageUtilization: string
  activeVsEmpty: string
  activeEmptySub: string
  criticalAlerts: string
  criticalAlertsSub: string
  tanksHolding: string
  avgQuality: string
  selectDay: string
  massUnit: string
  unitTon: string
  unitKg: string
  kpiDetailHint: string
  activeTanks: string
  emptyTanks: string
  reasonOverfill: string
  reasonHotTemp: string
  noCriticalAlerts: string
  alertRule: string
  gateSamplesWindow: string
  vehicle: string
  sampleDay: string
  modeVessel: string
  modeTruck: string
  noRows: string
  throughput: string
  approvalRate: string
  unavailable: string
  period: string
  periodDaily: string
  periodMonthly: string
  tank: string
  status: string
  levelTemp: string
  charging: string
  qualityLog: string
  awaiting: string
  latestPerTank: string
  round: string
  retest: string
  noLab: string
  allCommodities: string
  noCommodity: string
  incomingCpo: string
  pass: string
  rejected: string
  target: string
  levelAxis: string
  tempAxis: string
  movementNote: string
  notClassified: string
  outbound: string
  inbound: string
  specPending: string
  noQuality: string
  massShort: string
  masterMenu: string
  masterMenuTitle: string
  masterIntro: string
  masterDash: string
  datahubGroup: string
  datahubGroupNote: string
  plantGroup: string
  plantGroupNote: string
  company: string
  companies: string
  companyBlurb: string
  site: string
  sites: string
  siteBlurb: string
  plant: string
  plants: string
  plantsBlurb: string
  commodities: string
  commodity: string
  commoditiesBlurb: string
  tankFarm: string
  tanks: string
  tankFarmBlurb: string
  badgeDatahub: string
  badgeThisPlant: string
  openPage: string
  backToMaster: string
  refresh: string
  add: string
  edit: string
  remove: string
  save: string
  cancel: string
  code: string
  recordName: string
  timezone: string
  capacity: string
  unit: string
  logsheets: string
  actions: string
  noMasterRows: string
  duplicateRecord: string
  recordInUse: string
  requiredFields: string
  filterBy: string
  identity: string
  densityGroup: string
  volumeRows: string
  calibrationStatus: string
  calibrationDefault: string
  calibrationCustom: string
  backToTankFarm: string
  tankCalibration: string
  tankCalibrationBlurb: string
  calibrationConstants: string
  bottomStock: string
  dipOffset: string
  ullageLk: string
  ullageLb: string
  tableTemp: string
  lookupMode: string
  lookupExact: string
  lookupApprox: string
  volumeTable: string
  ringVolumes: string
  ringBands: string
  heightM: string
  liters: string
  importCsv: string
  exportCsv: string
  addRow: string
  resetTank: string
  preview: string
  previewHeightOutOfRange: string
  previewDensityOutOfRange: string
  previewNoTable: string
  soundingMethod: string
  savedCalibration: string
  resetCalibration: string
  invalidCapacity: string
  invalidVolumeHeights: string
  invalidDensityGroup: string
  tableTempRequired: string
  invalidRingBand: string
  csvParseError: string
  ringIndex: string
  bandLow: string
  bandHigh: string
  bandOffset: string
  previousPage: string
  nextPage: string
  commoditiesCalibration: string
  commoditiesCalibrationBlurb: string
  densityLookup: string
  densityLookupNote: string
  density: string
  densityAtTemp: string
  tanksUsingGroup: string
  dailyProduction: string
  dailyProductionTitle: string
  loggedDays: string
  dataDay: string
  feed: string
  product: string
  yieldPct: string
  coproduct: string
  loss: string
  refinery500: string
  refinery150: string
  fract400: string
  fract500: string
  separator: string
  rbdpoPfad: string
  oleinStearin: string
  washedCpo: string
  chemicalsUtilities: string
  beBags: string
  paLogged: string
  powerKwh: string
  gasMmBtu: string
  steamLogged: string
  water: string
  compressor: string
  oilMovement: string
  incoming: string
  localSales: string
  shipment: string
  blendIn: string
  blendOut: string
  transferIn: string
  transferOut: string
  gainLoss: string
  stockLadder: string
  opening: string
  productionKg: string
  used: string
  closing: string
  cpo: string
  rbdpo: string
  pfad: string
  olein: string
  stearin: string
  plantDetail: string
  productionGroup: string
  supportingMaterials: string
  totalRow: string
  colDate: string
  totalFeed: string
  powerRatio: string
  gasRatio: string
  citricAcid: string
  received: string
  closingBag: string
  material: string
  downtime: string
  quality: string
  solar: string
  fame: string
  pmf: string
  oleinIv64: string
  oleinCp09: string
  rbdpoIn: string
  schedulingDt: string
  commercialDt: string
  technicalDt: string
  utilityDt: string
  ffa: string
  moisture: string
  dobi: string
  qualityControl: string
  qcTitle: string
  qcStorage: string
  qcVessel: string
  qcTruck: string
  qcMovements: string
  refineryQuality: string
  hoursLogged: string
  finishedFfa: string
  feedFfa: string
  byproductFfa: string
  streamsTitle: string
  readingsTitle: string
  declaredNotTested: string
  rangeLow: string
  rangeHigh: string
  time: string
  fromTank: string
  flowRate: string
  finishedOil: string
  feedOil: string
  colour: string
  toTank: string
  rawMaterial: string
  bleachingOil: string
  finishedGood: string
  byProduct: string
  spentEarth: string
  bleachRed: string
  spentEarthOc: string
  noSample: string
  tanksLogged: string
  retestDue: string
  oilTypes: string
  inboundPassed: string
  inboundRejected: string
  trucksSampled: string
  unloadRemarks: string
  vesselTickets: string
  palkaSamples: string
  movementCount: string
  gatePeriodNote: string
  analysisDate: string
  ageDays: string
  slipPoint: string
  cloudPoint: string
  carotene: string
  phosphorus: string
  totox: string
  odor: string
  remark: string
  analyst: string
  policeNo: string
  colourR: string
  colourY: string
  ship: string
  supplier: string
  arrival: string
  contractLimits: string
  composite: string
  sampleNo: string
  mineralOil: string
  triene: string
  allOils: string
  noQcRows: string
  snapshot: string
  customerShip: string
  timeIn: string
  timeOut: string
  sealIn: string
  sealOut: string
  operator: string
  asLogged: string
  revisionShort: string
  storageSpecNote: string
  palkaLimitNote: string
  writtenAs: string
  latestSnapshot: string
  snapshots: string
  direction: string
  palka: string
  ticketCode: string
  resultValue: string
  incomplete: string
  noSampleDate: string
  needsAttention: string
  nothingNeedsAttention: string
  moreItems: string
  overMax: string
  watch: string
  noSpec: string
  notRecorded: string
  rangeFor: string
  tooFewToCompare: string
  tanksWithoutResult: string
  tankCount: string
  tankCountOne: string
  retestCount: string
  contractMax: string
  floorAbove: string
  watchBand: string
  dailyLowHigh: string
  groupSample: string
  groupCore: string
  groupOxidation: string
  groupComposition: string
  groupNotes: string
  tankFill: string
  productsInTanks: string
  passMix: string
  dayFlow: string
  ffaPct: string
  moisturePct: string
  tempC: string
  colourRLov: string
  colourYLov: string
  truckScatter: string
  vesselScatter: string
  palkaStrip: string
  ffaBySnapshot: string
  dailyBandCaption: string
  hourlyCaption: string
  reasonOver: string
  reasonRetest: string
  reasonWatch: string
  view: string
  ageDaysShort: string
  legend: string
  loading: string
  loginInvalid: string
  signingIn: string
  administration: string
  adminMenuTitle: string
  adminIntro: string
  userManagement: string
  userManagementBlurb: string
  roleManagement: string
  roleManagementBlurb: string
  backToAdmin: string
  users: string
  user: string
  addUser: string
  editUser: string
  username: string
  displayName: string
  email: string
  password: string
  newPasswordOptional: string
  active: string
  roles: string
  siteAccess: string
  search: string
  allStatuses: string
  activeStatus: string
  inactiveStatus: string
  noUsers: string
  noMatch: string
  userSaved: string
  userDeleted: string
  deleteUserConfirm: string
  saving: string
  systemSuffix: string
  rolesHelp: string
  sitesHelp: string
  searchSite: string
  selectVisible: string
  clearVisible: string
  noRoles: string
  noSites: string
  accessNotConfigured: string
  noSiteBody: string
  accessDenied: string
  accessDeniedBody: string
  changePassword: string
  signOut: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
  passwordUpdated: string
  permissionView: string
  permissionEdit: string
  permissionDelete: string
  roleSaved: string
  roleDeleted: string
  deleteRoleConfirm: string
  addRole: string
  editRole: string
  roleName: string
  description: string
  usersCount: string
  noRolesYet: string
  pages: string
  operationsGroup: string
  masterGroup: string
  refineryFractionation: string
  utility: string
  utilityOverview: string
  utilityBoiler: string
  utilityCoal: string
  utilityWater: string
  utilityEffluent: string
  utilityLoader: string
  utilityPower: string
  utilityNote: string
  latestDay: string
  logged: string
  emptySheet: string
  notSubmitted: string
  notLogged: string
  outsidePrinted: string
  checklistNo: string
  printedRange: string
  periodRange: string
  readingCount: string
  daysLogged: string
  daysLoggedOf: string
  formsSubmitted: string
  byHour: string
  labBandCaption: string
  date: string
  shift: string
  boilerDaysLogged: string
  coalBuckets: string
  coalRatio: string
  printedRatio: string
  attentionItems: string
  sourceBoard: string
  coalAndRatio: string
  coalRatioCaption: string
  waterCoverage: string
  roCleaning: string
  performedOn: string
  doneBy: string
  roVerifications: string
  checkYes: string
  checkNo: string
  reasonOutside: string
  reasonNotLogged: string
  reasonEmpty: string
  reasonChecklistNo: string
  noUtilityRows: string
  noDataDay: string
  controlRoom: string
  localPanel: string
  boilerNote: string
  hourlyLog: string
  latestAgainstPrinted: string
  boilerChemicals: string
  chemicalNote: string
  chemical: string
  lastRemaining: string
  lastLog: string
  usedOnLogDays: string
  daysWithLog: string
  coalSteamNote: string
  steamDistribution: string
  steamMeterCaption: string
  incomingCoalDays: string
  incomingCoal: string
  utilityPeriod: string
  form: string
  shiftLog: string
  fuelClockLog: string
  steamMeter: string
  waterNote: string
  boilerWaterGroup: string
  wtpGroup: string
  testsRecorded: string
  samplePointsLogged: string
  daysSinceRo: string
  samplePoint: string
  test: string
  printedSpec: string
  labRoster: string
  wwtpCoverage: string
  effluentCoverage: string
  inletCod: string
  outletCod: string
  outletTss: string
  inletVsOutlet: string
  inlet: string
  outlet: string
  generalLevels: string
  loaderNote: string
  hoursRun: string
  runs: string
  fuelWritten: string
  fuelRuns: string
  checklistNoItems: string
  dailyHours: string
  loaderCaption: string
  checklist: string
  checklistAllYes: string
  yesItems: string
  runRoster: string
  hourStart: string
  hourEnd: string
  printedTotal: string
  fuelL: string
  oilL: string
  coverage: string
  logsheetCatalog: string
  qualityRules: string
  requestFailed: string
  usernameRequired: string
  passwordRequired: string
  passwordShort: string
  usernameTaken: string
  emailTaken: string
  lastAdmin: string
  selfDeactivate: string
  selfDelete: string
  currentPasswordRequired: string
  newPasswordRequired: string
  samePassword: string
  badCurrentPassword: string
  confirmMismatch: string
  roleNameRequired: string
  roleNameTaken: string
  systemRoleLocked: string
  roleInUse: string
}

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    appTitle: 'Plant Information Dashboard',
    tagline: 'Smart monitoring for smarter plants',
    brandMark: 'PI',
    brandTitle: 'Plant Information',
    brandSub: 'Dashboard',
    corpName: 'KPN CORP',
    loginPitch: 'Watch tank stock, quality, and daily production from one place.',
    welcomeBack: 'Welcome back',
    signInContinue: 'Sign in to continue to Plant Information Dashboard',
    loginUsername: 'Username or email',
    loginUsernamePlaceholder: 'Enter username or email',
    loginPassword: 'Password',
    loginPasswordPlaceholder: 'Enter password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    signIn: 'Sign In',
    signInViaDwsHub: 'Sign in via Dws Hub',
    backToSignIn: 'Back to sign in',
    ssoErrorTitle: 'Sign-in could not be completed',
    ssoErrorFallback: 'Downstream Hub could not sign you in. Try again, or use your username and password.',
    loginRequired: 'Enter your username and password.',
    copyright: '© {{year}} KPN Corporation. All rights reserved.',
    liveOps: 'Tank & Stock Dashboard',
    opsAnalytics: 'Tank Level & Temperature',
    analyticsTitle: 'Tank Level & Temperature',
    siteLabel: 'Site',
    notifications: 'Notifications',
    noNotifications: 'No notifications',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    openMenu: 'Toggle menu',
    gridView: 'Grid',
    tableView: 'Table',
    commodityStock: 'Total stock of commodity',
    utilizationOf: 'Utilization of',
    stockSources: 'Tanks in this stock',
    close: 'Close',
    gatekeeper: 'Live In/Out & Quality Gatekeeper',
    liveLogistics: 'Live in/out logistics',
    noSounding: 'No morning sounding round is loaded yet.',
    noVehicles: 'No truck or vessel is in the current gate view.',
    morningRounds: 'Morning sounding rounds',
    noHistory: 'The level and temperature chart plots one point per morning round.',
    lastUpdated: 'Last updated',
    showGatekeeper: 'Show live in/out and quality',
    hideGatekeeper: 'Hide live in/out and quality',
    quantity: 'Quantity',
    soundingDay: 'Sounding that day.',
    analysisDay: 'Lab result that day.',
    qualityAge: 'Lab result is {age} days old ({day}).',
    levelFillHint: 'Red when the tank is more than 80% full.',
    tempSpikeHint: 'Red when the temperature is more than 30% above the average temperature.',
    ffaAgeHint: 'Red when the latest lab result is more than 7 days old.',
    emptySpace: 'Empty space',
    loadable: 'Loadable',
    rangeAverage: 'Average',
    rangeMax: 'Max',
    rangeMin: 'Min',
    tankLevelPct: 'Level tank',
    totalQuantity: 'Total quantity',
    avgLevel: 'Average tank level',
    avgTemp: 'Avg temp',
    storageUtilization: 'Overall storage utilization',
    activeVsEmpty: 'Active vs empty tanks',
    activeEmptySub: 'active / empty',
    criticalAlerts: 'Critical alerts',
    criticalAlertsSub: 'Over 95% full or temperature anomaly',
    tanksHolding: '{held} of {total} tanks',
    avgQuality: 'Avg quality',
    selectDay: 'Day',
    massUnit: 'Quantity unit',
    unitTon: 'Ton',
    unitKg: 'Kg',
    kpiDetailHint: 'Show details',
    activeTanks: 'Active tanks',
    emptyTanks: 'Empty tanks',
    reasonOverfill: 'Over 95% full ({value})',
    reasonHotTemp: '{value} against the {avg} average',
    noCriticalAlerts: 'No tank is over 95% full or running hot.',
    alertRule: 'A tank is critical when it is more than 95% full, or more than 30% hotter than the farm average temperature ({avg}).',
    gateSamplesWindow: 'Judged incoming CPO samples, {start} – {end}',
    vehicle: 'Vessel / truck',
    sampleDay: 'Sampled',
    modeVessel: 'Vessel',
    modeTruck: 'Truck',
    noRows: 'Nothing to show.',
    throughput: 'Throughput (mass)',
    approvalRate: 'Lab approval rate',
    unavailable: '—',
    period: 'Period',
    periodDaily: 'Daily',
    periodMonthly: 'Monthly',
    tank: 'Tank',
    status: 'Status',
    levelTemp: 'Tank level & temperature',
    charging: 'Discharging & charging',
    qualityLog: 'Quality parameters',
    awaiting: 'Waiting for the logsheet history.',
    latestPerTank: 'Latest sounding per tank',
    round: 'Round',
    retest: 'Re-test',
    noLab: 'No lab result',
    allCommodities: 'All commodities',
    noCommodity: 'No commodity',
    incomingCpo: 'Incoming CPO',
    pass: 'Pass',
    rejected: 'Rejected',
    target: 'Target',
    levelAxis: 'Level (m)',
    tempAxis: 'Temperature (°C)',
    movementNote: 'Vehicle counts from the gate log. Tons are not on that sheet.',
    notClassified: 'Not classified',
    outbound: 'Outbound',
    inbound: 'Inbound',
    specPending: 'Storage spec not set',
    noQuality: 'No lab series for this tank.',
    massShort: 'Mass',
    masterMenu: 'Master',
    masterMenuTitle: 'Master Menu',
    masterIntro: 'Manage organization data and the tank farm for this application.',
    masterDash: 'Master –',
    datahubGroup: 'DataHub',
    datahubGroupNote: 'Company, site, plant, and commodity. DataHub will send these records. This screen keeps a local copy.',
    plantGroup: 'This plant',
    plantGroupNote: 'Tank master is kept in this application. DataHub does not send tanks.',
    company: 'Company',
    companies: 'Companies',
    companyBlurb: 'Companies in the group.',
    site: 'Site',
    sites: 'Sites',
    siteBlurb: 'Operating sites under a company.',
    plant: 'Plant',
    plants: 'Plants',
    plantsBlurb: 'Plants on a site. Current logsheets belong to one plant.',
    commodities: 'Commodities',
    commodity: 'Commodity',
    commoditiesBlurb: 'Oil catalog from DataHub. Logsheet names are mapped to these later.',
    tankFarm: 'Tank Farm',
    tanks: 'Tanks',
    tankFarmBlurb: 'Tanks and the calibration numbers the Tank & Stock Dashboard uses for quantity. Managed in this application.',
    badgeDatahub: 'DataHub',
    badgeThisPlant: 'This plant',
    openPage: 'Open →',
    backToMaster: '← Back to Master Menu',
    refresh: 'Refresh',
    add: 'Add',
    edit: 'Edit',
    remove: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    code: 'Code',
    recordName: 'Name',
    timezone: 'Timezone',
    capacity: 'Capacity',
    unit: 'Unit',
    logsheets: 'Logsheets',
    actions: 'Actions',
    noMasterRows: 'No records match this filter.',
    duplicateRecord: 'A record with this name or code already exists.',
    recordInUse: 'This record is still used by another master list.',
    requiredFields: 'Fill in the required fields.',
    filterBy: 'Filter',
    identity: 'Identity',
    densityGroup: 'Density group',
    volumeRows: 'Volume rows',
    calibrationStatus: 'Calibration',
    calibrationDefault: 'Default',
    calibrationCustom: 'Custom',
    backToTankFarm: '← Back to Tank Farm',
    tankCalibration: 'Tank calibration',
    tankCalibrationBlurb: 'Capacity, offsets, and the litre table. Save to update Tank & Stock Dashboard quantity. Reset restores the workbook numbers for this tank.',
    calibrationConstants: 'Constants',
    bottomStock: 'Bottom stock',
    dipOffset: 'Dip offset',
    ullageLk: 'Ullage LK',
    ullageLb: 'Ullage LB',
    tableTemp: 'Table temperature',
    lookupMode: 'Lookup mode',
    lookupExact: 'Exact height',
    lookupApprox: 'At or below height',
    volumeTable: 'Volume table',
    ringVolumes: 'Ring volumes',
    ringBands: 'Ring bands',
    heightM: 'Height (m)',
    liters: 'Litres',
    importCsv: 'Import CSV',
    exportCsv: 'Export CSV',
    addRow: 'Add row',
    resetTank: 'Reset this tank',
    preview: 'Preview',
    previewHeightOutOfRange: 'Looked up {lookup} m. The volume table covers {min} m to {max} m, so quantity cannot be calculated.',
    previewDensityOutOfRange: 'No {group} density at {temp} °C. That table covers {min} °C to {max} °C in whole degrees.',
    previewNoTable: 'This tank has no volume table, so quantity stays blank.',
    soundingMethod: 'Sounding method',
    savedCalibration: 'Saved. The Tank & Stock Dashboard will use these numbers.',
    resetCalibration: 'Restored the workbook numbers for this tank.',
    invalidCapacity: 'Capacity must be greater than zero when set.',
    invalidVolumeHeights: 'Each volume row needs a unique height and a litre value.',
    invalidDensityGroup: 'Choose one of the known density groups.',
    tableTempRequired: 'Table temperature is required when a volume table is present.',
    invalidRingBand: 'Each ring band needs a low, high, and offset, with low at or below high.',
    csvParseError: 'That CSV could not be read. Use numeric columns with a header row optional.',
    ringIndex: 'Index',
    bandLow: 'Low (mm)',
    bandHigh: 'High (mm)',
    bandOffset: 'Offset',
    previousPage: 'Previous',
    nextPage: 'Next',
    commoditiesCalibration: 'Commodities Calibration',
    commoditiesCalibrationBlurb: 'Shared density by temperature. A tank stores only the group name. Quantity uses the density at the sounding temperature.',
    densityLookup: 'Density at a temperature',
    densityLookupNote: 'Type a whole number of degrees. The highlighted row is the density multiplied into the quantity.',
    density: 'Density',
    densityAtTemp: '{group} at {temp} °C is {density}.',
    tanksUsingGroup: 'Tanks using this group',
    dailyProduction: 'Daily Production Summary',
    dailyProductionTitle: 'Daily Production Summary',
    loggedDays: 'Logged days (6–7 Oct)',
    dataDay: 'Day with logsheet data',
    feed: 'Feed (t)',
    product: 'Product (t)',
    yieldPct: 'Yield',
    coproduct: 'Co-product (t)',
    loss: 'Loss (t)',
    refinery500: 'Refinery 500',
    refinery150: 'Refinery 150',
    fract400: 'Fractionation 400',
    fract500: 'Fractionation 500',
    separator: 'Separator',
    rbdpoPfad: 'RBDPO + PFAD',
    oleinStearin: 'Olein + stearin',
    washedCpo: 'Washed CPO',
    chemicalsUtilities: 'Chemicals and utilities',
    beBags: 'BE (bag)',
    paLogged: 'PA (as logged)',
    powerKwh: 'Power (kWh)',
    gasMmBtu: 'Gas (mmBtu)',
    steamLogged: 'Steam (as logged)',
    water: 'Water',
    compressor: 'Air compressor',
    oilMovement: 'Oil movement',
    incoming: 'Incoming',
    localSales: 'Local sales',
    shipment: 'Shipment',
    blendIn: 'Blend in',
    blendOut: 'Blend out',
    transferIn: 'Transfer in',
    transferOut: 'Transfer out',
    gainLoss: 'Gain / loss',
  stockLadder: 'Stock ladder',
  opening: 'Opening',
    productionKg: 'Production',
    used: 'Used',
    closing: 'Closing',
    cpo: 'CPO',
    rbdpo: 'RBDPO',
    pfad: 'PFAD',
    olein: 'Olein',
    stearin: 'Stearin',
    plantDetail: 'Plant detail',
    productionGroup: 'Production',
    supportingMaterials: 'Supporting Materials',
    totalRow: 'Total',
    colDate: 'Date',
    totalFeed: 'Total feed (t)',
    powerRatio: 'kWh/t',
    gasRatio: 'mmBtu/t',
    citricAcid: 'Citric acid',
    received: 'Received',
    closingBag: 'Closing (bag)',
    material: 'Material',
    downtime: 'Downtime',
    quality: 'Quality',
    solar: 'Solar (L)',
    fame: 'FAME (L)',
    pmf: 'PMF (t)',
    oleinIv64: 'Olein IV 64 (t)',
    oleinCp09: 'Olein CP 09 (t)',
    rbdpoIn: 'RBDPO in (t)',
    schedulingDt: 'Scheduling (h)',
    commercialDt: 'Commercial (h)',
    technicalDt: 'Technical (h)',
    utilityDt: 'Utility (h)',
    ffa: 'FFA',
    moisture: 'Moisture',
    dobi: 'DOBI',
    qualityControl: 'Quality Control',
    qcTitle: 'Quality Control',
    qcStorage: 'Storage Tanks',
    qcVessel: 'Incoming by Vessel',
    qcTruck: 'Incoming by Truck',
    qcMovements: 'Oil in and out',
    refineryQuality: 'Refinery quality',
    hoursLogged: 'Hours logged',
    finishedFfa: 'Finished FFA',
    feedFfa: 'Feed FFA',
    byproductFfa: 'By-product FFA',
    streamsTitle: 'Streams',
    readingsTitle: 'Readings',
    declaredNotTested: 'Declared, not tested',
    rangeLow: 'Low',
    rangeHigh: 'High',
    time: 'Time',
    fromTank: 'From tank',
    flowRate: 'Flow',
    finishedOil: 'Finished oil',
    feedOil: 'Feed oil',
    colour: 'Colour',
    toTank: 'To tank',
    rawMaterial: 'Raw material',
    bleachingOil: 'Bleaching',
    finishedGood: 'Finished good',
    byProduct: 'By-product',
    spentEarth: 'Spent earth',
    bleachRed: 'Bleach R',
    spentEarthOc: 'Spent earth OC',
    noSample: 'No sample',
    tanksLogged: 'Tanks logged',
    retestDue: 'Retest due',
    oilTypes: 'Oil types',
    inboundPassed: 'Inbound passed',
    inboundRejected: 'Inbound rejected',
    trucksSampled: 'Trucks sampled',
    unloadRemarks: 'Unload remarks',
    vesselTickets: 'Vessel tickets',
    palkaSamples: 'Palka samples',
    movementCount: 'Movements',
    gatePeriodNote: 'Counts follow the date range above. The sheet spans {period}.',
    analysisDate: 'Analysis date',
    ageDays: 'Age (days)',
    slipPoint: 'Slip point',
    cloudPoint: 'Cloud point',
    carotene: 'β-Carotene',
    phosphorus: 'P',
    totox: 'Totox',
    odor: 'Odor',
    remark: 'Remark',
    analyst: 'Analyst',
    policeNo: 'Police no.',
    colourR: 'Colour R',
    colourY: 'Colour Y',
    ship: 'Ship',
    supplier: 'Supplier',
    arrival: 'Arrival',
    contractLimits: 'Contract',
    composite: 'Composite',
    sampleNo: 'Sample',
    mineralOil: 'Mineral oil',
    triene: 'Triene',
    allOils: 'All oils',
    noQcRows: 'No rows in this range.',
    snapshot: 'Snapshot',
    customerShip: 'Customer / ship',
    timeIn: 'Time in',
    timeOut: 'Time out',
    sealIn: 'Seal in',
    sealOut: 'Seal out',
    operator: 'Operator',
    asLogged: 'as logged',
    revisionShort: 'Rev.',
    storageSpecNote: 'Storage limits are not set, so tanks are not passed or quarantined here. A retest badge means the analysis is more than 2 days older than the snapshot. Figures are shown as written on the form.',
    palkaLimitNote: 'Red numbers are over that ticket’s FFA or moisture limit. Amber numbers are outside the palka IV band (51–54) or not above DOBI 2. Amber marks do not reject the cargo.',
    writtenAs: 'As written',
    latestSnapshot: 'Latest snapshot',
    snapshots: 'Snapshots',
    direction: 'Direction',
    palka: 'Palka',
    ticketCode: 'Ticket',
    resultValue: 'Value',
    incomplete: 'Incomplete',
    noSampleDate: 'No sampling date',
    needsAttention: 'Needs attention',
    nothingNeedsAttention: 'Nothing needs attention in this range.',
    moreItems: '+{count} more',
    overMax: 'Over max',
    watch: 'Watch',
    noSpec: 'No spec',
    notRecorded: 'Not recorded',
    rangeFor: 'Range for {product}, {from}–{to} · {count} results',
    tooFewToCompare: 'Too few results to compare',
    tanksWithoutResult: '{count} tanks without a result',
    tankCount: '{count} tanks',
    tankCountOne: '1 tank',
    retestCount: '{count} retest',
    contractMax: 'max {value}',
    floorAbove: 'above {value}',
    watchBand: 'watch band {low}–{high}',
    dailyLowHigh: 'daily low–high',
    groupSample: 'Sample',
    groupCore: 'Core',
    groupOxidation: 'Oxidation',
    groupComposition: 'Composition',
    groupNotes: 'Notes',
    tankFill: 'Fill',
    productsInTanks: 'Products in tanks',
    passMix: 'Pass mix',
    dayFlow: 'Product flow',
    ffaPct: 'FFA %',
    moisturePct: 'M&I %',
    tempC: 'Temp °C',
    colourRLov: 'R (Lovibond)',
    colourYLov: 'Y (Lovibond)',
    truckScatter: 'FFA % against M&I % · one dot per truck · lines at the contract max',
    vesselScatter: 'Composite FFA % against M&I % · one dot per ticket · lines at the contract max',
    palkaStrip: 'FFA % per hold sample · line at the contract max',
    ffaBySnapshot: 'FFA % by snapshot · shaded band is the product range',
    dailyBandCaption: 'Shaded band runs from the daily low to the daily high. Click a day to open its hours.',
    hourlyCaption: 'Finished FFA % by hour. Shading marks each finished-product run.',
    reasonOver: '{param} {value} over max {max}',
    reasonRetest: 'Analysis {days} days old',
    reasonWatch: '{param} {value} outside the watch band',
    view: 'View',
    ageDaysShort: '{days} d',
    legend: 'Legend',
    loading: 'Loading…',
    loginInvalid: 'Invalid username or password.',
    signingIn: 'Signing in…',
    administration: 'Administration',
    adminMenuTitle: 'Administration',
    adminIntro: 'Manage who can sign in, which sites they see, and what each role may do.',
    userManagement: 'User Management',
    userManagementBlurb: 'Create users, assign roles, and assign sites.',
    roleManagement: 'Role Management',
    roleManagementBlurb: 'Define roles and the pages they can view, edit, or delete.',
    backToAdmin: '← Back to Administration',
    users: 'Users',
    user: 'User',
    addUser: 'Add User',
    editUser: 'Edit User',
    username: 'Username',
    displayName: 'Display name',
    email: 'Email',
    password: 'Password',
    newPasswordOptional: 'New password (optional)',
    active: 'Active',
    roles: 'Roles',
    siteAccess: 'Site access',
    search: 'Search',
    allStatuses: 'All statuses',
    activeStatus: 'Active',
    inactiveStatus: 'Inactive',
    noUsers: 'No users yet.',
    noMatch: 'No entries match the current filters.',
    userSaved: 'User saved. {n} site(s) assigned.',
    userDeleted: 'User deleted.',
    deleteUserConfirm: 'Delete this user? They will no longer be able to sign in.',
    saving: 'Saving…',
    systemSuffix: '(system)',
    rolesHelp: 'Roles control which pages this user can view, edit, or delete.',
    sitesHelp: 'A user with no site assigned cannot open operational or master data.',
    searchSite: 'Search site…',
    selectVisible: 'Select visible',
    clearVisible: 'Clear visible',
    noRoles: 'No roles found.',
    noSites: 'No sites found.',
    accessNotConfigured: 'Access not configured',
    noSiteBody: 'No site assigned. Contact a Plant Information Dashboard administrator.',
    accessDenied: 'Access denied',
    accessDeniedBody: 'You do not have permission to view this page.',
    changePassword: 'Change password',
    signOut: 'Sign out',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    passwordUpdated: 'Your password has been updated.',
    permissionView: 'View',
    permissionEdit: 'Edit',
    permissionDelete: 'Delete',
    roleSaved: 'Role saved.',
    roleDeleted: 'Role deleted.',
    deleteRoleConfirm: 'Delete this role?',
    addRole: 'Add Role',
    editRole: 'Edit Role',
    roleName: 'Role name',
    description: 'Description',
    usersCount: 'Users',
    noRolesYet: 'No roles yet.',
    pages: 'Page',
    operationsGroup: 'Operations',
    masterGroup: 'Master data',
    refineryFractionation: 'Refinery and fractionation',
    utility: 'Utility',
    utilityOverview: 'Utility overview',
    utilityBoiler: 'Boiler',
    utilityCoal: 'Coal & fuel',
    utilityWater: 'Water',
    utilityEffluent: 'Effluent',
    utilityLoader: 'Loader',
    utilityPower: 'Power',
    utilityNote: 'Values are shown as written on the utility logsheets. A range printed on the sheet is context, not a pass or fail. Boiler steam meters are not added to the refinery steam on the production report.',
    latestDay: 'Latest day',
    logged: 'Logged',
    emptySheet: 'Empty sheet',
    notSubmitted: 'Not submitted',
    notLogged: 'Not logged',
    outsidePrinted: 'Outside printed range',
    checklistNo: 'Checklist no',
    printedRange: 'printed {spec}',
    periodRange: 'range in this period · {count} results',
    readingCount: '{count} readings',
    daysLogged: 'Days logged',
    daysLoggedOf: '{logged} of {days} days',
    formsSubmitted: '{submitted} of {total} forms submitted',
    byHour: 'by hour',
    labBandCaption: 'Shaded band runs from the daily low to the daily high. The grey band or dashed line is the range printed on the sheet.',
    date: 'Date',
    shift: 'Shift',
    boilerDaysLogged: 'Boiler days logged (F/UTI-001)',
    coalBuckets: 'Coal consumed (buckets)',
    coalRatio: 'Latest coal ratio (kg/mt steam)',
    printedRatio: 'Printed ratio (kg/mt steam)',
    attentionItems: 'Items needing attention',
    sourceBoard: 'Logsheets in this range',
    coalAndRatio: 'Coal and ratio',
    coalRatioCaption: 'Coal buckets per day, with the last printed ratio of each day on its own axis. A day without a sheet is a gap.',
    waterCoverage: 'Water coverage',
    roCleaning: 'RO cleaning',
    performedOn: 'Performed on',
    doneBy: 'Done by',
    roVerifications: '{count} verifications after cleaning',
    checkYes: 'Yes',
    checkNo: 'No',
    reasonOutside: '{value}, printed {spec}',
    reasonNotLogged: 'Last log {date}',
    reasonEmpty: 'Sheet for {date} has no rows',
    reasonChecklistNo: 'Answered no on {date}',
    noUtilityRows: 'No utility logs in this range.',
    noDataDay: 'The sheet for this day has no readings.',
    controlRoom: 'Control Room',
    localPanel: 'Local',
    boilerNote: 'Taihu 15 TPH. Wuxi 15 TPH has no submissions. The steam flowmeter is a meter reading and is not refinery steam. Click a number to see that tag across the range.',
    hourlyLog: 'Hourly log',
    latestAgainstPrinted: 'Latest hour against the printed range',
    boilerChemicals: 'Boiler chemicals',
    chemicalNote: 'Logged on {count} days in this range. Remaining is a spot reading, not a stock balance.',
    chemical: 'Chemical',
    lastRemaining: 'Last remaining',
    lastLog: 'Last log',
    usedOnLogDays: 'Used on log days',
    daysWithLog: 'Days with a log',
    coalSteamNote: 'Steam on this tab is the boiler meter. It is not added to the refinery steam on the production report. The ratio is shown as printed.',
    steamDistribution: 'Steam distribution (kg, meter)',
    steamMeterCaption: 'Steam distribution per day from the coal logsheet. A day without a sheet is a gap.',
    incomingCoalDays: 'Days with incoming coal',
    incomingCoal: 'Incoming coal (kg)',
    utilityPeriod: '{start} – {end}',
    form: 'Form',
    shiftLog: 'Shift log',
    fuelClockLog: 'Fuel clock log',
    steamMeter: 'Steam (meter reading)',
    waterNote: 'Each result is compared only with the range printed in its own tag. Click a result to see that test across the range.',
    boilerWaterGroup: 'Boiler water',
    wtpGroup: 'WTP & WWTP',
    testsRecorded: 'Tests recorded',
    samplePointsLogged: 'Sample points logged',
    daysSinceRo: 'Days since RO cleaning',
    samplePoint: 'Sample point',
    test: 'Test',
    printedSpec: 'Printed range',
    labRoster: 'Results',
    wwtpCoverage: 'WWTP log coverage',
    effluentCoverage: '{logged} of {days} days in this range have a WWTP log.',
    inletCod: 'Inlet COD',
    outletCod: 'Outlet COD',
    outletTss: 'Outlet TSS',
    inletVsOutlet: 'Inlet and outlet',
    inlet: 'Inlet',
    outlet: 'Outlet',
    generalLevels: 'General levels',
    loaderNote: 'Totals are shown as printed on the sheet. Fuel and oil appear only on the runs where they were written.',
    hoursRun: 'Hours run',
    runs: 'Runs',
    fuelWritten: 'Fuel written (L)',
    fuelRuns: '{count} runs with fuel',
    checklistNoItems: 'Checklist no items (latest day)',
    dailyHours: 'Daily hours',
    loaderCaption: 'Printed hours per day. Green dots mark the days fuel was written.',
    checklist: 'Checklist',
    checklistAllYes: 'Every item was answered yes.',
    yesItems: '{count} yes items',
    runRoster: 'Hour meter runs',
    hourStart: 'Hour meter start',
    hourEnd: 'Hour meter end',
    printedTotal: 'Total (printed)',
    fuelL: 'Fuel (L)',
    oilL: 'Oil (L)',
    coverage: 'Coverage',
    logsheetCatalog: 'Logsheet catalog',
    qualityRules: 'Quality rules',
    requestFailed: 'The request could not be completed.',
    usernameRequired: 'Username is required.',
    passwordRequired: 'Password is required for a new user.',
    passwordShort: 'Password must be at least 6 characters.',
    usernameTaken: 'Username is already in use.',
    emailTaken: 'Email is already in use.',
    lastAdmin: 'At least one active administrator must remain.',
    selfDeactivate: 'You cannot deactivate your own account.',
    selfDelete: 'You cannot delete your own account.',
    currentPasswordRequired: 'Current password is required.',
    newPasswordRequired: 'New password is required.',
    samePassword: 'New password must be different from your current password.',
    badCurrentPassword: 'Invalid current password.',
    confirmMismatch: 'New password and confirmation do not match.',
    roleNameRequired: 'Role name is required.',
    roleNameTaken: 'Role name is already in use.',
    systemRoleLocked: 'A system role cannot be deleted.',
    roleInUse: 'This role is still assigned to a user.',
  },
  id: {
    appTitle: 'Dasbor Informasi Pabrik',
    tagline: 'Pemantauan cerdas untuk pabrik yang lebih cerdas',
    brandMark: 'PI',
    brandTitle: 'Informasi Pabrik',
    brandSub: 'Dasbor',
    corpName: 'KPN CORP',
    loginPitch: 'Pantau stok tangki, kualitas, dan produksi harian dari satu tempat.',
    welcomeBack: 'Selamat datang kembali',
    signInContinue: 'Masuk untuk melanjutkan ke Dasbor Informasi Pabrik',
    loginUsername: 'Nama pengguna atau email',
    loginUsernamePlaceholder: 'Masukkan nama pengguna atau email',
    loginPassword: 'Kata sandi',
    loginPasswordPlaceholder: 'Masukkan kata sandi',
    showPassword: 'Tampilkan kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
    signIn: 'Masuk',
    signInViaDwsHub: 'Masuk via Dws Hub',
    backToSignIn: 'Kembali ke halaman masuk',
    ssoErrorTitle: 'Masuk tidak dapat diselesaikan',
    ssoErrorFallback: 'Downstream Hub tidak dapat memasukkan Anda. Coba lagi, atau gunakan nama pengguna dan kata sandi.',
    loginRequired: 'Masukkan nama pengguna dan kata sandi.',
    copyright: '© {{year}} KPN Corporation. Hak cipta dilindungi.',
    liveOps: 'Dasbor Tangki & Stok',
    opsAnalytics: 'Level & Suhu Tangki',
    analyticsTitle: 'Level & Suhu Tangki',
    siteLabel: 'Lokasi',
    notifications: 'Notifikasi',
    noNotifications: 'Tidak ada notifikasi',
    expandSidebar: 'Bentangkan menu',
    collapseSidebar: 'Ciutkan menu',
    openMenu: 'Buka menu',
    gridView: 'Grid',
    tableView: 'Tabel',
    commodityStock: 'Total stok komoditas',
    utilizationOf: 'Utilisasi',
    stockSources: 'Tangki dalam stok ini',
    close: 'Tutup',
    gatekeeper: 'Masuk/Keluar & Penjaga Kualitas',
    liveLogistics: 'Logistik masuk/keluar',
    noSounding: 'Belum ada data sounding pagi yang dimuat.',
    noVehicles: 'Tidak ada truk atau kapal pada tampilan gerbang saat ini.',
    morningRounds: 'Putaran sounding pagi',
    noHistory: 'Grafik level dan suhu menampilkan satu titik untuk setiap putaran pagi.',
    lastUpdated: 'Terakhir diperbarui',
    showGatekeeper: 'Tampilkan masuk/keluar dan kualitas',
    hideGatekeeper: 'Sembunyikan masuk/keluar dan kualitas',
    quantity: 'Kuantitas',
    soundingDay: 'Ada sounding pada hari itu.',
    analysisDay: 'Ada hasil lab pada hari itu.',
    qualityAge: 'Hasil lab berumur {age} hari ({day}).',
    levelFillHint: 'Merah jika tangki terisi lebih dari 80%.',
    tempSpikeHint: 'Merah jika suhu lebih dari 30% di atas suhu rata-rata.',
    ffaAgeHint: 'Merah jika hasil lab terbaru berumur lebih dari 7 hari.',
    emptySpace: 'Ruang kosong',
    loadable: 'Loadable',
    rangeAverage: 'Rata-rata',
    rangeMax: 'Maks',
    rangeMin: 'Min',
    tankLevelPct: 'Level tangki',
    totalQuantity: 'Total kuantitas',
    avgLevel: 'Rata-rata level tangki',
    avgTemp: 'Suhu rata-rata',
    storageUtilization: 'Utilisasi penyimpanan',
    activeVsEmpty: 'Tangki aktif vs kosong',
    activeEmptySub: 'aktif / kosong',
    criticalAlerts: 'Peringatan kritis',
    criticalAlertsSub: 'Isi di atas 95% atau anomali suhu',
    tanksHolding: '{held} dari {total} tangki',
    avgQuality: 'Rata-rata mutu',
    selectDay: 'Tanggal',
    massUnit: 'Satuan kuantitas',
    unitTon: 'Ton',
    unitKg: 'Kg',
    kpiDetailHint: 'Lihat detail',
    activeTanks: 'Tangki aktif',
    emptyTanks: 'Tangki kosong',
    reasonOverfill: 'Isi di atas 95% ({value})',
    reasonHotTemp: '{value} terhadap rata-rata {avg}',
    noCriticalAlerts: 'Tidak ada tangki di atas 95% atau bersuhu tinggi.',
    alertRule: 'Tangki kritis bila isinya di atas 95%, atau suhunya lebih dari 30% di atas rata-rata suhu tangki ({avg}).',
    gateSamplesWindow: 'Sampel CPO masuk yang sudah dinilai, {start} – {end}',
    vehicle: 'Kapal / truk',
    sampleDay: 'Disampling',
    modeVessel: 'Kapal',
    modeTruck: 'Truk',
    noRows: 'Tidak ada data.',
    throughput: 'Throughput (massa)',
    approvalRate: 'Tingkat kelulusan lab',
    unavailable: '—',
    period: 'Periode',
    periodDaily: 'Harian',
    periodMonthly: 'Bulanan',
    tank: 'Tangki',
    status: 'Status',
    levelTemp: 'Level tangki & suhu',
    charging: 'Bongkar & muat',
    qualityLog: 'Parameter kualitas',
    awaiting: 'Menunggu riwayat logsheet.',
    latestPerTank: 'Sounding terakhir per tangki',
    round: 'Putaran',
    retest: 'Uji ulang',
    noLab: 'Belum ada hasil lab',
    allCommodities: 'Semua komoditas',
    noCommodity: 'Tidak ada komoditas',
    incomingCpo: 'CPO masuk',
    pass: 'Lolos',
    rejected: 'Ditolak',
    target: 'Tujuan',
    levelAxis: 'Level (m)',
    tempAxis: 'Suhu (°C)',
    movementNote: 'Jumlah kendaraan dari log gerbang. Ton tidak ada di lembar itu.',
    notClassified: 'Tidak terklasifikasi',
    outbound: 'Keluar',
    inbound: 'Masuk',
    specPending: 'Spek tangki belum diatur',
    noQuality: 'Tidak ada seri lab untuk tangki ini.',
    massShort: 'Massa',
    masterMenu: 'Master',
    masterMenuTitle: 'Menu Master',
    masterIntro: 'Kelola data organisasi dan tank farm untuk aplikasi ini.',
    masterDash: 'Master –',
    datahubGroup: 'DataHub',
    datahubGroupNote: 'Perusahaan, site, pabrik, dan komoditas. DataHub akan mengirim data ini. Layar ini menyimpan salinan lokal.',
    plantGroup: 'Pabrik ini',
    plantGroupNote: 'Master tangki disimpan di aplikasi ini. DataHub tidak mengirim data tangki.',
    company: 'Perusahaan',
    companies: 'Perusahaan',
    companyBlurb: 'Perusahaan di dalam grup.',
    site: 'Site',
    sites: 'Site',
    siteBlurb: 'Site operasi di bawah perusahaan.',
    plant: 'Pabrik',
    plants: 'Pabrik',
    plantsBlurb: 'Pabrik pada sebuah site. Logsheet saat ini milik satu pabrik.',
    commodities: 'Komoditas',
    commodity: 'Komoditas',
    commoditiesBlurb: 'Katalog minyak dari DataHub. Nama di logsheet dipetakan ke sini nanti.',
    tankFarm: 'Tank Farm',
    tanks: 'Tangki',
    tankFarmBlurb: 'Tangki dan angka kalibrasi yang dipakai Dasbor Tangki & Stok untuk kuantitas. Dikelola di aplikasi ini.',
    badgeDatahub: 'DataHub',
    badgeThisPlant: 'Pabrik ini',
    openPage: 'Buka →',
    backToMaster: '← Kembali ke Menu Master',
    refresh: 'Muat ulang',
    add: 'Tambah',
    edit: 'Ubah',
    remove: 'Hapus',
    save: 'Simpan',
    cancel: 'Batal',
    code: 'Kode',
    recordName: 'Nama',
    timezone: 'Zona waktu',
    capacity: 'Kapasitas',
    unit: 'Satuan',
    logsheets: 'Logsheet',
    actions: 'Aksi',
    noMasterRows: 'Tidak ada data yang cocok dengan filter.',
    duplicateRecord: 'Nama atau kode ini sudah ada.',
    recordInUse: 'Data ini masih dipakai daftar master lain.',
    requiredFields: 'Isi kolom yang wajib.',
    filterBy: 'Filter',
    identity: 'Identitas',
    densityGroup: 'Grup densitas',
    volumeRows: 'Baris volume',
    calibrationStatus: 'Kalibrasi',
    calibrationDefault: 'Bawaan',
    calibrationCustom: 'Kustom',
    backToTankFarm: '← Kembali ke Tank Farm',
    tankCalibration: 'Kalibrasi tangki',
    tankCalibrationBlurb: 'Kapasitas, offset, dan tabel liter. Simpan untuk memperbarui kuantitas di Dasbor Tangki & Stok. Reset mengembalikan angka dari workbook untuk tangki ini.',
    calibrationConstants: 'Konstanta',
    bottomStock: 'Stok dasar',
    dipOffset: 'Offset dip',
    ullageLk: 'Ullage LK',
    ullageLb: 'Ullage LB',
    tableTemp: 'Suhu tabel',
    lookupMode: 'Mode pencarian',
    lookupExact: 'Tinggi persis',
    lookupApprox: 'Tinggi sama atau di bawah',
    volumeTable: 'Tabel volume',
    ringVolumes: 'Volume ring',
    ringBands: 'Pita ring',
    heightM: 'Tinggi (m)',
    liters: 'Liter',
    importCsv: 'Impor CSV',
    exportCsv: 'Ekspor CSV',
    addRow: 'Tambah baris',
    resetTank: 'Reset tangki ini',
    preview: 'Pratinjau',
    previewHeightOutOfRange: 'Tinggi yang dicari {lookup} m. Tabel volume hanya {min} m sampai {max} m, jadi kuantitas tidak dapat dihitung.',
    previewDensityOutOfRange: 'Tidak ada densitas {group} pada {temp} °C. Tabel itu mencakup {min} °C sampai {max} °C dalam bilangan bulat.',
    previewNoTable: 'Tangki ini belum punya tabel volume, jadi kuantitas tetap kosong.',
    soundingMethod: 'Metode sounding',
    savedCalibration: 'Tersimpan. Dasbor Tangki & Stok memakai angka ini.',
    resetCalibration: 'Angka workbook untuk tangki ini dipulihkan.',
    invalidCapacity: 'Kapasitas harus lebih dari nol jika diisi.',
    invalidVolumeHeights: 'Setiap baris volume butuh tinggi unik dan nilai liter.',
    invalidDensityGroup: 'Pilih salah satu grup densitas yang dikenal.',
    tableTempRequired: 'Suhu tabel wajib jika tabel volume ada.',
    invalidRingBand: 'Setiap pita ring butuh rendah, tinggi, dan offset, dengan rendah tidak melebihi tinggi.',
    csvParseError: 'CSV tidak dapat dibaca. Gunakan kolom angka; baris judul boleh ada.',
    ringIndex: 'Indeks',
    bandLow: 'Rendah (mm)',
    bandHigh: 'Tinggi (mm)',
    bandOffset: 'Offset',
    previousPage: 'Sebelumnya',
    nextPage: 'Berikutnya',
    commoditiesCalibration: 'Kalibrasi Komoditas',
    commoditiesCalibrationBlurb: 'Densitas bersama menurut suhu. Tangki hanya menyimpan nama grup. Kuantitas memakai densitas pada suhu sounding.',
    densityLookup: 'Densitas pada suatu suhu',
    densityLookupNote: 'Isi suhu dalam bilangan bulat. Baris yang ditandai adalah densitas yang dikalikan ke kuantitas.',
    density: 'Densitas',
    densityAtTemp: '{group} pada {temp} °C adalah {density}.',
    tanksUsingGroup: 'Tangki yang memakai grup ini',
    dailyProduction: 'Ringkasan Produksi Harian',
    dailyProductionTitle: 'Ringkasan Produksi Harian',
    loggedDays: 'Hari tercatat (6–7 Okt)',
    dataDay: 'Hari dengan data logsheet',
    feed: 'Feed (t)',
    product: 'Produk (t)',
    yieldPct: 'Yield',
    coproduct: 'Produk samping (t)',
    loss: 'Loss (t)',
    refinery500: 'Refinery 500',
    refinery150: 'Refinery 150',
    fract400: 'Fraksinasi 400',
    fract500: 'Fraksinasi 500',
    separator: 'Separator',
    rbdpoPfad: 'RBDPO + PFAD',
    oleinStearin: 'Olein + stearin',
    washedCpo: 'CPO cuci',
    chemicalsUtilities: 'Bahan kimia dan utilitas',
    beBags: 'BE (bag)',
    paLogged: 'PA (sesuai log)',
    powerKwh: 'Listrik (kWh)',
    gasMmBtu: 'Gas (mmBtu)',
    steamLogged: 'Steam (sesuai log)',
    water: 'Air',
    compressor: 'Kompresor udara',
    oilMovement: 'Pergerakan minyak',
    incoming: 'Masuk',
    localSales: 'Penjualan lokal',
    shipment: 'Shipment',
    blendIn: 'Blend in',
    blendOut: 'Blend out',
    transferIn: 'Transfer in',
    transferOut: 'Transfer out',
    gainLoss: 'Gain / loss',
  stockLadder: 'Tangga stok',
  opening: 'Awal',
    productionKg: 'Produksi',
    used: 'Pakai',
    closing: 'Akhir',
    cpo: 'CPO',
    rbdpo: 'RBDPO',
    pfad: 'PFAD',
    olein: 'Olein',
    stearin: 'Stearin',
    plantDetail: 'Detail pabrik',
    productionGroup: 'Produksi',
    supportingMaterials: 'Bahan Penunjang',
    totalRow: 'Total',
    colDate: 'Tanggal',
    totalFeed: 'Total feed (t)',
    powerRatio: 'kWh/t',
    gasRatio: 'mmBtu/t',
    citricAcid: 'Asam sitrat',
    received: 'Terima',
    closingBag: 'Akhir (bag)',
    material: 'Bahan',
    downtime: 'Downtime',
    quality: 'Kualitas',
    solar: 'Solar (L)',
    fame: 'FAME (L)',
    pmf: 'PMF (t)',
    oleinIv64: 'Olein IV 64 (t)',
    oleinCp09: 'Olein CP 09 (t)',
    rbdpoIn: 'RBDPO masuk (t)',
    schedulingDt: 'Jadwal (jam)',
    commercialDt: 'Komersial (jam)',
    technicalDt: 'Teknis (jam)',
    utilityDt: 'Utilitas (jam)',
    ffa: 'FFA',
    moisture: 'Moisture',
    dobi: 'DOBI',
    qualityControl: 'Kendali Mutu',
    qcTitle: 'Kendali Mutu',
    qcStorage: 'Tangki Timbun',
    qcVessel: 'Masuk Kapal',
    qcTruck: 'Masuk Truk',
    qcMovements: 'Minyak masuk dan keluar',
    refineryQuality: 'Mutu refinery',
    hoursLogged: 'Jam tercatat',
    finishedFfa: 'FFA produk jadi',
    feedFfa: 'FFA bahan baku',
    byproductFfa: 'FFA produk samping',
    streamsTitle: 'Aliran',
    readingsTitle: 'Pembacaan',
    declaredNotTested: 'Dinyatakan, belum diuji',
    rangeLow: 'Terendah',
    rangeHigh: 'Tertinggi',
    time: 'Waktu',
    fromTank: 'Dari tangki',
    flowRate: 'Aliran',
    finishedOil: 'Minyak jadi',
    feedOil: 'Minyak bahan baku',
    colour: 'Warna',
    toTank: 'Ke tangki',
    rawMaterial: 'Bahan baku',
    bleachingOil: 'Pemucatan',
    finishedGood: 'Produk jadi',
    byProduct: 'Produk samping',
    spentEarth: 'Spent earth',
    bleachRed: 'R pemucatan',
    spentEarthOc: 'OC spent earth',
    noSample: 'Tidak ada sampel',
    tanksLogged: 'Tangki tercatat',
    retestDue: 'Perlu uji ulang',
    oilTypes: 'Jenis minyak',
    inboundPassed: 'Masuk lolos',
    inboundRejected: 'Masuk ditolak',
    trucksSampled: 'Truk disampling',
    unloadRemarks: 'Keterangan bongkar',
    vesselTickets: 'Tiket kapal',
    palkaSamples: 'Sampel palka',
    movementCount: 'Pergerakan',
    gatePeriodNote: 'Angka mengikuti rentang tanggal di atas. Lembar mencakup {period}.',
    analysisDate: 'Tanggal analisa',
    ageDays: 'Umur (hari)',
    slipPoint: 'Slip point',
    cloudPoint: 'Cloud point',
    carotene: 'β-Carotene',
    phosphorus: 'P',
    totox: 'Totox',
    odor: 'Odor',
    remark: 'Keterangan',
    analyst: 'Analis',
    policeNo: 'No. polisi',
    colourR: 'Colour R',
    colourY: 'Colour Y',
    ship: 'Kapal',
    supplier: 'Pemasok',
    arrival: 'Kedatangan',
    contractLimits: 'Kontrak',
    composite: 'Komposit',
    sampleNo: 'Sampel',
    mineralOil: 'Mineral oil',
    triene: 'Triene',
    allOils: 'Semua minyak',
    noQcRows: 'Tidak ada baris pada rentang ini.',
    snapshot: 'Snapshot',
    customerShip: 'Customer / kapal',
    timeIn: 'Jam masuk',
    timeOut: 'Jam keluar',
    sealIn: 'Segel masuk',
    sealOut: 'Segel keluar',
    operator: 'Operator',
    asLogged: 'sesuai log',
    revisionShort: 'Rev.',
    storageSpecNote: 'Batas mutu tangki belum ditetapkan, jadi tangki tidak dinilai lolos atau karantina di sini. Lencana uji ulang berarti analisa lebih dari 2 hari lebih tua dari snapshot. Angka ditampilkan sebagaimana tertulis di formulir.',
    palkaLimitNote: 'Angka merah melewati batas FFA atau moisture tiket itu. Angka kuning di luar pita IV palka (51–54) atau tidak di atas DOBI 2. Tanda kuning tidak menolak muatan.',
    writtenAs: 'Sesuai tulis',
    latestSnapshot: 'Snapshot terakhir',
    snapshots: 'Snapshot',
    direction: 'Arah',
    palka: 'Palka',
    ticketCode: 'Tiket',
    resultValue: 'Nilai',
    incomplete: 'Belum lengkap',
    noSampleDate: 'Tanpa tanggal sampling',
    needsAttention: 'Perlu tindakan',
    nothingNeedsAttention: 'Tidak ada yang perlu ditindaklanjuti pada rentang ini.',
    moreItems: '+{count} lainnya',
    overMax: 'Melewati batas',
    watch: 'Pantau',
    noSpec: 'Tanpa spek',
    notRecorded: 'Tidak dicatat',
    rangeFor: 'Rentang {product}, {from}–{to} · {count} hasil',
    tooFewToCompare: 'Hasil terlalu sedikit untuk dibandingkan',
    tanksWithoutResult: '{count} tangki tanpa hasil',
    tankCount: '{count} tangki',
    tankCountOne: '1 tangki',
    retestCount: '{count} uji ulang',
    contractMax: 'maks {value}',
    floorAbove: 'di atas {value}',
    watchBand: 'pita pantau {low}–{high}',
    dailyLowHigh: 'rendah–tinggi harian',
    groupSample: 'Sampel',
    groupCore: 'Utama',
    groupOxidation: 'Oksidasi',
    groupComposition: 'Komposisi',
    groupNotes: 'Catatan',
    tankFill: 'Isi',
    productsInTanks: 'Produk di tangki',
    passMix: 'Komposisi hasil',
    dayFlow: 'Alur produk',
    ffaPct: 'FFA %',
    moisturePct: 'M&I %',
    tempC: 'Suhu °C',
    colourRLov: 'R (Lovibond)',
    colourYLov: 'Y (Lovibond)',
    truckScatter: 'FFA % terhadap M&I % · satu titik per truk · garis pada batas kontrak',
    vesselScatter: 'FFA % komposit terhadap M&I % · satu titik per tiket · garis pada batas kontrak',
    palkaStrip: 'FFA % per sampel palka · garis pada batas kontrak',
    ffaBySnapshot: 'FFA % per snapshot · pita arsir adalah rentang produk',
    dailyBandCaption: 'Pita arsir dari nilai terendah ke tertinggi harian. Klik hari untuk membuka per jam.',
    hourlyCaption: 'FFA % produk jadi per jam. Arsiran menandai tiap jalannya produk.',
    reasonOver: '{param} {value} melewati maks {max}',
    reasonRetest: 'Analisa berumur {days} hari',
    reasonWatch: '{param} {value} di luar pita pantau',
    view: 'Lihat',
    ageDaysShort: '{days} h',
    legend: 'Keterangan',
    loading: 'Memuat…',
    loginInvalid: 'Nama pengguna atau kata sandi salah.',
    signingIn: 'Masuk…',
    administration: 'Administrasi',
    adminMenuTitle: 'Administrasi',
    adminIntro: 'Kelola siapa yang dapat masuk, site yang mereka lihat, dan apa yang boleh dilakukan setiap peran.',
    userManagement: 'Manajemen Pengguna',
    userManagementBlurb: 'Buat pengguna, tetapkan peran, dan tetapkan site.',
    roleManagement: 'Manajemen Peran',
    roleManagementBlurb: 'Atur peran dan halaman yang dapat dilihat, diubah, atau dihapus.',
    backToAdmin: '← Kembali ke Administrasi',
    users: 'Pengguna',
    user: 'Pengguna',
    addUser: 'Tambah Pengguna',
    editUser: 'Ubah Pengguna',
    username: 'Nama pengguna',
    displayName: 'Nama tampilan',
    email: 'Email',
    password: 'Kata sandi',
    newPasswordOptional: 'Kata sandi baru (opsional)',
    active: 'Aktif',
    roles: 'Peran',
    siteAccess: 'Akses site',
    search: 'Cari',
    allStatuses: 'Semua status',
    activeStatus: 'Aktif',
    inactiveStatus: 'Nonaktif',
    noUsers: 'Belum ada pengguna.',
    noMatch: 'Tidak ada data yang sesuai dengan filter.',
    userSaved: 'Pengguna disimpan. {n} site ditetapkan.',
    userDeleted: 'Pengguna dihapus.',
    deleteUserConfirm: 'Hapus pengguna ini? Mereka tidak akan bisa masuk lagi.',
    saving: 'Menyimpan…',
    systemSuffix: '(sistem)',
    rolesHelp: 'Peran mengatur halaman yang dapat dilihat, diubah, atau dihapus pengguna ini.',
    sitesHelp: 'Pengguna tanpa site tidak dapat membuka data operasional maupun data master.',
    searchSite: 'Cari site…',
    selectVisible: 'Pilih yang tampil',
    clearVisible: 'Hapus yang tampil',
    noRoles: 'Tidak ada peran.',
    noSites: 'Tidak ada site.',
    accessNotConfigured: 'Akses belum dikonfigurasi',
    noSiteBody: 'Tidak ada site yang ditetapkan. Hubungi administrator Plant Information Dashboard.',
    accessDenied: 'Akses ditolak',
    accessDeniedBody: 'Anda tidak memiliki izin untuk melihat halaman ini.',
    changePassword: 'Ubah kata sandi',
    signOut: 'Keluar',
    currentPassword: 'Kata sandi saat ini',
    newPassword: 'Kata sandi baru',
    confirmPassword: 'Konfirmasi kata sandi',
    passwordUpdated: 'Kata sandi Anda telah diperbarui.',
    permissionView: 'Lihat',
    permissionEdit: 'Ubah',
    permissionDelete: 'Hapus',
    roleSaved: 'Peran disimpan.',
    roleDeleted: 'Peran dihapus.',
    deleteRoleConfirm: 'Hapus peran ini?',
    addRole: 'Tambah Peran',
    editRole: 'Ubah Peran',
    roleName: 'Nama peran',
    description: 'Deskripsi',
    usersCount: 'Pengguna',
    noRolesYet: 'Belum ada peran.',
    pages: 'Halaman',
    operationsGroup: 'Operasi',
    masterGroup: 'Data master',
    refineryFractionation: 'Refinery dan fraksinasi',
    utility: 'Utilitas',
    utilityOverview: 'Ikhtisar utilitas',
    utilityBoiler: 'Boiler',
    utilityCoal: 'Batu bara & bahan bakar',
    utilityWater: 'Air',
    utilityEffluent: 'Limbah cair',
    utilityLoader: 'Loader',
    utilityPower: 'Listrik',
    utilityNote: 'Nilai ditampilkan sesuai logsheet utilitas. Rentang yang tercetak di lembar hanya konteks, bukan lulus atau gagal. Meter steam boiler tidak ditambahkan ke steam refineri di laporan produksi.',
    latestDay: 'Hari terakhir',
    logged: 'Tercatat',
    emptySheet: 'Lembar kosong',
    notSubmitted: 'Tidak dikirim',
    notLogged: 'Tidak tercatat',
    outsidePrinted: 'Di luar rentang tercetak',
    checklistNo: 'Checklist tidak',
    printedRange: 'tercetak {spec}',
    periodRange: 'rentang periode ini · {count} hasil',
    readingCount: '{count} pembacaan',
    daysLogged: 'Hari tercatat',
    daysLoggedOf: '{logged} dari {days} hari',
    formsSubmitted: '{submitted} dari {total} form dikirim',
    byHour: 'per jam',
    labBandCaption: 'Area berarsir dari nilai terendah hingga tertinggi harian. Pita abu-abu atau garis putus-putus adalah rentang yang tercetak di lembar.',
    date: 'Tanggal',
    shift: 'Shift',
    boilerDaysLogged: 'Hari boiler tercatat (F/UTI-001)',
    coalBuckets: 'Batu bara terpakai (bucket)',
    coalRatio: 'Rasio batu bara terakhir (kg/mt steam)',
    printedRatio: 'Rasio tercetak (kg/mt steam)',
    attentionItems: 'Perlu perhatian',
    sourceBoard: 'Logsheet pada periode ini',
    coalAndRatio: 'Batu bara dan rasio',
    coalRatioCaption: 'Bucket batu bara per hari, dengan rasio tercetak terakhir tiap hari pada sumbu sendiri. Hari tanpa lembar dibiarkan kosong.',
    waterCoverage: 'Cakupan air',
    roCleaning: 'Pembersihan RO',
    performedOn: 'Dilakukan',
    doneBy: 'Oleh',
    roVerifications: '{count} verifikasi setelah pembersihan',
    checkYes: 'Ya',
    checkNo: 'Tidak',
    reasonOutside: '{value}, tercetak {spec}',
    reasonNotLogged: 'Log terakhir {date}',
    reasonEmpty: 'Lembar {date} tidak berisi baris',
    reasonChecklistNo: 'Dijawab tidak pada {date}',
    noUtilityRows: 'Tidak ada log utilitas pada periode ini.',
    noDataDay: 'Lembar hari ini tidak berisi pembacaan.',
    controlRoom: 'Control Room',
    localPanel: 'Lokal',
    boilerNote: 'Taihu 15 TPH. Wuxi 15 TPH belum memiliki kiriman. Flowmeter steam adalah pembacaan meter, bukan steam refineri. Klik angka untuk melihat tag tersebut sepanjang periode.',
    hourlyLog: 'Log per jam',
    latestAgainstPrinted: 'Jam terakhir terhadap rentang tercetak',
    boilerChemicals: 'Chemical boiler',
    chemicalNote: 'Tercatat pada {count} hari di periode ini. Sisa adalah pembacaan sesaat, bukan saldo stok.',
    chemical: 'Chemical',
    lastRemaining: 'Sisa terakhir',
    lastLog: 'Log terakhir',
    usedOnLogDays: 'Terpakai pada hari log',
    daysWithLog: 'Hari dengan log',
    coalSteamNote: 'Steam pada tab ini adalah meter boiler. Tidak ditambahkan ke steam refineri di laporan produksi. Rasio ditampilkan sesuai cetakan.',
    steamDistribution: 'Distribusi steam (kg, meter)',
    steamMeterCaption: 'Distribusi steam per hari dari logsheet batu bara. Hari tanpa lembar dibiarkan kosong.',
    incomingCoalDays: 'Hari dengan batu bara masuk',
    incomingCoal: 'Batu bara masuk (kg)',
    utilityPeriod: '{start} – {end}',
    form: 'Formulir',
    shiftLog: 'Log shift',
    fuelClockLog: 'Log jam bahan bakar',
    steamMeter: 'Steam (pembacaan meter)',
    waterNote: 'Setiap hasil hanya dibandingkan dengan rentang yang tercetak pada tagnya sendiri. Klik hasil untuk melihat uji tersebut sepanjang periode.',
    boilerWaterGroup: 'Air boiler',
    wtpGroup: 'WTP & WWTP',
    testsRecorded: 'Uji tercatat',
    samplePointsLogged: 'Titik sampel tercatat',
    daysSinceRo: 'Hari sejak pembersihan RO',
    samplePoint: 'Titik sampel',
    test: 'Uji',
    printedSpec: 'Rentang tercetak',
    labRoster: 'Hasil',
    wwtpCoverage: 'Cakupan log WWTP',
    effluentCoverage: '{logged} dari {days} hari pada periode ini memiliki log WWTP.',
    inletCod: 'COD inlet',
    outletCod: 'COD outlet',
    outletTss: 'TSS outlet',
    inletVsOutlet: 'Inlet dan outlet',
    inlet: 'Inlet',
    outlet: 'Outlet',
    generalLevels: 'Level umum',
    loaderNote: 'Total ditampilkan sesuai cetakan di lembar. Solar dan oli hanya muncul pada run yang mencatatnya.',
    hoursRun: 'Jam operasi',
    runs: 'Run',
    fuelWritten: 'Solar tercatat (L)',
    fuelRuns: '{count} run dengan solar',
    checklistNoItems: 'Item checklist tidak (hari terakhir)',
    dailyHours: 'Jam per hari',
    loaderCaption: 'Jam tercetak per hari. Titik hijau menandai hari solar dicatat.',
    checklist: 'Checklist',
    checklistAllYes: 'Semua item dijawab ya.',
    yesItems: '{count} item ya',
    runRoster: 'Run hour meter',
    hourStart: 'Hour meter awal',
    hourEnd: 'Hour meter akhir',
    printedTotal: 'Total (tercetak)',
    fuelL: 'Solar (L)',
    oilL: 'Oli (L)',
    coverage: 'Cakupan',
    logsheetCatalog: 'Katalog logsheet',
    qualityRules: 'Aturan mutu',
    requestFailed: 'Permintaan tidak dapat diselesaikan.',
    usernameRequired: 'Nama pengguna wajib diisi.',
    passwordRequired: 'Kata sandi wajib diisi untuk pengguna baru.',
    passwordShort: 'Kata sandi minimal 6 karakter.',
    usernameTaken: 'Nama pengguna sudah digunakan.',
    emailTaken: 'Email sudah digunakan.',
    lastAdmin: 'Minimal satu administrator aktif harus tetap ada.',
    selfDeactivate: 'Anda tidak dapat menonaktifkan akun Anda sendiri.',
    selfDelete: 'Anda tidak dapat menghapus akun Anda sendiri.',
    currentPasswordRequired: 'Kata sandi saat ini wajib diisi.',
    newPasswordRequired: 'Kata sandi baru wajib diisi.',
    samePassword: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
    badCurrentPassword: 'Kata sandi saat ini salah.',
    confirmMismatch: 'Kata sandi baru dan konfirmasi tidak cocok.',
    roleNameRequired: 'Nama peran wajib diisi.',
    roleNameTaken: 'Nama peran sudah digunakan.',
    systemRoleLocked: 'Peran sistem tidak dapat dihapus.',
    roleInUse: 'Peran ini masih ditetapkan ke pengguna.',
  },
}

export const SSO_ERROR_TEXT: Record<Locale, Record<string, string>> = {
  en: {
    oidc_disabled: 'Sign-in via Downstream Hub is turned off.',
    oidc_not_configured: 'Sign-in via Downstream Hub is not configured yet.',
    legacy_bridge_disabled: 'This Hub sign-in link is turned off.',
    sso_not_configured: 'Sign-in via Downstream Hub is not configured yet.',
    missing_token: 'Downstream Hub did not send a sign-in token.',
    invalid_token: 'The Hub sign-in token is invalid or expired. Open the app from Downstream Hub again.',
    missing_email_claim: 'The Hub sign-in token did not include an email address.',
    missing_user_id: 'The Hub sign-in token did not include a user id.',
    inactive_user: 'This account is inactive. Ask an administrator to turn it back on.',
    no_linked_sso_user: 'No Plant Information Dashboard account uses this Hub email. Ask an administrator to add you first.',
    oidc_sub_collision: 'This Hub account is already linked to a different user.',
    email_not_verified: 'Confirm your email in Downstream Hub, then try again.',
    invalid_state: 'This sign-in session expired. Start again from the login page.',
    missing_code: 'Downstream Hub did not finish sign-in. Start again from the login page.',
    missing_id_token: 'Downstream Hub did not finish sign-in. Start again from the login page.',
    oidc_sign_in_failed: 'Downstream Hub could not sign you in. Try again, or use your username and password.',
    sign_on_failed: 'Downstream Hub could not sign you in. Try again, or use your username and password.',
  },
  id: {
    oidc_disabled: 'Masuk via Downstream Hub sedang dimatikan.',
    oidc_not_configured: 'Masuk via Downstream Hub belum dikonfigurasi.',
    legacy_bridge_disabled: 'Tautan masuk Hub ini sedang dimatikan.',
    sso_not_configured: 'Masuk via Downstream Hub belum dikonfigurasi.',
    missing_token: 'Downstream Hub tidak mengirim token masuk.',
    invalid_token: 'Token masuk Hub tidak valid atau sudah kedaluwarsa. Buka aplikasi dari Downstream Hub lagi.',
    missing_email_claim: 'Token masuk Hub tidak berisi alamat email.',
    missing_user_id: 'Token masuk Hub tidak berisi id pengguna.',
    inactive_user: 'Akun ini tidak aktif. Minta administrator untuk mengaktifkannya.',
    no_linked_sso_user: 'Tidak ada akun Dasbor Informasi Pabrik untuk email Hub ini. Minta administrator menambahkan Anda terlebih dahulu.',
    oidc_sub_collision: 'Akun Hub ini sudah tertaut ke pengguna lain.',
    email_not_verified: 'Konfirmasi email Anda di Downstream Hub, lalu coba lagi.',
    invalid_state: 'Sesi masuk ini sudah berakhir. Mulai lagi dari halaman masuk.',
    missing_code: 'Downstream Hub tidak menyelesaikan masuk. Mulai lagi dari halaman masuk.',
    missing_id_token: 'Downstream Hub tidak menyelesaikan masuk. Mulai lagi dari halaman masuk.',
    oidc_sign_in_failed: 'Downstream Hub tidak dapat memasukkan Anda. Coba lagi, atau gunakan nama pengguna dan kata sandi.',
    sign_on_failed: 'Downstream Hub tidak dapat memasukkan Anda. Coba lagi, atau gunakan nama pengguna dan kata sandi.',
  },
}
