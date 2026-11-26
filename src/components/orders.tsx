import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import type { Order, OrderStatus } from '../lib/types'
import { STATUS_BADGE, STATUS_LABEL, statusLabel, timelineSteps } from '../lib/constants'
import { hora, soles } from '../lib/format'
import { api } from '../data'
import { DishPhoto } from './ui'

const BADGE_TONE: Partial<Record<OrderStatus, string>> = {
  reservado: 'bg-[#fff4ea] text-[#9a4b0f]',
  enviado: 'bg-guinda text-white',
  aceptado: 'bg-[#e8f5ee] text-ok',
  preparando: 'bg-[#fff4ea] text-[#9a4b0f]',
  listo: 'bg-[#e8f5ee] text-ok',
  en_camino: 'bg-[#e9f0fb] text-[#285ea8]',
  entregado: 'bg-[#eee8e6] text-cafe',
  rechazado: 'bg-[#fde8e8] text-[#a32020]',
  cancelado: 'bg-[#eee8e6] text-gris',
  expirado: 'bg-[#eee8e6] text-gris',
}

export function StatusBadge({ s }: { s: OrderStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider ${BADGE_TONE[s]}`}>{STATUS_BADGE[s]}</span>
}

export function OrderTimeline({ order }: { order: Order }) {
  const steps = timelineSteps(order.mode)
  const at = (s: OrderStatus) => order.history.find((h) => h.status === s)?.at
  const closedBad = ['rechazado', 'cancelado', 'expirado'].includes(order.status)
  const currentIdx = steps.indexOf(order.status)
  return (
    <ol className="relative ml-1">
      {steps.map((s, i) => {
        const time = at(s)
        const done = !!time
        const current = i === currentIdx && order.status !== 'entregado'
        const label = s === 'enviado' ? 'Pedido enviado · esperando revisión' : statusLabel(s, order.mode)
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${done && at(steps[i + 1]) ? 'bg-ok' : 'bg-borde'}`} />}
            <span className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
              done ? 'border-ok bg-ok text-white' : current ? 'border-guinda bg-white text-guinda' : 'border-borde bg-white text-borde'}`}>
              {done ? <Check size={14} strokeWidth={3} /> : <Clock size={13} />}
            </span>
            <div className="pt-0.5">
              <div className={`text-sm font-bold ${done ? 'text-tinta' : 'text-gris'}`}>{label}</div>
              <div className="text-xs text-gris">{time ? hora(time) : current ? 'En curso…' : 'Pendiente'}</div>
            </div>
          </li>
        )
      })}
      {closedBad && (
        <li className="mt-3 rounded-2xl bg-[#fde8e8] p-3 text-sm font-semibold text-[#a32020]">
          {STATUS_LABEL[order.status]}
          {order.history.at(-1)?.reason ? ` · ${order.history.at(-1)?.reason}` : ''}
        </li>
      )}
    </ol>
  )
}

export function OrderTotals({ o }: { o: Order }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-crema p-2"><div className="text-[10px] text-gris">Platos</div><div className="text-sm font-bold">{soles(o.subtotal)}</div></div>
      <div className="rounded-xl bg-crema p-2"><div className="text-[10px] text-gris">{o.mode === 'delivery' ? 'Delivery' : o.mode === 'en_casa' ? 'En el hogar' : 'Recojo'}</div><div className="text-sm font-bold">{soles(o.delivery_cost)}</div></div>
      <div className="rounded-xl bg-guinda-50 p-2"><div className="text-[10px] text-gris">Total</div><div className="text-sm font-extrabold text-guinda">{soles(o.total)}</div></div>
    </div>
  )
}

export function OrderItems({ o }: { o: Order }) {
  return (
    <ul className="space-y-2">
      {o.items.map((it) => (
        <li key={it.dish_id + it.dish_name} className="flex items-center gap-3">
          <DishPhoto src={it.photo} alt={it.dish_name} className="h-11 w-11 rounded-xl object-cover" />
          <div className="min-w-0 flex-1 text-sm"><span className="font-bold">{it.qty} ×</span> {it.dish_name}
            {it.extras?.length > 0 && <span className="block text-xs text-gris">+ {it.extras.map((x) => x.name).join(', ')}</span>}</div>
          <div className="whitespace-nowrap text-sm font-semibold">{soles((it.unit_price + (it.extras_total ?? 0)) * it.qty)}</div>
        </li>
      ))}
    </ul>
  )
}

/** Constancia de Yape: en Supabase se pide un enlace firmado temporal (bucket privado) */
export function VoucherImage({ ref_ }: { ref_: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => { let on = true; api.resolveImage('voucher', ref_).then((u) => on && setSrc(u)).catch(() => {}); return () => { on = false } }, [ref_])
  if (!src) return <div className="grid h-64 place-items-center text-sm text-gris">Cargando constancia…</div>
  return <img src={src} alt="Constancia de pago" className="max-h-[65vh] w-full rounded-2xl object-contain bg-crema" />
}

export function ReservaCountdown({ until, onExpire }: { until: string; onExpire?: () => void }) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now())
  useEffect(() => {
    const t = setInterval(() => {
      const l = new Date(until).getTime() - Date.now()
      setLeft(l)
      if (l <= 0) { clearInterval(t); onExpire?.() }
    }, 1000)
    return () => clearInterval(t)
  }, [until, onExpire])
  const s = Math.max(0, Math.floor(left / 1000))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return (
    <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${s < 120 ? 'bg-[#fde8e8] text-[#a32020]' : 'bg-[#fff4ea] text-[#9a4b0f]'}`}>
      <span className="text-sm font-semibold">Tu porción está reservada</span>
      <span className="font-mono text-xl font-extrabold tabular-nums" aria-live="off">{mm}:{ss}</span>
    </div>
  )
}
