import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BookOpen, Camera, ChartColumn, Check, ChevronRight, LocateFixed, DoorOpen, Eye, Heart, Navigation, Pause, Pencil, Phone, Play, Plus, ShoppingBag, Store, Target, Trash2, Truck, Users,
} from 'lucide-react'
import { api, mensajeError } from '../../data'
import { useAuth, useToast } from '../../context/AppContext'
import { ACTIVE_STATUSES, ALERGENOS, CATEGORIAS, ETIQUETAS, HORARIOS, ZONAS, nextActionLabel, nextStatus } from '../../lib/constants'
import type { DeliveryMode, Dish, DishView, Extra, Order, Review } from '../../lib/types'
import { celularValido, comprimirImagen, fechaHora, primerNombre, soles } from '../../lib/format'
import { RouteCard } from '../../components/RouteCard'
import { getMyLocation } from '../../lib/route'
import { ReviewItem } from '../../components/reviews'
import { PrimerosPasos } from './MamitaHelp'
import { OrderItems, OrderTotals, StatusBadge, VoucherImage } from '../../components/orders'
import {
  Avatar, BackButton, Button, Card, CheckGrid, DishPhoto, EmptyState, Eyebrow, Field, ImagePicker, Loading, PageTitle, Screen, Segmented, Sheet, Stars, Stepper,
} from '../../components/ui'

const limaDay = (iso: string | Date) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
const isToday = (iso: string) => limaDay(iso) === limaDay(new Date())

/* ===================== INICIO (DASHBOARD) ===================== */
export function MamitaHome() {
  const { profile } = useAuth()
  const [dishes, setDishes] = useState<DishView[] | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const load = useCallback(async () => {
    const [d, o] = await Promise.all([api.listMyDishes().catch(() => []), api.listMyOrders().catch(() => [])])
    setDishes(d); setOrders(o)
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])
  const visibles = orders.filter((o) => o.status !== 'reservado' && o.status !== 'expirado')
  const porAtender = visibles.filter((o) => ['enviado', 'aceptado', 'preparando', 'listo', 'en_camino'].includes(o.status)).length
  const nuevos = visibles.filter((o) => o.status === 'enviado').length
  const ventasHoy = visibles.filter((o) => o.status === 'entregado' && isToday(o.created_at)).reduce((a, o) => a + o.total, 0)
  const sinStock = (dishes ?? []).filter((d) => !d.paused && d.available === 0).length
  if (profile && !profile.onboarded) return <Navigate to="/mamita/bienvenida" replace />

  return (
    <Screen>
      <PageTitle eyebrow="Tu cocina, tus oportunidades" title={<>¡Hola, {primerNombre(profile!.full_name)}! Qué bueno tenerte aquí</>}
        text="Hoy es un buen día para compartir tus sabores con más personas." />
      {nuevos > 0 && (
        <Link to="/mamita/pedidos" className="rise mb-4 flex items-center gap-3 rounded-2xl bg-guinda p-4 text-white shadow-lg">
          <span className="relative flex h-3 w-3"><span className="absolute h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative h-3 w-3 rounded-full bg-white" /></span>
          <span className="flex-1 font-bold">{nuevos === 1 ? 'Tienes 1 pedido nuevo' : `Tienes ${nuevos} pedidos nuevos`}</span><ChevronRight />
        </Link>
      )}
      {dishes && <PrimerosPasos dishCount={dishes.length} />}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Platitos publicados" value={dishes ? dishes.filter((d) => !d.paused).length : '—'} />
        <Stat label="Pedidos de hoy" value={visibles.filter((o) => isToday(o.created_at)).length} />
        <Stat label="Por atender" value={porAtender} />
        <Stat label="Ventas de hoy" value={soles(ventasHoy)} highlight />
      </div>
      {sinStock > 0 && <p className="mt-3 rounded-2xl bg-[#fff4ea] p-3 text-sm text-[#9a4b0f]">{sinStock} plato(s) sin porciones. Actualízalos en <Link to="/mamita/platos" className="font-bold underline">Mis platos</Link>.</p>}
      <div className="mt-5 space-y-3">
        <MenuRow to="/mamita/platos" icon={<Target />} title="Mis platitos" text="Mira y administra lo que tienes publicado" />
        <MenuRow to="/mamita/pedidos" icon={<ShoppingBag />} title="Mis pedidos" text="Revisa quiénes esperan tus delicias" />
        <MenuRow to="/mamita/ventas" icon={<ChartColumn />} title="Mis ventas" text="Descubre cuánto estás ganando" />
        <MenuRow to="/mamita/guia" icon={<BookOpen />} title="Guía de uso" text="Aprende paso a paso a usar MAMAYS" />
      </div>
    </Screen>
  )
}
const Stat = ({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) => (
  <div className={`rounded-[20px] border p-4 ${highlight ? 'border-[#f6e0cd] bg-crema-200' : 'border-borde bg-white'}`}>
    <div className="text-xs text-gris">{label}</div>
    <div className={`mt-1 font-serif text-[28px] font-bold ${highlight ? 'text-guinda' : 'text-tinta'}`}>{value}</div>
  </div>
)
const MenuRow = ({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) => (
  <Link to={to} className="flex items-center gap-4 rounded-[20px] border border-borde bg-white p-4">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-crema-200 text-guinda">{icon}</span>
    <span className="flex-1"><span className="block font-bold">{title}</span><span className="text-xs text-gris">{text}</span></span>
    <ChevronRight className="text-cafe" />
  </Link>
)

/* ===================== MIS PLATOS ===================== */
export function MyDishes() {
  const [dishes, setDishes] = useState<DishView[] | null>(null)
  const { toast } = useToast()
  const load = useCallback(() => api.listMyDishes().then(setDishes).catch((e) => { toast(mensajeError(e), 'error'); setDishes([]) }), [toast])
  useEffect(() => { load() }, [load])

  async function patch(d: DishView, p: Partial<Dish>) {
    setDishes((xs) => xs?.map((x) => (x.id === d.id ? { ...x, ...p, available: Math.max(0, (p.portions ?? x.portions) - x.sold - x.reserved) } : x)) ?? null)
    try { await api.saveDish({ ...stripView(d), ...p }) } catch (e) { toast(mensajeError(e), 'error'); load() }
  }

  return (
    <Screen>
      <PageTitle eyebrow="Tus sabores" title="¡Vamos a publicar tus platitos!" text="Actualiza las porciones cada mañana para que nadie se quede con las ganas." />
      <Link to="/mamita/platos/nuevo"><Button><Plus size={18} /> Publicar un nuevo platito</Button></Link>
      {!dishes ? <Loading /> : dishes.length === 0 ? (
        <EmptyState icon={<Target />} title="Aún no publicas platitos" text="Publica tu primer plato del día y los comensales de tu zona lo verán al instante." />
      ) : (
        <div className="mt-5 space-y-4">
          {dishes.map((d) => (
            <article key={d.id} className="overflow-hidden rounded-[22px] border border-borde bg-white">
              <div className="flex">
                <div className="relative w-32 shrink-0 bg-[#2b2023]">
                  <DishPhoto src={d.photos[0]} alt={d.name} className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <div className="flex-1 p-3.5">
                  <div className="flex items-start justify-between">
                    <div className="eyebrow !text-[10px]">{d.category}</div>
                    <Link to={`/mamita/platos/${d.id}`} aria-label={`Editar ${d.name}`} className="-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-full bg-crema text-guinda"><Pencil size={16} /></Link>
                  </div>
                  <div className="font-bold leading-tight">{d.name}</div>
                  <div className="font-bold text-guinda">{soles(d.price)}</div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold ${d.paused ? 'bg-[#eee8e6] text-gris' : d.available === 0 ? 'bg-[#fde8e8] text-[#a32020]' : 'bg-[#e8f5ee] text-ok'}`}>
                    {d.paused ? 'PAUSADO' : d.available === 0 ? 'AGOTADO' : 'DISPONIBLE'}
                  </span>
                  <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-crema p-2 text-center">
                    {[['Inicial', d.portions], ['Vendidas', d.sold], ['Reserv.', d.reserved], ['Dispon.', d.available]].map(([k, v]) => (
                      <div key={k}><div className="text-[9px] text-gris">{k}</div><div className="text-sm font-bold">{v}</div></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-borde px-3.5 py-2">
                <Stepper value={d.portions} min={d.sold + d.reserved} max={200} label="porc." onChange={(n) => patch(d, { portions: n })} />
                <button onClick={() => patch(d, { paused: !d.paused })} className="inline-flex items-center gap-1 text-sm font-bold text-guinda">
                  {d.paused ? <><Play size={15} /> Reanudar</> : <><Pause size={15} /> Pausar</>}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Screen>
  )
}

function stripView(d: DishView): Partial<Dish> {
  const { sold: _s, reserved: _r, available: _a, mamita_name: _n, mamita_zone: _z, mamita_rating: _mr, rating: _rt, ...rest } = d
  void _s; void _r; void _a; void _n; void _z; void _mr; void _rt
  return rest
}

/* ===================== PUBLICAR / EDITAR PLATO ===================== */
export function DishForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toast } = useToast()
  const [f, setF] = useState<Partial<Dish> | null>(id ? null : {
    name: '', description: '', category: 'Tradicional', price: undefined, portions: 5, ingredients: '', allergens: [], tags: [],
    delivery_mode: 'ambos', delivery_cost: null, available_from: '11:30', available_to: '15:00', conservation: '', photos: [], paused: false,
    extras: [], dine_in: false,
  })
  const [costText, setCostText] = useState('')
  const [priceText, setPriceText] = useState('')
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!id) return
    api.getDish(id).then((d) => {
      if (!d) return nav('/mamita/platos')
      setF(stripView(d)); setPriceText(String(d.price)); setCostText(d.delivery_cost != null ? String(d.delivery_cost) : '')
    })
  }, [id, nav])
  if (!f) return <Screen><Loading /></Screen>
  const set = <K extends keyof Dish>(k: K, v: Dish[K]) => setF((x) => ({ ...x!, [k]: v }))

  function validate() {
    const e: Record<string, string> = {}
    const price = Number(priceText.replace(',', '.'))
    if ((f!.name ?? '').trim().length < 2) e.name = 'Ponle nombre a tu plato.'
    if (!(price > 0 && price <= 500)) e.price = 'Precio entre S/ 0.10 y S/ 500.'
    if ((f!.ingredients ?? '').trim().length < 3) e.ingredients = 'Los ingredientes son obligatorios: ayudan a quienes tienen alergias.'
    if (f!.delivery_mode !== 'recojo') {
      const c = costText.trim() === '' ? NaN : Number(costText.replace(',', '.'))
      if (!(c >= 0)) e.delivery_cost = 'Indica el costo de delivery (puede ser 0, sin negativos).'
    }
    if ((f!.available_from ?? '') >= (f!.available_to ?? '')) e.horario = 'La hora de fin debe ser después del inicio.'
    if ((f!.extras ?? []).some((x) => x.name.trim().length < 2 || !(x.price >= 0 && x.price <= 50))) e.extras = 'Cada extra necesita nombre y un precio entre S/ 0 y S/ 50.'
    if (!f!.photos?.length) e.photos = 'Agrega al menos una foto: los platos con foto se piden más.'
    setErrs(e)
    return Object.keys(e).length === 0
  }

  async function save() {
    if (!validate()) return toast('Revisa los campos marcados', 'error')
    setBusy(true)
    try {
      await api.saveDish({ ...f, price: Number(priceText.replace(',', '.')),
        delivery_cost: f!.delivery_mode === 'recojo' ? null : Number(costText.replace(',', '.')) })
      toast(id ? 'Plato actualizado' : '¡Plato publicado! Ya lo ven los comensales.')
      nav('/mamita/platos')
    } catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }
  async function remove() {
    try { await api.deleteDish(id!); toast('Plato eliminado', 'info'); nav('/mamita/platos') } catch (e) { toast(mensajeError(e), 'error') }
  }

  return (
    <Screen nav={false}>
      <BackButton to="/mamita/platos" label="Mis platos" />
      <PageTitle eyebrow={id ? 'Editar plato' : 'Nuevo plato'} title={id ? f.name || 'Editar plato' : 'Publicar un platito'} />
      <div className="space-y-4">
        <Field label="Fotos del plato" error={errs.photos} hint="Hasta 4. La primera es la portada.">
          <ImagePicker images={f.photos ?? []} onChange={(v) => set('photos', v)} kind="dish" />
        </Field>
        <Field label="Nombre del plato" error={errs.name}><input className="field-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Trucha frita" /></Field>
        <Field label="Descripción" optional><textarea className="field-input min-h-20" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="¿Qué lo hace especial?" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría"><select className="field-input" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Precio (S/)" error={errs.price}><input className="field-input" inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="12.00" /></Field>
        </div>
        <Field label="Porciones de hoy" hint="Se descuentan solas con cada pedido.">
          <Stepper value={f.portions ?? 0} min={0} max={200} onChange={(n) => set('portions', n)} label="porciones" />
        </Field>
        <Field label="Ingredientes" error={errs.ingredients} hint="Sepáralos con comas.">
          <textarea className="field-input min-h-20" value={f.ingredients} onChange={(e) => set('ingredients', e.target.value)} placeholder="trucha, papa, arroz, limón…" />
        </Field>
        <fieldset className="rounded-[20px] border border-borde bg-white p-4">
          <legend className="px-2 font-semibold">Alérgenos que contiene</legend>
          <CheckGrid options={ALERGENOS} value={f.allergens ?? []} onChange={(v) => set('allergens', v)} />
          <p className="mt-2 text-xs text-gris">Si no marcas ninguno, aparecerá como “Sin alérgenos declarados”.</p>
        </fieldset>
        <fieldset className="rounded-[20px] border border-borde bg-white p-4">
          <legend className="px-2 font-semibold">Etiquetas</legend>
          <CheckGrid options={ETIQUETAS} value={f.tags ?? []} onChange={(v) => set('tags', v)} />
        </fieldset>

        <div className="rounded-[20px] border border-borde bg-crema-200 p-4">
          <div className="mb-3 font-semibold">Modalidad de entrega</div>
          <Segmented<DeliveryMode> value={f.delivery_mode ?? 'ambos'} onChange={(v) => set('delivery_mode', v)} options={[
            { value: 'delivery', label: 'Solo delivery', icon: <Truck size={18} /> },
            { value: 'recojo', label: 'Solo recojo', icon: <Store size={18} /> },
            { value: 'ambos', label: 'Delivery y recojo', icon: <Users size={18} /> },
          ]} />
          {f.delivery_mode !== 'recojo' && (
            <div className="mt-3"><Field label="Costo de delivery (S/)" error={errs.delivery_cost} hint="Acepta decimales. Si es gratis, escribe 0.">
              <input className="field-input" inputMode="decimal" value={costText} onChange={(e) => setCostText(e.target.value)} placeholder="Ej. 2.50" />
            </Field></div>
          )}
        </div>

        <ExtrasEditor value={f.extras ?? []} onChange={(v) => set('extras', v)} error={errs.extras} />

        <label className="flex items-start gap-3 rounded-[20px] border border-borde bg-white p-4">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#A3173B]" checked={!!f.dine_in} onChange={(e) => set('dine_in', e.target.checked)} />
          <span className="text-sm"><b className="flex items-center gap-1.5"><DoorOpen size={16} className="text-guinda" /> Recibo comensales en mi hogar</b>
            <span className="text-gris">Podrán venir a comer a tu casa. Antes deben aceptar normas de seguridad y convivencia, y tu dirección se comparte solo cuando aceptas.</span></span>
        </label>

        <div>
          <div className="mb-1.5 text-[13px] font-bold">Horario de atención</div>
          <div className="mb-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Horarios rápidos">
            {HORARIOS.map((hh) => {
              const on = f.available_from === hh.from && f.available_to === hh.to
              return (
                <button key={hh.id} type="button" role="radio" aria-checked={on} onClick={() => setF((x) => ({ ...x!, available_from: hh.from, available_to: hh.to }))}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? 'border-guinda bg-guinda text-white' : 'border-borde bg-white text-cafe'}`}>
                  {hh.label}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className="field-input" value={f.available_from} onChange={(e) => set('available_from', e.target.value)} aria-label="Desde" />
            <input type="time" className="field-input" value={f.available_to} onChange={(e) => set('available_to', e.target.value)} aria-label="Hasta" />
          </div>
          {errs.horario && <p className="mt-1 text-xs font-semibold text-[#b42323]">{errs.horario}</p>}
          <p className="mt-1 text-xs text-gris">“Toda la tarde” (12:00 a 6:30 p. m.) atrae a estudiantes que piden entre clases.</p>
        </div>
        <Field label="Conservación" optional><input className="field-input" value={f.conservation} onChange={(e) => set('conservation', e.target.value)} placeholder="Ej. Refrigerar y consumir en 24 h" /></Field>

        <Button onClick={save} loading={busy}>{id ? 'Guardar cambios' : 'Publicar plato'}</Button>
        {id && <Button variant="danger" onClick={() => setConfirmDel(true)}><Trash2 size={16} /> Eliminar plato</Button>}
      </div>
      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="¿Eliminar este plato?">
        <p className="text-sm text-gris">Desaparecerá del menú. Los pedidos anteriores se conservan. Esta acción no se puede deshacer.</p>
        <div className="mt-5 space-y-2"><Button variant="danger" onClick={remove}>Sí, eliminar</Button><Button variant="secondary" onClick={() => setConfirmDel(false)}>Cancelar</Button></div>
      </Sheet>
    </Screen>
  )
}

/** Editor de extras / acompañamientos del plato */
function ExtrasEditor({ value, onChange, error }: { value: Extra[]; onChange: (v: Extra[]) => void; error?: string }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const sugerencias = ['Gelatina', 'Mazamorra morada', 'Arroz con leche', 'Ensalada fresca', 'Chicha morada', 'Refresco de maracuyá', 'Porción extra de arroz', 'Huevo frito']
  function add(n = name, p = price) {
    const precio = Number(String(p).replace(',', '.'))
    if (n.trim().length < 2 || !(precio >= 0 && precio <= 50) || value.length >= 10) return
    onChange([...value, { id: `x${Date.now().toString(36)}`, name: n.trim(), price: Math.round(precio * 100) / 100 }])
    setName(''); setPrice('')
  }
  return (
    <fieldset className="rounded-[20px] border border-borde bg-white p-4">
      <legend className="px-2 font-semibold">Extras y acompañamientos <span className="text-xs font-normal text-gris">(opcional)</span></legend>
      <p className="-mt-1 text-xs text-gris">El comensal los puede sumar a su plato: postres, gelatina, ensaladas, bebidas…</p>
      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((x) => (
            <li key={x.id} className="flex items-center gap-2 rounded-xl bg-crema px-3 py-2 text-sm">
              <span className="flex-1 font-semibold">{x.name}</span>
              <span className="whitespace-nowrap font-bold text-guinda">+ {soles(x.price)}</span>
              <button type="button" onClick={() => onChange(value.filter((e) => e.id !== x.id))} aria-label={`Quitar ${x.name}`} className="grid h-8 w-8 place-items-center rounded-full text-gris hover:bg-white"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid grid-cols-[1fr_90px_auto] gap-2">
        <input className="field-input !py-2.5" placeholder="Ej. Gelatina" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del extra" maxLength={40} />
        <input className="field-input !py-2.5" placeholder="S/ 2.00" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Precio del extra" />
        <button type="button" onClick={() => add()} className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-guinda text-white disabled:opacity-40" disabled={name.trim().length < 2 || price === ''} aria-label="Agregar extra"><Plus size={18} /></button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sugerencias.filter((sg) => !value.some((v) => v.name === sg)).slice(0, 6).map((sg) => (
          <button key={sg} type="button" onClick={() => setName(sg)} className="rounded-full border border-dashed border-[#d9b3bf] px-2.5 py-1 text-[11.5px] font-semibold text-guinda">+ {sg}</button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-[#b42323]">{error}</p>}
    </fieldset>
  )
}

/* ===================== PEDIDOS (MAMITA) ===================== */
export function MamitaOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [tab, setTab] = useState<'activos' | 'cerrados'>('activos')
  const [voucher, setVoucher] = useState<string | null>(null)
  const [reject, setReject] = useState<Order | null>(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rutaId, setRutaId] = useState<string | null>(null)
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const focus = params.get('o')
  const { toast } = useToast()
  const load = useCallback(() => api.listMyOrders().then(setOrders).catch((e) => { toast(mensajeError(e), 'error'); setOrders([]) }), [toast])
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])

  const visibles = useMemo(() => (orders ?? []).filter((o) => o.status !== 'reservado' && o.status !== 'expirado'), [orders])
  const list = visibles.filter((o) => (tab === 'activos' ? ACTIVE_STATUSES.includes(o.status) : !ACTIVE_STATUSES.includes(o.status)))

  async function advance(o: Order) {
    const n = nextStatus(o.status, o.mode)
    if (!n) return
    setBusyId(o.id)
    try { await api.setOrderStatus(o.id, n); toast(nextActionLabel(n, o.mode)); await load() } catch (e) { toast(mensajeError(e), 'error') } finally { setBusyId(null) }
  }
  async function doReject() {
    if (!reject) return
    try {
      await api.setOrderStatus(reject.id, 'rechazado', reason.trim())
      toast(reject.paid_at ? 'Pedido rechazado. Devuelve el pago desde Mercado Pago (Actividad → el pago → Devolver).' : 'Pedido rechazado. Si ya te yapearon, devuelve el dinero.', 'info')
      setReject(null); setReason(''); load()
    }
    catch (e) { toast(mensajeError(e), 'error') }
  }

  return (
    <Screen>
      <PageTitle eyebrow="Pedidos en tiempo real" title="¡Mira quién quiere probar tus platitos!" text="Aquí encontrarás los pedidos que llegan para ti." />
      <div className="mb-4 grid grid-cols-2 rounded-2xl bg-crema p-1">
        {(['activos', 'cerrados'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-xl py-2 text-sm font-bold capitalize ${tab === t ? 'bg-white text-guinda shadow-sm' : 'text-gris'}`}>
            {t} {t === 'activos' && visibles.filter((o) => ACTIVE_STATUSES.includes(o.status)).length > 0 && `(${visibles.filter((o) => ACTIVE_STATUSES.includes(o.status)).length})`}
          </button>
        ))}
      </div>
      {!orders ? <Loading /> : list.length === 0 ? (
        <EmptyState icon={<Heart />} title={tab === 'activos' ? 'Aún no llegaron pedidos' : 'Sin pedidos cerrados'} text={tab === 'activos' ? 'Cuando llegue uno, lo verás aquí al instante.' : 'Los pedidos entregados o cancelados aparecerán aquí.'} />
      ) : (
        <div className="space-y-4">
          {list.map((o) => {
            const n = nextStatus(o.status, o.mode)
            return (
              <article key={o.id} className={`rounded-[22px] border bg-white p-4 ${focus === o.id ? 'border-guinda ring-2 ring-guinda/20' : 'border-borde'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gris">{o.code}</span><StatusBadge s={o.status} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={o.comensal_name} size={40} />
                  <div className="flex-1"><div className="text-[11px] text-gris">Comensal</div><div className="font-bold">{o.comensal_name}</div></div>
                  <div className="text-right text-xs text-gris">{fechaHora(o.created_at)}</div>
                </div>
                <div className="mt-3"><OrderItems o={o} /></div>
                <div className="mt-3 space-y-1 rounded-2xl bg-crema p-3 text-sm">
                  <div className="flex gap-2">{o.mode === 'delivery' ? <Truck size={16} className="mt-0.5 text-guinda" /> : o.mode === 'en_casa' ? <DoorOpen size={16} className="mt-0.5 text-guinda" /> : <Store size={16} className="mt-0.5 text-guinda" />}
                    {o.mode === 'delivery' && <span>Delivery a <b>{o.delivery_address}</b></span>}
                    {o.mode === 'recojo' && <span>Recoge en tu cocina</span>}
                    {o.mode === 'en_casa' && <span><b>Comerá en tu hogar · {o.guests} {o.guests === 1 ? 'persona' : 'personas'}</b>
                      {o.terms_accepted_at && <span className="block text-xs text-ok">✓ Aceptó las normas de seguridad y convivencia</span>}</span>}</div>
                  {o.mode === 'delivery' && ACTIVE_STATUSES.includes(o.status) && (
                    rutaId === o.id ? (
                      <RouteCard className="mt-2" title={`¿A cuánto está ${primerNombre(o.receiver_name)}?`} defaultMode="car"
                        to={o.delivery_lat != null && o.delivery_lng != null ? { lat: o.delivery_lat, lng: o.delivery_lng } : null}
                        toLabel={o.receiver_name} googleDest={o.delivery_address}
                        from={profile?.home_lat != null && profile.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : undefined}
                        fromLabel="Tu cocina" />
                    ) : (
                      <button onClick={() => setRutaId(o.id)} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-guinda shadow-sm">
                        <Navigation size={13} /> {o.delivery_lat != null ? 'Ver ruta y tiempo de llegada' : 'Ruta en Google Maps'}
                      </button>
                    )
                  )}
                  <div className="flex gap-2"><Phone size={16} className="mt-0.5 text-guinda" /> Recibe {o.receiver_name} · <a className="font-semibold text-guinda" href={`tel:${o.receiver_phone}`}>{o.receiver_phone}</a></div>
                  {o.payer_name && o.payer_name !== o.receiver_name && <div className="flex gap-2"><Users size={16} className="mt-0.5 text-guinda" /> Paga {o.payer_name}</div>}
                  {o.notes && <div className="rounded-xl bg-white p-2 text-[13px]">📝 {o.notes}</div>}
                </div>
                <div className="mt-3"><OrderTotals o={o} /></div>
                <div className={`mt-3 flex items-center justify-between gap-2 rounded-2xl p-3 ${o.paid_at ? 'bg-[#e8f5ee]' : o.payment_method === 'efectivo' ? 'bg-[#e9f0fb]' : 'bg-crema-200'}`}>
                  <span className="text-sm font-bold">
                    {o.payment_method === 'yape' && <>YAPE · <span className="text-ok">pagado en línea ✓</span></>}
                    {o.payment_method === 'tarjeta' && <>TARJETA · <span className="text-ok">pagado en línea ✓</span></>}
                    {o.payment_method === 'yape_manual' && 'YAPE · con constancia'}
                    {o.payment_method === 'efectivo' && 'EFECTIVO · cobrar al entregar'}
                    {o.payment_id && <span className="block text-[11px] font-normal text-gris">Op. {o.payment_id}</span>}
                  </span>
                  {o.payment_method === 'yape_manual' && o.voucher_url && (
                    <button onClick={() => setVoucher(o.voucher_url)} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-guinda shadow-sm"><Eye size={14} /> Ver constancia</button>
                  )}
                </div>
                {o.status === 'enviado' && o.payment_method === 'yape_manual' && <p className="mt-2 text-xs text-gris">Verifica en tu app de Yape que llegaron {soles(o.total)} antes de aceptar.</p>}
                {o.status === 'enviado' && o.paid_at && <p className="mt-2 text-xs text-ok">Mercado Pago ya confirmó el cobro de {soles(o.total)}.</p>}
                {n && (
                  <div className="mt-3 flex gap-2">
                    {['enviado', 'aceptado'].includes(o.status) && <Button variant="secondary" full={false} onClick={() => setReject(o)}>Rechazar</Button>}
                    <Button onClick={() => advance(o)} loading={busyId === o.id} className="flex-1">{nextActionLabel(n, o.mode)}</Button>
                  </div>
                )}
                {o.rating && <p className="mt-3 text-sm"><span className="text-[#E9A23B]">{'★'.repeat(o.rating)}</span> {o.review && <span className="text-gris">“{o.review}”</span>}</p>}
              </article>
            )
          })}
        </div>
      )}
      <Sheet open={!!voucher} onClose={() => setVoucher(null)} title="Constancia de Yape">{voucher && <VoucherImage ref_={voucher} />}</Sheet>
      <Sheet open={!!reject} onClose={() => setReject(null)} title="Rechazar pedido">
        <p className="text-sm text-gris">Cuéntale al comensal el motivo. Si ya te yapeó, recuerda devolverle el dinero.</p>
        <textarea className="field-input mt-3 min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Se me acabó el arroz, disculpa" />
        <div className="mt-4 space-y-2"><Button variant="danger" onClick={doReject}>Rechazar pedido</Button><Button variant="secondary" onClick={() => setReject(null)}>Volver</Button></div>
      </Sheet>
    </Screen>
  )
}

/* ===================== MIS VENTAS ===================== */
export function MamitaSales() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  useEffect(() => { api.listMyOrders().then(setOrders).catch(() => setOrders([])) }, [])
  const done = (orders ?? []).filter((o) => o.status === 'entregado')
  const now = new Date()
  const sum = (days: number) => done.filter((o) => (now.getTime() - new Date(o.created_at).getTime()) / 86400000 < days).reduce((a, o) => a + o.total, 0)
  const hoy = done.filter((o) => isToday(o.created_at)).reduce((a, o) => a + o.total, 0)
  // últimos 7 días para el gráfico
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return limaDay(d) })
  const perDay = days.map((day) => done.filter((o) => limaDay(o.created_at) === day).reduce((a, o) => a + o.total, 0))
  const max = Math.max(1, ...perDay)
  const top = Object.entries(done.flatMap((o) => o.items).reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.dish_name]: (acc[i.dish_name] ?? 0) + i.qty }), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <Screen>
      <BackButton to="/mamita" label="Inicio" />
      <PageTitle eyebrow="Mis ventas" title="Lo que vas ganando" text="Solo cuentan los pedidos entregados." />
      {!orders ? <Loading /> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[['Hoy', hoy], ['7 días', sum(7)], ['30 días', sum(30)]].map(([k, v]) => (
              <Card key={k as string} tone={k === 'Hoy' ? 'crema' : 'white'} className="!p-3 text-center">
                <div className="text-[11px] text-gris">{k}</div><div className="mt-0.5 font-serif text-lg font-bold text-guinda">{soles(v as number)}</div>
              </Card>
            ))}
          </div>
          <Card className="mt-4">
            <div className="mb-3 text-sm font-bold">Últimos 7 días</div>
            <div className="flex h-36 items-end gap-2">
              {perDay.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-gris">{v ? Math.round(v) : ''}</span>
                  <div className="w-full rounded-t-lg bg-guinda/85" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 2, opacity: v ? 1 : 0.15 }} />
                  <span className="text-[10px] text-gris">{new Date(days[i] + 'T12:00').toLocaleDateString('es-PE', { weekday: 'narrow' })}</span>
                </div>
              ))}
            </div>
          </Card>
          {top.length > 0 && (
            <Card className="mt-4">
              <div className="mb-2 text-sm font-bold">Tus platos más pedidos</div>
              {top.map(([name, qty], i) => <div key={name} className="flex justify-between py-1 text-sm"><span>{i + 1}. {name}</span><b>{qty}</b></div>)}
            </Card>
          )}
          <h2 className="mb-2 mt-6 text-sm font-extrabold text-gris">PEDIDOS ENTREGADOS</h2>
          {done.length === 0 ? <p className="text-sm text-gris">Aún no hay ventas entregadas.</p> : (
            <ul className="divide-y divide-borde rounded-[20px] border border-borde bg-white">
              {done.map((o) => (
                <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span><b className="font-mono text-xs">{o.code}</b><br /><span className="text-gris">{o.comensal_name} · {fechaHora(o.created_at)}</span></span>
                  <b className="whitespace-nowrap pl-3 text-guinda">{soles(o.total)}</b>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Screen>
  )
}

/* ===================== MI PERFIL (MAMITA) ===================== */
export function MamitaProfile() {
  const { profile, setProfile, signOut } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState(profile!)
  const [rating, setRating] = useState<{ r: number | null; c: number; n: number }>({ r: null, c: 0, n: 0 })
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [locBusy, setLocBusy] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { api.getMamita(profile!.id).then((m) => m && setRating({ r: m.rating, c: m.rating_count, n: m.dish_count })).catch(() => {}) }, [profile])
  const loadReviews = useCallback(() => api.listReviews({ mamitaId: profile!.id }).then(setReviews).catch(() => {}), [profile])
  useEffect(() => { loadReviews() }, [loadReviews])
  const [dishNames, setDishNames] = useState<Record<string, string>>({})
  useEffect(() => { api.listMyDishes().then((ds) => setDishNames(Object.fromEntries(ds.map((d) => [d.id, d.name])))).catch(() => {}) }, [])

  // Cambiar la foto de perfil tocando la cámara (se guarda al instante)
  async function changePhoto(file?: File) {
    if (!file || !file.type.startsWith('image/')) return
    setPhotoBusy(true)
    try {
      const blob = await comprimirImagen(file, 600, 0.8)
      const url = await api.uploadImage('avatar', blob)
      const p = await api.updateProfile({ avatar_url: url })
      setProfile(p); setF((x) => ({ ...x, avatar_url: url })); toast('¡Foto de perfil actualizada!')
    } catch (e) { toast(mensajeError(e), 'error') } finally { setPhotoBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  async function save() {
    if (!celularValido(f.phone) || !celularValido(f.yape_phone)) return toast('Revisa los números de celular y Yape', 'error')
    setBusy(true)
    try { const p = await api.updateProfile({ ...f, phone: f.phone.replace(/\D/g, ''), yape_phone: f.yape_phone.replace(/\D/g, '') }); setProfile(p); setF(p); setEdit(false); toast('Perfil actualizado') }
    catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }

  const p = profile!
  return (
    <Screen className="!px-0 !pt-0">
      <div className="relative h-36 overflow-hidden rounded-b-[32px] bg-gradient-to-br from-guinda to-[#d0345d]">
        <div className="absolute -right-4 top-4 h-28 w-28 rounded-full border-[16px] border-white/15" />
      </div>
      <div className="px-5">
        <div className="-mt-14 flex items-end justify-between">
          <div className="relative">
            <Avatar name={p.full_name} url={p.avatar_url} size={104} />
            <button onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label="Cambiar foto de perfil"
              className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-[3px] border-white bg-guinda text-white shadow-lg">
              {photoBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Camera size={18} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => changePhoto(e.target.files?.[0])} data-testid="avatar-input" />
          </div>
          <button onClick={() => setEdit(!edit)} className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-borde bg-white px-4 py-2 text-xs font-bold text-guinda shadow-sm">
            <Pencil size={14} /> {edit ? 'Cerrar edición' : 'Editar perfil y fotos'}
          </button>
        </div>
        <Eyebrow className="mt-4">Este es tu espacio, mamita</Eyebrow>
        <h1 className="mt-1 font-serif text-[32px] font-bold leading-tight">{p.full_name}</h1>
        <div className="text-sm text-gris"><Stars value={rating.r} count={rating.c} /> · {p.zone}</div>
        {!edit ? (
          <>
            {p.bio && <p className="mt-3 text-[15px] text-gris">{p.bio}</p>}
            <Card tone="crema" className="mt-5">
              <div className="font-serif text-xl font-bold">Así es mi hogar</div>
              <p className="mt-1 text-sm text-gris">{p.home_description || 'Aún no describes tu cocina. Los comensales confían más cuando la conocen.'}</p>
              {p.home_photos.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{p.home_photos.map((x, i) => <img key={i} src={x} alt="Cocina" className="h-24 w-36 rounded-xl object-cover" />)}</div>}
              {!p.show_home && <p className="mt-2 text-[11px] font-semibold text-[#9a4b0f]">Oculto al público (actívalo en Editar)</p>}
            </Card>
            <Card tone="crema" className="mt-3 space-y-2 text-sm">
              <div><div className="text-[10px] font-bold uppercase tracking-wider text-gris">Zona pública</div>{p.public_zone_label || p.zone}</div>
              <div><div className="text-[10px] font-bold uppercase tracking-wider text-gris">Yape</div>{p.yape_name} · {p.yape_phone}</div>
              <div><div className="text-[10px] font-bold uppercase tracking-wider text-gris">Contacto</div>{p.phone}</div>
            </Card>
            <p className="mt-4 font-serif text-lg font-bold">{rating.n} platitos publicados</p>

            <section className="mt-6" aria-labelledby="resenas-mamita">
              <div className="flex items-end justify-between">
                <h2 id="resenas-mamita" className="font-serif text-2xl font-bold">Lo que dicen de ti</h2>
                <span className="pb-1 text-xs text-gris">{reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}</span>
              </div>
              {reviews.length === 0 ? <p className="mt-2 text-sm text-gris">Cuando te califiquen o comenten tus platos, aparecerá aquí y podrás responder.</p> : (
                <ul className="mt-1 divide-y divide-borde">
                  {reviews.map((r) => (
                    <ReviewItem key={r.id} r={r} canReply onChanged={loadReviews}
                      label={r.kind === 'mamita' ? 'Sobre ti' : r.kind === 'dish' ? `Calificación · ${dishNames[r.dish_id ?? ''] ?? 'plato'}` : `Comentario · ${dishNames[r.dish_id ?? ''] ?? 'plato'}`} />
                  ))}
                </ul>
              )}
            </section>
            <Link to="/mamita/guia" className="mt-6 flex items-center gap-3 rounded-[20px] border border-borde bg-white p-4">
              <BookOpen className="text-guinda" /><span className="flex-1 font-bold">Guía de uso</span><ChevronRight className="text-gris" />
            </Link>
            <Button variant="secondary" className="mt-6" onClick={async () => { await signOut(); nav('/') }}>Cerrar sesión</Button>
          </>
        ) : (
          <div className="mt-5 space-y-4 pb-4">
            <Field label="Foto de perfil"><ImagePicker images={f.avatar_url ? [f.avatar_url] : []} onChange={(v) => set('avatar_url', v[0] ?? '')} max={1} kind="avatar" /></Field>
            <Field label="Nombres y apellidos"><input className="field-input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Celular"><input className="field-input" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="Distrito o zona"><select className="field-input" value={f.zone} onChange={(e) => set('zone', e.target.value)}>{ZONAS.map((z) => <option key={z}>{z}</option>)}</select></Field>
            </div>
            <Field label="Dirección de referencia (privada)" hint="Solo la recibe el comensal cuando aceptas un pedido para recojo."><input className="field-input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
            <div className="rounded-[20px] border border-borde bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold"><LocateFixed size={17} className="text-guinda" /> Ubicación exacta de tu cocina <span className="text-xs font-normal text-gris">(privada)</span></div>
              <p className="mt-1 text-xs text-gris">Márcala estando en tu cocina. Así el comensal ve la ruta y el tiempo exacto para llegar, solo cuando aceptas su pedido de recojo o para comer en tu hogar.</p>
              {f.home_lat != null ? (
                <div className="mt-2 flex items-center gap-2 text-[13px] text-ok"><Check size={15} /> <span className="flex-1">Ubicación guardada</span>
                  <button type="button" onClick={() => setF((x) => ({ ...x, home_lat: null, home_lng: null }))} className="text-xs font-bold text-gris underline">Quitar</button></div>
              ) : null}
              <button type="button" disabled={locBusy} onClick={async () => {
                setLocBusy(true)
                try { const p = await getMyLocation(); setF((x) => ({ ...x, home_lat: Number(p.lat.toFixed(6)), home_lng: Number(p.lng.toFixed(6)) })); toast('Ubicación marcada. Toca “Guardar cambios”.', 'info') }
                catch (e) { toast(mensajeError(e), 'error') } finally { setLocBusy(false) }
              }} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-crema py-2.5 text-sm font-bold text-cafe">
                {locBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-guinda border-t-transparent" /> : <LocateFixed size={16} className="text-guinda" />}
                {f.home_lat != null ? 'Volver a marcar con mi ubicación actual' : 'Marcar con mi ubicación actual'}
              </button>
            </div>
            <Field label="Zona que deseas mostrar públicamente"><input className="field-input" value={f.public_zone_label} onChange={(e) => set('public_zone_label', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Titular Yape"><input className="field-input" value={f.yape_name} onChange={(e) => set('yape_name', e.target.value)} /></Field>
              <Field label="Número Yape"><input className="field-input" inputMode="tel" value={f.yape_phone} onChange={(e) => set('yape_phone', e.target.value)} /></Field>
            </div>
            <Field label="Presentación personal"><textarea className="field-input min-h-24" value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
            <Field label="Tu cocina y ambiente"><textarea className="field-input min-h-24" value={f.home_description} onChange={(e) => set('home_description', e.target.value)} /></Field>
            <Field label="Fotos de tu cocina"><ImagePicker images={f.home_photos} onChange={(v) => set('home_photos', v)} kind="home" /></Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#A3173B]" checked={f.show_home} onChange={(e) => set('show_home', e.target.checked)} />
              Deseo mostrar la descripción y fotos de mi hogar públicamente
            </label>
            <Button onClick={save} loading={busy}>Guardar cambios</Button>
          </div>
        )}
      </div>
    </Screen>
  )
}

