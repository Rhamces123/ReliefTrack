import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../context/AuthContext'

function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({ lat: lat.toFixed(5), lon: lng.toFixed(5), format: 'json' })
  return fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { 'User-Agent': 'ReliefTrack/1.0' },
  }).then((r) => r.json()).then((d) => d.display_name || 'Unknown location')
}
import { getUserProfile } from '../firebase/users'
import { subscribeReliefRequests } from '../firebase/requests'
import { searchPhilippinesPlaces } from '../utils/philippinesPlaces'
import DashboardLayout from '../components/DashboardLayout'
import '../styles/MapView.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function markerIcon(status) {
  const color = status === 'completed' ? '#3b82f6' : status === 'in-progress' ? '#22c55e' : '#ef4444'
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 28px; height: 28px;
      background: ${color};
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

const PH_CENTER = [12.8797, 121.7740]

function totalAffected(categories) {
  if (!categories) return 0
  return Object.values(categories).reduce((sum, c) => sum + (Number(c.count) || 0), 0)
}

function MapBounds({ markers }) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) return
    if (markers.length === 1) {
      map.setView(markers[0], 13)
    } else {
      map.fitBounds(L.latLngBounds(markers), { padding: [50, 50] })
    }
  }, [markers, map])
  return null
}

function FlyToSearch({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    if (target.bbox) {
      const bounds = L.latLngBounds(
        [target.bbox.south, target.bbox.west],
        [target.bbox.north, target.bbox.east]
      )
      map.flyToBounds(bounds, { padding: [40, 40], duration: 1.5 })
    } else {
      const zoom = target.zoom || 15
      map.flyTo([target.lat, target.lng], zoom, { duration: 1.5 })
    }
  }, [target, map])
  return null
}

function MapClick({ streetViewRef }) {
  const map = useMap()
  useEffect(() => {
    const handler = async (e) => {
      if (streetViewRef?.current) {
        const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.latlng.lat},${e.latlng.lng}`
        window.open(url, '_blank', 'noopener')
        streetViewRef.current = false
        map.getContainer().style.cursor = ''
        return
      }
      const name = await reverseGeocode(e.latlng.lat, e.latlng.lng)
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<div class="mapview-popup"><h4>${name}</h4><p>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</p></div>`)
        .openOn(map)
    }
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [map, streetViewRef])
  return null
}

export default function MapView() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [geocoded, setGeocoded] = useState([])
  const [geocoding, setGeocoding] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [streetViewActive, setStreetViewActive] = useState(false)
  const streetViewRef = useRef(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [flyTarget, setFlyTarget] = useState(null)
  const [searchBounds, setSearchBounds] = useState(null)
  const searchWrapRef = useRef(null)
  const geocodingRef = useRef(new Set())

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null))
  }, [user?.uid])

  useEffect(() => {
    const unsubscribe = subscribeReliefRequests(
      (data) => { setRequests(data); setLoading(false) },
      () => { setLoading(false) },
      { uid: user.uid, role: profile?.role }
    )
    return unsubscribe
  }, [user?.uid, profile?.role])

  useEffect(() => {
    const toGeocode = requests.filter(
      (r) => r.lat == null && r.location && !geocodingRef.current.has(r.docId)
    )
    if (toGeocode.length === 0) return
    for (const r of toGeocode) geocodingRef.current.add(r.docId)
    setGeocoding(true)
    Promise.allSettled(
      toGeocode.map((r) =>
        searchPhilippinesPlaces(r.location).then((places) => {
          if (places.length > 0) {
            return { docId: r.docId, lat: Number(places[0].lat), lng: Number(places[0].lon) }
          }
          return null
        })
      )
    ).then((results) => {
      const next = []
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) next.push(res.value)
      }
      if (next.length > 0) setGeocoded((prev) => [...prev, ...next])
      setGeocoding(false)
    })
  }, [requests])



  const markers = []
  const markerPositions = []
  for (const r of requests) {
    let lat = r.lat
    let lng = r.lng
    if (lat == null) {
      const g = geocoded.find((g) => g.docId === r.docId)
      if (g) { lat = g.lat; lng = g.lng }
    }
    if (lat != null) {
      markers.push({ ...r, lat: Number(lat), lng: Number(lng) })
      markerPositions.push([Number(lat), Number(lng)])
    }
  }

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const email = profile?.email || user?.email || ''

  return (
    <DashboardLayout title="Map View" userLabel={displayName} userEmail={email}>
      <div className="mapview-container">
        <div className="mapview-header">
          <div className="mapview-stats">
            <span>Total Requests: <strong>{requests.length}</strong></span>
            <span>On Map: <strong>{markers.length}</strong></span>
            {geocoding && <span className="mapview-geocoding">Geocoding locations...</span>}
          </div>
          <div className="mapview-legend">
            <span><span className="legend-dot pending" /> Not Yet Assessed</span>
            <span><span className="legend-dot inprogress" /> Not Yet Received Relief</span>
            <span><span className="legend-dot completed" /> Already Received Relief</span>
          </div>
          <div className="mapview-search" ref={searchWrapRef}>
            <input
              className="mapview-search-input"
              type="text"
              placeholder="Search location (press Enter)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const q = searchQuery.trim()
                  if (q.length < 2) return
                  const places = await searchPhilippinesPlaces(q)
                  if (places.length > 0) {
                    const p = places[0]
                    setFlyTarget({ lat: Number(p.lat), lng: Number(p.lon), bbox: p.bbox })
                    setSearchBounds(p.bbox ? [[Number(p.bbox.south), Number(p.bbox.west)], [Number(p.bbox.north), Number(p.bbox.east)]] : null)
                  }
                }
              }}
            />
          </div>
          <button className="mapview-toggle" onClick={() => setSatellite((s) => !s)}>
            {satellite ? '🗺️ Street' : '🛰️ Satellite'}
          </button>
          <button
            className={`mapview-toggle ${streetViewActive ? 'active' : ''}`}
            onClick={() => {
              const next = !streetViewActive
              setStreetViewActive(next)
              streetViewRef.current = next
            }}
          >
            🏙️ Street View
          </button>
        </div>
        {loading ? (
          <div className="mapview-loading">Loading map...</div>
        ) : (
          <div className={`mapview-map-wrap${streetViewActive ? ' mapview-sv-active' : ''}`}>
            <MapContainer center={PH_CENTER} zoom={6} className="mapview-map" scrollWheelZoom={true}>
              {satellite ? (
                <>
                  <TileLayer
                    attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"
                    opacity={0.8}
                  />
                </>
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              )}
              <FlyToSearch target={flyTarget} />
              <MapClick streetViewRef={streetViewRef} />
              <MapBounds markers={markerPositions} />
              {markers.map((m) => (
                <Marker
                  key={m.docId}
                  position={[m.lat, m.lng]}
                  icon={markerIcon(m.status)}
                >
                  <Popup>
                    <div className="mapview-popup">
                      <h4>{m.requesterName || 'Unknown'}</h4>
                      <p className="mapview-popup-location">{m.location}</p>
                       <p>Status: <strong style={{ color: m.status === 'completed' ? '#3b82f6' : m.status === 'in-progress' ? '#22c55e' : '#ef4444' }}>{m.status === 'completed' ? 'Already Received' : m.status === 'in-progress' ? 'Not Yet Received' : 'Not Yet Assessed'}</strong></p>
                      {m.familyMembers > 0 && <p>Family Members: {m.familyMembers}</p>}
                      {totalAffected(m.categories) > 0 && <p>Affected: {totalAffected(m.categories)}</p>}
                      {m.description && <p className="mapview-popup-desc">{m.description}</p>}
                      <a
                        href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${m.lat},${m.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mapview-streetview"
                      >
                        🏙️ Street View
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {searchBounds && (
                <Rectangle bounds={searchBounds} pathOptions={{ color: '#1a73e8', weight: 3, fill: false }} />
              )}
            </MapContainer>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}