import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Eye, EyeOff, Heart, MailCheck, Target } from 'lucide-react'
import { api, mensajeError } from '../../data'
import { useAuth, useToast } from '../../context/AppContext'
import { ALERGENOS, ZONAS } from '../../lib/constants'
import type { Role } from '../../lib/types'
import { celularValido, emailValido, primerNombre } from '../../lib/format'
import { BackButton, Button, CheckGrid, DemoBanner, Eyebrow, Field, Logo } from '../../components/ui'

const home = (r: Role) => (r === 'mamita' ? '/mamita' : '/comensal')
const rolOk = (r?: string): Role => (r === 'mamita' ? 'mamita' : 'comensal')

/* ===================== BIENVENIDA ===================== */
export function Welcome() {
  const { profile } = useAuth()
  if (profile) return <Navigate to={home(profile.role)} replace />
  return (
    <div className="relative min-h-dvh overflow-hidden bg-guinda text-white">
      <DemoBanner />
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full border-[36px] border-white/10" />
      <div className="pointer-events-none absolute -left-16 bottom-28 h-48 w-48 rounded-full bg-white/5" />
      <div className="relative px-6 pb-10 safe-top">
        <div className="pt-5"><Logo light /></div>

        <div className="relative mx-auto mt-6 h-40 w-60" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <svg key={i} viewBox="0 0 20 60" className="steam absolute h-16 w-5" style={{ left: 88 + i * 22, top: -6, animationDelay: `${i * 0.6}s` }}>
              <path d="M10 58 C2 46 18 36 10 24 C2 12 16 6 10 0" stroke="#fff" strokeOpacity=".7" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          ))}
          <svg viewBox="0 0 240 120" className="absolute bottom-0 h-28 w-60">
            <ellipse cx="120" cy="30" rx="112" ry="16" fill="#E9B98F" />
            <ellipse cx="120" cy="28" rx="104" ry="11" fill="#C9763A" />
            <circle cx="92" cy="28" r="7" fill="#7FB069" /><circle cx="146" cy="26" r="6" fill="#7FB069" /><circle cx="122" cy="31" r="5" fill="#F2C14E" />
            <path d="M8 30 Q120 160 232 30 Z" fill="#FFF8F2" />
            <path d="M40 74 Q120 96 200 74" stroke="#EFDCDC" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/50 px-4 py-1.5 text-sm font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> De Puno, con mucho cariño
        </div>
        <Eyebrow className="mt-6 !text-white/85">Bienvenidos a nuestra mesa</Eyebrow>
        <h1 className="mt-2 font-serif text-[40px] font-bold leading-[1.05]">
          El sabor de casa,<br /><span className="text-[#F7B6C8]">más cerca de ti</span>
        </h1>
        <p className="mt-3 text-[15px] text-white/90">¡Qué alegría tenerte aquí! Cuéntanos, ¿cómo deseas ingresar?</p>

        <div className="mt-6 space-y-3">
          <RoleCard to="/acceso/comensal" icon={<Target size={24} />} title="Soy comensal" text="Quiero descubrir platitos caseros y disfrutar de un rico almuerzo" />
          <RoleCard to="/acceso/mamita" icon={<Heart size={24} />} title="Soy mamita" text="Quiero compartir mis platitos y ganar un dinerito desde casa" />
        </div>

        <p className="mt-8 text-center font-serif text-[15px] italic text-white/90">
          “Cada platito tiene una historia y cada sabor nos acerca a casa”.
        </p>
      </div>
    </div>
  )
}

function RoleCard({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to} className="rise flex items-center gap-4 rounded-[22px] bg-white p-4 text-tinta shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)] active:scale-[.99]">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-guinda-50 text-guinda">{icon}</span>
      <span className="flex-1">
        <span className="block text-[13px] font-extrabold uppercase tracking-[0.12em] text-guinda">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-gris">{text}</span>
      </span>
      <ChevronRight className="text-cafe" size={20} />
    </Link>
  )
}

function AuthShell({ children, back }: { children: React.ReactNode; back?: string }) {
  return (
    <div className="min-h-full safe-top">
      <DemoBanner />
      <div className="px-6 pb-10 pt-3">
        <BackButton to={back} />
        <div className="mt-3"><Logo /></div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  )
}

/* ===================== ACCESO POR ROL ===================== */
export function AuthChoice() {
  const rol = rolOk(useParams().rol)
  const { profile } = useAuth()
  if (profile) return <Navigate to={home(profile.role)} replace />
  return (
    <AuthShell back="/">
      <Eyebrow>Tu espacio de {rol}</Eyebrow>
      <h1 className="mt-2 text-[36px] font-medium leading-[1.1] text-tinta">¿Cómo deseas continuar?</h1>
      <p className="mt-3 text-[16px] text-gris">Tu información quedará guardada y disponible cuando vuelvas a MAMAYS.</p>
      <div className="mt-8 space-y-3">
        <Link to={`/ingresar/${rol}`}><Button>Ya tengo una cuenta</Button></Link>
        <Link to={`/registro/${rol}`} className="block"><Button variant="secondary">Crear una cuenta</Button></Link>
      </div>
      <p className="mt-6 text-center text-xs text-gris">Tu sesión es privada e independiente del panel administrativo.</p>
      {api.mode === 'demo' && (
        <div className="mt-8 rounded-2xl border border-dashed border-[#e6c6cf] bg-guinda-50/60 p-4 text-[13px] text-cafe">
          <b>Cuentas de prueba</b> (contraseña <b>demo123</b>):<br />
          {rol === 'comensal' ? 'comensal@demo.pe' : 'juana@demo.pe · teodora@demo.pe · marta@demo.pe · elena@demo.pe'}
        </div>
      )}
    </AuthShell>
  )
}

/* ===================== INICIAR SESIÓN ===================== */
export function Login() {
  const rol = rolOk(useParams().rol)
  const { setProfile } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (!emailValido(email)) return setErr('Escribe un correo válido.')
    setBusy(true)
    try {
      const p = await api.signIn(email, pass)
      setProfile(p)
      toast(`¡Qué alegría tenerte de vuelta, ${primerNombre(p.full_name)}!`)
      if (p.role !== rol) toast(`Esta cuenta es de ${p.role}; te llevamos a su espacio.`, 'info')
      nav(home(p.role), { replace: true })
    } catch (e) { setErr(mensajeError(e)) } finally { setBusy(false) }
  }

  return (
    <AuthShell back={`/acceso/${rol}`}>
      <Eyebrow>Tu espacio de {rol}</Eyebrow>
      <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight">Hola de nuevo</h1>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Correo electrónico">
          <input className="field-input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div>
          <label htmlFor="login-pass" className="mb-1.5 block text-[13px] font-bold text-tinta">Contraseña</label>
          <div className="relative">
            <input id="login-pass" className="field-input pr-12" type={show ? 'text' : 'password'} autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gris">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {err && <p className="rounded-xl bg-[#fde8e8] px-3 py-2 text-sm font-semibold text-[#a32020]" role="alert">{err}</p>}
        <Button type="submit" loading={busy}>Ingresar</Button>
        <div className="flex justify-between text-sm">
          <Link to="/recuperar" className="font-semibold text-guinda">¿Olvidaste tu contraseña?</Link>
          <Link to={`/registro/${rol}`} className="font-semibold text-cafe">Crear cuenta</Link>
        </div>
      </form>
    </AuthShell>
  )
}

/* ===================== RECUPERAR CONTRASEÑA ===================== */
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!emailValido(email)) return setErr('Escribe un correo válido.')
    setBusy(true); setErr('')
    try { await api.resetPassword(email); setSent(true) } catch (e) { setErr(mensajeError(e)) } finally { setBusy(false) }
  }
  return (
    <AuthShell>
      <Eyebrow>Recuperar acceso</Eyebrow>
      <h1 className="mt-2 font-serif text-[30px] font-bold leading-tight">¿Olvidaste tu contraseña?</h1>
      {sent ? (
        <div className="mt-6 rounded-2xl bg-[#e8f5ee] p-4 text-sm text-ok">
          <MailCheck className="mb-2" /> Si existe una cuenta con <b>{email}</b>, te enviamos un enlace para crear una nueva contraseña.
          {api.mode === 'demo' && <div className="mt-2 text-cafe">(En modo demo no se envían correos.)</div>}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <p className="text-gris">Escribe tu correo y te enviaremos un enlace para crear una nueva.</p>
          <Field label="Correo electrónico" error={err}>
            <input className="field-input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy}>Enviar enlace</Button>
        </form>
      )}
    </AuthShell>
  )
}

/* ===================== REGISTRO (comensal y mamita) ===================== */
export function Register() {
  const rol = rolOk(useParams().rol)
  const { setProfile } = useAuth()
  const { toast } = useToast()
  const nav = useNavigate()
  const [f, setF] = useState({
    full_name: '', email: '', password: '', phone: '', zone: 'Puno Centro', address: '',
    allergies: [] as string[], other_allergies: '', preferences: '', avoid_foods: '',
    public_zone_label: '', bio: '', home_description: '', show_home: false, yape_name: '', yape_phone: '',
  })
  const [more, setMore] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  function validate() {
    const e: Record<string, string> = {}
    if (f.full_name.trim().split(/\s+/).length < 2) e.full_name = 'Escribe tu nombre y apellido.'
    if (!emailValido(f.email)) e.email = 'Correo no válido.'
    if (f.password.length < 6) e.password = 'Mínimo 6 caracteres.'
    if (!celularValido(f.phone)) e.phone = 'Celular de 9 dígitos que empiece en 9.'
    if (f.address.trim().length < 5) e.address = rol === 'mamita' ? 'Necesaria para coordinar recojos (no se muestra).' : 'Necesaria para tus deliverys.'
    if (rol === 'comensal' && f.allergies.length === 0) e.allergies = 'Marca tus alergias o elige “Ninguna”. Así te avisamos si un plato no es para ti.'
    if (rol === 'mamita') {
      if (f.public_zone_label.trim().length < 4) e.public_zone_label = 'Ej. “A dos cuadras del mercado Bellavista”.'
      if (f.yape_name.trim().length < 3) e.yape_name = 'Nombre que aparece en tu Yape.'
      if (!celularValido(f.yape_phone)) e.yape_phone = 'Número de Yape de 9 dígitos.'
    }
    setErrs(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) { toast('Revisa los campos marcados', 'error'); return }
    setBusy(true)
    try {
      const { password, email, ...rest } = f
      const profile = { ...rest, phone: f.phone.replace(/\D/g, ''), yape_phone: f.yape_phone.replace(/\D/g, ''),
        allergies: f.allergies.filter((a) => a !== 'Ninguna') }
      const r = await api.signUp({ role: rol, email, password, profile })
      if (r.needsConfirmation) { setConfirm(true); return }
      setProfile(r.profile)
      // la mamita nueva ya recibe su bienvenida a pantalla completa: sin toast encima
      if (rol !== 'mamita') toast(`¡Bienvenida a nuestra mesa, ${primerNombre(f.full_name)}!`)
      nav(rol === 'mamita' ? '/mamita/bienvenida' : home(rol), { replace: true })
    } catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }

  if (confirm) return (
    <AuthShell back={`/acceso/${rol}`}>
      <div className="rounded-3xl bg-[#e8f5ee] p-6 text-center">
        <MailCheck className="mx-auto mb-3 text-ok" size={40} />
        <h1 className="font-serif text-2xl font-bold">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-cafe">Te enviamos un enlace a <b>{f.email}</b> para activar tu cuenta. Luego vuelve e ingresa.</p>
      </div>
      <Link to={`/ingresar/${rol}`} className="mt-5 block"><Button>Ir a ingresar</Button></Link>
    </AuthShell>
  )

  const E = (k: string) => errs[k]
  return (
    <AuthShell back={`/acceso/${rol}`}>
      <Eyebrow>Bienvenida a nuestra mesa</Eyebrow>
      <h1 className="mt-2 text-[34px] font-medium leading-[1.1]">Crea tu cuenta de {rol}</h1>
      <p className="mt-2 text-sm text-gris">Solo lo esencial. Lo demás lo completas cuando quieras desde tu perfil.</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Nombres y apellidos" error={E('full_name')}>
          <input className="field-input" autoComplete="name" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} aria-invalid={!!E('full_name')} />
        </Field>
        <Field label="Correo electrónico" error={E('email')}>
          <input className="field-input" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!E('email')} />
        </Field>
        <Field label="Contraseña" error={E('password')} hint="Mínimo 6 caracteres">
          <input className="field-input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} aria-invalid={!!E('password')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Celular" error={E('phone')}>
            <input className="field-input" inputMode="tel" autoComplete="tel" placeholder="9XX XXX XXX" value={f.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={!!E('phone')} />
          </Field>
          <Field label="Distrito o zona">
            <select className="field-input" value={f.zone} onChange={(e) => set('zone', e.target.value)}>
              {ZONAS.map((z) => <option key={z}>{z}</option>)}
            </select>
          </Field>
        </div>
        <Field label={rol === 'mamita' ? 'Dirección de referencia (privada)' : 'Dirección de entrega'} error={E('address')}
          hint={rol === 'mamita' ? 'Nunca la mostramos. Solo la ve el comensal cuando un pedido es para recojo y tú lo aceptas.' : undefined}>
          <input className="field-input" autoComplete="street-address" value={f.address} onChange={(e) => set('address', e.target.value)} aria-invalid={!!E('address')} />
        </Field>

        {rol === 'comensal' && (
          <fieldset className="rounded-[20px] border border-borde bg-white p-4">
            <legend className="px-2 text-[17px] font-semibold">Alergias e intolerancias</legend>
            <CheckGrid options={ALERGENOS} value={f.allergies} onChange={(v) => set('allergies', v)} noneLabel="Ninguna" />
            {E('allergies') && <p className="mt-2 text-xs font-semibold text-[#b42323]">{E('allergies')}</p>}
          </fieldset>
        )}

        {rol === 'mamita' && (
          <>
            <Field label="Zona que deseas mostrar públicamente" error={E('public_zone_label')}>
              <input className="field-input" placeholder="Ej. A dos cuadras del mercado Bellavista" value={f.public_zone_label} onChange={(e) => set('public_zone_label', e.target.value)} />
            </Field>
            <div className="rounded-[20px] border border-borde bg-crema-200 p-4">
              <div className="mb-3 text-sm font-bold">Tu Yape para recibir pagos</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre del titular" error={E('yape_name')}>
                  <input className="field-input" value={f.yape_name} onChange={(e) => set('yape_name', e.target.value)} />
                </Field>
                <Field label="Número Yape" error={E('yape_phone')}>
                  <input className="field-input" inputMode="tel" value={f.yape_phone} onChange={(e) => set('yape_phone', e.target.value)} />
                </Field>
              </div>
            </div>
          </>
        )}

        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between rounded-2xl bg-crema px-4 py-3 text-sm font-bold text-cafe" aria-expanded={more}>
          {rol === 'comensal' ? 'Más sobre tus gustos' : 'Tu presentación y tu cocina'} <span className="font-normal text-gris">opcional</span>
          <ChevronDown size={18} className={`transition ${more ? 'rotate-180' : ''}`} />
        </button>
        {more && rol === 'comensal' && (
          <div className="space-y-4">
            <Field label="Otras alergias" optional><input className="field-input" value={f.other_allergies} onChange={(e) => set('other_allergies', e.target.value)} /></Field>
            <Field label="Preferencias de comida" optional><textarea className="field-input min-h-20" value={f.preferences} onChange={(e) => set('preferences', e.target.value)} /></Field>
            <Field label="Alimentos que deseas evitar" optional><textarea className="field-input min-h-20" value={f.avoid_foods} onChange={(e) => set('avoid_foods', e.target.value)} /></Field>
          </div>
        )}
        {more && rol === 'mamita' && (
          <div className="space-y-4">
            <Field label="Presentación personal" optional><textarea className="field-input min-h-24" placeholder="Cuéntanos qué te gusta cocinar" value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
            <Field label="Tu cocina y ambiente" optional><textarea className="field-input min-h-24" value={f.home_description} onChange={(e) => set('home_description', e.target.value)} /></Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#A3173B]" checked={f.show_home} onChange={(e) => set('show_home', e.target.checked)} />
              Deseo mostrar la descripción de mi hogar públicamente
            </label>
          </div>
        )}

        <p className="text-center text-xs text-gris">
          {rol === 'mamita' ? 'Nunca mostraremos tu dirección exacta. Podrás añadir fotos desde tu perfil.' : 'Tus datos solo se comparten con la mamita de cada pedido.'}
        </p>
        <Button type="submit" loading={busy}>Crear mi cuenta</Button>
      </form>
    </AuthShell>
  )
}
