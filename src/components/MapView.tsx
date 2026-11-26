import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MamitaPublic } from '../lib/types'
import { PUNO_CENTER, ZONA_COORDS } from '../lib/constants'
import { openMapsSearch } from '../lib/maps'

/** Mapa con OpenStreetMap (sin API key). Muestra la ZONA pública de cada mamita, nunca su dirección exacta. */
export function MapView({ mamitas, onSelect, height = 260 }: { mamitas: MamitaPublic[]; onSelect?: (id: string) => void; height?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(PUNO_CENTER, 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© OpenStreetMap',
    }).addTo(map.current)
    return () => { map.current?.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    const layer = L.layerGroup().addTo(m)
    const pts: L.LatLngExpression[] = []
    mamitas.forEach((mm, i) => {
      const base = mm.lat != null && mm.lng != null ? [mm.lat, mm.lng] : ZONA_COORDS[mm.zone] ?? PUNO_CENTER
      const pos: [number, number] = [base[0] + (i % 3) * 0.0004, base[1] - (i % 2) * 0.0004]
      pts.push(pos)
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#A3173B;color:#fff;border:3px solid #fff;border-radius:999px;width:34px;height:34px;display:grid;place-items:center;font:700 14px Playfair Display,serif;box-shadow:0 4px 10px rgba(0,0,0,.3)">${(mm.full_name[0] || 'M').toUpperCase()}</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      })
      // Ventana del pin: datos de la mamita + botón para abrir en Google Maps (texto escapado)
      const box = document.createElement('div')
      const b = document.createElement('b'); b.textContent = mm.full_name
      const z = document.createElement('div'); z.textContent = `${mm.public_zone_label || mm.zone} · ${mm.dish_count} platitos hoy`
      const btn = document.createElement('button')
      btn.textContent = 'Abrir en Google Maps'
      btn.style.cssText = 'margin-top:6px;background:#A3173B;color:#fff;border:0;border-radius:999px;padding:6px 10px;font-weight:700;font-size:12px'
      btn.onclick = () => openMapsSearch({ lat: pos[0], lng: pos[1] })
      box.append(b, z, btn)
      L.marker(pos, { icon, title: mm.full_name }).addTo(layer)
        .bindPopup(box)
        .on('click', () => onSelect?.(mm.id))
    })
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 })
    else if (pts.length === 1) m.setView(pts[0], 15)
    return () => { layer.remove() }
  }, [mamitas, onSelect])

  return <div ref={el} style={{ height }} className="isolate relative z-0 w-full overflow-hidden rounded-[20px] border border-borde" role="region" aria-label="Mapa de mamitas" />
}
