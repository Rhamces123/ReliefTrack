import nagaGeoJSON from './nagaBoundary.js'

const NAGA_POLYGON = nagaGeoJSON.features[0].geometry.coordinates[0]

function isInsideNaga(lat, lng) {
  const x = lng
  const y = lat
  let inside = false
  for (let i = 0, j = NAGA_POLYGON.length - 1; i < NAGA_POLYGON.length; j = i++) {
    const xi = NAGA_POLYGON[i][0]
    const yi = NAGA_POLYGON[i][1]
    const xj = NAGA_POLYGON[j][0]
    const yj = NAGA_POLYGON[j][1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const CACHE_KEY = 'relieftrack_evac_cache_v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const ENDPOINT_TIMEOUT_MS = 8000

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

function cacheKey(lat, lng) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

function readCache(lat, lng) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    const entry = cache[cacheKey(lat, lng)]
    if (!entry) return null
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
    return entry.schools
  } catch {
    return null
  }
}

function writeCache(lat, lng, schools) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const cache = raw ? JSON.parse(raw) : {}
    cache[cacheKey(lat, lng)] = { timestamp: Date.now(), schools }
    if (Object.keys(cache).length > 50) {
      const keys = Object.keys(cache)
      for (const k of keys.slice(0, keys.length - 50)) delete cache[k]
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore storage errors */
  }
}

async function fetchWithTimeout(url, ms = ENDPOINT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function findNearbySchools(lat, lng, radiusM = 5000) {
  const cached = readCache(lat, lng)
  if (cached) return cached

  const query = `[out:json][timeout:10];
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
      const schools = (data.elements || [])
        .map((el) => {
          const name = el.tags?.name
          const lat2 = el.lat != null ? el.lat : el.center?.lat
          const lng2 = el.lon != null ? el.lon : el.center?.lon
          if (!name || lat2 == null || lng2 == null) return null
          if (!isInsideNaga(Number(lat2), Number(lng2))) return null
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
      writeCache(lat, lng, schools)
      return schools
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('All evacuation center services failed.')
}

const ALL_SCHOOLS_CACHE_KEY = 'relieftrack_all_schools_naga_v2'
const ALL_SCHOOLS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function readAllSchoolsCache() {
  try {
    const raw = localStorage.getItem(ALL_SCHOOLS_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    if (Date.now() - cache.timestamp > ALL_SCHOOLS_CACHE_TTL_MS) return null
    return cache.schools
  } catch {
    return null
  }
}

function writeAllSchoolsCache(schools) {
  try {
    localStorage.setItem(ALL_SCHOOLS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      schools
    }))
  } catch {
    /* ignore storage errors */
  }
}

export async function findAllSchoolsInNaga() {
  const cached = readAllSchoolsCache()
  if (cached) return cached

  // NAGA_BOUNDS: [10.13, 123.65, 10.32, 123.79] -> south, west, north, east
  const query = `[out:json][timeout:25];
(
  node["amenity"="school"](10.13,123.65,10.32,123.79);
  way["amenity"="school"](10.13,123.65,10.32,123.79);
);
out center;`

  let lastError = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const url = `${endpoint}?data=${encodeURIComponent(query)}`
    try {
      const res = await fetchWithTimeout(url, 30000)
      if (!res.ok) throw new Error(`Overpass request failed: ${res.status}`)
      const data = await res.json()
      const schools = (data.elements || [])
        .map((el) => {
          const name = el.tags?.name
          const lat2 = el.lat != null ? el.lat : el.center?.lat
          const lng2 = el.lon != null ? el.lon : el.center?.lon
          if (!name || lat2 == null || lng2 == null) return null
          if (!isInsideNaga(Number(lat2), Number(lng2))) return null
          return {
            name,
            lat: Number(lat2),
            lng: Number(lng2),
            address: el.tags?.['addr:street'] || el.tags?.['addr:full'] || '',
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
      writeAllSchoolsCache(schools)
      return schools
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('All school services failed.')
}
