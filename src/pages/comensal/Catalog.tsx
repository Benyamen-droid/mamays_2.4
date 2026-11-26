import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Heart, LocateFixed, Map as MapIcon, MapPin, Rotate3d, Search, ShieldAlert, Target, Timer, X } from 'lucide-react'
import { api, mensajeError } from '../../data'
import { useAuth, useCart, useToast } from '../../context/AppContext'
import { ACTIVE_STATUSES, CATEGORIAS, STATUS_LABEL, horarioPreset } from '../../lib/constants'
import { openMapsSearch } from '../../lib/maps'
import { DishComments, ReviewItem } from '../../components/reviews'
import { RouteCard } from '../../components/RouteCard'
import { estimateRoute, fmtKm, fmtMin, getMyLocation, lastLocation, type LatLng } from '../../lib/route'
const Dish3DViewer = lazy(() => import('../../components/Dish3D'))
import type { DishView, MamitaPublic, Order, Review } from '../../lib/types'
import { estadoHorario, horarioTexto, primerNombre, soles } from '../../lib/format'
import { DishCard, dishTags } from '../../components/DishCard'
import { MapView } from '../../components/MapView'
import { Avatar, Button, Card, DishPhoto, EmptyState, Eyebrow, Loading, Screen, Sheet, Stars, StockBar, Stepper, Tag } from '../../components/ui'

function useFavorites() {
  const [favs, setFavs] = useState<string[]>([])
  const { toast } = useToast()
  useEffect(() => { api.listFavorites().then(setFavs).catch(() => {}) }, [])
  const toggle = useCallback(async (id: string) => {
    try {
      const on = await api.toggleFavorite(id)
      setFavs((f) => (on ? [...f, id] : f.filter((x) => x !== id)))
    } catch (e) { toast(mensajeError(e), 'error') }
  }, [toast])
  return { favs, toggle }
}

/* ===================== INICIO / MENÚ DEL DÍA ===================== */
export function ComensalHome() {
  const { profile } = useAuth()
  const [dishes, setDishes] = useState<DishView[] | null>(null)
  const [mamitas, setMamitas] = useState<MamitaPublic[]>([])
  const [active, setActive] = useState<Order | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todos')
  const [zona, setZona] = useState('')
  const [mamita, setMamita] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [hideMine, setHideMine] = useState(false)
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [myLoc, setMyLoc] = useState<LatLng | null>(() => lastLocation(120))
  const [cerca, setCerca] = useState(false)
  const [locBusy, setLocBusy] = useState(false)
  const { favs, toggle } = useFavorites()
  const { toast } = useToast()
  const alergias = profile?.allergies ?? []

  const load = useCallback(async () => {
    try {
      const [d, m, o] = await Promise.all([api.listDishes(), api.listMamitas(), api.listMyOrders()])
      setDishes(d); setMamitas(m)
      setActive(o.find((x) => ACTIVE_STATUSES.includes(x.status)) ?? null)
    } catch (e) { toast(mensajeError(e), 'error'); setDishes([]) }
  }, [toast])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  const zonas = useMemo(() => [...new Set(mamitas.map((m) => m.zone))].sort(), [mamitas])
  // distancia aproximada (a la zona de cada mamita) y tiempo caminando
  const dist = useMemo(() => {
    const r: Record<string, { n: number; km: string; min: string }> = {}
    if (!myLoc) return r
    for (const m of mamitas) {
      if (m.lat == null || m.lng == null) continue
      const e = estimateRoute(myLoc, { lat: m.lat, lng: m.lng }, 'foot')
      r[m.id] = { n: e.km, km: fmtKm(e.km), min: e.km > 15 ? 'lejos' : fmtMin(e.min) }
    }
    return r
  }, [myLoc, mamitas])
  async function toggleCerca() {
    if (cerca) return setCerca(false)
    setLocBusy(true)
    try { setMyLoc(await getMyLocation()); setCerca(true) } catch (e) { toast(mensajeError(e), 'error') } finally { setLocBusy(false) }
  }
  const filtered = useMemo(() => {
    if (!dishes) return []
    const s = q.trim().toLowerCase()
    return dishes
      .filter((d) => cat === 'Todos' || d.category === cat || d.tags.includes(cat))
      .filter((d) => !zona || d.mamita_zone === zona)
      .filter((d) => !mamita || d.mamita_id === mamita)
      .filter((d) => !minRating || (d.rating ?? d.mamita_rating ?? 0) >= minRating)
      .filter((d) => !onlyFavs || favs.includes(d.id))
      .filter((d) => !hideMine || !d.allergens.some((a) => alergias.includes(a)))
      .filter((d) => !s || [d.name, d.description, d.ingredients, d.mamita_name, d.category].join(' ').toLowerCase().includes(s))
      .sort((a, b) => Number(b.available > 0) - Number(a.available > 0)
        || (cerca ? (dist[a.mamita_id]?.n ?? 999) - (dist[b.mamita_id]?.n ?? 999) : 0))
  }, [dishes, q, cat, zona, mamita, minRating, onlyFavs, favs, hideMine, alergias, cerca, dist])
  const ocultosPorAlergia = dishes ? dishes.filter((d) => d.allergens.some((a) => alergias.includes(a))).length : 0
  const mamitasMapa = useMemo(() => mamitas.filter((m) => !zona || m.zone === zona), [mamitas, zona])
  const onSelectMap = useCallback((id: string) => setMamita(id), [])

  return (
    <Screen>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Menú del día</Eyebrow>
          <h1 className="mt-1.5 font-serif text-[30px] font-bold leading-[1.1]">¡Hola, {primerNombre(profile?.full_name ?? '')}! ¿Qué se te antoja hoy?</h1>
          <p className="mt-1.5 text-[15px] text-gris">Encuentra algo rico, caserito y preparado con cariño.</p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-guinda-50 bg-white text-guinda shadow"><Target size={28} /></div>
      </div>

      <label className="relative mt-5 block">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-guinda" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca tu platito favorito..." aria-label="Buscar platos"
          className="w-full rounded-[18px] border border-borde bg-white py-4 pl-12 pr-10 text-[16px] shadow-sm outline-none focus:border-guinda" />
        {q && <button onClick={() => setQ('')} aria-label="Borrar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-gris"><X size={18} /></button>}
      </label>

      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5" role="tablist" aria-label="Categorías">
        {['Todos', ...CATEGORIAS].map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${cat === c ? 'border-guinda bg-guinda text-white' : 'border-borde bg-white text-cafe'}`}>{c}</button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <FilterSelect label="Zona" value={zona} onChange={(v) => { setZona(v); setMamita('') }} options={[['', 'Todas'], ...zonas.map((z) => [z, z] as [string, string])]} />
        <FilterSelect label="Mamita" value={mamita} onChange={setMamita} options={[['', 'Todas'], ...mamitas.filter((m) => !zona || m.zone === zona).map((m) => [m.id, primerNombre(m.full_name)] as [string, string])]} />
        <FilterSelect label="Valoración" value={String(minRating)} onChange={(v) => setMinRating(Number(v))} options={[['0', 'Todas'], ['4', '★ 4 o más'], ['4.5', '★ 4.5 o más']]} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {alergias.length > 0 && (
          <button onClick={() => setHideMine(!hideMine)} aria-pressed={hideMine}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${hideMine ? 'border-[#b42323] bg-[#fde8e8] text-[#a32020]' : 'border-borde bg-white text-gris'}`}>
            <ShieldAlert size={14} /> {hideMine ? `Ocultando ${ocultosPorAlergia} con tus alérgenos` : `Ocultar ${ocultosPorAlergia} con tus alérgenos`}
          </button>
        )}
        <button onClick={() => setOnlyFavs(!onlyFavs)} aria-pressed={onlyFavs}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${onlyFavs ? 'border-guinda bg-guinda-50 text-guinda' : 'border-borde bg-white text-gris'}`}>
          <Heart size={14} fill={onlyFavs ? 'currentColor' : 'none'} /> Favoritos
        </button>
        <button onClick={toggleCerca} aria-pressed={cerca} disabled={locBusy}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${cerca ? 'border-guinda bg-guinda-50 text-guinda' : 'border-borde bg-white text-gris'}`}>
          {locBusy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-guinda border-t-transparent" /> : <LocateFixed size={14} />} Cerca de mí
        </button>
      </div>

      <button onClick={() => setShowMap(!showMap)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-cafe py-3.5 text-sm font-bold text-white">
        <MapIcon size={18} /> {showMap ? 'Ocultar mapa' : 'Ver mapa'}
      </button>
      {showMap && <div className="mt-3"><MapView mamitas={mamitasMapa} onSelect={onSelectMap} />
        <p className="mt-1.5 text-center text-[11px] text-gris">Zona aproximada de cada mamita. Toca un punto para ver sus platos o abrirlo en Google Maps.</p>
        <button onClick={() => openMapsSearch({ query: zona || 'Puno' })} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-borde bg-white py-3 text-sm font-bold text-cafe">
          <MapPin size={16} className="text-guinda" /> Abrir {zona || 'Puno'} en Google Maps
        </button></div>}

      <div className="mt-7 flex items-end justify-between">
        <div>
          <Eyebrow>Hecho hoy</Eyebrow>
          <h2 className="mt-1 font-serif text-[24px] font-bold">Platitos con sabor a casa</h2>
        </div>
        <span className="pb-1 text-xs text-gris">{filtered.length} opciones</span>
      </div>

      {!dishes ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon={<Search />} title="No encontramos platitos" text="Prueba con otra categoría, zona o quita algún filtro." />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {filtered.map((d) => <DishCard key={d.id} d={d} fav={favs.includes(d.id)} onFav={() => toggle(d.id)} userAllergies={alergias} distancia={dist[d.mamita_id]} />)}
        </div>
      )}

      {active && (
        <Link to={`/comensal/pedidos/${active.id}`}
          className="rise fixed inset-x-0 bottom-[78px] z-20 mx-auto flex w-[calc(100%-32px)] max-w-[448px] items-center gap-3 rounded-2xl bg-guinda px-4 py-3 text-white shadow-[0_12px_30px_-10px_rgb(163_23_59/0.8)]">
          <span className="relative flex h-3 w-3"><span className="absolute h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative h-3 w-3 rounded-full bg-white" /></span>
          <span className="flex-1 text-sm"><b>Ver mi pedido</b> · {active.status === 'reservado' ? 'Falta completar el pago' : STATUS_LABEL[active.status]}</span>
          <ChevronRight size={18} />
        </Link>
      )}
    </Screen>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="relative rounded-2xl border border-borde bg-white px-3 pb-2 pt-1.5">
      <span className="block text-[9px] font-extrabold uppercase tracking-wider text-gris">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none bg-transparent pr-4 text-[13px] font-semibold text-tinta outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronRight size={14} className="pointer-events-none absolute bottom-2.5 right-2 rotate-90 text-tinta" />
    </label>
  )
}

/* ===================== DETALLE DE PLATO ===================== */
export function DishDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile } = useAuth()
  const cart = useCart()
  const { toast } = useToast()
  const { favs, toggle } = useFavorites()
  const [d, setD] = useState<DishView | null | undefined>(undefined)
  const [mamita, setMamita] = useState<MamitaPublic | null>(null)
  const [qty, setQty] = useState(1)
  const [photo, setPhoto] = useState(0)
  const [extras, setExtras] = useState<string[]>([])
  const [conflict, setConflict] = useState(false)
  const [allergyOpen, setAllergyOpen] = useState(false)
  const [confirmAllergens, setConfirmAllergens] = useState(false)
  const [riskChecked, setRiskChecked] = useState(false)
  const [show3d, setShow3d] = useState(false)
  const misAlergias = profile?.allergies ?? []

  useEffect(() => {
    api.getDish(id!).then((x) => {
      setD(x)
      if (x) api.getMamita(x.mamita_id).then(setMamita).catch(() => {})
    }).catch(() => setD(null))
  }, [id])
  // Al abrir un plato con alérgenos del usuario, aparece de inmediato la advertencia
  useEffect(() => {
    if (d && d.allergens.some((a) => misAlergias.includes(a))) setAllergyOpen(true)
  }, [d]) // eslint-disable-line react-hooks/exhaustive-deps

  if (d === undefined) return <Screen><Loading /></Screen>
  if (d === null) return <Screen><EmptyState icon={<X />} title="Este plato ya no está" text="Puede que la mamita lo haya retirado." action={<Button onClick={() => nav('/comensal')}>Volver al menú</Button>} /></Screen>

  const choque = d.allergens.filter((a) => misAlergias.includes(a))
  const agotado = d.available === 0
  const h = estadoHorario(d.available_from, d.available_to)
  const preset = horarioPreset(d.available_from, d.available_to)
  const maxQty = Math.max(1, Math.min(d.available, 20))
  const modos = [d.delivery_mode !== 'recojo' && 'Delivery', d.delivery_mode !== 'delivery' && 'Recojo', d.dine_in && 'Comer en el hogar'].filter(Boolean).join(' · ')
  const extrasSel = d.extras.filter((x) => extras.includes(x.id))
  const unit = d.price + extrasSel.reduce((a, x) => a + x.price, 0)

  // Al pedir: SIEMPRE se muestran los alérgenos del plato (y con más fuerza si son del usuario)
  function pedir() {
    if (d!.allergens.length > 0) { setRiskChecked(false); setConfirmAllergens(true); return }
    agregar()
  }
  function agregar() {
    if (!d) return
    const r = cart.add(d.id, d.mamita_id, qty, extras)
    if (r === 'otra-mamita') return setConflict(true)
    toast(`${qty} × ${d.name} en tu carrito`)
    nav('/comensal/carrito')
  }

  return (
    <Screen nav={false} className="!px-0 !pt-0">
      <div className="relative aspect-[4/3] bg-[#2b2023]">
        <DishPhoto src={d.photos[photo]} alt={d.name} className="h-full w-full object-cover" onClick={() => d.photos.length > 1 && setPhoto((photo + 1) % d.photos.length)} />
        <button onClick={() => nav(-1)} aria-label="Volver" className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/95 shadow"><ChevronLeft /></button>
        <button onClick={() => toggle(d.id)} aria-label="Favorito" aria-pressed={favs.includes(d.id)} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/95 text-guinda shadow">
          <Heart fill={favs.includes(d.id) ? 'currentColor' : 'none'} />
        </button>
        <button onClick={() => setShow3d(true)} className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-[13px] font-extrabold text-guinda shadow-lg">
          <Rotate3d size={17} /> Ver en 3D
        </button>
        {d.photos.length > 1 && <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white">Foto {photo + 1} de {d.photos.length}</span>}
        {agotado && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-guinda/75"><span className="rounded-full border border-white/70 px-4 py-1.5 font-extrabold tracking-[0.25em] text-white">AGOTADO</span></div>}
      </div>

      <div className="px-5 pb-40 pt-5">
        {choque.length > 0 && (
          <div className="mb-4 flex gap-3 rounded-2xl border border-[#f0b4b4] bg-[#fde8e8] p-3.5 text-sm text-[#8f1f1f]" role="alert">
            <ShieldAlert className="shrink-0" />
            <div><b>Ojo: contiene {choque.join(', ')}</b>, que marcaste en tus alergias. Consulta con la mamita antes de pedir.</div>
          </div>
        )}
        <Eyebrow>¡Mira qué rico se ve!</Eyebrow>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <h1 className="font-serif text-[34px] font-bold leading-[1.05]">{d.name}</h1>
          <div className="whitespace-nowrap pt-1 text-[22px] font-extrabold text-guinda">{soles(d.price)}</div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-gris">
          <Stars value={d.rating ?? d.mamita_rating} />
          <a href="#comentarios" className="font-semibold text-guinda underline">{d.review_count} {d.review_count === 1 ? 'comentario' : 'comentarios'}</a>
        </div>
        {d.description && <p className="mt-3 text-[15px] text-gris">{d.description}</p>}

        <div className={`mt-4 flex items-start gap-3 rounded-2xl px-4 py-3 ${h.abierto ? 'bg-[#e8f5ee] text-ok' : 'bg-crema-200 text-cafe'}`}>
          <Timer size={20} className="mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold">{preset ? `${preset.label}: ` : 'Horario de hoy: '}{horarioTexto(d.available_from, d.available_to)}</div>
            {h.texto && <div className="text-xs">{h.abierto ? h.texto : `${h.texto}. Puedes pedir, pero confirma con la mamita.`}</div>}
          </div>
        </div>

        {d.extras.length > 0 && (
          <fieldset className="mt-5 rounded-[20px] border border-borde bg-white p-4">
            <legend className="px-2 font-serif text-lg font-bold">Agrega extras</legend>
            <p className="-mt-1 mb-2 text-xs text-gris">Acompañamientos que ofrece {primerNombre(d.mamita_name)} para este plato</p>
            <div className="space-y-2">
              {d.extras.map((x) => {
                const on = extras.includes(x.id)
                return (
                  <label key={x.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${on ? 'border-guinda bg-guinda-50' : 'border-borde'}`}>
                    <input type="checkbox" className="h-5 w-5 accent-[#A3173B]" checked={on} onChange={() => setExtras(on ? extras.filter((e) => e !== x.id) : [...extras, x.id])} />
                    <span className="flex-1 text-sm font-semibold">{x.name}</span>
                    <span className="whitespace-nowrap text-sm font-bold text-guinda">+ {soles(x.price)}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <hr className="my-5 border-borde" />
        <Eyebrow>Información alimentaria</Eyebrow>
        <h2 className="mt-1 font-serif text-[24px] font-bold">Ingredientes y características</h2>
        <Card tone="crema" className="mt-4">
          <div className="text-sm font-bold">Ingredientes</div>
          <p className="mt-1 text-sm text-gris">{d.ingredients}</p>
        </Card>
        <div className="mt-3 rounded-[20px] border border-[#f3d4bf] bg-[#fff8f2] p-4">
          <div className="font-semibold text-cafe">Alérgenos declarados</div>
          <div className="mt-1 text-sm font-bold">{d.allergens.length ? d.allergens.join(' · ') : 'Ninguno declarado'}</div>
          <p className="mt-2 text-[13px] text-gris">Puede existir contacto cruzado en una cocina doméstica. Si tienes una alergia o intolerancia, consulta directamente con la mamita antes de pedir.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{dishTags(d, misAlergias).map((t) => <Tag key={t.label} label={t.label} alert={t.alert} />)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[['Categoría', d.category], ['Conservación', d.conservation || (d.tags.filter((t) => /recalentar|fresco/i.test(t)).join(' · ') || 'No declarada')], ['Entrega', modos + (d.delivery_mode !== 'recojo' && d.delivery_cost != null ? ` · delivery ${soles(d.delivery_cost)}` : '')]].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-borde bg-white p-3"><div className="text-[11px] text-gris">{k}</div><div className="mt-0.5 text-[13px] font-semibold leading-snug">{v}</div></div>
          ))}
        </div>

        <div className={`mt-4 rounded-[20px] border p-4 ${agotado ? 'border-borde bg-[#f6f1ef]' : 'border-borde bg-white'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-extrabold tracking-wider ${agotado ? 'text-gris' : d.available === 1 ? 'text-naranja' : 'text-ok'}`}>
              {agotado ? 'AGOTADO' : d.available === 1 ? 'ÚLTIMA PORCIÓN' : 'DISPONIBLE'}
            </span>
            <span className="text-xs text-gris">Stock actual: {d.available} {d.available === 1 ? 'porción' : 'porciones'}</span>
          </div>
          <div className="mt-2.5"><StockBar available={d.available} portions={d.portions} /></div>
          {d.reserved > 0 && <p className="mt-2 text-[11px] text-gris">{d.reserved} reservada(s) por otros comensales en este momento.</p>}
        </div>

        <div className="mt-4 rounded-[20px] border border-borde bg-white p-4">
          <Link to={`/comensal/mamita/${d.mamita_id}`} className="flex items-center gap-3">
            <Avatar name={d.mamita_name} url={mamita?.avatar_url} size={52} />
            <div className="flex-1">
              <div className="text-[11px] text-gris">Conoce a quien lo preparó</div>
              <div className="font-bold">{d.mamita_name}</div>
              <div className="text-xs text-gris"><Stars value={d.mamita_rating} /> · {mamita?.public_zone_label || d.mamita_zone}</div>
            </div>
            <ChevronRight />
          </Link>
        </div>
        <RouteCard className="mt-4" title={`¿A cuánto está la cocina de ${primerNombre(d.mamita_name)}?`}
          to={mamita?.lat != null && mamita.lng != null ? { lat: mamita.lat, lng: mamita.lng } : null}
          toLabel={`Zona de ${primerNombre(d.mamita_name)}`} approx googleDest={d.mamita_zone} />

        <DishComments dishId={d.id} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-center gap-3 border-t border-borde bg-white px-5 py-3 safe-bottom">
        <Stepper value={qty} onChange={setQty} max={maxQty} />
        <Button onClick={pedir} disabled={agotado} className="flex-1">
          <span className="whitespace-nowrap">{agotado ? 'AGOTADO' : `Agregar · ${soles(unit * qty)}`}</span>
        </Button>
      </div>

      {show3d && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] grid place-items-center bg-[#1c1416] text-sm text-white/80">Preparando la vista 3D…</div>}>
          <Dish3DViewer src={d.photos[0]} name={d.name} onClose={() => setShow3d(false)} />
        </Suspense>
      )}

      {allergyOpen && choque.length > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-6" role="alertdialog" aria-modal="true" aria-labelledby="alerta-alergia">
          <div className="rise w-full max-w-[380px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="bg-[#b42323] px-6 pb-5 pt-6 text-center text-white">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/15"><ShieldAlert size={34} /></div>
              <h2 id="alerta-alergia" className="mt-3 font-serif text-2xl font-bold">¡Alerta de alergia!</h2>
              <p className="mt-1 text-sm text-white/90">Este plato contiene algo que registraste como alergia</p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap justify-center gap-2">
                {choque.map((a) => <span key={a} className="rounded-full bg-[#fde8e8] px-3 py-1.5 text-sm font-extrabold text-[#a32020]">⚠ {a}</span>)}
              </div>
              <p className="mt-4 text-center text-sm text-gris">
                <b className="text-tinta">{d.name}</b> de {d.mamita_name} declara <b className="text-tinta">{d.allergens.join(', ')}</b>.
                Además, en una cocina casera puede haber contacto cruzado.
              </p>
              <div className="mt-5 space-y-2">
                <Button onClick={() => nav('/comensal')}>Volver al menú</Button>
                <Button variant="secondary" onClick={() => setAllergyOpen(false)}>Ver el plato de todos modos</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Sheet open={confirmAllergens} onClose={() => setConfirmAllergens(false)} title={choque.length ? 'Confirma antes de agregar' : 'Alérgenos de este plato'}>
        <div className={`flex gap-3 rounded-2xl p-3.5 text-sm ${choque.length ? 'bg-[#fde8e8] text-[#8f1f1f]' : 'bg-[#fff4ea] text-[#7a3d0c]'}`}>
          <ShieldAlert className="shrink-0" />
          <div>
            <b>{d.name}</b> contiene: <b>{d.allergens.join(', ')}</b>.
            {choque.length > 0 ? <> Marcaste <b>{choque.join(', ')}</b> en tus alergias.</> : ' Si tú o quien lo comerá es alérgico a alguno, no lo pidas o consulta con la mamita.'}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{d.allergens.map((a) => <Tag key={a} label={a} alert />)}</div>
        {choque.length > 0 && (
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#A3173B]" checked={riskChecked} onChange={(e) => setRiskChecked(e.target.checked)} />
            Entiendo el riesgo y confirmo que este pedido es seguro para quien lo va a comer (por ejemplo, es para otra persona).
          </label>
        )}
        <div className="mt-5 space-y-2">
          <Button disabled={choque.length > 0 && !riskChecked} onClick={() => { setConfirmAllergens(false); agregar() }}>
            {choque.length ? 'Agregar de todos modos' : 'Entendido, agregar al carrito'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmAllergens(false)}>Mejor no</Button>
        </div>
      </Sheet>

      <Sheet open={conflict} onClose={() => setConflict(false)} title="Tu carrito es de otra mamita">
        <p className="text-sm text-gris">Cada pedido se prepara en una sola cocina. ¿Quieres vaciar tu carrito y empezar uno nuevo con {d.name}?</p>
        <div className="mt-5 space-y-2">
          <Button onClick={() => { cart.replaceWith(d.id, d.mamita_id, qty, extras); setConflict(false); nav('/comensal/carrito') }}>Vaciar y agregar</Button>
          <Button variant="secondary" onClick={() => setConflict(false)}>Mantener mi carrito</Button>
        </div>
      </Sheet>
    </Screen>
  )
}

/* ===================== PERFIL PÚBLICO DE LA MAMITA ===================== */
export function MamitaPublicPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [m, setM] = useState<MamitaPublic | null | undefined>(undefined)
  const [dishes, setDishes] = useState<DishView[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const { favs, toggle } = useFavorites()
  useEffect(() => {
    api.getMamita(id!).then(setM).catch(() => setM(null))
    api.listDishes().then((ds) => setDishes(ds.filter((d) => d.mamita_id === id))).catch(() => {})
    api.listReviews({ mamitaId: id! }).then((r) => setReviews(r.filter((x) => x.kind === 'mamita'))).catch(() => {})
  }, [id])
  if (m === undefined) return <Screen><Loading /></Screen>
  if (!m) return <Screen><EmptyState icon={<X />} title="No encontramos a esta mamita" text="" /></Screen>
  return (
    <Screen className="!px-0 !pt-0">
      <div className="relative h-32 bg-gradient-to-br from-guinda to-[#c9325a]">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full border-[18px] border-white/15" />
      </div>
      <div className="px-5">
        <div className="-mt-12"><Avatar name={m.full_name} url={m.avatar_url} size={96} /></div>
        <Eyebrow className="mt-3">Mamita de {m.zone}</Eyebrow>
        <h1 className="mt-1 font-serif text-[32px] font-bold leading-tight">{m.full_name}</h1>
        <div className="mt-1 text-sm text-gris"><Stars value={m.rating} count={m.rating_count} /> · <MapPin size={13} className="inline" /> {m.public_zone_label || m.zone}</div>
        {m.bio && <p className="mt-3 text-[15px] text-gris">{m.bio}</p>}
        <RouteCard className="mt-4" title={`¿A cuánto está ${primerNombre(m.full_name)}?`}
          to={m.lat != null && m.lng != null ? { lat: m.lat, lng: m.lng } : null}
          toLabel={`Zona de ${primerNombre(m.full_name)}`} approx googleDest={m.zone} />
        {(m.home_description || m.home_photos.length > 0) && (
          <Card tone="crema" className="mt-5">
            <div className="font-serif text-xl font-bold">Así es mi hogar</div>
            {m.home_description && <p className="mt-1 text-sm text-gris">{m.home_description}</p>}
            {m.home_photos.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{m.home_photos.map((p, i) => <img key={i} src={p} alt="Cocina" className="h-28 w-40 rounded-xl object-cover" />)}</div>}
          </Card>
        )}
        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-2xl font-bold">Lo que dicen de {primerNombre(m.full_name)}</h2>
            <span className="pb-1 text-xs text-gris"><Stars value={m.rating} count={m.rating_count} /></span>
          </div>
          {reviews.length === 0 ? <p className="mt-2 text-sm text-gris">Aún no tiene calificaciones.</p>
            : <ul className="mt-1 divide-y divide-borde">{reviews.slice(0, 6).map((r) => <ReviewItem key={r.id} r={r} />)}</ul>}
        </section>
        <h2 className="mt-7 font-serif text-2xl font-bold">Sus platitos de hoy</h2>
        {dishes.length === 0 ? <p className="mt-2 text-sm text-gris">Hoy no tiene platos publicados.</p> : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {dishes.map((d) => <DishCard key={d.id} d={d} fav={favs.includes(d.id)} onFav={() => toggle(d.id)} userAllergies={profile?.allergies ?? []} />)}
          </div>
        )}
      </div>
    </Screen>
  )
}
