/**
 * Google Maps: abre la app de Google Maps en Android (o la web en el navegador).
 * Dentro del APK, navegar a un enlace externo hace que Android lo abra con la app que corresponde.
 */
const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

export function openExternal(url: string) {
  if (isNative()) window.location.href = url
  else window.open(url, '_blank', 'noopener,noreferrer')
}

const withCity = (q: string) => (/puno|juliaca|per[uú]/i.test(q) ? q : `${q}, Puno, Perú`)

/** Buscar un lugar: por coordenadas o por texto */
export function mapsSearchUrl(target: { lat?: number | null; lng?: number | null; query?: string }) {
  const q = target.lat != null && target.lng != null ? `${target.lat},${target.lng}` : withCity(target.query ?? 'Puno')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Cómo llegar desde la ubicación actual */
export function mapsDirectionsUrl(destination: string | { lat: number; lng: number }, mode: 'walking' | 'driving' | 'transit' = 'walking') {
  const dest = typeof destination === 'string' ? withCity(destination) : `${destination.lat},${destination.lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode}`
}

export const openMapsSearch = (t: Parameters<typeof mapsSearchUrl>[0]) => openExternal(mapsSearchUrl(t))
export const openMapsDirections = (dest: string | { lat: number; lng: number }, mode?: 'walking' | 'driving' | 'transit') => openExternal(mapsDirectionsUrl(dest, mode))
