import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth, useNotifications } from '../context/AppContext'
import { haceCuanto } from '../lib/format'
import { EmptyState, PageTitle, Screen } from '../components/ui'

export function NotificationsPage() {
  const { items, markRead, reload } = useNotifications()
  const { profile } = useAuth()
  const nav = useNavigate()
  useEffect(() => { reload().then(() => setTimeout(() => { markRead().catch(() => {}) }, 1200)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const open = (orderId: string | null) => {
    if (!orderId) return
    nav(profile?.role === 'mamita' ? `/mamita/pedidos?o=${orderId}` : `/comensal/pedidos/${orderId}`)
  }
  return (
    <Screen>
      <PageTitle eyebrow="Avisos" title="Tus notificaciones" />
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title="Todo tranquilo por aquí" text="Te avisaremos de cada novedad de tus pedidos." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n.order_id)} className={`w-full rounded-[18px] border p-4 text-left ${n.read ? 'border-borde bg-white' : 'border-guinda/30 bg-guinda-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold">{n.title}</span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-guinda" aria-label="Sin leer" />}
                </div>
                <p className="mt-0.5 text-sm text-gris">{n.body}</p>
                <div className="mt-1 text-[11px] text-gris">{haceCuanto(n.created_at)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
