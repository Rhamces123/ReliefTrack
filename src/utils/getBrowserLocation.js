let cachedPromise = null

export function requestBrowserLocation() {
  if (!navigator.geolocation) return Promise.resolve('')
  if (cachedPromise) return cachedPromise
  cachedPromise = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: false }
    )
  })
  return cachedPromise
}

export async function getBrowserLocation() {
  const coords = await requestBrowserLocation()
  if (!coords) return ''
  const { latitude, longitude } = coords
  const params = new URLSearchParams({ lat: latitude, lon: longitude, format: 'json' })
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'ReliefTrack/1.0 (auto location)' },
  })
  if (!res.ok) return ''
  const data = await res.json()
  return data?.display_name || ''
}
