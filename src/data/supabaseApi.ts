import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Api, ImageKind } from './api'
import type {
  AppNotification, Dish, DishView, MamitaPublic, Order, OrderStatus, PayInput, PayResult, PlaceOrderInput, Profile, Review, ReviewsInput, SignUpInput,
} from '../lib/types'
import { uid } from '../lib/format'

const num = (x: unknown) => (x == null ? 0 : Number(x))
const numOrNull = (x: unknown) => (x == null ? null : Number(x))

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const DISH_FIELDS: (keyof Dish)[] = [
  'name', 'description', 'category', 'price', 'portions', 'ingredients', 'allergens', 'tags', 'delivery_mode',
  'delivery_cost', 'available_from', 'available_to', 'conservation', 'photos', 'paused', 'extras', 'dine_in',
]
const PROFILE_EDITABLE: (keyof Profile)[] = [
  'full_name', 'phone', 'zone', 'address', 'allergies', 'other_allergies', 'preferences', 'avoid_foods',
  'public_zone_label', 'bio', 'home_description', 'show_home', 'home_photos', 'avatar_url', 'yape_name', 'yape_phone', 'lat', 'lng',
  'onboarded', 'home_lat', 'home_lng',
]

function mapDish(r: Record<string, unknown>): DishView {
  return {
    ...(r as unknown as DishView),
    price: num(r.price), portions: num(r.portions), delivery_cost: numOrNull(r.delivery_cost),
    sold: num(r.sold), reserved: num(r.reserved), available: num(r.available),
    mamita_rating: numOrNull(r.mamita_rating), rating: numOrNull(r.rating),
    allergens: (r.allergens as string[]) ?? [], tags: (r.tags as string[]) ?? [], photos: (r.photos as string[]) ?? [],
    extras: ((r.extras as DishView['extras']) ?? []).map((x) => ({ ...x, price: Number(x.price) })),
    dine_in: !!r.dine_in, review_count: num(r.review_count),
  }
}

function mapOrder(r: Record<string, unknown>): Order {
  const items = ((r.order_items as Record<string, unknown>[]) ?? []).map((i) => ({
    dish_id: String(i.dish_id ?? ''), dish_name: String(i.dish_name), unit_price: num(i.unit_price), qty: num(i.qty), photo: String(i.photo ?? ''),
    extras: ((i.extras as { id: string; name: string; price: number }[]) ?? []).map((x) => ({ ...x, price: Number(x.price) })),
    extras_total: num(i.extras_total),
  }))
  let status = r.status as OrderStatus
  if (status === 'reservado' && r.reserved_until && new Date(String(r.reserved_until)).getTime() < Date.now()) status = 'expirado'
  return {
    ...(r as unknown as Order), status, items,
    subtotal: num(r.subtotal), delivery_cost: num(r.delivery_cost), total: num(r.total), rating: numOrNull(r.rating),
    history: (r.history as Order['history']) ?? [], guests: num(r.guests) || 1,
    delivery_lat: numOrNull(r.delivery_lat), delivery_lng: numOrNull(r.delivery_lng), pickup_lat: numOrNull(r.pickup_lat), pickup_lng: numOrNull(r.pickup_lng),
  }
}

export class SupabaseApi implements Api {
  mode = 'supabase' as const
  onlinePayments: 'mercadopago' | 'none'
  mercadoPagoPublicKey: string
  private sb: SupabaseClient
  private uidCache: string | null = null

  constructor(url: string, key: string, mpPublicKey = '') {
    this.mercadoPagoPublicKey = mpPublicKey
    this.onlinePayments = mpPublicKey ? 'mercadopago' : 'none'
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  }

  private async myId(): Promise<string> {
    const { data } = await this.sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('NO_AUTENTICADO')
    this.uidCache = id
    return id
  }

  // ---------- Sesión ----------
  async currentProfile(): Promise<Profile | null> {
    const { data } = await this.sb.auth.getSession()
    if (!data.session) return null
    const r = await this.sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle()
    return (check(r) as Profile) ?? null
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message)
    const p = await this.currentProfile()
    if (!p) throw new Error('No encontramos tu perfil. Escríbenos para ayudarte.')
    return p
  }
  async signUp(input: SignUpInput) {
    const res = await this.sb.auth.signUp({
      email: input.email.trim(), password: input.password,
      options: { data: { ...input.profile, role: input.role }, emailRedirectTo: location.origin + location.pathname },
    })
    if (res.error) throw new Error(res.error.message)
    if (!res.data.session) return { profile: null, needsConfirmation: true }
    return { profile: await this.currentProfile(), needsConfirmation: false }
  }
  async signOut() { await this.sb.auth.signOut(); this.uidCache = null }
  async resetPassword(email: string) {
    check(await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname }))
  }
  async updateProfile(patch: Partial<Profile>) {
    const id = await this.myId()
    const clean: Record<string, unknown> = {}
    for (const k of PROFILE_EDITABLE) if (k in patch) clean[k] = patch[k]
    return check(await this.sb.from('profiles').update(clean).eq('id', id).select('*').single()) as Profile
  }

  // ---------- Catálogo ----------
  async listDishes() {
    const rows = check(await this.sb.from('dishes_view').select('*').eq('paused', false).order('created_at', { ascending: false }))
    return (rows ?? []).map(mapDish)
  }
  async getDish(id: string) {
    const r = check(await this.sb.from('dishes_view').select('*').eq('id', id).maybeSingle())
    return r ? mapDish(r) : null
  }
  async listMamitas() {
    const rows = check(await this.sb.from('mamitas_public').select('*'))
    return (rows ?? []).map((r) => ({ ...r, rating: numOrNull(r.rating) })) as MamitaPublic[]
  }
  async getMamita(id: string) {
    const r = check(await this.sb.from('mamitas_public').select('*').eq('id', id).maybeSingle())
    return r ? ({ ...r, rating: numOrNull(r.rating) } as MamitaPublic) : null
  }

  // ---------- Mamita ----------
  async listMyDishes() {
    const id = await this.myId()
    const rows = check(await this.sb.from('dishes_view').select('*').eq('mamita_id', id).order('created_at', { ascending: false }))
    return (rows ?? []).map(mapDish)
  }
  async saveDish(d: Partial<Dish>) {
    const id = await this.myId()
    const row: Record<string, unknown> = {}
    for (const k of DISH_FIELDS) if (k in d) row[k] = d[k]
    if (d.delivery_mode === 'recojo') row.delivery_cost = null
    row.updated_at = new Date().toISOString()
    const q = d.id
      ? this.sb.from('dishes').update(row).eq('id', d.id).eq('mamita_id', id).select('*').single()
      : this.sb.from('dishes').insert({ ...row, mamita_id: id }).select('*').single()
    return check(await q) as Dish
  }
  async deleteDish(id: string) { check(await this.sb.from('dishes').delete().eq('id', id)) }
  async uploadImage(kind: ImageKind, blob: Blob) {
    const id = await this.myId()
    const bucket = kind === 'voucher' ? 'vouchers' : 'public-images'
    const path = `${id}/${kind}-${uid()}.jpg`
    check(await this.sb.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
    if (bucket === 'vouchers') return path
    return this.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }
  async resolveImage(kind: ImageKind, ref: string) {
    if (kind !== 'voucher' || !ref || ref.startsWith('http') || ref.startsWith('data:')) return ref
    const r = check(await this.sb.storage.from('vouchers').createSignedUrl(ref, 3600))
    return r?.signedUrl ?? ''
  }

  // ---------- Pedidos ----------
  async placeOrder(input: PlaceOrderInput) {
    return check(await this.sb.rpc('place_order', { p: input })) as string
  }
  async submitVoucher(orderId: string, ref: string) {
    check(await this.sb.rpc('submit_voucher', { p_order: orderId, p_voucher: ref }))
  }
  async listMyOrders() {
    await this.sb.rpc('expire_reservations')
    const rows = check(await this.sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100))
    return (rows ?? []).map(mapOrder)
  }
  async getOrder(id: string) {
    const r = check(await this.sb.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle())
    return r ? mapOrder(r) : null
  }
  async setOrderStatus(id: string, status: OrderStatus, reason = '') {
    check(await this.sb.rpc('set_order_status', { p_order: id, p_status: status, p_reason: reason }))
  }
  async submitReviews(id: string, input: ReviewsInput) {
    check(await this.sb.rpc('submit_reviews', { p_order: id, p: input }))
  }
  async listReviews(f: { dishId?: string; mamitaId?: string }) {
    let q = this.sb.from('reviews').select('*').order('created_at', { ascending: false }).limit(100)
    if (f.dishId) q = q.eq('dish_id', f.dishId)
    if (f.mamitaId) q = q.eq('mamita_id', f.mamitaId)
    return ((check(await q) ?? []) as Review[])
  }
  async addComment(dishId: string, body: string) {
    check(await this.sb.rpc('add_comment', { p_dish: dishId, p_body: body }))
  }
  async deleteComment(id: string) {
    check(await this.sb.from('reviews').delete().eq('id', id))
  }
  async replyReview(id: string, reply: string) {
    check(await this.sb.rpc('reply_review', { p_review: id, p_reply: reply }))
  }


  // ---------- Pagos en línea: la Edge Function "pagar" habla con Mercado Pago ----------
  private async callPagar(body: Record<string, unknown>): Promise<PayResult> {
    const { data, error } = await this.sb.functions.invoke('pagar', { body })
    if (error) {
      let msg = error.message
      try { const j = await (error as unknown as { context: Response }).context.json(); msg = j.error || j.message || msg } catch { /* sin cuerpo */ }
      throw new Error(msg)
    }
    if (data?.error) throw new Error(data.error)
    return data as PayResult
  }
  async payOnline(orderId: string, input: PayInput) {
    return this.callPagar({ action: 'pay', order_id: orderId, token: input.token, payment_method_id: input.payment_method_id,
      issuer_id: input.issuer_id, installments: input.installments ?? 1, identification: input.identification })
  }
  async confirmChallenge(orderId: string) {
    return this.callPagar({ action: 'status', order_id: orderId })
  }

  // ---------- Avisos y favoritos ----------
  async listNotifications() {
    return (check(await this.sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)) ?? []) as AppNotification[]
  }
  async markNotificationsRead() {
    const id = this.uidCache ?? (await this.myId())
    check(await this.sb.from('notifications').update({ read: true }).eq('user_id', id).eq('read', false))
  }
  async listFavorites() {
    return ((check(await this.sb.from('favorites').select('dish_id')) ?? []) as { dish_id: string }[]).map((r) => r.dish_id)
  }
  async toggleFavorite(dishId: string) {
    const id = await this.myId()
    const exists = check(await this.sb.from('favorites').select('dish_id').eq('dish_id', dishId).maybeSingle())
    if (exists) { check(await this.sb.from('favorites').delete().eq('user_id', id).eq('dish_id', dishId)); return false }
    check(await this.sb.from('favorites').insert({ user_id: id, dish_id: dishId }))
    return true
  }
}
