import { useRef, useCallback, useState, useEffect } from 'react'
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api'
import { searchPhilippinesPlaces } from '../utils/philippinesPlaces'

const libraries = ['places']

const autocompleteOptions = {
  componentRestrictions: { country: 'ph' },
  fields: ['formatted_address', 'name', 'geometry'],
}

function FallbackInput({ id, value, onChange, disabled, placeholder, hint }) {
  return (
    <div className="location-autocomplete-wrap">
      <input
        id={id}
        type="text"
        className="location-autocomplete-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
      />
      {hint && <p className="location-autocomplete-hint">{hint}</p>}
    </div>
  )
}

function NominatimLocationInput({
  id,
  value,
  onChange,
  onCoordChange,
  disabled,
  placeholder,
  hint,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSuggestions([])
      setLoading(false)
      /* eslint-enable react-hooks/set-state-in-effect */
      return
    }

    setLoading(true)
    const timer = setTimeout(() => {
      searchPhilippinesPlaces(trimmed)
        .then((results) => {
          setSuggestions(results)
          setOpen(true)
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false))
    }, 400)

    return () => clearTimeout(timer)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (displayName, lat, lng) => {
    onChange(displayName)
    onCoordChange?.({ lat, lng })
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div className="location-autocomplete-wrap" ref={wrapRef}>
      <input
        id={id}
        type="text"
        className="location-autocomplete-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        required
        disabled={disabled}
        autoComplete="off"
      />
      {loading && (
        <p className="location-autocomplete-hint">Searching places...</p>
      )}
      {open && suggestions.length > 0 && (
        <ul className="location-suggestions-list" role="listbox">
          {suggestions.map((place) => (
            <li key={`${place.lat}-${place.lon}`}>
              <button
                type="button"
                className="location-suggestion-item"
                onClick={() => handleSelect(place.displayName, Number(place.lat), Number(place.lon))}
              >
                {place.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="location-autocomplete-hint">{hint}</p>}
    </div>
  )
}

function LocationAutocompleteGoogle({
  id,
  value,
  onChange,
  onCoordChange,
  disabled,
  placeholder,
  apiKey,
  useNominatimFallback,
  onAuthFailure,
}) {
  const autocompleteRef = useRef(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
  })

  useEffect(() => {
    if (loadError) onAuthFailure()
  }, [loadError, onAuthFailure])

  useEffect(() => {
    const previous = window.gm_authFailure
    window.gm_authFailure = () => {
      onAuthFailure()
    }
    return () => {
      window.gm_authFailure = previous
    }
  }, [onAuthFailure])

  const onLoad = useCallback((autocomplete) => {
    autocompleteRef.current = autocomplete
  }, [])

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    const text = place?.formatted_address || place?.name || ''
    if (text) {
      onChange(text)
      const loc = place?.geometry?.location
      if (loc?.lat && loc?.lng) {
        onCoordChange?.({ lat: loc.lat(), lng: loc.lng() })
      }
    }
  }, [onChange, onCoordChange])

  if (useNominatimFallback) {
    return (
      <NominatimLocationInput
        id={id}
        value={value}
        onChange={onChange}
        onCoordChange={onCoordChange}
        disabled={disabled}
        placeholder={placeholder}
        hint="Google Places unavailable — enable Places API & billing in Google Cloud Console."
      />
    )
  }

  if (loadError) {
    return (
      <NominatimLocationInput
        id={id}
        value={value}
        onChange={onChange}
        onCoordChange={onCoordChange}
        disabled={disabled}
        placeholder={placeholder}
      />
    )
  }

  if (!isLoaded) {
    return (
      <FallbackInput
        id={id}
        value={value}
        onChange={onChange}
        disabled={true}
        placeholder="Loading place suggestions..."
      />
    )
  }

  return (
    <div className="location-autocomplete-wrap">
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={autocompleteOptions}
      >
        <input
          id={id}
          type="text"
          className="location-autocomplete-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          disabled={disabled}
          autoComplete="off"
        />
      </Autocomplete>
    </div>
  )
}

export default function LocationAutocomplete({
  id = 'location',
  value,
  onChange,
  onCoordChange,
  disabled = false,
  placeholder = 'e.g. Barangay Mabolo, Naga City',
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const [useNominatimFallback, setUseNominatimFallback] = useState(false)

  const handleAuthFailure = useCallback(() => {
    setUseNominatimFallback(true)
  }, [])

  if (!apiKey) {
    return (
      <NominatimLocationInput
        id={id}
        value={value}
        onChange={onChange}
        onCoordChange={onCoordChange}
        disabled={disabled}
        placeholder={placeholder}
        hint="Set VITE_GOOGLE_MAPS_API_KEY in .env to enable Google Places."
      />
    )
  }

  return (
    <LocationAutocompleteGoogle
      id={id}
      value={value}
      onChange={onChange}
      onCoordChange={onCoordChange}
      disabled={disabled}
      placeholder={placeholder}
      apiKey={apiKey}
      useNominatimFallback={useNominatimFallback}
      onAuthFailure={handleAuthFailure}
    />
  )
}
