import { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Rectangle, GeoJSON, Polyline, useMap } from 'react-leaflet'
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
import { subscribeReliefRequests, updateReliefRequestCoordinates } from '../firebase/requests'
import { searchPhilippinesPlaces, searchPlaces } from '../utils/philippinesPlaces'
import nagaGeoJSON from '../utils/nagaBoundary'
import EVACUATION_CENTERS, { getNearestEvacuation, getRoute, haversine } from '../data/evacuationCenters'
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

const evacIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 34px; height: 34px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: 3px solid #fff;
    border-radius: 8px 8px 8px 0;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transform: rotate(0deg);
  ">🏠</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 30],
  popupAnchor: [0, -34],
})

const NAGA_BOUNDS = L.latLngBounds([10.0485, 123.5991], [10.3685, 123.9191])
const NAGA_CENTER = [10.2085, 123.7591]

const geoIcon = L.divIcon({
  className: '',
  html: '<div style="width:24px;height:24px;background:#1a73e8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"><div style="width:10px;height:10px;background:#fff;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"></div></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function BindBounds() {
  const map = useMap()
  useEffect(() => {
    map.setMaxBounds(NAGA_BOUNDS)
    map.fitBounds(NAGA_BOUNDS, { padding: [20, 20] })
  }, [map])
  return null
}

function LocateMe({ trigger, onLocated }) {
  const map = useMap()
  useEffect(() => {
    if (!trigger) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        map.flyTo([latitude, longitude], 15, { duration: 1.5 })
        onLocated?.(latitude, longitude)
      },
      () => {},
      { timeout: 10000, enableHighAccuracy: true }
    )
  }, [trigger, map, onLocated])
  return null
}

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

function FlyToSearch({ target, onDone }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const flyOptions = { duration: 2, easeLinearity: 0.25 }
    if (target.bbox) {
      const bounds = L.latLngBounds(
        [target.bbox.south, target.bbox.west],
        [target.bbox.north, target.bbox.east]
      )
      map.flyToBounds(bounds, { padding: [60, 60], ...flyOptions })
    } else {
      map.flyTo([target.lat, target.lng], 16, flyOptions)
    }
    map.once('moveend', () => onDone?.())
  }, [target, map, onDone])
  return null
}

function MapClick({ streetViewRef, onStreetViewDone }) {
  const map = useMap()
  useEffect(() => {
    const handler = async (e) => {
      if (streetViewRef?.current) {
        const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.latlng.lat},${e.latlng.lng}`
        window.open(url, '_blank', 'noopener')
        streetViewRef.current = false
        map.getContainer().style.cursor = ''
        onStreetViewDone?.()
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
  }, [map, streetViewRef, onStreetViewDone])
  return null
}

function FitRoute({ routeCoords }) {
  const map = useMap()
  useEffect(() => {
    if (!routeCoords || routeCoords.length < 2) return
    const bounds = L.latLngBounds(routeCoords)
    map.fitBounds(bounds, { padding: [60, 60] })
  }, [routeCoords, map])
  return null
}

function MapCenterTracker({ onCenter }) {
  const map = useMap()
  useEffect(() => {
    const handler = () => onCenter(map.getCenter())
    handler()
    map.on('moveend', handler)
    return () => map.off('moveend', handler)
  }, [map, onCenter])
  return null
}

const MAX_EVAC_KM = 5

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
  const [locateTrigger, setLocateTrigger] = useState(0)
  const [geoPosition, setGeoPosition] = useState(null)
  const [searchResult, setSearchResult] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const searchWrapRef = useRef(null)
  const geocodingRef = useRef(new Set())
  const savedCoordsRef = useRef(new Set())
  const [routeCoords, setRouteCoords] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [routingId, setRoutingId] = useState(null)
  const [showEvac, setShowEvac] = useState(false)
  const [mapCenter, setMapCenter] = useState(null)

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
        if (res.status === 'fulfilled' && res.value) {
          const v = res.value
          next.push(v)
          if (!savedCoordsRef.current.has(v.docId)) {
            savedCoordsRef.current.add(v.docId)
            updateReliefRequestCoordinates(v.docId, v.lat, v.lng).catch(() => {})
          }
        }
      }
      if (next.length > 0) setGeocoded((prev) => [...prev, ...next])
      setGeocoding(false)
    })
  }, [requests])

  const handleLocated = useCallback((lat, lng) => {
    setGeoPosition({ lat, lng })
  }, [])

  const handleFindEvac = useCallback(async (lat, lng, docId) => {
    const nearest = getNearestEvacuation(lat, lng)
    if (!nearest) return
    setRoutingId(docId)
    setRouteInfo({ ...nearest, status: 'routing' })
    try {
      const route = await getRoute(lat, lng, nearest.lat, nearest.lng)
      setRouteCoords(route.coordinates)
      setRouteInfo({ ...nearest, status: 'ready', distanceKm: route.distanceKm, durationMin: route.durationMin })
    } catch {
      setRouteInfo({ ...nearest, status: 'error' })
    }
  }, [])

  const clearRoute = useCallback(() => {
    setRouteCoords(null)
    setRouteInfo(null)
    setRoutingId(null)
  }, [])

  const handleToggleEvac = useCallback(() => {
    setShowEvac((s) => !s)
  }, [])

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

  const refLat = geoPosition?.lat ?? mapCenter?.lat ?? NAGA_CENTER[0]
  const refLng = geoPosition?.lng ?? mapCenter?.lng ?? NAGA_CENTER[1]
  const nearbyEvacCenters = useMemo(
    () => EVACUATION_CENTERS.filter((ec) => haversine(refLat, refLng, ec.lat, ec.lng) <= MAX_EVAC_KM),
    [refLat, refLng]
  )

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
            <span><span className="legend-dot evac" /> Evacuation Center</span>
            <span><span className="legend-dot route" /> Route</span>
          </div>
          <div className="mapview-search" ref={searchWrapRef}>
            <input
              className="mapview-search-input"
              type="text"
              placeholder="Search location (press Enter)..."
               value={searchQuery}
               onChange={(e) => {
                 setSearchQuery(e.target.value)
                 if (!e.target.value.trim()) {
                   setFlyTarget(null)
                   setSearchBounds(null)
                   setSearchResult(null)
                   setSearchError('')
                 }
               }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const q = searchQuery.trim()
                  if (q.length < 2) return
                  setSearchError('')
                  setSearchResult(null)
                  setSearching(true)
                  try {
                    const places = await searchPlaces(q)
                    if (places.length > 0) {
                      const p = places[0]
                      setFlyTarget({ lat: Number(p.lat), lng: Number(p.lon), bbox: p.bbox })
                      setSearchBounds(p.bbox ? [[Number(p.bbox.south), Number(p.bbox.west)], [Number(p.bbox.north), Number(p.bbox.east)]] : null)
                      setSearchResult({ lat: Number(p.lat), lng: Number(p.lon), name: p.displayName })
                    } else {
                      setSearchError('No results found. Try a different name.')
                    }
                  } catch {
                    setSearchError('Search failed. Please try again.')
                  } finally {
                    setSearching(false)
                  }
                }
              }}
            />
            {searchError && <div className="mapview-search-error">{searchError}</div>}
            {searching && <div className="mapview-searching">Searching...</div>}
          </div>
          <button className="mapview-toggle" onClick={() => setLocateTrigger((t) => t + 1)}>
            📍 My Location
          </button>
          <button className="mapview-toggle" onClick={() => setSatellite((s) => !s)}>
            {satellite ? '🗺️ Street' : '🛰️ Satellite'}
          </button>
          <button
            className={`mapview-toggle ${showEvac ? 'active' : ''}`}
            onClick={handleToggleEvac}
            title={!geoPosition && markers.length === 0 ? 'Click My Location first' : ''}
          >
            🏠 Evac Centers{showEvac ? ` (${nearbyEvacCenters.length})` : ''}
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

        {/* Route info bar */}
        {routeInfo && routeInfo.status === 'routing' && (
          <div className="mapview-route-bar">
            <span>📍 Finding route to {routeInfo.name}...</span>
          </div>
        )}
        {routeInfo && routeInfo.status === 'ready' && (
          <div className="mapview-route-bar mapview-route-bar-ready">
            <span>
              🏠 <strong>{routeInfo.name}</strong> — {routeInfo.distanceKm.toFixed(1)} km · {Math.round(routeInfo.durationMin)} min drive
            </span>
            <button type="button" className="mapview-route-close" onClick={clearRoute}>✕</button>
          </div>
        )}
        {routeInfo && routeInfo.status === 'error' && (
          <div className="mapview-route-bar mapview-route-bar-error">
            <span>Failed to get route. Try again.</span>
            <button type="button" className="mapview-route-close" onClick={clearRoute}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="mapview-loading">Loading map...</div>
        ) : (
          <div className={`mapview-map-wrap${streetViewActive ? ' mapview-sv-active' : ''}`}>
            <MapContainer center={NAGA_CENTER} zoom={13} className="mapview-map" scrollWheelZoom={true}>
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
              <BindBounds />
              <FlyToSearch target={flyTarget} onDone={() => {}} />
              <LocateMe trigger={locateTrigger} onLocated={handleLocated} />
              <MapClick streetViewRef={streetViewRef} onStreetViewDone={() => setStreetViewActive(false)} />
              <MapBounds markers={markerPositions} />
              <FitRoute routeCoords={routeCoords} />
              <MapCenterTracker onCenter={setMapCenter} />

              {/* Relief request markers */}
              {markers.map((m) => (
                <Marker
                  key={m.docId}
                  position={[m.lat, m.lng]}
                  icon={markerIcon(m.status)}
                  eventHandlers={{
                    popupopen: () => handleFindEvac(m.lat, m.lng, m.docId),
                  }}
                >
                  <Popup>
                    <div className="mapview-popup">
                      <h4>{m.requesterName || 'Unknown'}</h4>
                      <p className="mapview-popup-location">{m.location}</p>
                       <p>Status: <strong style={{ color: m.status === 'completed' ? '#3b82f6' : m.status === 'in-progress' ? '#22c55e' : '#ef4444' }}>{m.status === 'completed' ? 'Already Received' : m.status === 'in-progress' ? 'Not Yet Received' : 'Not Yet Assessed'}</strong></p>
                      {m.familyMembers > 0 && <p>Family Members: {m.familyMembers}</p>}
                      {totalAffected(m.categories) > 0 && <p>Affected: {totalAffected(m.categories)}</p>}
                      {m.description && <p className="mapview-popup-desc">{m.description}</p>}
                      <div className="mapview-popup-actions">
                        <a
                          href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${m.lat},${m.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mapview-streetview"
                        >
                          🏙️ Street View
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Evacuation center markers (nearby only) */}
              {showEvac && nearbyEvacCenters.map((ec) => (
                <Marker
                  key={ec.id}
                  position={[ec.lat, ec.lng]}
                  icon={evacIcon}
                  eventHandlers={{
                    click: () => {
                      const nearest = markers.reduce((best, m) => {
                        const d = Math.hypot(m.lat - ec.lat, m.lng - ec.lng)
                        return d < best.dist ? { docId: m.docId, lat: m.lat, lng: m.lng, dist: d } : best
                      }, { docId: null, lat: null, lng: null, dist: Infinity })
                      if (nearest.docId) {
                        handleFindEvac(nearest.lat, nearest.lng, nearest.docId)
                      } else if (geoPosition) {
                        handleFindEvac(geoPosition.lat, geoPosition.lng, 'geo')
                      }
                    },
                  }}
                >
                  <Popup>
                    <div className="mapview-popup mapview-evac-popup">
                      <h4>🏠 {ec.name}</h4>
                      <p>Barangay: {ec.barangay}</p>
                      <p>Capacity: ~{ec.capacity} persons</p>
                      <p>Type: {ec.type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</p>
                      <p>📍 {haversine(refLat, refLng, ec.lat, ec.lng).toFixed(1)} km from your location</p>
                      <div className="mapview-popup-actions">
                        <button
                          type="button"
                          className="mapview-evac-btn"
                          onClick={() => {
                            const nearest = markers.reduce((best, m) => {
                              const d = Math.hypot(m.lat - ec.lat, m.lng - ec.lng)
                              return d < best.dist ? { docId: m.docId, lat: m.lat, lng: m.lng, dist: d } : best
                            }, { docId: null, lat: null, lng: null, dist: Infinity })
                            if (nearest.docId) {
                              handleFindEvac(nearest.lat, nearest.lng, nearest.docId)
                            } else if (geoPosition) {
                              handleFindEvac(geoPosition.lat, geoPosition.lng, 'geo')
                            }
                          }}
                        >
                          🚗 Show route from nearest request
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Route polyline */}
              {routeCoords && routeCoords.length > 1 && (
                <Polyline
                  positions={routeCoords}
                  pathOptions={{ color: '#1a73e8', weight: 5, opacity: 0.85 }}
                />
              )}

              <GeoJSON
                key="naga-boundary"
                data={nagaGeoJSON}
                style={() => ({ color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.04 })}
              />
              {geoPosition && (
                <Marker position={[geoPosition.lat, geoPosition.lng]} icon={geoIcon}>
                  <Popup><div className="mapview-popup"><h4>Your Location</h4><p>{geoPosition.lat.toFixed(5)}, {geoPosition.lng.toFixed(5)}</p></div></Popup>
                </Marker>
              )}
              {searchResult && (
                <Marker position={[searchResult.lat, searchResult.lng]} icon={L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:#1a73e8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:14px">🔍</div>', iconSize: [32, 32], iconAnchor: [16, 16] })}>
                  <Popup><div className="mapview-popup"><h4>Search result</h4><p>{searchResult.name}</p></div></Popup>
                </Marker>
              )}
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
