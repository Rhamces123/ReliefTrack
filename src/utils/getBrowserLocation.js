export async function getBrowserLocation() {
  if (!navigator.geolocation) return ''

  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      enableHighAccuracy: false,
    })
  })

  if (!pos?.coords) return ''

  const { latitude, longitude } = pos.coords
  const params = new URLSearchParams({
    lat: latitude,
    lon: longitude,
    format: 'json',
  })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ReliefTrack/1.0 (auto location)',
      },
    }
  )

  if (!res.ok) return ''
  const data = await res.json()
  return data?.display_name || ''
}
