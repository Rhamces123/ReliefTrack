import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { searchPhilippinesPlaces } from '../utils/philippinesPlaces'
import { updateReliefRequestCoordinates } from '../firebase/requests'

const NAGA_CENTER = [10.2085, 123.7591]

function miniMarkerIcon(status) {
  const color = status === 'completed' ? '#3b82f6' : status === 'in-progress' ? '#22c55e' : '#ef4444'
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 24px; height: 24px;
        background: ${color};
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.38);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 7px; height: 7px; background: #ffffff; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function MiniMapController({ center }) {
  const map = useMap()
  useEffect(() => {
    if (!center) return
    map.setView(center, 15)
    const t = setTimeout(() => {
      map.invalidateSize()
    }, 250)
    return () => clearTimeout(t)
  }, [center, map])
  return null
}

export default function RequestMiniMap({ request, onOpenMap }) {
  const [coords, setCoords] = useState(() => {
    if (request?.lat != null && request?.lng != null) {
      return { lat: Number(request.lat), lng: Number(request.lng) }
    }
    return null
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (request?.lat != null && request?.lng != null) {
      setCoords({ lat: Number(request.lat), lng: Number(request.lng) })
      return
    }

    if (!request?.location?.trim()) {
      setCoords({ lat: NAGA_CENTER[0], lng: NAGA_CENTER[1] })
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
        } else {
          setCoords({ lat: NAGA_CENTER[0], lng: NAGA_CENTER[1] })
        }
      })
      .catch(() => {
        if (isMounted) {
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

  return (
    <div className="requests-detail-section requests-detail-map-section">
      <div className="requests-detail-section-title requests-minimap-header">
        <span>Location Map</span>
        <span className="requests-minimap-subhint">Click to direct to View Map</span>
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
        title="Click to view this location in View Map"
      >
        <MapContainer
          key={`${centerPos[0]}-${centerPos[1]}`}
          center={centerPos}
          zoom={15}
          className="requests-minimap"
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
            <span>Locating address...</span>
          </div>
        )}

        <div className="requests-minimap-overlay">
          <div className="requests-minimap-badge">
            <span className="requests-minimap-badge-icon">🗺️</span>
            <span className="requests-minimap-badge-text">View in View Map ↗</span>
          </div>
          {request?.location && (
            <div className="requests-minimap-loc-pill" title={request.location}>
              📍 {request.location}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
