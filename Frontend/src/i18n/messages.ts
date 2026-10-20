export type Locale = 'en' | 'id'

export interface Messages {
  appTitle: string
  tagline: string
  brandMark: string
  brandTitle: string
  brandSub: string
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
  throughput: string
  approvalRate: string
  unavailable: string
  period: string
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
}

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    appTitle: 'Plant Information Dashboard',
    tagline: 'Smart monitoring for smarter plants',
    brandMark: 'PI',
    brandTitle: 'Plant Information',
    brandSub: 'Dashboard',
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
    throughput: 'Throughput (mass)',
    approvalRate: 'Lab approval rate',
    unavailable: '—',
    period: 'Period',
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
    gatePeriodNote: 'Gate counts cover the full printed period {period}, not the date range above.',
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
  },
  id: {
    appTitle: 'Dasbor Informasi Pabrik',
    tagline: 'Pemantauan cerdas untuk pabrik yang lebih cerdas',
    brandMark: 'PI',
    brandTitle: 'Informasi Pabrik',
    brandSub: 'Dasbor',
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
    throughput: 'Throughput (massa)',
    approvalRate: 'Tingkat kelulusan lab',
    unavailable: '—',
    period: 'Periode',
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
    gatePeriodNote: 'Angka gerbang mencakup seluruh periode tercetak {period}, bukan rentang tanggal di atas.',
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
  },
}
