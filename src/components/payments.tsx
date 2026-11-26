/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { ChevronDown, CreditCard, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import { api, mensajeError } from '../data'
import { useAuth, useToast } from '../context/AppContext'
import type { Order, PayResult } from '../lib/types'
import { cardBrand, expValida, luhn, sleep, soles } from '../lib/format'
import { crearTokenYape, getMercadoPago, MP_FIELD_STYLE } from '../lib/mercadopago'
import { Button, Field } from './ui'

/* ---------------- Marca visual de los medios de pago ---------------- */
export function YapeMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`inline-flex items-center rounded-xl bg-[#742284] font-extrabold italic tracking-tight text-white ${size === 'sm' ? 'px-2 py-0.5 text-sm' : 'px-3 py-1 text-xl'}`}
      aria-label="Yape">yape</span>
  )
}

/** Notificación tipo SMS (modo demo): así llega el código de verificación del banco */
function SmsNotification({ code, amount, onClose }: { code: string; amount: number; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 12000); return () => clearTimeout(t) }, [code, onClose])
  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-[80] mx-auto max-w-[480px] px-3 pt-2 safe-top" role="status" aria-live="polite">
      <button onClick={onClose} className="rise w-full rounded-2xl bg-[#1f1a1c]/95 p-3 text-left text-white shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-[#2e9e5b] text-[10px] font-bold text-white">✉</span> Mensajes · ahora
        </div>
        <div className="mt-1 text-[13px] font-bold">Banco · Verificación de compra</div>
        <div className="text-[13px] text-white/90">Tu código para la compra de {soles(amount)} en MAMAYS es <b className="font-mono text-[15px] tracking-widest" data-testid="sms-code">{code}</b>. No lo compartas.</div>
      </button>
    </div>
  )
}

/* ---------------- Casillas del código (6 dígitos) ---------------- */
export function OtpBoxes({ value, onChange, label, autoFocus }: { value: string; onChange: (v: string) => void; label: string; autoFocus?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')
  const set = (i: number, d: string) => {
    const arr = digits.slice(); arr[i] = d
    onChange(arr.join('').slice(0, 6))
  }
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) { refs.current[i - 1]?.focus(); set(i - 1, '') }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, 5)]?.focus() }
  }
  return (
    <div className="flex justify-between gap-2" role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1} aria-label={`${label}, dígito ${i + 1}`} autoFocus={autoFocus && i === 0}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            if (v.length > 1) { onChange(v.slice(0, 6)); refs.current[Math.min(v.length, 5)]?.focus(); return }
            set(i, v); if (v && i < 5) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => onKey(i, e)} onPaste={onPaste} onFocus={(e) => e.target.select()}
          className="h-14 w-full min-w-0 rounded-xl border border-borde bg-white text-center text-2xl font-bold text-tinta outline-none focus:border-[#742284] focus:ring-2 focus:ring-[#742284]/20" />
      ))}
    </div>
  )
}

/* ===================== YAPE EN LÍNEA (celular + código de aprobación) ===================== */
export function YapePayForm({ order, onResult }: { order: Order; onResult: (r: PayResult) => void }) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [phone, setPhone] = useState((profile?.phone ?? '').replace(/\D/g, ''))
  const [otp, setOtp] = useState('')
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const phoneOk = /^\d{9}$/.test(phone.replace(/\D/g, ''))
  const fmt = (v: string) => v.replace(/\D/g, '').slice(0, 9).replace(/(\d{3})(\d{0,3})(\d{0,3})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '))

  async function pay() {
    setBusy(true)
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      let r: PayResult
      if (api.onlinePayments === 'mercadopago') {
        const token = await crearTokenYape(api.mercadoPagoPublicKey, cleanPhone, otp)
        r = await api.payOnline(order.id, { token })
      } else {
        r = await api.payOnline(order.id, { phone: cleanPhone, otp })
      }
      if (r.status === 'rejected') setOtp('')
      onResult(r)
    } catch (e) { toast(mensajeError(e), 'error'); setOtp('') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-borde bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <YapeMark />
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gris"><Lock size={12} /> Pago seguro</span>
        </div>
        <label className="mt-5 block">
          <span className="text-[14px] text-gris">Ingresa tu celular Yape</span>
          <input value={fmt(phone)} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} inputMode="tel" autoComplete="tel"
            placeholder="9XX XXX XXX" aria-label="Celular Yape"
            className="mt-1.5 w-full rounded-xl border border-borde bg-[#faf8f9] px-4 py-3.5 text-[22px] font-bold tracking-wide text-tinta outline-none focus:border-[#742284] focus:ring-2 focus:ring-[#742284]/20" />
        </label>
        <div className="mt-5">
          <span className="text-[14px] text-gris">Código de aprobación</span>
          <div className="mt-1.5"><OtpBoxes value={otp} onChange={setOtp} label="Código de aprobación" /></div>
          <p className="mt-2 text-[13px] text-gris">Encuéntralo en el menú de Yape.</p>
        </div>
        <button type="button" onClick={() => setHelp(!help)} aria-expanded={help}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[#742284]">
          ¿Dónde está mi código? <ChevronDown size={15} className={`transition ${help ? 'rotate-180' : ''}`} />
        </button>
        {help && (
          <ol className="mt-2 space-y-1.5 rounded-xl bg-[#f6eef8] p-3 text-[13px] text-[#4a1d55]">
            <li>1. Abre tu app <b>Yape</b>.</li>
            <li>2. Toca el <b>menú</b> (las tres rayitas ☰).</li>
            <li>3. Entra a <b>“Código de aprobación”</b>.</li>
            <li>4. Copia los <b>6 dígitos</b> y vuelve aquí. El código es temporal: si vence, genera otro.</li>
          </ol>
        )}
      </div>

      <Button onClick={pay} loading={busy} disabled={!phoneOk || otp.length !== 6} className="!bg-[#742284] hover:!bg-[#5d1a6a]">
        Pagar {soles(order.total)}
      </Button>
      <p className="text-center text-[11px] text-gris">Procesado por Mercado Pago. MAMAYS nunca ve tu clave de Yape.</p>
    </div>
  )
}

/* ===================== TARJETA (crédito / débito) ===================== */
const BRAND_LABEL: Record<string, string> = { visa: 'VISA', mastercard: 'Mastercard', amex: 'AMEX', diners: 'Diners', master: 'Mastercard' }

function CardPreview({ number, name, exp, brand }: { number: string; name: string; exp: string; brand: string }) {
  const d = number.replace(/\D/g, '')
  const shown = (d + '•'.repeat(Math.max(0, 16 - d.length))).slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  return (
    <div className="relative aspect-[1.586] w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#2b1d21] via-[#5a1630] to-[#A3173B] p-5 text-white shadow-[0_16px_30px_-14px_rgb(0_0_0/0.6)]">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[22px] border-white/10" />
      <div className="flex items-start justify-between">
        <div className="h-8 w-11 rounded-md bg-gradient-to-br from-[#f3d38a] to-[#c9a24a]" aria-hidden="true" />
        <span className="text-lg font-extrabold italic">{BRAND_LABEL[brand] ?? ''}</span>
      </div>
      <div className="mt-7 font-mono text-[19px] tracking-[0.12em]">{d ? shown : '•••• •••• •••• ••••'}</div>
      <div className="mt-4 flex items-end justify-between text-[11px] uppercase">
        <div><div className="text-white/60">Titular</div><div className="text-[13px] font-semibold">{name || 'NOMBRE APELLIDO'}</div></div>
        <div className="text-right"><div className="text-white/60">Vence</div><div className="text-[13px] font-semibold">{exp || 'MM/AA'}</div></div>
      </div>
    </div>
  )
}

export function CardPayForm({ order, onResult }: { order: Order; onResult: (r: PayResult) => void }) {
  return api.onlinePayments === 'mercadopago'
    ? <CardFormMercadoPago order={order} onResult={onResult} />
    : <CardFormDemo order={order} onResult={onResult} />
}

/** Modo demo: campos normales con validación real (Luhn, vencimiento, CVV). No se guarda ni envía nada. */
function CardFormDemo({ order, onResult }: { order: Order; onResult: (r: PayResult) => void }) {
  const { toast } = useToast()
  const [c, setC] = useState({ number: '', name: '', exp: '', cvv: '', docType: 'DNI', doc: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof c, v: string) => setC((x) => ({ ...x, [k]: v }))
  const brand = cardBrand(c.number)
  const numOk = luhn(c.number)
  const expOk = expValida(c.exp)
  const valid = numOk && expOk && /^\d{3,4}$/.test(c.cvv) && c.name.trim().length >= 2 && /^\d{8,12}$/.test(c.doc)

  async function pay() {
    setBusy(true)
    try { onResult(await api.payOnline(order.id, { card: { number: c.number, name: c.name, exp: c.exp, cvv: c.cvv } })) }
    catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <CardPreview number={c.number} name={c.name.toUpperCase()} exp={c.exp} brand={brand} />
      <Field label="Número de tarjeta" error={c.number.replace(/\D/g, '').length >= 13 && !numOk ? 'Número no válido' : undefined}>
        <input className="field-input font-mono tracking-wider" inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234"
          value={c.number} onChange={(e) => set('number', e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vencimiento" error={c.exp.length === 5 && !expOk ? 'Fecha no válida' : undefined}>
          <input className="field-input" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={c.exp}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); set('exp', d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d) }} />
        </Field>
        <Field label="CVV">
          <input className="field-input" inputMode="numeric" autoComplete="cc-csc" placeholder="123" type="password" value={c.cvv}
            onChange={(e) => set('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </Field>
      </div>
      <Field label="Nombre del titular (como en la tarjeta)">
        <input className="field-input uppercase" autoComplete="cc-name" value={c.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Documento">
          <select className="field-input" value={c.docType} onChange={(e) => set('docType', e.target.value)}><option>DNI</option><option>C.E</option></select>
        </Field>
        <Field label="Número"><input className="field-input" inputMode="numeric" value={c.doc} onChange={(e) => set('doc', e.target.value.replace(/\D/g, '').slice(0, 12))} /></Field>
      </div>
      <Button onClick={pay} loading={busy} disabled={!valid}><Lock size={16} /> Pagar {soles(order.total)}</Button>
      <p className="flex items-center justify-center gap-1 text-center text-[11px] text-gris"><ShieldCheck size={13} /> Protegido con verificación 3-D Secure de tu banco</p>
      <button type="button" onClick={() => setC({ number: '4009 1753 3280 6176', name: 'APRO', exp: '11/30', cvv: '123', docType: 'DNI', doc: '12345678' })}
        className="mx-auto block text-[11px] text-[#b9a9ad] underline">Usar tarjeta de prueba</button>
    </div>
  )
}

/** Mercado Pago real: campos seguros (iframes) para número, vencimiento y CVV */
function CardFormMercadoPago({ order, onResult }: { order: Order; onResult: (r: PayResult) => void }) {
  const { toast } = useToast()
  const [ready, setReady] = useState(false)
  const [name, setName] = useState('')
  const [docType, setDocType] = useState('DNI')
  const [docTypes, setDocTypes] = useState<{ id: string; name: string }[]>([{ id: 'DNI', name: 'DNI' }])
  const [doc, setDoc] = useState('')
  const [brand, setBrand] = useState('')
  const [busy, setBusy] = useState(false)
  const mpRef = useRef<any>(null)
  const pm = useRef<{ id: string; issuer?: string }>({ id: '' })

  useEffect(() => {
    let fields: any[] = []
    let alive = true
    getMercadoPago(api.mercadoPagoPublicKey).then(async (mp) => {
      if (!alive) return
      mpRef.current = mp
      const style = { style: MP_FIELD_STYLE }
      const num = mp.fields.create('cardNumber', { placeholder: '1234 1234 1234 1234', ...style }).mount('mp-cardNumber')
      const exp = mp.fields.create('expirationDate', { placeholder: 'MM/AA', ...style }).mount('mp-expirationDate')
      const cvv = mp.fields.create('securityCode', { placeholder: '123', ...style }).mount('mp-securityCode')
      fields = [num, exp, cvv]
      num.on('binChange', async ({ bin }: { bin?: string }) => {
        if (!bin) { pm.current = { id: '' }; setBrand(''); return }
        try {
          const { results } = await mp.getPaymentMethods({ bin })
          const m = results?.[0]
          if (!m) return
          let issuer = m.issuer?.id
          if (m.additional_info_needed?.includes('issuer_id')) {
            const issuers = await mp.getIssuers({ paymentMethodId: m.id, bin })
            issuer = issuers?.[0]?.id
          }
          pm.current = { id: m.id, issuer: issuer ? String(issuer) : undefined }
          setBrand(m.id)
          if (m.settings?.[0]) { num.update({ settings: m.settings[0].card_number }); cvv.update({ settings: m.settings[0].security_code }) }
        } catch { /* se reintenta con el siguiente BIN */ }
      })
      try { const t = await mp.getIdentificationTypes(); if (t?.length) setDocTypes(t) } catch { /* DNI por defecto */ }
      setReady(true)
    }).catch((e) => toast(mensajeError(e), 'error'))
    return () => { alive = false; fields.forEach((f) => { try { f.unmount() } catch { /* ya desmontado */ } }) }
  }, [toast])

  async function pay() {
    if (!pm.current.id) return toast('Revisa el número de tarjeta', 'error')
    setBusy(true)
    try {
      const token = await mpRef.current.fields.createCardToken({ cardholderName: name, identificationType: docType, identificationNumber: doc })
      onResult(await api.payOnline(order.id, {
        token: token.id, payment_method_id: pm.current.id, issuer_id: pm.current.issuer, installments: 1,
        identification: { type: docType, number: doc },
      }))
    } catch (e: any) {
      const msg = Array.isArray(e) ? e.map((x: any) => x.message).join(' · ') : mensajeError(e)
      toast(msg || 'Revisa los datos de la tarjeta', 'error')
    } finally { setBusy(false) }
  }

  const box = 'h-[50px] rounded-[14px] border border-borde bg-white px-3.5'
  return (
    <div className="space-y-4">
      <CardPreview number="" name={name.toUpperCase()} exp="" brand={brand} />
      <div>
        <span className="mb-1.5 block text-[13px] font-bold">Número de tarjeta</span>
        <div id="mp-cardNumber" className={box} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><span className="mb-1.5 block text-[13px] font-bold">Vencimiento</span><div id="mp-expirationDate" className={box} /></div>
        <div><span className="mb-1.5 block text-[13px] font-bold">CVV</span><div id="mp-securityCode" className={box} /></div>
      </div>
      <Field label="Nombre del titular (como en la tarjeta)">
        <input className="field-input uppercase" autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Documento">
          <select className="field-input" value={docType} onChange={(e) => setDocType(e.target.value)}>{docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </Field>
        <Field label="Número"><input className="field-input" inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value.replace(/\D/g, '').slice(0, 12))} /></Field>
      </div>
      <Button onClick={pay} loading={busy || !ready} disabled={!ready || name.trim().length < 2 || doc.length < 8}><Lock size={16} /> Pagar {soles(order.total)}</Button>
      <p className="flex items-center justify-center gap-1 text-center text-[11px] text-gris"><ShieldCheck size={13} /> Tus datos van cifrados directo a Mercado Pago · verificación 3-D Secure</p>
    </div>
  )
}

/* ===================== VERIFICACIÓN 3-D SECURE ===================== */
export function ThreeDSModal({ order, challenge, onResult, onCancel }: {
  order: Order; challenge: Extract<PayResult, { status: 'challenge' }>; onResult: (r: PayResult) => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Verificación de seguridad">
      <div className="rise w-full max-w-[480px] overflow-hidden rounded-t-[28px] bg-white sm:rounded-[28px]">
        {challenge.url && challenge.creq
          ? <ChallengeIframe order={order} url={challenge.url} creq={challenge.creq} onResult={onResult} onCancel={onCancel} />
          : <ChallengeDemo order={order} challenge={challenge} onResult={onResult} onCancel={onCancel} />}
      </div>
    </div>
  )
}

/** Mercado Pago: el banco muestra su propia pantalla dentro de un iframe (estándar EMV 3-D Secure) */
function ChallengeIframe({ order, url, creq, onResult, onCancel }: { order: Order; url: string; creq: string; onResult: (r: PayResult) => void; onCancel: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [checking, setChecking] = useState(false)
  useEffect(() => { formRef.current?.submit() }, [])
  useEffect(() => {
    async function onMsg(e: MessageEvent) {
      if (e.data?.status !== 'COMPLETE') return
      setChecking(true)
      // El fin del desafío no significa aprobado: se consulta el estado final del pago
      for (let i = 0; i < 8; i++) {
        try {
          const r = await api.confirmChallenge(order.id)
          if (r.status !== 'pending' && r.status !== 'challenge') return onResult(r)
        } catch { /* reintento */ }
        await sleep(2000)
      }
      onResult({ status: 'pending', message: 'Tu banco aún está confirmando el pago. Te avisaremos en Mis pedidos.' })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [order.id, onResult])
  return (
    <div>
      <div className="flex items-center justify-between border-b border-borde px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="text-ok" size={18} /> Verificación de tu banco</div>
        <button onClick={onCancel} className="text-sm font-semibold text-gris">Cancelar</button>
      </div>
      {checking && <div className="bg-[#e8f5ee] px-5 py-2 text-center text-sm font-semibold text-ok">Confirmando con tu banco…</div>}
      <iframe name="mamays3ds" title="Verificación 3-D Secure" className="h-[70vh] w-full border-0" />
      <form ref={formRef} method="post" action={url} target="mamays3ds" className="hidden">
        <input type="hidden" name="creq" value={creq} />
      </form>
    </div>
  )
}

/** Modo demo: simulación de la pantalla de verificación (código de un solo uso por SMS) */
function ChallengeDemo({ order, challenge, onResult, onCancel }: { order: Order; challenge: Extract<PayResult, { status: 'challenge' }>; onResult: (r: PayResult) => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(300)
  const [sms, setSms] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSms(true), 1200); return () => clearTimeout(t) }, [])
  useEffect(() => { const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (left === 0) onResult({ status: 'rejected', message: 'Se acabó el tiempo para verificar. Intenta pagar de nuevo.' }) }, [left, onResult])

  async function confirm() {
    setBusy(true); setErr('')
    try { onResult(await api.confirmChallenge(order.id, code)) }
    catch (e) { setErr(mensajeError(e)); setCode('') } finally { setBusy(false) }
  }
  return (
    <div className="p-6 pb-8 safe-bottom">
      {sms && challenge.demoCode && <SmsNotification code={challenge.demoCode} amount={order.total} onClose={() => setSms(false)} />}
      <div className="flex items-center gap-2 text-sm font-extrabold text-tinta"><ShieldCheck className="text-ok" /> Verificación 3-D Secure</div>
      <div className="mt-4 rounded-2xl bg-crema p-4 text-sm">
        <div className="flex justify-between"><span className="text-gris">Comercio</span><b>MAMAYS</b></div>
        <div className="mt-1 flex justify-between"><span className="text-gris">Monto</span><b>{soles(order.total)}</b></div>
      </div>
      <p className="mt-4 flex gap-2 text-[15px]"><Smartphone className="mt-0.5 shrink-0 text-guinda" size={18} />
        Tu banco envió un código de 6 dígitos por SMS al celular <b className="whitespace-nowrap">{challenge.maskedPhone}</b>.</p>
      <div className="mt-4"><OtpBoxes value={code} onChange={setCode} label="Código de verificación" autoFocus /></div>
      {err && <p className="mt-2 text-sm font-semibold text-[#a32020]" role="alert">{err}</p>}
      <p className="mt-3 text-center text-xs text-gris">El código vence en {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} ·{' '}
        <button type="button" onClick={() => setSms(true)} className="font-semibold text-guinda underline">¿No te llegó? Ver mensaje</button></p>
      <div className="mt-4 space-y-2">
        <Button onClick={confirm} loading={busy} disabled={code.length !== 6}>Confirmar</Button>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-gris"><CreditCard size={12} /> Verificación protegida de tu banco</p>
    </div>
  )
}
