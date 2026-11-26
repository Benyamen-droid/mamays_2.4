/**
 * Ruta, distancia y tiempo estimado (caminando y en mototaxi/auto).
 * - Ubicación: GPS del celular (plugin de Capacitor en el APK, navegador en la web).
 * - Ruta por calles: OSRM sobre OpenStreetMap (servidor público de FOSSGIS, sin API key).
 * - Sin internet o si el servidor no responde: estimación por distancia en línea recta.
 */
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export type LatLng = { lat: number; lng: number }
export type TravelMode = 'foot' | 'car'
export interface RouteResult {
  mode: TravelMode
  km: number
  min: number
  /** recorrido por calles [lat, lng]; vacío si es estimado */
  path: [number, number][]
  /** true = estimado en línea recta (no se pudo consultar la ruta por calles) */
  estimado: boolean
}

const LS_KEY = 'mamays-ubicacion'

/* ---------------- Ubicación del usuario ---------------- */
export function lastLocation(maxAgeMin = 30): LatLng | null {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') as (LatLng & { at: number }) | null
    if (v && Date.now() - v.at < maxAgeMin * 60_000) return { lat: v.lat, lng: v.lng }
  } catch { /* almacenamiento no disponible */ }
  return null
}
function remember(p: LatLng) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...p, at: Date.now() })) } catch { /* sin almacenamiento */ }
}

/** Pide la ubicación actual (muestra el permiso del sistema la primera vez) */
export async function getMyLocation(): Promise<LatLng> {
  if (Capacitor.isNativePlatform()) {
    let perm = await Geolocation.checkPermissions()
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') perm = await Geolocation.requestPermissions()
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') throw new Error('UBICACION_DENEGADA')
    try {
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
      const r = { lat: p.coords.latitude, lng: p.coords.longitude }; remember(r); return r
    } catch (e) {
      throw new Error(/denied|permission/i.test(String(e)) ? 'UBICACION_DENEGADA' : 'UBICACION_NO_DISPONIBLE')
    }
  }
  if (!('geolocation' in navigator)) throw new Error('UBICACION_NO_DISPONIBLE')
  return new Promise((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      (p) => { const r = { lat: p.coords.latitude, lng: p.coords.longitude }; remember(r); res(r) },
      (e) => rej(new Error(e.code === 1 ? 'UBICACION_DENEGADA' : 'UBICACION_NO_DISPONIBLE')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

/* ---------------- Distancias ---------------- */
export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Ajustes para Puno: a 3 800 m se camina algo más lento y el tráfico del centro
 * hace más lentos los autos que lo que calcula OSRM (pensado para vías libres).
 */
const AJUSTE = { foot: 1.15, car: 1.3 }
const ESPERA_CAR_MIN = 2 // tomar el mototaxi / estacionar
const VEL_ESTIMADA = { foot: 4.3, car: 18 } // km/h, si no hay ruta por calles
const DESVIO = 1.35 // las calles no van en línea recta

/** Estimación sin internet: línea recta × desvío típico */
export function estimateRoute(from: LatLng, to: LatLng, mode: TravelMode): RouteResult {
  const km = haversineKm(from, to) * DESVIO
  const min = (km / VEL_ESTIMADA[mode]) * 60 + (mode === 'car' ? ESPERA_CAR_MIN : 0)
  return { mode, km, min: Math.max(1, Math.round(min)), path: [], estimado: true }
}

const cache = new Map<string, RouteResult>()

/** Ruta por calles con OSRM (OpenStreetMap); si falla, estimación */
export async function getRoute(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteResult> {
  const key = [mode, from.lat.toFixed(4), from.lng.toFixed(4), to.lat.toFixed(4), to.lng.toFixed(4)].join('|')
  const hit = cache.get(key)
  if (hit) return hit
  const perfil = mode === 'foot' ? 'routed-foot' : 'routed-car'
  const url = `https://routing.openstreetmap.de/${perfil}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 7000)
    const r = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json() as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
    const best = j.routes?.[0]
    if (j.code !== 'Ok' || !best) throw new Error(j.code)
    const min = (best.duration / 60) * AJUSTE[mode] + (mode === 'car' ? ESPERA_CAR_MIN : 0)
    const res: RouteResult = {
      mode, km: best.distance / 1000, min: Math.max(1, Math.round(min)),
      path: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]), estimado: false,
    }
    cache.set(key, res)
    return res
  } catch {
    return estimateRoute(from, to, mode)
  }
}

/* ---------------- Formato ---------------- */
export function fmtKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`
}
export function fmtMin(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
