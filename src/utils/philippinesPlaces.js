/**
 * OpenStreetMap Nominatim search — worldwide.
 * Used when Google Places is unavailable (API key / billing / referrer issues).
 */
export async function searchPhilippinesPlaces(query) {
  const trimmed = query?.trim()
  if (!trimmed || trimmed.length < 2) return []

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    countrycodes: 'ph',
    addressdetails: '0',
    limit: '8',
  })

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ReliefTrack/1.0 (relief request location search)',
      },
    }
  )

  if (!res.ok) {
    throw new Error('Place search is temporarily unavailable.')
  }

  const data = await res.json()
  return data.map((item) => ({
    displayName: item.display_name,
    lat: item.lat,
    lon: item.lon,
    bbox: item.boundingbox ? { south: Number(item.boundingbox[0]), north: Number(item.boundingbox[1]), west: Number(item.boundingbox[2]), east: Number(item.boundingbox[3]) } : null,
  }))
}
