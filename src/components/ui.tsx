import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, ChevronLeft, Clock, DoorOpen, House, ImagePlus, Leaf, LogOut, Minus, Plus, ReceiptText, RotateCcw,
  Salad, ShoppingBag, Sparkles, Store, Target, TriangleAlert, Truck, UserRound, X,
} from 'lucide-react'
import { useAuth, useCart, useNotifications, useToast } from '../context/AppContext'
import { api } from '../data'
import type { ImageKind } from '../data/api'
import { comprimirImagen, primerNombre } from '../lib/format'
import { dishArt } from '../data/demoArt'

/* ---------------- Marca ---------------- */
export function Logo({ light = false, small = false }: { light?: boolean; small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`grid place-items-center rounded-xl font-serif font-bold ${small ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl'} ${
        light ? 'bg-white text-guinda' : 'bg-guinda text-white'}`}>M</div>
      <div className="leading-tight">
        <div className={`font-serif font-bold tracking-wide ${small ? 'text-lg' : 'text-xl'} ${light ? 'text-white' : 'text-guinda'}`}>MAMAYS</div>
        <div className={`text-[10px] ${light ? 'text-white/80' : 'text-gris'}`}>comida casera hecha con amor</div>
      </div>
    </div>
  )
}

export const Eyebrow = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`eyebrow ${className}`}>{children}</div>

export function Avatar({ name, url, size = 44 }: { name: string; url?: string; size?: number }) {
  if (url) return <img src={url} alt={name} className="rounded-full object-cover border-2 border-white shadow" style={{ width: size, height: size }} />
  const ini = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  return (
    <div className="grid place-items-center rounded-full bg-guinda-50 text-guinda font-serif font-bold border-2 border-white shadow"
      style={{ width: size, height: size, fontSize: size * 0.38 }} aria-label={name}>{ini}</div>
  )
}

export function Stars({ value, count, className = '' }: { value: number | null; count?: number; className?: string }) {
  if (value == null) return <span className={`text-xs text-gris ${className}`}>Nuevo</span>
  return (
    <span className={`text-xs text-gris ${className}`}>
      <span className="text-[#E9A23B]">★</span> {value.toFixed(1)}{count != null && <span> ({count})</span>}
    </span>
  )
}

/* ---------------- Foto de plato con respaldo ---------------- */
const ARTS = ['arroz', 'queso', 'aji', 'trucha', 'sopa', 'quinua', 'verde', 'carne']
/** Muestra la foto real; si no carga (sin internet o enlace roto), pone una ilustración en su lugar */
/** Ilustración de respaldo de un plato (la misma en tarjetas, detalle y visor 3D) */
export function dishFallbackArt(name: string) {
  const seed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  return dishArt(ARTS[seed % ARTS.length], seed)
}

export function DishPhoto({ src, alt, className = '', onClick }: { src?: string; alt: string; className?: string; onClick?: () => void }) {
  const [failed, setFailed] = useState(false)
  const art = dishFallbackArt(alt)
  return <img src={!src || failed ? art : src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
    onError={() => setFailed(true)} onClick={onClick} className={className} />
}

/* ---------------- Botones ---------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger'; loading?: boolean; full?: boolean }
export function Button({ variant = 'primary', loading, full = true, className = '', children, disabled, ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-guinda text-white shadow-[0_8px_20px_-8px_rgb(163_23_59/0.6)] hover:bg-guinda-700 disabled:bg-[#d98aa0] disabled:shadow-none',
    secondary: 'bg-white text-guinda border border-borde hover:bg-guinda-50',
    dark: 'bg-cafe text-white hover:bg-[#3a262b]',
    ghost: 'bg-transparent text-guinda hover:bg-guinda-50',
    danger: 'bg-white text-[#a32020] border border-[#f0c9c9] hover:bg-[#fff1f1]',
  }[variant]
  return (
    <button {...rest} disabled={disabled || loading}
      className={`${full ? 'w-full' : ''} inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-bold transition active:scale-[.98] disabled:cursor-not-allowed ${styles} ${className}`}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

export function BackButton({ to, label = 'Volver' }: { to?: string; label?: string }) {
  const nav = useNavigate()
  return (
    <button onClick={() => (to ? nav(to) : nav(-1))} className="inline-flex items-center gap-1 text-sm font-bold text-guinda py-2 -ml-1">
      <ChevronLeft size={18} /> {label}
    </button>
  )
}

/* ---------------- Formularios ---------------- */
export function Field({ label, hint, error, children, optional }: { label: string; hint?: string; error?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-tinta">
        {label} {optional && <span className="font-normal text-gris">(opcional)</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-[#b42323]">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-gris">{hint}</span> : null}
    </label>
  )
}

export function CheckGrid({ options, value, onChange, noneLabel }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; noneLabel?: string }) {
  const toggle = (o: string) => {
    if (o === noneLabel) return onChange(value.includes(o) ? [] : [o])
    const base = value.filter((x) => x !== noneLabel)
    onChange(base.includes(o) ? base.filter((x) => x !== o) : [...base, o])
  }
  const all = noneLabel ? [...options, noneLabel] : options
  return (
    <div className="grid grid-cols-2 gap-2">
      {all.map((o) => {
        const on = value.includes(o)
        return (
          <button type="button" key={o} onClick={() => toggle(o)} aria-pressed={on}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${on ? 'border-guinda bg-guinda-50 font-semibold text-guinda' : 'border-borde bg-white text-tinta'}`}>
            <span className={`grid h-4 w-4 place-items-center rounded border ${on ? 'border-guinda bg-guinda text-white' : 'border-[#cbb]'}`}>
              {on && <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
            </span>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-[13px] font-bold transition ${value === o.value ? 'border-guinda bg-guinda-50 text-guinda' : 'border-borde bg-white text-gris'}`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, max = 20, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="inline-flex items-center rounded-2xl border border-borde bg-white">
      <button type="button" aria-label="Quitar" disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-11 w-11 place-items-center text-guinda disabled:opacity-30"><Minus size={18} /></button>
      <span className="min-w-8 text-center font-bold">{value}{label && <span className="ml-1 text-xs font-semibold text-gris">{label}</span>}</span>
      <button type="button" aria-label="Agregar" disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-11 w-11 place-items-center text-guinda disabled:opacity-30"><Plus size={18} /></button>
    </div>
  )
}

/* ---------------- Etiquetas ---------------- */
const TAG_ICON: Record<string, ReactNode> = {
  Vegetariano: <Leaf size={13} />, Vegano: <Leaf size={13} />, Saludable: <Salad size={13} />, 'Bajo en sal': <Sparkles size={13} />,
  'Se puede recalentar': <RotateCcw size={13} />, 'Consumir fresco': <Clock size={13} />, Delivery: <Truck size={13} />, Recojo: <Store size={13} />,
  'Comer en el hogar': <DoorOpen size={13} />,
}
export function Tag({ label, alert, icon, sm }: { label: string; alert?: boolean; icon?: ReactNode; sm?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold ${sm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${
      alert ? 'border-[#f3c9a4] bg-[#fff4ea] text-[#9a4b0f]' : 'border-borde bg-white text-cafe'}`}>
      {icon ?? (alert ? <TriangleAlert size={13} /> : TAG_ICON[label])}{label}
    </span>
  )
}

export function StockBar({ available, portions }: { available: number; portions: number }) {
  const pct = portions > 0 ? Math.round((available / portions) * 100) : 0
  const color = available === 0 ? '#c9b8bb' : available === 1 ? '#D9822B' : '#1F8A5B'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#efe7e3]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-guinda-50 text-guinda">{icon}</div>
      <div className="font-serif text-xl font-bold text-cafe">{title}</div>
      <p className="mt-1 max-w-[280px] text-sm text-gris">{text}</p>
      {action && <div className="mt-5 w-full max-w-[260px]">{action}</div>}
    </div>
  )
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-gris">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-guinda border-t-transparent" />
      {text}
    </div>
  )
}

export function Card({ children, className = '', tone = 'white' }: { children: ReactNode; className?: string; tone?: 'white' | 'crema' | 'rosa' }) {
  const bg = tone === 'crema' ? 'bg-crema-200 border-[#f6e0cd]' : tone === 'rosa' ? 'bg-guinda-50 border-[#f5d3dc]' : 'bg-white border-borde'
  return <div className={`rounded-[20px] border p-4 ${bg} ${className}`}>{children}</div>
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="rise w-full max-w-[480px] rounded-t-[28px] bg-white p-5 pb-8 safe-bottom max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="font-serif text-xl font-bold">{title}</div>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full bg-crema"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------------- Fotos ---------------- */
export function ImagePicker({ images, onChange, max = 4, kind, label = 'Agregar foto' }: { images: string[]; onChange: (imgs: string[]) => void; max?: number; kind: ImageKind; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  async function pick(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const out: string[] = []
      for (const f of Array.from(files).slice(0, max - images.length)) {
        if (!f.type.startsWith('image/')) continue
        const blob = await comprimirImagen(f, kind === 'voucher' ? 1400 : 1000)
        out.push(await api.uploadImage(kind, blob))
      }
      onChange([...images, ...out])
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo subir la foto', 'error')
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((src, i) => (
        <div key={src + i} className="relative h-24 w-24 overflow-hidden rounded-2xl border border-borde bg-crema">
          <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
          <button type="button" aria-label="Quitar foto" onClick={() => onChange(images.filter((_, j) => j !== i))}
            className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X size={14} /></button>
        </div>
      ))}
      {images.length < max && (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#e6c6cf] bg-guinda-50/50 text-xs font-semibold text-guinda">
          {busy ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-guinda border-t-transparent" /> : <ImagePlus size={22} />}
          {busy ? 'Subiendo…' : label}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" multiple={max > 1} hidden onChange={(e) => pick(e.target.files)} />
    </div>
  )
}

/* ---------------- Estructura de pantalla ---------------- */
export function Header() {
  const { profile, signOut } = useAuth()
  const { unread } = useNotifications()
  const { count } = useCart()
  const nav = useNavigate()
  if (!profile) return null
  const base = profile.role === 'mamita' ? '/mamita' : '/comensal'
  return (
    <header className="sticky top-0 z-30 border-b border-borde/70 bg-white/95 backdrop-blur safe-top">
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link to={base} aria-label="Ir al inicio de MAMAYS"><Logo small /></Link>
        <div className="flex items-center gap-1.5">
          {profile.role === 'mamita' && <span className="mr-1 hidden text-sm font-semibold text-cafe min-[380px]:inline">{primerNombre(profile.full_name)}</span>}
          <button onClick={() => nav(`${base}/avisos`)} aria-label={`Avisos${unread ? `, ${unread} sin leer` : ''}`}
            className="relative grid h-10 w-10 place-items-center rounded-full bg-crema-200 text-guinda">
            <Bell size={19} />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-guinda px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
          </button>
          {profile.role === 'comensal' && (
            <button onClick={() => nav('/comensal/carrito')} aria-label={`Carrito, ${count} platos`}
              className="relative grid h-10 w-10 place-items-center rounded-full bg-crema-200 text-guinda">
              <ShoppingBag size={19} />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-guinda px-1 text-[10px] font-bold text-white">{count}</span>}
            </button>
          )}
          <button onClick={async () => { await signOut(); nav('/') }} aria-label="Salir"
            className="ml-0.5 grid h-10 w-10 place-items-center rounded-full text-gris hover:bg-crema"><LogOut size={18} /></button>
        </div>
      </div>
    </header>
  )
}

export function BottomNav() {
  const { profile } = useAuth()
  const loc = useLocation()
  if (!profile) return null
  const items = profile.role === 'mamita'
    ? [
        { to: '/mamita', label: 'Inicio', icon: <House size={21} /> },
        { to: '/mamita/platos', label: 'Mis platos', icon: <Target size={21} /> },
        { to: '/mamita/pedidos', label: 'Pedidos', icon: <ShoppingBag size={21} /> },
        { to: '/mamita/perfil', label: 'Mi perfil', icon: <UserRound size={21} /> },
      ]
    : [
        { to: '/comensal', label: 'Inicio', icon: <House size={21} /> },
        { to: '/comensal/pedidos', label: 'Mis pedidos', icon: <ReceiptText size={21} /> },
        { to: '/comensal/perfil', label: 'Mi perfil', icon: <UserRound size={21} /> },
      ]
  const active = (to: string) => (to === '/mamita' || to === '/comensal' ? loc.pathname === to : loc.pathname.startsWith(to))
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-borde bg-white safe-bottom" aria-label="Navegación principal">
      <div className="flex">
        {items.map((it) => (
          <Link key={it.to} to={it.to} aria-current={active(it.to) ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold ${active(it.to) ? 'text-guinda' : 'text-gris'}`}>
            {active(it.to) && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-guinda" />}
            {it.icon}{it.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function Screen({ children, nav = true, header = true, className = '' }: { children: ReactNode; nav?: boolean; header?: boolean; className?: string }) {
  return (
    <div className="min-h-full">
      {header && <Header />}
      <main className={`px-5 pt-5 ${nav ? 'pb-28' : 'pb-10'} ${className}`}>{children}</main>
      {nav && <BottomNav />}
    </div>
  )
}

export function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: ReactNode }) {
  return (
    <div className="mb-5">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-1.5 font-serif text-[30px] font-bold leading-[1.1] text-tinta">{title}</h1>
      {text && <p className="mt-2 text-[15px] text-gris">{text}</p>}
    </div>
  )
}

export function DemoBanner() {
  if (api.mode !== 'demo') return null
  return (
    <div className="bg-cafe px-4 py-1.5 text-center text-[11px] font-semibold text-white">
      MODO DEMO · los datos se guardan solo en este dispositivo
    </div>
  )
}
