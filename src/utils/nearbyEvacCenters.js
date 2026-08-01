const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchWithTimeout(url, ms = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function findNearbySchools(lat, lng, radiusM = 5000) {
  const query = `[out:json][timeout:25];
(
  node["amenity"="school"](around:${radiusM},${lat},${lng});
  way["amenity"="school"](around:${radiusM},${lat},${lng});
);
out center 100;`

  let lastError = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const url = `${endpoint}?data=${encodeURIComponent(query)}`
    try {
      const res = await fetchWithTimeout(url)
      if (!res.ok) throw new Error(`Overpass request failed: ${res.status}`)
      const data = await res.json()
      return (data.elements || [])
        .map((el) => {
          const name = el.tags?.name
          const lat2 = el.lat != null ? el.lat : el.center?.lat
          const lng2 = el.lon != null ? el.lon : el.center?.lon
          if (!name || lat2 == null || lng2 == null) return null
          return {
            name,
            lat: Number(lat2),
            lng: Number(lng2),
            address: el.tags?.['addr:street'] || el.tags?.['addr:full'] || '',
            distKm: haversineKm(Number(lat), Number(lng), Number(lat2), Number(lng2)),
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, 10)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('All evacuation center services failed.')
}
