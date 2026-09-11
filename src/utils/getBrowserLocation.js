let cachedPromise = null

export function requestBrowserLocation() {
  if (typeof window === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  if (cachedPromise) return cachedPromise
  cachedPromise = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true }
    )
  })
  return cachedPromise
}

async function getIpLocationFallback() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
    if (res.ok) {
      const d = await res.json()
      const parts = [d.city, d.region, d.country_name].filter(Boolean)
      if (parts.length > 0) return parts.join(', ')
    }
  } catch {
    // ignore
  }
  return ''
}

export async function getBrowserLocation() {
  try {
    const coords = await requestBrowserLocation()
    if (coords) {
      const { latitude, longitude } = coords
      const params = new URLSearchParams({
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: '1',
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'ReliefTrack/1.0 (auto location)' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        const addr = data?.address
        if (addr) {
          const barangay = addr.suburb || addr.village || addr.neighbourhood || addr.quarter || ''
          const city = addr.city || addr.town || addr.municipality || ''
          const province = addr.province || addr.state || ''
          const parts = [barangay ? `Brgy. ${barangay}` : '', city, province].filter(Boolean)
          if (parts.length >= 2) return parts.join(', ')
        }
        if (data?.display_name) {
          return data.display_name.split(',').slice(0, 3).map((s) => s.trim()).join(', ')
        }
      }
    }
  } catch {
    // fallback
  }

  const ipLoc = await getIpLocationFallback()
  return ipLoc || ''
}

