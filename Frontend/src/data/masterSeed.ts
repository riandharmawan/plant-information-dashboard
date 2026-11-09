import type { MasterData } from '../domain/master.ts'

// The plant the Bekasi logsheet data belongs to: PRC PALM & LAURIC BEKASI, DataHub PLT-0087.
const PRISCOLIN = 'prc-palm-lauric-bekasi'

const TANK_CODES = [
  'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08',
  'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16',
  'T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29',
  'BAK CURAH CPO A',
  'BAK CURAH CPO B',
  'BAK CURAH CPO DEPAN',
]

export const MASTER_SEED: MasterData = {
  companies: [
    { id: 'prc-general-ho-jakarta', code: 'PRC-HO', name: 'PRC GENERAL HO JAKARTA' },
  ],
  sites: [
    { id: 'bekasi', companyId: 'prc-general-ho-jakarta', name: 'Bekasi', timezone: 'Asia/Jakarta' },
  ],
  plants: [
    { id: PRISCOLIN, siteId: 'bekasi', name: 'PRC PALM & LAURIC BEKASI', logsheetPeriod: '2026-07-22 – 2026-10-19' },
  ],
  commodities: [
    { id: 'cpo', code: 'CPO', name: 'Crude palm oil' },
    { id: 'rpl', code: 'RPL', name: 'RPL' },
    { id: 'rpol', code: 'RPOL', name: 'RPOL' },
    { id: 'rpo', code: 'RPO', name: 'Refined palm oil' },
    { id: 'rps', code: 'RPS', name: 'Refined palm stearin' },
    { id: 'olein', code: 'OLEIN', name: 'Palm olein' },
    { id: 'pfad', code: 'PFAD', name: 'Palm fatty acid distillate' },
    { id: 'pmf', code: 'PMF', name: 'Palm mid fraction' },
    { id: 'sludge', code: 'SLUDGE', name: 'Sludge' },
  ],
  tanks: TANK_CODES.map((code) => ({
    id: `tank-${code.toLowerCase().replace(/\s+/g, '-')}`,
    plantId: PRISCOLIN,
    code,
    capacity: '',
    capacityUnit: '',
  })),
}
