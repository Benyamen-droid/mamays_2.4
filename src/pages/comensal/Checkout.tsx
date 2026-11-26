import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Banknote, Check, CircleCheck, Copy, CreditCard, DoorOpen, LocateFixed, ShieldCheck, ShoppingBag, Store, Trash2, Truck, TriangleAlert, Users, Wallet } from 'lucide-react'
import { api, mensajeError } from '../../data'
import { lineKey, useAuth, useCart, useToast } from '../../context/AppContext'
import type { CartLine, DishView, MamitaPublic, Order, OrderMode, PaymentMethod, PayResult } from '../../lib/types'
import { celularValido, soles } from '../../lib/format'
import { OrderItems, OrderTotals, ReservaCountdown } from '../../components/orders'
import { BackButton, Button, Card, DishPhoto, EmptyState, Eyebrow, Field, ImagePicker, Loading, PageTitle, Screen, Segmented, Sheet, Stepper } from '../../components/ui'
import { CardPayForm, ThreeDSModal, YapeMark, YapePayForm } from '../../components/payments'
import { PAYMENT_LABEL, TERMINOS_HOGAR, TERMINOS_VERSION } from '../../lib/constants'
import { estimateRoute, fmtKm, getMyLocation, type LatLng } from '../../lib/route'

/* ===================== CARRITO ===================== */
export function CartPage() {
  const { profile } = useAuth()
  const cart = useCart()
  const nav = useNavigate()
  const { toast } = useToast()
  const [dishes, setDishes] = useState<Record<string, DishView | null>>({})
  const [mamita, setMamita] = useState<MamitaPublic | null>(null)
  const [mode, setMode] = useState<OrderMode>('delivery')
  const online = api.onlinePayments !== 'none'
  const [pay, setPay] = useState<PaymentMethod>(online ? 'yape' : 'yape_manual')
  const [address, setAddress] = useState(profile?.address ?? '')
  const [deliveryLoc, setDeliveryLoc] = useState<LatLng | null>(null)
  const [locBusy, setLocBusy] = useState(false)
  async function compartirUbicacion() {
    setLocBusy(true)
    try { setDeliveryLoc(await getMyLocation()) } catch (e) { toast(mensajeError(e), 'error') } finally { setLocBusy(false) }
  }
  const [forOther, setForOther] = useState(false)
  const [receiver, setReceiver] = useState({ name: '', phone: '' })
  const [notes, setNotes] = useState('')
  const [guests, setGuests] = useState(1)
  const [termsOk, setTermsOk] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let on = true
    ;(async () => {
      const entries = await Promise.all(cart.lines.map(async (l) => [l.dish_id, await api.getDish(l.dish_id).catch(() => null)] as const))
      if (!on) return
      setDishes(Object.fromEntries(entries))
      if (cart.mamitaId) setMamita(await api.getMamita(cart.mamitaId).catch(() => null))
      setLoaded(true)
    })()
    return () => { on = false }
    // solo al entrar o al cambiar los platos del carrito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.lines.map((l) => l.dish_id).join()])

  const rows = cart.lines.map((l) => ({ line: l, d: dishes[l.dish_id] }))
  const valid = rows.filter((r) => r.d) as { line: CartLine; d: DishView }[]
  const allowDelivery = valid.every((r) => r.d.delivery_mode !== 'recojo')
  const allowRecojo = valid.every((r) => r.d.delivery_mode !== 'delivery')
  const allowCasa = valid.length > 0 && valid.every((r) => r.d.dine_in)
  useEffect(() => {
    const ok = { delivery: allowDelivery, recojo: allowRecojo, en_casa: allowCasa }
    if (!ok[mode]) setMode(allowDelivery ? 'delivery' : allowRecojo ? 'recojo' : 'en_casa')
  }, [allowDelivery, allowRecojo, allowCasa, mode])

  const extrasDe = (d: DishView, ids: string[] = []) => d.extras.filter((x) => ids.includes(x.id))
  const unitPrice = (d: DishView, ids?: string[]) => d.price + extrasDe(d, ids).reduce((a, x) => a + x.price, 0)
  const subtotal = valid.reduce((a, r) => a + unitPrice(r.d, r.line.extras) * r.line.qty, 0)
  const deliveryCost = mode === 'delivery' ? Math.max(0, ...valid.map((r) => r.d.delivery_cost ?? 0)) : 0
  const problems = useMemo(() => rows.flatMap((r) => {
    if (!r.d) return ['Un plato de tu carrito ya no existe.']
    if (r.d.available < r.line.qty) return [r.d.available === 0 ? `${r.d.name} se agotó.` : `De ${r.d.name} solo quedan ${r.d.available}.`]
    return []
  }), [rows])
  const alergias = profile?.allergies ?? []
  const choques = valid.flatMap((r) => r.d.allergens.filter((a) => alergias.includes(a)).map((a) => `${r.d.name}: ${a}`))
  const alergenosPedido = valid.filter((r) => r.d.allergens.length).map((r) => ({ name: r.d.name, list: r.d.allergens }))

  async function submit() {
    if (!cart.mamitaId) return
    if (mode === 'delivery' && address.trim().length < 5) return toast('Escribe la dirección de entrega', 'error')
    if (forOther && (receiver.name.trim().length < 3 || !celularValido(receiver.phone))) return toast('Completa nombre y celular de quien recibe', 'error')
    if (!allowDelivery && !allowRecojo && !allowCasa) return toast('Estos platos no comparten modalidad de entrega. Pídelos por separado.', 'error')
    if (mode === 'en_casa' && !termsOk) { setTermsOpen(true); return toast('Acepta los términos de seguridad para comer en el hogar', 'error') }
    setBusy(true)
    try {
      const id = await api.placeOrder({
        mamita_id: cart.mamitaId, items: valid.map((r) => ({ dish_id: r.d.id, qty: r.line.qty, extras: r.line.extras ?? [] })), mode, payment_method: pay,
        guests: mode === 'en_casa' ? guests : 1,
        delivery_lat: mode === 'delivery' ? deliveryLoc?.lat ?? null : null, delivery_lng: mode === 'delivery' ? deliveryLoc?.lng ?? null : null, terms_accepted: mode === 'en_casa' && termsOk, terms_version: TERMINOS_VERSION,
        delivery_address: address, receiver_name: forOther ? receiver.name : '', receiver_phone: forOther ? receiver.phone.replace(/\D/g, '') : '',
        payer_name: profile?.full_name ?? '', notes,
      })
      if (pay !== 'efectivo') nav(`/comensal/pago/${id}`)
      else { cart.clear(); nav(`/comensal/confirmado/${id}`, { replace: true }) }
    } catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }

  if (cart.lines.length === 0) return (
    <Screen><BackButton />
      <EmptyState icon={<ShoppingBag />} title="Tu carrito está vacío" text="Elige un platito del menú del día y aparecerá aquí." action={<Link to="/comensal"><Button>Ver el menú del día</Button></Link>} />
    </Screen>
  )
  if (!loaded) return <Screen><Loading /></Screen>

  return (
    <Screen nav={false}>
      <BackButton />
      <PageTitle eyebrow="Tu carrito" title="¡Ya casi tienes tu almuerzo!" text={mamita ? <>Cocina de <b>{mamita.full_name}</b> · {mamita.zone}</> : undefined} />

      <div className="space-y-3">
        {rows.map(({ line, d }) => (
          <Card key={lineKey(line)} className="flex items-center gap-3 !p-3">
            <DishPhoto src={d?.photos[0]} alt={d?.name ?? 'Plato'} className="h-16 w-16 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="font-bold leading-tight">{d?.name ?? 'Plato no disponible'}</div>
              {d && extrasDe(d, line.extras).length > 0 && (
                <div className="text-xs text-gris">+ {extrasDe(d, line.extras).map((x) => x.name).join(', ')}</div>
              )}
              <div className="text-sm font-semibold text-guinda">{d ? soles(unitPrice(d, line.extras) * line.qty) : '—'}</div>
              {d && <Stepper value={line.qty} onChange={(n) => cart.setQty(lineKey(line), n)} max={Math.max(1, Math.min(20, d.available))} />}
            </div>
            <button onClick={() => cart.setQty(lineKey(line), 0)} aria-label="Quitar" className="grid h-10 w-10 place-items-center rounded-full text-gris hover:bg-crema"><Trash2 size={18} /></button>
          </Card>
        ))}
      </div>
      {problems.length > 0 && <div className="mt-3 rounded-2xl bg-[#fde8e8] p-3 text-sm font-semibold text-[#a32020]" role="alert">{problems.join(' ')}</div>}
      {alergenosPedido.length > 0 && (
        <div className={`mt-3 rounded-2xl p-3 text-sm ${choques.length ? 'border border-[#f0b4b4] bg-[#fde8e8] text-[#8f1f1f]' : 'bg-[#fff4ea] text-[#7a3d0c]'}`} role="note" aria-label="Alérgenos de tu pedido">
          <div className="flex items-center gap-2 font-bold"><TriangleAlert size={17} /> Alérgenos de tu pedido</div>
          <ul className="mt-1 space-y-0.5 pl-6">
            {alergenosPedido.map((a) => <li key={a.name}><b>{a.name}:</b> {a.list.map((x) => alergias.includes(x) ? `${x} (tu alergia)` : x).join(', ')}</li>)}
          </ul>
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-extrabold">¿Cómo lo recibes?</h2>
      <Segmented value={mode} onChange={setMode} options={[
        ...(allowDelivery ? [{ value: 'delivery' as const, label: `Delivery · ${soles(Math.max(0, ...valid.map((r) => r.d.delivery_cost ?? 0)))}`, icon: <Truck size={20} /> }] : []),
        ...(allowRecojo ? [{ value: 'recojo' as const, label: 'Recojo · S/ 0.00', icon: <Store size={20} /> }] : []),
        ...(allowCasa ? [{ value: 'en_casa' as const, label: 'Comer en el hogar', icon: <DoorOpen size={20} /> }] : []),
      ]} />
      {mode === 'delivery' && (
        <div className="mt-3">
          <Field label="Dirección de entrega"><input className="field-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av., jirón, número, referencia" /></Field>
          {deliveryLoc ? (
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-[#e8f5ee] px-3 py-2.5 text-[13px] text-[#1d6b41]">
              <LocateFixed size={16} className="shrink-0" />
              <span className="flex-1"><b>Ubicación compartida.</b> La mamita verá la ruta y cuánto tarda en llegar.
                {mamita?.lat != null && mamita.lng != null && <> Su cocina está a unos <b>{fmtKm(estimateRoute(deliveryLoc, { lat: mamita.lat, lng: mamita.lng }, 'car').km)}</b>.</>}</span>
              <button type="button" onClick={() => setDeliveryLoc(null)} className="text-xs font-bold underline">Quitar</button>
            </div>
          ) : (
            <button type="button" onClick={compartirUbicacion} disabled={locBusy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-guinda/50 bg-guinda-50 py-2.5 text-sm font-bold text-guinda">
              {locBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-guinda border-t-transparent" /> : <LocateFixed size={16} />}
              Compartir mi ubicación para el delivery (opcional)
            </button>
          )}
        </div>
      )}
      {mode === 'recojo' && (
        <p className="mt-2 rounded-2xl bg-crema-200 p-3 text-[13px] text-cafe">Recoges en la zona <b>{mamita?.public_zone_label || mamita?.zone}</b>. La dirección exacta te llega cuando la mamita acepte tu pedido.</p>
      )}
      {mode === 'en_casa' && (
        <div className="mt-3 space-y-3 rounded-[20px] border border-borde bg-white p-4">
          <p className="text-[13px] text-cafe">Comerás en el hogar de <b>{mamita?.full_name}</b>, en la zona <b>{mamita?.public_zone_label || mamita?.zone}</b>. La dirección exacta te llega cuando ella acepte tu pedido.</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">¿Cuántas personas van?</span>
            <Stepper value={guests} onChange={setGuests} min={1} max={6} label={guests === 1 ? 'pers.' : 'pers.'} />
          </div>
          <div className={`rounded-2xl border p-3 ${termsOk ? 'border-ok bg-[#e8f5ee]' : 'border-[#f0b4b4] bg-[#fff6f6]'}`}>
            <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17} className={termsOk ? 'text-ok' : 'text-[#b42323]'} /> Términos de seguridad y convivencia</div>
            <p className="mt-1 text-xs text-gris">{termsOk ? 'Aceptaste los términos. ¡Gracias por cuidar este espacio!' : 'Es obligatorio leerlos y aceptarlos para comer en un hogar.'}</p>
            <button type="button" onClick={() => setTermsOpen(true)} className="mt-2 text-sm font-bold text-guinda underline">{termsOk ? 'Ver términos' : 'Leer y aceptar'}</button>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setForOther(!forOther)} aria-pressed={forOther}
        className={`mt-4 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${forOther ? 'border-guinda bg-guinda-50' : 'border-borde bg-white'}`}>
        <Users className="text-guinda" size={22} />
        <span className="flex-1 text-sm"><b>Es para otra persona</b><br /><span className="text-gris">Pagas tú y lo recibe tu hijo/a, familiar o amigo.</span></span>
        <span className={`grid h-5 w-5 place-items-center rounded border ${forOther ? 'border-guinda bg-guinda text-white' : 'border-[#cbb]'}`}>{forOther && <Check size={14} />}</span>
      </button>
      {forOther && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="¿Quién recibe?"><input className="field-input" value={receiver.name} onChange={(e) => setReceiver({ ...receiver, name: e.target.value })} /></Field>
          <Field label="Su celular"><input className="field-input" inputMode="tel" value={receiver.phone} onChange={(e) => setReceiver({ ...receiver, phone: e.target.value })} /></Field>
        </div>
      )}
      <div className="mt-3"><Field label="Nota para la mamita" optional><input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. sin cebolla, paso a la 1 p. m." maxLength={300} /></Field></div>

      <h2 className="mb-2 mt-6 text-sm font-extrabold">¿Cómo pagas?</h2>
      <div className="space-y-2" role="radiogroup" aria-label="Medio de pago">
        {(online
          ? [
              { v: 'yape' as const, title: <YapeMark size="sm" />, text: 'Con tu celular y código de aprobación', icon: <Wallet size={20} /> },
              { v: 'tarjeta' as const, title: 'Tarjeta de crédito o débito', text: 'Visa, Mastercard · con verificación de tu banco', icon: <CreditCard size={20} /> },
              { v: 'efectivo' as const, title: 'Efectivo', text: 'Pagas al recibir tu pedido', icon: <Banknote size={20} /> },
            ]
          : [
              { v: 'yape_manual' as const, title: 'Yape a la mamita', text: 'Yapeas a su número y adjuntas la constancia', icon: <Wallet size={20} /> },
              { v: 'efectivo' as const, title: 'Efectivo', text: 'Pagas al recibir tu pedido', icon: <Banknote size={20} /> },
            ]
        ).map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={pay === o.v} aria-label={PAYMENT_LABEL[o.v]} onClick={() => setPay(o.v)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${pay === o.v ? 'border-guinda bg-guinda-50' : 'border-borde bg-white'}`}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${pay === o.v ? 'border-guinda' : 'border-[#cbb]'}`}>
              {pay === o.v && <span className="h-2.5 w-2.5 rounded-full bg-guinda" />}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold">{o.title}</span>
              <span className="block text-xs text-gris">{o.text}</span>
            </span>
            <span className="text-gris">{o.icon}</span>
          </button>
        ))}
      </div>

      <Card className="mt-5">
        <div className="flex justify-between text-sm"><span className="text-gris">Platos</span><span>{soles(subtotal)}</span></div>
        <div className="mt-1 flex justify-between text-sm"><span className="text-gris">{mode === 'delivery' ? 'Delivery' : mode === 'en_casa' ? `En el hogar · ${guests} ${guests === 1 ? 'persona' : 'personas'}` : 'Recojo'}</span><span>{soles(deliveryCost)}</span></div>
        <div className="mt-2 flex justify-between border-t border-borde pt-2 text-lg font-extrabold"><span>Total</span><span className="text-guinda">{soles(subtotal + deliveryCost)}</span></div>
      </Card>

      <div className="mt-5">
        <Button onClick={submit} loading={busy} disabled={problems.length > 0}>
          {pay === 'efectivo' ? 'Enviar pedido a la mamita' : pay === 'yape_manual' ? 'Continuar para adjuntar constancia' : `Continuar al pago · ${soles(subtotal + deliveryCost)}`}
        </Button>
        {pay !== 'efectivo' && <p className="mt-2 text-center text-xs text-gris">Reservamos tu porción por 15 minutos mientras pagas.</p>}
      </div>
      <TermsSheet open={termsOpen} onClose={() => setTermsOpen(false)} accepted={termsOk} onAccept={() => { setTermsOk(true); setTermsOpen(false) }} />
    </Screen>
  )
}

/** Términos de seguridad y convivencia para comer en el hogar de una mamita (aceptación obligatoria) */
function TermsSheet({ open, onClose, accepted, onAccept }: { open: boolean; onClose: () => void; accepted: boolean; onAccept: () => void }) {
  const [check, setCheck] = useState(accepted)
  useEffect(() => { if (open) setCheck(accepted) }, [open, accepted])
  return (
    <Sheet open={open} onClose={onClose} title="Comer en el hogar">
      <p className="text-sm text-gris">Vas a ser recibido en una casa de familia. Para que sea seguro y agradable para todos:</p>
      <ol className="mt-3 space-y-2.5">
        {TERMINOS_HOGAR.map((t, i) => (
          <li key={t.t} className="flex gap-3 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-guinda-50 text-xs font-bold text-guinda">{i + 1}</span>
            <span><b>{t.t}.</b> {t.d}</span>
          </li>
        ))}
      </ol>
      <label className="mt-4 flex items-start gap-3 rounded-2xl bg-crema p-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#A3173B]" checked={check} onChange={(e) => setCheck(e.target.checked)} />
        He leído y acepto los términos de seguridad y convivencia para comer en el hogar de la mamita.
      </label>
      <div className="mt-4 space-y-2">
        <Button disabled={!check} onClick={onAccept}>Aceptar términos</Button>
        <Button variant="secondary" onClick={onClose}>Volver</Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-gris">Versión {TERMINOS_VERSION}. Tu aceptación queda registrada en el pedido.</p>
    </Sheet>
  )
}

/* ===================== PAGO (Yape en línea · Tarjeta 3-D Secure · Yape con constancia) ===================== */
export function PayPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const cart = useCart()
  const { toast } = useToast()
  const [o, setO] = useState<Order | null | undefined>(undefined)
  const [m, setM] = useState<MamitaPublic | null>(null)
  const [challenge, setChallenge] = useState<Extract<PayResult, { status: 'challenge' }> | null>(null)
  const [rejected, setRejected] = useState('')

  const load = useCallback(async () => {
    const order = await api.getOrder(id!).catch(() => null)
    setO(order)
    if (order) setM(await api.getMamita(order.mamita_id).catch(() => null))
  }, [id])
  useEffect(() => { load() }, [load])

  const onResult = useCallback((r: PayResult) => {
    setChallenge(null)
    if (r.status === 'approved') {
      cart.clear()
      nav(`/comensal/confirmado/${id}`, { replace: true })
    } else if (r.status === 'challenge') {
      setRejected('')
      setChallenge(r)
    } else if (r.status === 'pending') {
      cart.clear()
      toast(r.message, 'info')
      nav(`/comensal/pedidos/${id}`, { replace: true })
    } else {
      setRejected(r.message)
      load()
    }
  }, [cart, id, load, nav, toast])

  if (o === undefined) return <Screen nav={false}><Loading /></Screen>
  if (!o) return <Screen nav={false}><EmptyState icon={<TriangleAlert />} title="Pedido no encontrado" text="" /></Screen>
  if (o.status !== 'reservado') {
    const expired = o.status === 'expirado'
    return (
      <Screen nav={false}>
        <EmptyState icon={expired ? <TriangleAlert /> : <CircleCheck />} title={expired ? 'Se venció la reserva' : 'Este pedido ya fue enviado'}
          text={expired ? 'Pasaron los 15 minutos. Tu carrito sigue guardado: vuelve a intentarlo.' : 'Puedes seguirlo en Mis pedidos.'}
          action={<Button onClick={() => nav(expired ? '/comensal/carrito' : `/comensal/pedidos/${o.id}`)}>{expired ? 'Volver al carrito' : 'Ver mi pedido'}</Button>} />
      </Screen>
    )
  }

  async function cancel() {
    try { await api.setOrderStatus(o!.id, 'cancelado'); toast('Reserva cancelada', 'info'); nav('/comensal/carrito') } catch (e) { toast(mensajeError(e), 'error') }
  }

  const title = o.payment_method === 'tarjeta' ? 'Paga con tarjeta' : o.payment_method === 'yape' ? 'Paga con Yape' : <>Yapea {soles(o.total)}</>
  return (
    <Screen nav={false}>
      <BackButton to="/comensal/carrito" label="Carrito" />
      <PageTitle eyebrow="Método de pago" title={title} text={`Pedido ${o.code} · Total ${soles(o.total)}`} />
      <ReservaCountdown until={o.reserved_until!} onExpire={load} />
      {rejected && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-[#f0b4b4] bg-[#fde8e8] p-3.5 text-sm text-[#8f1f1f]" role="alert">
          <TriangleAlert className="shrink-0" size={20} /><div><b>Pago rechazado.</b> {rejected}</div>
        </div>
      )}
      <div className="mt-4">
        {o.payment_method === 'yape' && <YapePayForm order={o} onResult={onResult} />}
        {o.payment_method === 'tarjeta' && <CardPayForm order={o} onResult={onResult} />}
        {o.payment_method === 'yape_manual' && <ManualYape order={o} mamita={m} onSent={() => { cart.clear(); nav(`/comensal/confirmado/${o.id}`, { replace: true }) }} onError={load} />}
      </div>
      <div className="mt-4"><OrderTotals o={o} /></div>
      <Button variant="ghost" className="mt-3" onClick={cancel}>Cancelar reserva</Button>
      {challenge && <ThreeDSModal order={o} challenge={challenge} onResult={onResult} onCancel={() => { setChallenge(null); setRejected('Cancelaste la verificación de tu banco.') }} />}
    </Screen>
  )
}

/** Yape directo al número de la mamita + captura de la constancia (cuando no hay pasarela configurada) */
function ManualYape({ order, mamita, onSent, onError }: { order: Order; mamita: MamitaPublic | null; onSent: () => void; onError: () => void }) {
  const { toast } = useToast()
  const [voucher, setVoucher] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText((mamita?.yape_phone ?? '').replace(/\s/g, '')); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { toast('No se pudo copiar. Anótalo manualmente.', 'info') }
  }
  async function send() {
    if (!voucher[0]) return toast('Adjunta la captura de tu Yape', 'error')
    setBusy(true)
    try { await api.submitVoucher(order.id, voucher[0]); onSent() } catch (e) { toast(mensajeError(e), 'error'); onError() } finally { setBusy(false) }
  }
  return (
    <>
      <Card>
        <div className="text-xs text-gris">Yapea a</div>
        <div className="mt-0.5 text-lg font-bold">{mamita?.yape_name || mamita?.full_name}</div>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-crema px-4 py-3">
          <span className="font-mono text-xl font-bold tracking-wider">{mamita?.yape_phone || '—'}</span>
          <button onClick={copy} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-guinda shadow-sm">
            {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
          </button>
        </div>
        <ol className="mt-4 space-y-2 text-sm text-cafe">
          {['Abre tu app de Yape.', `Yapea exactamente ${soles(order.total)} a este número.`, 'Toma una captura de la constancia.', 'Adjúntala aquí y envía tu pedido.'].map((t, i) => (
            <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-guinda-50 text-xs font-bold text-guinda">{i + 1}</span>{t}</li>
          ))}
        </ol>
      </Card>
      <h2 className="mb-2 mt-6 text-sm font-extrabold">Constancia de pago</h2>
      <ImagePicker images={voucher} onChange={setVoucher} max={1} kind="voucher" label="Adjuntar captura" />
      <Button className="mt-5" onClick={send} loading={busy} disabled={!voucher[0]}>Enviar constancia y pedido</Button>
    </>
  )
}

/* ===================== CONFIRMACIÓN ===================== */
export function ConfirmedPage() {
  const { id } = useParams()
  const [o, setO] = useState<Order | null>(null)
  useEffect(() => { api.getOrder(id!).then(setO).catch(() => {}) }, [id])
  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#1F8A5B] to-[#16704a] px-6 pb-10 text-white safe-top">
      <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <div className="rise grid h-24 w-24 place-items-center rounded-full bg-white text-ok shadow-xl"><Check size={52} strokeWidth={3} /></div>
        <Eyebrow className="mt-6 !text-white/85">Pedido enviado</Eyebrow>
        <h1 className="mt-2 font-serif text-[34px] font-bold leading-tight">¡Listo! Tu pedido fue enviado a la mamita</h1>
        {o && <div className="mt-4 rounded-full bg-white/15 px-5 py-2 font-mono text-lg font-bold tracking-wider">{o.code}</div>}
        {o?.payment_id && <div className="mt-2 text-xs text-white/80">N.° de operación: {o.payment_id}</div>}
        <p className="mt-4 max-w-[300px] text-white/90">
          {o?.paid_at ? `Pago aprobado con ${o.payment_method === 'yape' ? 'Yape' : 'tarjeta'} ✓ La mamita ya recibió tu pedido.`
            : o?.payment_method === 'yape_manual' ? 'Ella revisará tu constancia y te avisaremos cuando lo acepte.'
            : 'Ten listo el pago en efectivo al recibir tu pedido.'}
        </p>
        {o && <div className="mt-6 w-full rounded-3xl bg-white p-4 text-left text-tinta"><OrderItems o={o} /><div className="mt-3"><OrderTotals o={o} /></div></div>}
        <div className="mt-6 w-full space-y-2">
          <Link to={`/comensal/pedidos/${id}`}><Button variant="secondary">Seguir mi pedido</Button></Link>
          <Link to="/comensal" className="block py-3 text-sm font-bold text-white/90">Volver al inicio</Link>
        </div>
      </div>
    </div>
  )
}
