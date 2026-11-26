import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Banknote, Camera, Check, ChevronDown, ChevronRight, CircleHelp, DoorOpen, ListChecks, MessageCircle, Pause, PartyPopper, Plus,
  ShieldCheck, ShoppingBag, Sparkles, Wallet,
} from 'lucide-react'
import { api, mensajeError } from '../../data'
import { useAuth, useToast } from '../../context/AppContext'
import { primerNombre } from '../../lib/format'
import { Avatar, BackButton, Button, Eyebrow, ImagePicker, PageTitle, Screen } from '../../components/ui'

/* ===================== BIENVENIDA PARA MAMÁS NUEVAS ===================== */
export function MamitaWelcome() {
  const { profile, setProfile } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? '')
  const [busy, setBusy] = useState(false)
  const nombre = primerNombre(profile?.full_name ?? '')

  async function finish(to: string) {
    setBusy(true)
    try {
      const p = await api.updateProfile({ onboarded: true, avatar_url: avatar })
      setProfile(p)
      nav(to, { replace: true })
    } catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }

  const slides: { icon: ReactNode; eyebrow: string; title: string; body: ReactNode }[] = [
    {
      icon: <PartyPopper size={40} />, eyebrow: 'Bienvenida a la familia',
      title: `¡Qué alegría tenerte, ${nombre}!`,
      body: <p>Desde hoy, tu sazón llega a más mesas de Puno. Te acompañamos paso a paso: en 2 minutos sabrás todo lo necesario para empezar.</p>,
    },
    {
      icon: <ListChecks size={40} />, eyebrow: 'Así funciona', title: 'Cocinas, publicas y ganas',
      body: (
        <ol className="space-y-3 text-left">
          {[
            [<Plus key="a" size={18} />, 'Publicas tus platitos', 'Con foto, ingredientes, alérgenos, porciones y horario.'],
            [<ShoppingBag key="b" size={18} />, 'Te llegan pedidos', 'Te avisamos al instante. Ves quién pide, cómo paga y si es delivery, recojo o para comer en tu hogar.'],
            [<Check key="c" size={18} />, 'Preparas y entregas', 'Vas marcando cada paso y el comensal lo ve en tiempo real.'],
            [<Wallet key="d" size={18} />, 'Cobras y creces', 'Yape, tarjeta o efectivo. Las buenas calificaciones te traen más clientes.'],
          ].map(([icon, t, d], i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-white/90 p-3 text-tinta">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-guinda-50 text-guinda">{icon}</span>
              <span><b className="block text-sm">{t as string}</b><span className="text-[13px] text-gris">{d as string}</span></span>
            </li>
          ))}
        </ol>
      ),
    },
    {
      icon: <ShieldCheck size={40} />, eyebrow: 'Tu seguridad primero', title: 'Tú decides qué compartes',
      body: (
        <ul className="space-y-2.5 text-left text-[14px]">
          <li className="flex gap-2"><Check className="mt-0.5 shrink-0" size={18} /> Tu dirección exacta <b>nunca</b> se publica. Solo la recibe el comensal cuando <b>tú aceptas</b> un pedido de recojo o para comer en tu hogar.</li>
          <li className="flex gap-2"><Check className="mt-0.5 shrink-0" size={18} /> Recibir comensales en tu hogar es <b>opcional</b>, y ellos deben aceptar normas de seguridad y convivencia.</li>
          <li className="flex gap-2"><Check className="mt-0.5 shrink-0" size={18} /> Puedes rechazar un pedido explicando el motivo.</li>
        </ul>
      ),
    },
    {
      icon: <Camera size={40} />, eyebrow: 'Último paso', title: 'Pon tu foto de perfil',
      body: (
        <div className="flex flex-col items-center gap-3">
          <Avatar name={profile?.full_name ?? 'M'} url={avatar} size={110} />
          <p className="text-[14px]">Los comensales confían más cuando ven a quien cocina. Puedes cambiarla cuando quieras.</p>
          <div className="rounded-2xl bg-white p-3"><ImagePicker images={avatar ? [avatar] : []} onChange={(v) => setAvatar(v[0] ?? '')} max={1} kind="avatar" label="Subir foto" /></div>
        </div>
      ),
    },
  ]
  const s = slides[step]
  const last = step === slides.length - 1
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-guinda to-[#7E1230] px-6 pb-8 text-white safe-top">
      <div className="flex items-center justify-between pt-4">
        <div className="flex gap-1.5" aria-label={`Paso ${step + 1} de ${slides.length}`}>
          {slides.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'w-7 bg-white' : 'w-3 bg-white/35'}`} />)}
        </div>
        {!last && <button onClick={() => setStep(slides.length - 1)} className="text-sm font-semibold text-white/80">Saltar</button>}
      </div>
      <div key={step} className="rise flex flex-1 flex-col items-center justify-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/15">{s.icon}</div>
        <Eyebrow className="mt-5 !text-white/80">{s.eyebrow}</Eyebrow>
        <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight">{s.title}</h1>
        <div className="mt-4 w-full text-white/90">{s.body}</div>
      </div>
      <div className="space-y-2">
        {!last ? (
          <Button variant="secondary" onClick={() => setStep(step + 1)}>Siguiente</Button>
        ) : (
          <>
            <Button variant="secondary" loading={busy} onClick={() => finish('/mamita/platos/nuevo')}><Plus size={18} /> Publicar mi primer platito</Button>
            <button onClick={() => finish('/mamita')} className="block w-full py-2 text-sm font-bold text-white/90">Ir a mi cocina</button>
          </>
        )}
        {step > 0 && !last && <button onClick={() => setStep(step - 1)} className="block w-full py-2 text-sm font-semibold text-white/70">Atrás</button>}
      </div>
    </div>
  )
}

/* ===================== PRIMEROS PASOS (tarjeta del inicio) ===================== */
export function PrimerosPasos({ dishCount }: { dishCount: number }) {
  const { profile } = useAuth()
  const items = [
    { ok: !!profile?.avatar_url, t: 'Pon tu foto de perfil', to: '/mamita/perfil' },
    { ok: (profile?.home_description ?? '').length > 10, t: 'Cuenta cómo es tu cocina', to: '/mamita/perfil' },
    { ok: dishCount > 0, t: 'Publica tu primer platito', to: '/mamita/platos/nuevo' },
    { ok: !!profile?.yape_phone, t: 'Registra tu Yape para cobrar', to: '/mamita/perfil' },
  ]
  const done = items.filter((i) => i.ok).length
  if (done === items.length) return null
  return (
    <section className="mb-5 rounded-[22px] border border-[#f5d3dc] bg-guinda-50 p-4" aria-label="Primeros pasos">
      <div className="flex items-center justify-between">
        <div className="font-serif text-lg font-bold">Primeros pasos</div>
        <span className="text-xs font-bold text-guinda">{done}/{items.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-guinda" style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <ul className="mt-3 space-y-1.5">
        {items.map((i) => (
          <li key={i.t}>
            <Link to={i.to} className="flex items-center gap-2.5 text-sm">
              <span className={`grid h-5 w-5 place-items-center rounded-full ${i.ok ? 'bg-ok text-white' : 'border-2 border-[#d9a9b6] bg-white'}`}>{i.ok && <Check size={12} strokeWidth={3} />}</span>
              <span className={i.ok ? 'text-gris line-through' : 'font-semibold'}>{i.t}</span>
              {!i.ok && <ChevronRight size={15} className="ml-auto text-guinda" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ===================== GUÍA DE USO PARA MAMÁS ===================== */
type Paso = { t: string; d: string }
const GUIA: { id: string; icon: ReactNode; title: string; intro: string; pasos: Paso[]; cta?: { label: string; to: string } }[] = [
  {
    id: 'publicar', icon: <Plus />, title: 'Publicar un platito', intro: 'Así tu plato aparece en el menú del día de los comensales.',
    pasos: [
      { t: 'Toca “Mis platos” → “Publicar un nuevo platito”', d: 'Está en la barra de abajo.' },
      { t: 'Sube 1 a 4 fotos', d: 'De día, cerca de una ventana y con el plato servido. La primera foto es la portada.' },
      { t: 'Nombre, precio y porciones de hoy', d: 'Las porciones se descuentan solas con cada pedido.' },
      { t: 'Ingredientes y alérgenos', d: 'Es obligatorio y protege a quienes tienen alergias. Marca maní, gluten, lactosa, etc.' },
      { t: 'Extras (opcional)', d: 'Agrega acompañamientos con su precio: gelatina, mazamorra, ensalada, chicha…' },
      { t: 'Horario', d: 'Elige Almuerzo, Toda la tarde, Lonche, Cena o Todo el día, o pon tus propias horas.' },
      { t: 'Cómo entregas', d: 'Delivery (con su costo), recojo en tu casa y, si quieres, “comer en mi hogar”.' },
    ],
    cta: { label: 'Publicar ahora', to: '/mamita/platos/nuevo' },
  },
  {
    id: 'porciones', icon: <Pause />, title: 'Porciones del día y pausar', intro: 'Cada mañana, revisa cuántas porciones tienes.',
    pasos: [
      { t: 'En “Mis platos”, usa los botones − y +', d: 'Ves cuántas vendiste, cuántas están reservadas y cuántas quedan.' },
      { t: '“Pausar” oculta el plato', d: 'Úsalo si se te acabaron los ingredientes o no cocinarás ese día.' },
      { t: 'Al llegar a 0, sale “AGOTADO”', d: 'Nadie puede pedir porciones que no tienes.' },
    ],
    cta: { label: 'Ir a mis platos', to: '/mamita/platos' },
  },
  {
    id: 'pedidos', icon: <ShoppingBag />, title: 'Recibir y atender pedidos', intro: 'Te avisamos con la campana y en tu inicio.',
    pasos: [
      { t: 'Revisa el pedido', d: 'Quién pide, qué platos y extras, si es delivery, recojo o para comer en tu hogar, y cómo pagó.' },
      { t: 'Acepta o rechaza', d: 'Si no puedes atenderlo, recházalo con un motivo amable. El comensal recibe el aviso.' },
      { t: 'Marca cada paso', d: 'Empezar a preparar → Listo (o Salió para delivery) → Entregado. El comensal lo ve al instante.' },
      { t: 'Delivery: abre la ruta', d: 'Toca “Ruta en Google Maps” para llegar a la dirección.' },
    ],
    cta: { label: 'Ver mis pedidos', to: '/mamita/pedidos' },
  },
  {
    id: 'cobros', icon: <Banknote />, title: 'Cobros', intro: 'Hay 3 formas de pago.',
    pasos: [
      { t: 'Yape y tarjeta en línea', d: 'Si dice “pagado en línea ✓”, el cobro ya está confirmado. No necesitas revisar nada más.' },
      { t: 'Yape con constancia', d: 'Toca “Ver constancia” y revisa en tu app de Yape que llegó el monto antes de aceptar.' },
      { t: 'Efectivo', d: 'Cobras al entregar. Ten sencillo a la mano.' },
    ],
  },
  {
    id: 'hogar', icon: <DoorOpen />, title: 'Comensales en tu hogar (opcional)', intro: 'Puedes recibir comensales para que coman en tu casa.',
    pasos: [
      { t: 'Actívalo en cada plato', d: 'En el formulario del plato marca “Recibo comensales en mi hogar”.' },
      { t: 'Ellos aceptan normas obligatorias', d: 'Puntualidad, solo las personas indicadas, respeto, sin alcohol y tu derecho de admisión.' },
      { t: 'Tu dirección se comparte al aceptar', d: 'Ves cuántas personas van. Marca “Mesa lista” cuando los esperes.' },
    ],
  },
  {
    id: 'resenas', icon: <MessageCircle />, title: 'Calificaciones y comentarios', intro: 'Tu reputación es tu mejor publicidad.',
    pasos: [
      { t: 'Te califican a ti y a cada plato', d: 'Solo quien recibió su pedido puede calificar (compra verificada).' },
      { t: 'Responde con cariño', d: 'En “Mi perfil → Lo que dicen de ti” toca “Responder”. Tu respuesta se ve en público.' },
    ],
    cta: { label: 'Ver mis reseñas', to: '/mamita/perfil' },
  },
  {
    id: 'perfil', icon: <Camera />, title: 'Tu perfil y tu foto', intro: 'Un perfil completo da confianza.',
    pasos: [
      { t: 'Cambia tu foto', d: 'En “Mi perfil”, toca el ícono de cámara sobre tu foto.' },
      { t: 'Cuenta cómo es tu cocina', d: 'Agrega fotos de tu cocina limpia y ordenada. Tú decides si se muestra.' },
      { t: 'Tu Yape', d: 'Registra el titular y el número para recibir pagos con constancia.' },
    ],
    cta: { label: 'Ir a mi perfil', to: '/mamita/perfil' },
  },
  {
    id: 'consejos', icon: <Sparkles />, title: 'Consejos para vender más', intro: 'Lo que más valoran los comensales.',
    pasos: [
      { t: 'Fotos reales y apetitosas', d: 'Con luz natural y el plato tal como lo entregas.' },
      { t: 'Puntualidad', d: 'Cumple el horario que publicaste. Si te retrasas, avisa por WhatsApp.' },
      { t: 'Higiene visible', d: 'Envases cerrados, bolsa limpia y alérgenos bien declarados.' },
      { t: 'Ofrece “Toda la tarde”', d: 'Los estudiantes piden entre clases: un horario amplio te trae más pedidos.' },
    ],
  },
]

export function MamitaGuide() {
  const [open, setOpen] = useState<string>('publicar')
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <Screen>
      <BackButton to="/mamita" label="Inicio" />
      <PageTitle eyebrow="Guía de uso" title="Aprende a usar MAMAYS" text="Paso a paso y a tu ritmo. Puedes volver aquí cuando quieras." />
      <div className="space-y-3">
        {GUIA.map((g, gi) => {
          const isOpen = open === g.id
          return (
            <section key={g.id} className={`overflow-hidden rounded-[22px] border bg-white ${isOpen ? 'border-guinda/40 shadow-[0_10px_24px_-16px_rgb(163_23_59/0.7)]' : 'border-borde'}`}>
              <button onClick={() => setOpen(isOpen ? '' : g.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-guinda-50 text-guinda">{g.icon}</span>
                <span className="flex-1"><span className="block text-[11px] font-bold text-gris">PASO {gi + 1}</span><span className="block font-bold">{g.title}</span></span>
                <ChevronDown className={`text-gris transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="rise border-t border-borde px-4 pb-4 pt-3">
                  <p className="text-sm text-gris">{g.intro}</p>
                  <ol className="relative mt-3 space-y-3">
                    {g.pasos.map((p, i) => (
                      <li key={p.t} className="relative flex gap-3">
                        {i < g.pasos.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] w-0.5 bg-guinda-50" />}
                        <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-guinda text-xs font-bold text-white">{i + 1}</span>
                        <span><b className="block text-sm">{p.t}</b><span className="text-[13px] text-gris">{p.d}</span></span>
                      </li>
                    ))}
                  </ol>
                  {g.cta && <Link to={g.cta.to} className="mt-4 block"><Button>{g.cta.label}</Button></Link>}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-[20px] bg-crema-200 p-4 text-sm">
        <CircleHelp className="shrink-0 text-guinda" />
        <span>¿Algo no queda claro? Pídele ayuda a tu hijo, hija o nieto: esta guía es para leerla juntos 💛</span>
      </div>
    </Screen>
  )
}
