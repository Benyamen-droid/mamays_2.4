import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Car, Footprints, LocateFixed, MapPin, Navigation, RefreshCw } from 'lucide-react'
import { mensajeError } from '../data'
import { openMapsDirections } from '../lib/maps'
import { fmtKm, fmtMin, getMyLocation, getRoute, haversineKm, lastLocation, type LatLng, type RouteResult, type TravelMode } from '../lib/route'

const CONSENT = 'mamays-ubicacion-ok'
const consentGiven = () => { try { return localStorage.getItem(CONSENT) === '1' } catch { return false } }
const giveConsent = () => { try { localStorage.setItem(CONSENT, '1') } catch { /* sin almacenamiento */ } }

/**
 * Tarjeta “¿A cuánto está?”: distancia y tiempo caminando y en mototaxi/auto, la ruta dibujada
 * en el mapa y un botón para seguirla en Google Maps.
 */
export function RouteCard({
  to, toLabel, approx = false, from, fromLabel = 'Tú', title = '¿A cuánto está?', defaultMode = 'foot', googleDest, className = '',
}: {
  /** destino (si es null solo se ofrece Google Maps con googleDest) */
  to: LatLng | null
  toLabel: string
  /** el destino es la ZONA aproximada (no la dirección exacta) */
  approx?: boolean
  /** origen fijo; si no se da, se usa el GPS del celular */
  from?: LatLng | null
  fromLabel?: string
  title?: string
  defaultMode?: TravelMode
  /** destino para Google Maps si no hay coordenadas (texto de la dirección) */
  googleDest?: string
  className?: string
}) {
  const [origin, setOrigin] = useState<LatLng | null>(from ?? lastLocation())
  const [routes, setRoutes] = useState<Partial<Record<TravelMode, RouteResult>>>({})
  const [mode, setMode] = useState<TravelMode>(defaultMode)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)

  async function locate() {
    setBusy(true); setErr('')
    try { const p = await getMyLocation(); giveConsent(); setOrigin(p) }
    catch (e) { setErr(mensajeError(e)) }
    finally { setBusy(false) }
  }

  // si ya dio permiso antes, se actualiza solo
  useEffect(() => { if (!from && consentGiven()) locate() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (from) setOrigin(from) }, [from?.lat, from?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // calcular ambas rutas
  useEffect(() => {
    if (!origin || !to) return
    let alive = true
    setRoutes({})
    const lejos = haversineKm(origin, to) > 15
    Promise.all([lejos ? Promise.resolve(undefined) : getRoute(origin, to, 'foot'), getRoute(origin, to, 'car')]).then(([f, c]) => {
      if (!alive) return
      setRoutes({ foot: f, car: c })
      if (lejos) setMode('car')
    })
    return () => { alive = false }
  }, [origin?.lat, origin?.lng, to?.lat, to?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = routes[mode] ?? routes.car ?? routes.foot

  // mini mapa con la ruta
  useEffect(() => {
    if (!mapEl.current || !origin || !to || !sel) return
    if (!map.current) {
      map.current = L.map(mapEl.current, { zoomControl: false, attributionControl: true, dragging: true, scrollWheelZoom: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map.current)
    }
    const m = map.current
    const layer = L.layerGroup().addTo(m)
    const path: [number, number][] = sel.path.length ? sel.path : [[origin.lat, origin.lng], [to.lat, to.lng]]
    L.polyline(path, { color: '#A3173B', weight: 5, opacity: 0.9, dashArray: sel.estimado ? '6 8' : undefined }).addTo(layer)
    L.circleMarker([origin.lat, origin.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip(fromLabel).addTo(layer)
    if (approx) L.circle([to.lat, to.lng], { radius: 220, color: '#A3173B', weight: 1, fillOpacity: 0.12 }).addTo(layer)
    L.circleMarker([to.lat, to.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#A3173B', fillOpacity: 1 }).bindTooltip(toLabel).addTo(layer)
    m.fitBounds(L.latLngBounds(path), { padding: [28, 28], maxZoom: 16 })
    return () => { layer.remove() }
  }, [sel, origin, to, approx, fromLabel, toLabel])
  useEffect(() => () => { map.current?.remove(); map.current = null }, [])

  const google = () => {
    const dest = to ?? googleDest
    if (dest) openMapsDirections(dest, mode === 'foot' ? 'walking' : 'driving')
  }
  const tile = (m: TravelMode, r: RouteResult | undefined, icon: React.ReactNode, label: string) => (
    <button type="button" role="radio" aria-checked={mode === m} onClick={() => r && setMode(m)} disabled={!r}
      className={`flex-1 rounded-2xl border p-3 text-left transition ${mode === m ? 'border-guinda bg-guinda-50' : 'border-borde bg-white'} disabled:opacity-50`}>
      <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-cafe">{icon} {label}</span>
      <span className="mt-0.5 block text-xl font-extrabold text-tinta" data-testid={`tiempo-${m}`}>{r ? fmtMin(r.min) : '—'}</span>
      <span className="block text-[12px] text-gris">{r ? fmtKm(r.km) : m === 'foot' ? 'muy lejos para ir a pie' : ''}</span>
    </button>
  )

  return (
    <section className={`rounded-[22px] border border-borde bg-white p-4 ${className}`} aria-label={title}>
      <div className="flex items-center gap-2">
        <Navigation size={18} className="text-guinda" />
        <h3 className="flex-1 font-bold">{title}</h3>
        {origin && to && !from && (
          <button type="button" onClick={locate} disabled={busy} aria-label="Actualizar mi ubicación" className="grid h-8 w-8 place-items-center rounded-full text-gris hover:bg-crema">
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {!to ? (
        <p className="mt-1 text-sm text-gris">Abre la ruta en Google Maps para ver el tiempo de viaje.</p>
      ) : !origin ? (
        <div className="mt-2">
          <p className="text-sm text-gris">Mira la distancia y cuánto tardas en llegar caminando o en mototaxi, con la ruta en el mapa.</p>
          <button type="button" onClick={locate} disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-guinda px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <LocateFixed size={17} />}
            {busy ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-gris">Tu ubicación no se guarda ni se comparte con la mamita.</p>
        </div>
      ) : !sel ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-gris"><span className="h-4 w-4 animate-spin rounded-full border-2 border-guinda border-t-transparent" /> Calculando la ruta…</div>
      ) : (
        <>
          <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Cómo vas">
            {tile('foot', routes.foot, <Footprints size={15} />, 'Caminando')}
            {tile('car', routes.car, <Car size={15} />, 'Mototaxi o auto')}
          </div>
          <div ref={mapEl} className="isolate relative z-0 mt-3 h-44 overflow-hidden rounded-2xl border border-borde" aria-label={`Ruta de ${fromLabel} a ${toLabel}`} data-testid="mapa-ruta" />
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-snug text-gris">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            <span>
              {approx ? 'Hasta la zona de la mamita: la dirección exacta llega cuando acepte tu pedido. ' : ''}
              {sel.estimado ? 'Tiempo estimado en línea recta (sin conexión con el mapa de calles). ' : 'Ruta por calles, tiempo estimado. '}
              Google Maps te muestra el tráfico en vivo.
            </span>
          </p>
        </>
      )}
      {err && <p className="mt-2 rounded-xl bg-[#fde8e8] px-3 py-2 text-xs font-semibold text-[#a32020]" role="alert">{err}</p>}
      {(to || googleDest) && (
        <button type="button" onClick={google}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-borde bg-white px-4 py-2.5 text-sm font-bold text-guinda">
          <Navigation size={16} /> Ir con Google Maps
        </button>
      )}
    </section>
  )
}
