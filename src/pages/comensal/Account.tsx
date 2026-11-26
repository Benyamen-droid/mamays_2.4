import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, DoorOpen, MapPin, Phone, ReceiptText, Store, Truck, Users } from 'lucide-react'
import { api, mensajeError } from '../../data'
import { useAuth, useToast } from '../../context/AppContext'
import { ACTIVE_STATUSES, ALERGENOS, PAYMENT_LABEL, STATUS_LABEL, ZONAS } from '../../lib/constants'
import type { Order } from '../../lib/types'
import { celularValido, fechaHora, soles } from '../../lib/format'
import { OrderItems, OrderTimeline, OrderTotals, StatusBadge } from '../../components/orders'
import { CREDITS, photoPage } from '../../data/realPhotos'
import { Avatar, BackButton, Button, Card, CheckGrid, DishPhoto, EmptyState, Eyebrow, Field, ImagePicker, Loading, PageTitle, Screen, Sheet } from '../../components/ui'
import { StarsInput, StarsRow } from '../../components/reviews'
import { RouteCard } from '../../components/RouteCard'
import type { LatLng } from '../../lib/route'

/* ===================== MIS PEDIDOS ===================== */
export function MyOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const { toast } = useToast()
  const load = useCallback(() => api.listMyOrders().then(setOrders).catch((e) => { toast(mensajeError(e), 'error'); setOrders([]) }), [toast])
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])
  const active = (orders ?? []).filter((o) => ACTIVE_STATUSES.includes(o.status))
  const past = (orders ?? []).filter((o) => !ACTIVE_STATUSES.includes(o.status))
  return (
    <Screen>
      <PageTitle eyebrow="Seguimiento" title="Mis pedidos" text="Aquí ves en qué va tu almuerzo, paso a paso." />
      {!orders ? <Loading /> : orders.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title="Aún no tienes pedidos" text="Cuando pidas tu primer platito, lo seguirás desde aquí." action={<Link to="/comensal"><Button>Ver menú del día</Button></Link>} />
      ) : (
        <>
          {active.length > 0 && <h2 className="mb-2 text-sm font-extrabold text-guinda">EN CURSO</h2>}
          <div className="space-y-3">{active.map((o) => <OrderRow key={o.id} o={o} highlight />)}</div>
          {past.length > 0 && <h2 className="mb-2 mt-6 text-sm font-extrabold text-gris">HISTORIAL</h2>}
          <div className="space-y-3">{past.map((o) => <OrderRow key={o.id} o={o} />)}</div>
        </>
      )}
    </Screen>
  )
}

function OrderRow({ o, highlight }: { o: Order; highlight?: boolean }) {
  return (
    <Link to={`/comensal/pedidos/${o.id}`} className={`block rounded-[20px] border p-4 ${highlight ? 'border-guinda/40 bg-white shadow-[0_8px_24px_-14px_rgb(163_23_59/0.6)]' : 'border-borde bg-white'}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-gris">{o.code}</span>
        <StatusBadge s={o.status} />
      </div>
      <div className="mt-2 font-bold">{o.items.map((i) => `${i.qty} × ${i.dish_name}`).join(', ')}</div>
      <div className="mt-0.5 text-xs text-gris">{o.mamita_name} · {fechaHora(o.created_at)}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{highlight ? STATUS_LABEL[o.status] : soles(o.total)}</span>
        <ChevronRight size={18} className="text-gris" />
      </div>
    </Link>
  )
}

/* ===================== DETALLE / SEGUIMIENTO ===================== */
export function OrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toast } = useToast()
  const [o, setO] = useState<Order | null | undefined>(undefined)
  const [stars, setStars] = useState(0)
  const [review, setReview] = useState('')
  const [dishRates, setDishRates] = useState<Record<string, { rating: number; body: string }>>({})
  const [busy, setBusy] = useState(false)
  const [askCancel, setAskCancel] = useState(false)
  const load = useCallback(() => api.getOrder(id!).then(setO).catch(() => setO(null)), [id])
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])
  // antes de que acepte: zona aproximada de la mamita para estimar la distancia
  const [mamitaPos, setMamitaPos] = useState<LatLng | null>(null)
  const mamitaId = o?.mamita_id
  useEffect(() => {
    if (!mamitaId) return
    api.getMamita(mamitaId).then((m) => m && m.lat != null && m.lng != null && setMamitaPos({ lat: m.lat, lng: m.lng })).catch(() => {})
  }, [mamitaId])

  if (o === undefined) return <Screen><Loading /></Screen>
  if (!o) return <Screen><EmptyState icon={<ReceiptText />} title="Pedido no encontrado" text="" /></Screen>

  async function cancel() {
    setAskCancel(false)
    try { await api.setOrderStatus(o!.id, 'cancelado'); toast('Pedido cancelado', 'info'); load() } catch (e) { toast(mensajeError(e), 'error') }
  }
  const platos = [...new Map(o.items.filter((i) => i.dish_id).map((i) => [i.dish_id, i])).values()]
  async function rate() {
    if (!stars) return toast('Califica a la mamita (de 1 a 5 estrellas)', 'error')
    const faltan = platos.filter((p) => !dishRates[p.dish_id]?.rating)
    if (faltan.length) return toast(`Califica también: ${faltan.map((p) => p.dish_name).join(', ')}`, 'error')
    setBusy(true)
    try {
      await api.submitReviews(o!.id, {
        mamita: { rating: stars, body: review },
        dishes: platos.map((p) => ({ dish_id: p.dish_id, rating: dishRates[p.dish_id].rating, body: dishRates[p.dish_id].body ?? '' })),
      })
      toast('¡Gracias por tu calificación!'); load()
    } catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }

  return (
    <Screen>
      <BackButton to="/comensal/pedidos" label="Mis pedidos" />
      <div className="mt-2 flex items-center justify-between">
        <Eyebrow>Seguimiento de tu pedido</Eyebrow>
        <StatusBadge s={o.status} />
      </div>
      <h1 className="mt-1 font-mono text-2xl font-bold">{o.code}</h1>
      <p className="text-sm text-gris">{o.mamita_name} · {fechaHora(o.created_at)}</p>

      {o.status === 'reservado' && (
        <div className="mt-4 rounded-2xl bg-[#fff4ea] p-4 text-sm text-[#9a4b0f]">
          {o.payment_method === 'yape_manual' ? 'Falta adjuntar tu constancia de Yape.' : 'Falta completar el pago de tu pedido.'}
          <Button className="mt-3" onClick={() => nav(`/comensal/pago/${o.id}`)}>{o.payment_method === 'yape_manual' ? 'Adjuntar constancia' : 'Completar pago'}</Button>
        </div>
      )}

      <Card className="mt-5"><OrderTimeline order={o} /></Card>

      {o.mode !== 'delivery' && ACTIVE_STATUSES.includes(o.status) && (
        o.pickup_lat != null && o.pickup_lng != null ? (
          <RouteCard className="mt-4" title={o.mode === 'en_casa' ? 'Cómo llegar al hogar de la mamita' : 'Cómo llegar a recoger tu pedido'}
            to={{ lat: o.pickup_lat, lng: o.pickup_lng }} toLabel={`Cocina de ${o.mamita_name}`} googleDest={o.pickup_address} />
        ) : o.pickup_address ? (
          <RouteCard className="mt-4" title="Cómo llegar" to={null} toLabel={o.mamita_name} googleDest={o.pickup_address} />
        ) : mamitaPos ? (
          <RouteCard className="mt-4" title={`¿A cuánto está ${o.mamita_name}?`} to={mamitaPos} toLabel={`Zona de ${o.mamita_name}`} approx />
        ) : null
      )}

      <Card className="mt-4">
        <OrderItems o={o} />
        <div className="mt-3"><OrderTotals o={o} /></div>
        <div className="mt-3 space-y-1.5 text-sm text-cafe">
          {o.mode === 'delivery' ? (
            <div className="flex gap-2"><Truck size={16} className="mt-0.5 shrink-0 text-guinda" /> Delivery a {o.delivery_address}</div>
          ) : (
            <div className="flex gap-2">{o.mode === 'en_casa' ? <DoorOpen size={16} className="mt-0.5 shrink-0 text-guinda" /> : <Store size={16} className="mt-0.5 shrink-0 text-guinda" />}
              <span>
                {o.mode === 'en_casa' ? `Comer en el hogar · ${o.guests} ${o.guests === 1 ? 'persona' : 'personas'}` : 'Recojo'}
                {o.pickup_address ? <> en <b>{o.pickup_address}</b></> : ' · la dirección aparece cuando la mamita acepte'}
                {o.mode === 'en_casa' && o.terms_accepted_at && <span className="block text-xs text-ok">✓ Aceptaste los términos de seguridad y convivencia</span>}
              </span>
            </div>
          )}

          {o.receiver_name && o.receiver_name !== o.comensal_name && (
            <div className="flex gap-2"><Users size={16} className="mt-0.5 shrink-0 text-guinda" /> Lo recibe {o.receiver_name} · {o.receiver_phone}</div>
          )}
          <div className="flex gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-guinda" />
            <span>Pago: {PAYMENT_LABEL[o.payment_method]}{o.paid_at && <b className="text-ok"> · aprobado ✓</b>}{o.payment_id && <span className="block text-xs text-gris">Op. {o.payment_id}</span>}</span>
          </div>
        </div>
      </Card>

      {['reservado', 'enviado'].includes(o.status) && (
        <Button variant="danger" className="mt-4" onClick={() => setAskCancel(true)}>Cancelar pedido</Button>
      )}

      {o.status === 'entregado' && (
        <Card tone="crema" className="mt-4">
          {o.rating ? (
            <div className="text-sm"><b>Tu calificación a la mamita:</b> <StarsRow n={o.rating} />{o.review && <p className="mt-1 text-gris">“{o.review}”</p>}
              <p className="mt-2 text-xs text-gris">Tus calificaciones de los platos aparecen en su sección de comentarios.</p></div>
          ) : (
            <>
              <div className="font-serif text-xl font-bold">¿Qué tal estuvo?</div>
              <p className="text-xs text-gris">Tu opinión ayuda a otros comensales y a la mamita.</p>
              <div className="mt-3 rounded-2xl bg-white p-3">
                <div className="text-sm font-bold">La mamita · {o.mamita_name}</div>
                <p className="text-[11px] text-gris">Atención, puntualidad, trato</p>
                <div className="mt-1"><StarsInput value={stars} onChange={setStars} label="Calificación de la mamita" /></div>
                <textarea className="field-input mt-2 min-h-16 text-sm" placeholder="Cuéntale a la mamita (opcional)" value={review} onChange={(e) => setReview(e.target.value)} maxLength={400} />
              </div>
              {platos.map((p) => (
                <div key={p.dish_id} className="mt-3 rounded-2xl bg-white p-3">
                  <div className="flex items-center gap-2">
                    <DishPhoto src={p.photo} alt={p.dish_name} className="h-9 w-9 rounded-lg object-cover" />
                    <div className="text-sm font-bold">{p.dish_name}</div>
                  </div>
                  <p className="mt-1 text-[11px] text-gris">Sabor, porción, presentación</p>
                  <div className="mt-1"><StarsInput value={dishRates[p.dish_id]?.rating ?? 0} label={`Calificación de ${p.dish_name}`}
                    onChange={(n) => setDishRates((x) => ({ ...x, [p.dish_id]: { rating: n, body: x[p.dish_id]?.body ?? '' } }))} /></div>
                  <textarea className="field-input mt-2 min-h-14 text-sm" placeholder="Comentario del plato (opcional, será público)" maxLength={500}
                    value={dishRates[p.dish_id]?.body ?? ''} onChange={(e) => setDishRates((x) => ({ ...x, [p.dish_id]: { rating: x[p.dish_id]?.rating ?? 0, body: e.target.value } }))} />
                </div>
              ))}
              <Button className="mt-3" onClick={rate} loading={busy}>Enviar calificación</Button>
            </>
          )}
        </Card>
      )}
      <Sheet open={askCancel} onClose={() => setAskCancel(false)} title="¿Cancelar este pedido?">
        <p className="text-sm text-gris">La mamita dejará de prepararlo. Si ya yapeaste, coordina la devolución con ella.</p>
        <div className="mt-5 space-y-2">
          <Button variant="danger" onClick={cancel}>Sí, cancelar pedido</Button>
          <Button variant="secondary" onClick={() => setAskCancel(false)}>Mantener pedido</Button>
        </div>
      </Sheet>
    </Screen>
  )
}


/* ===================== MI PERFIL (COMENSAL) ===================== */
export function ComensalProfile() {
  const { profile, setProfile, signOut } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [f, setF] = useState(() => ({ ...profile!, allergies: profile!.allergies.length ? profile!.allergies : ['Ninguna'] }))
  const [busy, setBusy] = useState(false)
  const [credits, setCredits] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  async function save() {
    if (!celularValido(f.phone)) return toast('Celular no válido', 'error')
    setBusy(true)
    try {
      const p = await api.updateProfile({ ...f, phone: f.phone.replace(/\D/g, ''), allergies: f.allergies.filter((a) => a !== 'Ninguna') })
      setProfile(p); toast('Perfil actualizado')
    } catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }

  return (
    <Screen>
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={f.full_name} url={f.avatar_url} size={72} />
        <div><div className="eyebrow">Mi perfil</div><h1 className="font-serif text-[26px] font-bold leading-tight">{profile!.full_name}</h1><p className="text-sm text-gris">{profile!.email}</p></div>
      </div>
      <div className="space-y-4">
        <Field label="Foto de perfil" optional><ImagePicker images={f.avatar_url ? [f.avatar_url] : []} onChange={(v) => set('avatar_url', v[0] ?? '')} max={1} kind="avatar" label="Subir foto" /></Field>
        <Field label="Nombres y apellidos"><input className="field-input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Celular"><input className="field-input" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Zona"><select className="field-input" value={f.zone} onChange={(e) => set('zone', e.target.value)}>{ZONAS.map((z) => <option key={z}>{z}</option>)}</select></Field>
        </div>
        <Field label="Dirección de entrega"><input className="field-input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <fieldset className="rounded-[20px] border border-borde bg-white p-4">
          <legend className="px-2 font-semibold">Alergias e intolerancias</legend>
          <CheckGrid options={ALERGENOS} value={f.allergies} onChange={(v) => set('allergies', v)} noneLabel="Ninguna" />
          <p className="mt-2 text-xs text-gris">Usamos esto para avisarte y ocultar platos que no son para ti.</p>
        </fieldset>
        <Field label="Otras alergias" optional><input className="field-input" value={f.other_allergies} onChange={(e) => set('other_allergies', e.target.value)} /></Field>
        <Field label="Preferencias de comida" optional><textarea className="field-input min-h-20" value={f.preferences} onChange={(e) => set('preferences', e.target.value)} /></Field>
        <Field label="Alimentos que deseas evitar" optional><textarea className="field-input min-h-20" value={f.avoid_foods} onChange={(e) => set('avoid_foods', e.target.value)} /></Field>
        <Button onClick={save} loading={busy}>Guardar cambios</Button>
        <Button variant="secondary" onClick={async () => { await signOut(); nav('/') }}>Cerrar sesión</Button>
        <p className="flex items-center justify-center gap-1 text-center text-xs text-gris"><MapPin size={12} /> MAMAYS · Puno, Perú · {api.mode === 'demo' ? 'modo demo' : 'conectado'}</p>
        {api.mode === 'demo' && (
          <button onClick={() => setCredits(true)} className="mx-auto block text-xs font-semibold text-guinda underline">Créditos de las fotos de ejemplo</button>
        )}
        <Sheet open={credits} onClose={() => setCredits(false)} title="Créditos de fotos">
          <p className="text-sm text-gris">Las fotos de los platos de ejemplo son de <b>Wikimedia Commons</b>, con licencias libres (CC BY / CC BY-SA). Toca cada una para ver su autor y licencia. En la app real, cada mamita sube las fotos de sus propios platos.</p>
          <ul className="mt-3 divide-y divide-borde text-sm">
            {CREDITS.map((c) => (
              <li key={c.file} className="py-2"><a href={photoPage(c)} target="_blank" rel="noreferrer" className="font-semibold text-guinda underline">{c.title}</a><span className="block text-xs text-gris">{c.file}</span></li>
            ))}
          </ul>
        </Sheet>
      </div>
    </Screen>
  )
}
