import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, ExternalLink, Map } from 'lucide-react'
import { searchPhilippinesPlaces } from '../utils/philippinesPlaces'
import { updateReliefRequestCoordinates } from '../firebase/requests'

const NAGA_CENTER = [10.2085, 123.7591]

const NAGA_BARANGAYS = {
  alpaco: [10.245, 123.69],
  bairan: [10.198, 123.72],
  balirong: [10.222, 123.748],
  cabungahan: [10.214, 123.721],
  'cantao-an': [10.238, 123.745],
  cantaoan: [10.238, 123.745],
  central: [10.2075, 123.7585],
  cogon: [10.27, 123.73],
  colon: [10.219, 123.761],
  inayagan: [10.235, 123.768],
  inoburan: [10.189, 123.74],
  langtad: [10.17, 123.742],
  lutac: [10.24, 123.725],
  mainit: [10.217, 123.732],
  mayana: [10.255, 123.705],
  naalad: [10.2095, 123.744],
  pangdan: [10.25, 123.735],
  patag: [10.23, 123.695],
  poblacion: [10.2075, 123.7585],
  'south poblacion': [10.205, 123.757],
  'north poblacion': [10.21, 123.759],
  tagjaguimit: [10.26, 123.682],
  tangke: [10.201, 123.754],
  tinaan: [10.215, 123.752],
  tuyan: [10.226, 123.766],
  uling: [10.28, 123.715],
}

function getKnownBarangayCoords(location) {
  if (!location) return null
  const locLower = location.toLowerCase()
  for (const [brgy, coords] of Object.entries(NAGA_BARANGAYS)) {
    if (locLower.includes(brgy)) {
      return { lat: coords[0], lng: coords[1] }
    }
  }
  return null
}

function miniMarkerIcon(status) {
  const color = status === 'completed' ? '#10B981' : status === 'in-progress' ? '#3B82F6' : '#EF4444'
  const glow = status === 'completed' ? 'rgba(16, 185, 129, 0.45)' : status === 'in-progress' ? 'rgba(59, 130, 246, 0.45)' : 'rgba(239, 68, 68, 0.45)'
  return L.divIcon({
    className: 'custom-minimap-marker',
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: ${color};
          opacity: 0.35;
          animation: minimap-pulse 2s infinite ease-out;
        "></div>
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          background: ${color};
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 3px 10px ${glow};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 7px; height: 7px; background: #ffffff; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function MiniMapController({ center }) {
  const map = useMap()
  useEffect(() => {
    if (!center) return
    map.setView(center, 15)
    const t1 = setTimeout(() => map.invalidateSize(), 150)
    const t2 = setTimeout(() => map.invalidateSize(), 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [center, map])
  return null
}

export default function RequestMiniMap({ request, onOpenMap }) {
  const [coords, setCoords] = useState(() => {
    if (request?.lat != null && request?.lng != null) {
      return { lat: Number(request.lat), lng: Number(request.lng) }
    }
    const fallback = getKnownBarangayCoords(request?.location)
    if (fallback) return fallback
    return null
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (request?.lat != null && request?.lng != null) {
      setCoords({ lat: Number(request.lat), lng: Number(request.lng) })
      return
    }

    const fallback = getKnownBarangayCoords(request?.location)
    if (fallback) {
      setCoords(fallback)
    }

    if (!request?.location?.trim()) {
      if (!fallback) {
        setCoords({ lat: NAGA_CENTER[0], lng: NAGA_CENTER[1] })
      }
      return
    }

    let isMounted = true
    setLoading(true)

    searchPhilippinesPlaces(request.location)
      .then((places) => {
        if (!isMounted) return
        if (places && places.length > 0) {
          const newCoords = { lat: Number(places[0].lat), lng: Number(places[0].lon) }
          setCoords(newCoords)
          if (request.docId) {
            updateReliefRequestCoordinates(request.docId, newCoords.lat, newCoords.lng).catch(() => {})
          }
        } else if (!fallback) {
          setCoords({ lat: NAGA_CENTER[0], lng: NAGA_CENTER[1] })
        }
      })
      .catch(() => {
        if (isMounted && !fallback) {
          setCoords({ lat: NAGA_CENTER[0], lng: NAGA_CENTER[1] })
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [request?.docId, request?.lat, request?.lng, request?.location])

  const centerPos = coords ? [coords.lat, coords.lng] : NAGA_CENTER

  const handleClick = (e) => {
    e.stopPropagation()
    onOpenMap?.({
      docId: request?.docId,
      lat: coords?.lat ?? NAGA_CENTER[0],
      lng: coords?.lng ?? NAGA_CENTER[1],
      requesterName: request?.requesterName,
      location: request?.location,
      status: request?.status,
    })
  }

  const statusLabel =
    request?.status === 'completed'
      ? 'Completed Relief'
      : request?.status === 'in-progress'
      ? 'In Transit / Dispatch'
      : 'Pending Relief Aid'

  const statusDotColor =
    request?.status === 'completed' ? '#10B981' : request?.status === 'in-progress' ? '#3B82F6' : '#EF4444'

  return (
    <div className="requests-detail-section requests-detail-map-section">
      <div className="requests-minimap-header-row">
        <div className="requests-minimap-title-wrap">
          <MapPin size={15} />
          <span>Location Map</span>
        </div>
        <button
          type="button"
          className="requests-minimap-view-link"
          onClick={handleClick}
          title="Open in full Relief Operations Map"
        >
          <span>Open Full Map</span>
          <ExternalLink size={13} />
        </button>
      </div>

      <div
        className="requests-minimap-card"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e)
          }
        }}
        title="Click to view this location in full Relief Operations Map"
      >
        <MapContainer
          key={`${centerPos[0]}-${centerPos[1]}`}
          center={centerPos}
          zoom={15}
          className="requests-minimap"
          style={{ width: '100%', height: '210px', borderRadius: '10px', zIndex: 1 }}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={centerPos} icon={miniMarkerIcon(request?.status)} />
          <MiniMapController center={centerPos} />
        </MapContainer>

        {loading && (
          <div className="requests-minimap-loading-bar">
            <span>Locating address coordinates...</span>
          </div>
        )}

        {/* Floating Top Badge */}
        <div className="requests-minimap-top-badge">
          <span className="minimap-badge-status-dot" style={{ background: statusDotColor }} />
          <span>{statusLabel}</span>
        </div>

        {/* Floating Bottom Card */}
        <div className="requests-minimap-bottom-overlay">
          <div className="requests-minimap-address">
            <span className="minimap-pin-icon">📍</span>
            <span className="minimap-address-text" title={request?.location}>
              {request?.location || 'City of Naga, Cebu'}
            </span>
          </div>
          <div className="requests-minimap-click-hint">
            <span>Open Map</span>
            <ExternalLink size={11} />
          </div>
        </div>

        {/* Hover Curtain */}
        <div className="requests-minimap-hover-curtain">
          <div className="minimap-hover-pill">
            <Map size={15} />
            <span>Click to View on Full Operations Map ↗</span>
          </div>
        </div>
      </div>
    </div>
  )
}
