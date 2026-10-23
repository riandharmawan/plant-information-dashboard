function trunc2(value) {
  return Math.trunc(value * 100) / 100
}

function kilograms(value) {
  const sign = value < 0 ? -1 : 1
  return (sign * Math.floor(Math.abs(value) * 100 + 1e-8)) / 100
}

function lookupVolume(pairs, key, approximate) {
  const roundedKey = Math.round(key * 100) / 100
  if (!approximate) {
    const hit = pairs.find(([height]) => Math.abs(height - roundedKey) < 0.0005)
    return hit ? hit[1] : null
  }
  let best = null
  for (const pair of pairs) {
    if (pair[0] <= roundedKey + 0.0005 && (best == null || pair[0] > best[0])) best = pair
  }
  return best ? best[1] : null
}

function lookupDensity(tables, group, tempC) {
  if (!group) return null
  const hit = tables[group]?.find(([temp]) => temp === tempC)
  return hit ? hit[1] : null
}

function soundingTotalMm(profile, levelM, method) {
  const normalized = method.trim().toLowerCase().replace(/\s+/g, ' ')
  const soundingMm = Math.round(levelM * 1000)
  if (normalized === 'isi lk' || normalized === 'isi lkr') return soundingMm + profile.dipOffsetMm
  if (normalized === 'isi lb') return soundingMm
  if (normalized === 'k lk' && profile.ullageLkMm != null) return profile.ullageLkMm - soundingMm
  if (normalized === 'k lb' && profile.ullageLbMm != null) return profile.ullageLbMm - soundingMm
  return null
}

function quantityKg(profile, tables, levelM, tempC, method) {
  const normalized = method.trim().toLowerCase().replace(/\s+/g, ' ')
  if (normalized === 'empty') return 0
  if (levelM == null || tempC == null || profile.tableTempC == null) return null
  if (profile.volume.length === 0) return null
  const totalMm = soundingTotalMm(profile, levelM, method)
  if (totalMm == null) return null
  const tableLiters = lookupVolume(profile.volume, trunc2(totalMm / 1000), profile.volumeApprox)
  if (tableLiters == null) return trunc2(totalMm / 1000) <= 0 ? 0 : null
  const roundedMm = Math.round(totalMm)
  const digit = Math.abs(roundedMm) % 10
  let ring = 0
  if (digit !== 0 && profile.ringVolumes.length > 0) {
    let offset = 0
    for (const band of profile.ringBands) {
      const [low, high, bandOffset] = band
      if (roundedMm >= low && roundedMm <= high) offset += bandOffset
    }
    const index = offset * 10 + digit
    ring = index >= 1 && index <= profile.ringVolumes.length ? (profile.ringVolumes[index - 1] ?? 0) : 0
  }
  const density = lookupDensity(tables, profile.densityGroup, tempC)
  if (density == null) return null
  const factor = 1 + 0.0000348 * (tempC - profile.tableTempC)
  return kilograms((tableLiters + ring) * density * factor)
}

const TONNE_UNITS = new Set(['t', 'ton', 'tons', 'tonne', 'tonnes'])

/** Stock math is in kilograms. kg stays as stored. A tonne is 1,000 kg. Any other unit is not converted. */
export function massToKg(amount, unit) {
  if (amount == null) return null
  const normalized = String(unit ?? 'kg').trim().toLowerCase()
  if (normalized === 'kg') return amount
  if (TONNE_UNITS.has(normalized)) return amount * 1000
  return null
}

export function stockFromProfile(profile, tables, levelM, tempC, method) {
  const quantity = quantityKg(profile, tables, levelM, tempC, method)
  const capacityKg = profile.capacityKg
  if (quantity == null || capacityKg == null || profile.bottomStockKg == null || capacityKg === 0) {
    return {
      capacityKg,
      quantityKg: quantity,
      emptySpaceKg: null,
      loadableKg: null,
      levelRatio: null,
    }
  }
  return {
    capacityKg,
    quantityKg: quantity,
    emptySpaceKg: capacityKg - quantity,
    loadableKg: quantity - profile.bottomStockKg,
    levelRatio: quantity / capacityKg,
  }
}
