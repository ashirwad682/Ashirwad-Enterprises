import { useEffect, useState } from 'react'

/**
 * Hook returning boolean for a media query.
 * Falls back to false during SSR and updates on resize/orientation changes.
 */
export function useMediaQuery(query) {
  const getMatch = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  }

  const [matches, setMatches] = useState(getMatch)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const media = window.matchMedia(query)
    const handleChange = (event) => setMatches(event.matches)

    // Initial sync for environments where state initializer ran before listeners attached.
    setMatches(media.matches)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [query])

  return matches
}
