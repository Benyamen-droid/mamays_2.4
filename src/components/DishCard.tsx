import { Link } from 'react-router-dom'
import { ChevronRight, Footprints, Heart, MapPin, Timer, TriangleAlert } from 'lucide-react'
import type { DishView } from '../lib/types'
import { estadoHorario, horarioCorto, soles } from '../lib/format'
import { horarioPreset } from '../lib/constants'
import { DishPhoto, Stars, Tag } from './ui'

export function dishTags(d: DishView, alergiasUsuario: string[] = []) {
  const tags: { label: string; alert?: boolean }[] = []
  if (d.allergens.length === 0) tags.push({ label: 'Sin alérgenos declarados' })
  for (const a of d.allergens) tags.push({ label: a, alert: true })
  for (const t of d.tags) tags.push({ label: t })
  if (d.delivery_mode !== 'recojo') tags.push({ label: 'Delivery' })
  if (d.delivery_mode !== 'delivery') tags.push({ label: 'Recojo' })
  if (d.dine_in) tags.push({ label: 'Comer en el hogar' })
  if (d.extras?.length) tags.push({ label: `${d.extras.length} extras` })
  // primero las alergias del usuario, luego "Comer en el hogar" (es una modalidad que conviene ver de un vistazo)
  const prio = (t: { label: string }) => (alergiasUsuario.includes(t.label) ? 2 : t.label === 'Comer en el hogar' ? 1 : 0)
  return tags.sort((a, b) => prio(b) - prio(a))
}

export function DishCard({ d, fav, onFav, userAllergies = [], distancia }: { d: DishView; fav: boolean; onFav: () => void; userAllergies?: string[]; distancia?: { km: string; min: string } }) {
  const agotado = d.available === 0
  const ultima = d.available === 1
  const tags = dishTags(d, userAllergies)
  const shown = tags.slice(0, 3)
  const choque = d.allergens.filter((a) => userAllergies.includes(a))
  const h = estadoHorario(d.available_from, d.available_to)
  return (
    <article className="rise flex flex-col overflow-hidden rounded-[22px] border border-borde bg-white shadow-[0_6px_18px_-12px_rgb(46_35_38/0.35)]">
      <div className="relative">
        <Link to={`/comensal/plato/${d.id}`} className="relative block aspect-[4/3] bg-[#2b2023]" aria-label={`Ver ${d.name}`}>
          <DishPhoto src={d.photos[0]} alt={d.name} className={`h-full w-full object-cover ${agotado ? 'grayscale-[60%]' : ''}`} />
          {agotado && (
            <div className="absolute inset-0 grid place-items-center bg-guinda/80">
              <span className="rounded-full border border-white/60 px-3 py-1 text-xs font-extrabold tracking-[0.2em] text-white">AGOTADO</span>
            </div>
          )}
          {ultima && <span className="absolute bottom-2 left-2 rounded-full bg-naranja px-2.5 py-1 text-[11px] font-bold text-white shadow">Última porción</span>}
          {!agotado && !ultima && d.available <= 3 && <span className="absolute bottom-2 left-2 rounded-full bg-cafe/85 px-2.5 py-1 text-[11px] font-bold text-white">Quedan {d.available}</span>}
          {choque.length > 0 && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#b42323] px-2 py-1 text-[10px] font-bold text-white shadow">
              <TriangleAlert size={12} /> Tu alergia
            </span>
          )}
        </Link>
        <button onClick={onFav} aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'} aria-pressed={fav}
          className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow ${fav ? 'text-guinda' : 'text-[#b0919a]'}`}>
          <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="eyebrow !text-[10px]">{d.category}</div>
        <Link to={`/comensal/plato/${d.id}`} className="mt-0.5 font-serif text-[17px] font-bold leading-tight">{d.name}</Link>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-gris">
          <Stars value={d.rating ?? d.mamita_rating} className="!text-[11px] shrink-0" /> · <span className="truncate">{d.mamita_name}</span>
        </div>
        {d.available_from && (
          <div className={`mt-1 inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold ${h.abierto ? 'text-ok' : 'text-gris'}`}>
            <Timer size={12} /> {horarioPreset(d.available_from, d.available_to)?.id === 'tarde' ? 'Toda la tarde · ' : ''}{horarioCorto(d.available_from, d.available_to)}
          </div>
        )}
        {distancia && (
          <div className="mt-0.5 inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-cafe" data-testid="distancia-card">
            <MapPin size={12} className="text-guinda" /> {distancia.km} · <Footprints size={12} /> {distancia.min}
          </div>
        )}
        <div className="mb-3 mt-2 flex flex-wrap gap-1">
          {shown.map((t) => <Tag key={t.label} label={t.label} alert={t.alert} sm />)}
          {tags.length > shown.length && <Link to={`/comensal/plato/${d.id}`} className="self-center whitespace-nowrap text-[10px] font-bold text-guinda">+{tags.length - shown.length} más</Link>}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-borde pt-3">
          <span className="whitespace-nowrap text-[16px] font-extrabold text-guinda">{soles(d.price)}</span>
          <Link to={`/comensal/plato/${d.id}`} className="inline-flex items-center whitespace-nowrap text-[11px] font-bold text-cafe">Ver <ChevronRight size={13} /></Link>
        </div>
      </div>
    </article>
  )
}
