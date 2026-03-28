// Address autocomplete using OpenStreetMap Nominatim — no API key required.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
// Requests are debounced to respect the 1 req/s rate limit.

import { useEffect, useRef, useState } from 'react'

export interface PlaceResult {
  address_line_1: string
  city: string
  state: string
  postal_code: string
  country: string
}

interface Suggestion {
  display_name: string
  address: {
    amenity?: string
    building?: string
    house_number?: string
    road?: string
    hamlet?: string
    neighbourhood?: string
    suburb?: string
    city_district?: string
    city?: string
    town?: string
    village?: string
    county?: string
    state?: string
    postcode?: string
    country?: string
  }
}

interface Props {
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (result: PlaceResult) => void
  placeholder?: string
  className?: string
  required?: boolean
}

function toPlaceResult(s: Suggestion): PlaceResult {
  const a = s.address

  // Build address_line_1 with three tiers:
  // 1. Street: house_number + road (e.g. "12 MG Road")
  // 2. Locality: neighbourhood / suburb / hamlet (e.g. "Koramangala") — common for Indian area searches
  // 3. Last resort: first segment of display_name (e.g. "Lal Bagh", "Infosys Campus")
  const streetParts = [a.house_number, a.road].filter(Boolean)
  const localityFallback = a.neighbourhood ?? a.suburb ?? a.hamlet ?? ''
  const displayFallback = s.display_name.split(',')[0].trim()
  const address_line_1 = streetParts.length > 0
    ? streetParts.join(' ')
    : (localityFallback || displayFallback)

  // City: prefer proper city/town/village over district/county.
  // Deliberately exclude suburb — that belongs in address_line_1.
  const city = a.city ?? a.town ?? a.village ?? a.city_district ?? a.county ?? ''

  return {
    address_line_1,
    city,
    state:       a.state    ?? '',
    postal_code: a.postcode ?? '',
    country:     a.country  ?? '',
  }
}

export default function PlacesAutocomplete({
  value, onChange, onPlaceSelect, placeholder, className, required,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onPlaceSelect)

  useEffect(() => { onSelectRef.current = onPlaceSelect }, [onPlaceSelect])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleChange(val: string) {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (val.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search')
        url.searchParams.set('q', val)
        url.searchParams.set('format', 'json')
        url.searchParams.set('addressdetails', '1')
        url.searchParams.set('limit', '6')
        url.searchParams.set('countrycodes', 'in')   // bias to India; remove for worldwide

        const res = await fetch(url.toString(), {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'ColoursOfNature/1.0' },
        })
        const data: Suggestion[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      } catch {
        // Network error — silently ignore, user can still type manually
      }
    }, 350)
  }

  function handleSelect(s: Suggestion) {
    const result = toPlaceResult(s)
    // Update the input value first so it reflects the chosen address immediately
    onChange(result.address_line_1)
    // Then fire onPlaceSelect to fill in all other fields (city, state, postal_code, country)
    // onPlaceSelect is called after onChange so the parent's setForm functional updater
    // for address_line_1 sees the value already set by onChange — no double-write conflict.
    onSelectRef.current(result)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        className={className ?? 'form-input'}
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder ?? 'Start typing your street or area…'}
        required={required}
        autoComplete="off"
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {open && (
        <ul className="pac-container" style={{ position: 'absolute', left: 0, right: 0, top: '100%', margin: 0, padding: 0, listStyle: 'none', zIndex: 9999 }}>
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="pac-item"
              onMouseDown={() => handleSelect(s)}
            >
              <span className="pac-item-query">{s.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
