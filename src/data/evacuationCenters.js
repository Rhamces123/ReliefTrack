const EVACUATION_CENTERS = [
  {
    id: 'enan-chiong',
    name: 'Enan Chiong Activity Center',
    barangay: 'Central',
    lat: 10.2089,
    lng: 123.7588,
    capacity: 500,
    type: 'activity-center',
  },
  {
    id: 'naga-central-school',
    name: 'Naga Central Elementary School',
    barangay: 'East Poblacion',
    lat: 10.2102,
    lng: 123.7625,
    capacity: 400,
    type: 'school',
  },
  {
    id: 'naga-national-high-school',
    name: 'Naga National High School',
    barangay: 'West Poblacion',
    lat: 10.2055,
    lng: 123.7530,
    capacity: 450,
    type: 'school',
  },
  {
    id: 'naalad-elem-school',
    name: 'Naalad Elementary School',
    barangay: 'Naalad',
    lat: 10.2000,
    lng: 123.7710,
    capacity: 300,
    type: 'school',
  },
  {
    id: 'apo-cemet-gym',
    name: 'Apo Cement Gymnasium',
    barangay: 'Tinaan',
    lat: 10.1945,
    lng: 123.7490,
    capacity: 600,
    type: 'gymnasium',
  },
  {
    id: 'colon-elem-school',
    name: 'Colon Elementary School',
    barangay: 'Colon',
    lat: 10.2200,
    lng: 123.7650,
    capacity: 250,
    type: 'school',
  },
  {
    id: 'san-fernando-complex',
    name: 'San Fernando Complex',
    barangay: 'San Fernando',
    lat: 10.1900,
    lng: 123.7400,
    capacity: 350,
    type: 'complex',
  },
  {
    id: 'naga-sports-complex',
    name: 'Naga Sports Center',
    barangay: 'Central',
    lat: 10.2072,
    lng: 123.7558,
    capacity: 700,
    type: 'sports',
  },
  {
    id: 'tinago-covered-court',
    name: 'Tinago Barangay Covered Court',
    barangay: 'Tinago',
    lat: 10.2150,
    lng: 123.7700,
    capacity: 200,
    type: 'covered-court',
  },
  {
    id: 'mormons-church',
    name: 'Mormons Church (LDS)',
    barangay: 'Central',
    lat: 10.2070,
    lng: 123.7570,
    capacity: 150,
    type: 'church',
  },
]

export default EVACUATION_CENTERS

export function getNearestEvacuation(lat, lng) {
  let nearest = null
  let minDist = Infinity
  for (const c of EVACUATION_CENTERS) {
    const d = haversine(lat, lng, c.lat, c.lng)
    if (d < minDist) {
      minDist = d
      nearest = { ...c, distanceKm: d }
    }
  }
  return nearest
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function getRoute(startLat, startLng, endLat, endLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true&alternatives=false`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch route')
  const data = await res.json()
  if (!data.routes || data.routes.length === 0) throw new Error('No route found')
  const route = data.routes[0]
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  }
}
