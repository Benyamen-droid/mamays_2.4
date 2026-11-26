import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, MessageCircle, Send, Star, Trash2 } from 'lucide-react'
import { api, mensajeError } from '../data'
import { useAuth, useToast } from '../context/AppContext'
import type { Review } from '../lib/types'
import { haceCuanto } from '../lib/format'
import { Avatar, Button } from './ui'

export function StarsInput({ value, onChange, size = 30, label }: { value: number; onChange: (n: number) => void; size?: number; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label}: ${n} estrellas`} onClick={() => onChange(n)}
          className={n <= value ? 'text-[#E9A23B]' : 'text-[#dccfcf]'}><Star size={size} fill="currentColor" /></button>
      ))}
    </div>
  )
}

export function StarsRow({ n }: { n: number }) {
  return <span className="text-[13px] tracking-tight text-[#E9A23B]" aria-label={`${n} de 5 estrellas`}>{'★'.repeat(n)}<span className="text-[#e5d9d9]">{'★'.repeat(5 - n)}</span></span>
}

/** Una reseña o comentario, con la respuesta de la mamita y opciones según quién mira */
export function ReviewItem({ r, canReply, onChanged, label }: { r: Review; canReply?: boolean; onChanged?: () => void; label?: string }) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState(r.reply)
  const [busy, setBusy] = useState(false)
  async function saveReply() {
    setBusy(true)
    try { await api.replyReview(r.id, reply); setReplying(false); toast('Respuesta publicada'); onChanged?.() }
    catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }
  async function remove() {
    try { await api.deleteComment(r.id); toast('Comentario eliminado', 'info'); onChanged?.() } catch (e) { toast(mensajeError(e), 'error') }
  }
  return (
    <li className="py-3.5">
      {label && <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gris">{label}</div>}
      <div className="flex items-start gap-3">
        <Avatar name={r.author_name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-bold">{r.author_name}</span>
            {r.verified && <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-ok"><BadgeCheck size={13} /> Compra verificada</span>}
            <span className="text-[11px] text-gris">{haceCuanto(r.created_at)}</span>
          </div>
          {r.rating != null && <StarsRow n={r.rating} />}
          {r.body && <p className="mt-0.5 whitespace-pre-line text-[14px] text-tinta">{r.body}</p>}
          {r.reply && !replying && (
            <div className="mt-2 rounded-xl bg-guinda-50 px-3 py-2 text-[13px]">
              <span className="font-bold text-guinda">Respuesta de la mamita: </span>{r.reply}
            </div>
          )}
          <div className="mt-1 flex gap-3">
            {canReply && !replying && <button onClick={() => setReplying(true)} className="text-xs font-bold text-guinda">{r.reply ? 'Editar respuesta' : 'Responder'}</button>}
            {profile?.id === r.author_id && r.kind === 'comment' && <button onClick={remove} className="inline-flex items-center gap-1 text-xs font-semibold text-gris"><Trash2 size={12} /> Eliminar</button>}
          </div>
          {replying && (
            <div className="mt-2">
              <textarea className="field-input min-h-16 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={500} placeholder="Escribe tu respuesta…" />
              <div className="mt-2 flex gap-2">
                <Button full={false} className="!py-2 text-sm" onClick={saveReply} loading={busy}>Publicar</Button>
                <Button full={false} variant="secondary" className="!py-2 text-sm" onClick={() => { setReplying(false); setReply(r.reply) }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

/** Sección de comentarios de un plato: calificaciones verificadas + comentarios libres */
export function DishComments({ dishId }: { dishId: string }) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Review[] | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => api.listReviews({ dishId }).then(setItems).catch(() => setItems([])), [dishId])
  useEffect(() => { load() }, [load])
  async function send() {
    setBusy(true)
    try { await api.addComment(dishId, body); setBody(''); toast('¡Gracias por tu comentario!'); load() }
    catch (e) { toast(mensajeError(e), 'error') } finally { setBusy(false) }
  }
  const rated = (items ?? []).filter((r) => r.rating != null)
  const avg = rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : null
  return (
    <section className="mt-6" aria-labelledby="comentarios">
      <div className="flex items-end justify-between">
        <h2 id="comentarios" className="font-serif text-[24px] font-bold">Comentarios</h2>
        <span className="pb-1 text-xs text-gris">{avg != null ? <><span className="text-[#E9A23B]">★</span> {avg.toFixed(1)} · </> : ''}{items?.length ?? 0} {items?.length === 1 ? 'comentario' : 'comentarios'}</span>
      </div>
      {profile?.role === 'comensal' && (
        <div className="mt-3 rounded-[20px] border border-borde bg-white p-3">
          <textarea className="w-full resize-none bg-transparent text-[15px] outline-none" rows={2} maxLength={500} value={body}
            onChange={(e) => setBody(e.target.value)} placeholder="Pregunta algo o cuenta qué te pareció…" aria-label="Escribe un comentario" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gris">{body.length}/500 · público</span>
            <button onClick={send} disabled={busy || body.trim().length < 2} className="inline-flex items-center gap-1.5 rounded-full bg-guinda px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              <Send size={14} /> Comentar
            </button>
          </div>
        </div>
      )}
      {!items ? <p className="mt-3 text-sm text-gris">Cargando comentarios…</p> : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-[20px] border border-dashed border-borde py-6 text-center text-sm text-gris">
          <MessageCircle className="mb-1 text-guinda" /> Aún no hay comentarios. ¡Sé el primero!
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-borde">{items.map((r) => <ReviewItem key={r.id} r={r} onChanged={load} />)}</ul>
      )}
    </section>
  )
}
