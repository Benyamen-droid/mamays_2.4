/**
 * MODO DEMO: misma lógica que supabase/schema.sql, pero guardada en el dispositivo (localStorage).
 * Sirve para probar la app sin configurar nada. Las reglas (stock, reserva de 15 min,
 * estados permitidos, precios calculados aquí y no en la pantalla) son las mismas.
 */
import type { Api, ImageKind } from './api'
import type {
  AppNotification, Dish, DishView, Extra, MamitaPublic, Order, OrderStatus, PayInput, PayResult, PlaceOrderInput, Profile, Review,
  ReviewsInput, SignUpInput,
} from '../lib/types'
import { blobToDataUrl, codigoPedido, expValida, luhn, sleep, uid } from '../lib/format'
import { MOTIVOS_PAGO, RESERVA_MINUTOS, ZONA_COORDS } from '../lib/constants'
import { kitchenArt } from './demoArt'
import { PHOTOS, photoUrl, type RealPhoto } from './realPhotos'

interface UserRow { profile: Profile; password: string }
interface DB {
  v: number
  users: UserRow[]
  dishes: Dish[]
  orders: Order[]
  notifications: AppNotification[]
  favorites: Record<string, string[]>
  reviews: Review[]
  session: string | null
}

const KEY = 'mamays-demo-v5'
const limaDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

function blankProfile(p: Partial<Profile>): Profile {
  return {
    id: uid(), role: 'comensal', full_name: '', email: '', phone: '', zone: 'Puno Centro', address: '',
    allergies: [], other_allergies: '', preferences: '', avoid_foods: '', public_zone_label: '', bio: '',
    home_description: '', show_home: false, home_photos: [], avatar_url: '', yape_name: '', yape_phone: '',
    lat: null, lng: null, home_lat: null, home_lng: null, onboarded: false, ...p,
  }
}

function seed(): DB {
  const now = new Date()
  const iso = (msAgo = 0) => new Date(now.getTime() - msAgo).toISOString()
  const mk = (p: Partial<Profile>, email: string): UserRow => ({
    profile: blankProfile({ ...p, email, role: p.role ?? 'mamita', onboarded: true }),
    password: 'demo123',
  })
  const jitter = (z: string, k: number): [number, number] => {
    const [la, ln] = ZONA_COORDS[z] ?? ZONA_COORDS['Puno Centro']
    return [la + (k % 3) * 0.0012, ln - (k % 2) * 0.0015]
  }
  const mamitas = [
    mk({ full_name: 'Juana Mamani', zone: 'Bellavista', public_zone_label: 'A dos cuadras del mercado Bellavista',
      bio: 'Cocino platos típicos caseros con ingredientes frescos y mucho cariño para la comunidad puneña.',
      home_description: 'Cocina familiar limpia y ordenada. Preparo cada porción al momento, separando bien los alimentos.',
      show_home: true, home_photos: [kitchenArt(1)], yape_name: 'Juana Mamani', yape_phone: '955 000 111',
      address: 'Jr. Ejemplo 101', phone: '955000111' }, 'juana@demo.pe'),
    mk({ full_name: 'Teodora Quispe', zone: 'Puno Centro', public_zone_label: 'Cerca al Parque Pino',
      bio: 'Me gusta cocinar comidas tradicionales de Puno: trucha, chairo y pesque.',
      home_description: 'Siempre manteniendo el orden y la limpieza.', show_home: true, home_photos: [kitchenArt(2)],
      yape_name: 'Teodora Quispe', yape_phone: '955 000 222', address: 'Av. Ejemplo 202', phone: '955000222' }, 'teodora@demo.pe'),
    mk({ full_name: 'Marta Condori', zone: 'Alto Puno', public_zone_label: 'Frente al colegio de Alto Puno',
      bio: 'Guisos de casa para recoger calientitos al mediodía.', yape_name: 'Marta Condori', yape_phone: '955 000 333',
      address: 'Jr. Ejemplo 303', phone: '955000333' }, 'marta@demo.pe'),
    mk({ full_name: 'Elena Apaza', zone: 'Salcedo', public_zone_label: 'Salcedo, por la UNA',
      bio: 'Comida saludable y postres de la abuela.', yape_name: 'Elena Apaza', yape_phone: '955 000 444',
      address: 'Pje. Ejemplo 404', phone: '955000444' }, 'elena@demo.pe'),
  ]
  mamitas.forEach((m, i) => {
    const [la, ln] = jitter(m.profile.zone, i); m.profile.lat = la; m.profile.lng = ln
    // ubicación exacta (privada) de la cocina: cerca de su zona, distinta del punto público
    m.profile.home_lat = Number((la + 0.0011 * (i % 2 ? 1 : -1)).toFixed(6)); m.profile.home_lng = Number((ln - 0.0008).toFixed(6))
  })
  const [juana, teo, marta, elena] = mamitas.map((m) => m.profile.id)

  const comensal = mk({ role: 'comensal', full_name: 'Comensal Demo', zone: 'Puno Centro', address: 'Av. El Sol 450',
    phone: '987654321', allergies: ['Maní'] }, 'comensal@demo.pe')

  let n = 0
  const d = (mamita_id: string, name: string, price: number, portions: number, photo: RealPhoto, extra: Partial<Dish>): Dish => ({
    id: uid(), mamita_id, name, description: '', category: 'Tradicional', price, portions, ingredients: '',
    allergens: [], tags: [], delivery_mode: 'ambos', delivery_cost: 3, available_from: '11:30', available_to: '15:00',
    conservation: 'Consumir fresco', photos: [photoUrl(photo)], paused: false, extras: [], dine_in: false, created_at: iso(++n * 60000), ...extra,
  })
  const dishes: Dish[] = [
    d(juana, 'Arroz chaufa con cecina', 12, 4, PHOTOS.chaufa, { description: 'Chaufa al wok con cecina, huevo y plátano frito, como en casa.',
      ingredients: 'arroz, cecina, huevo, plátano, cebolla china, sillao, kion, ajo', allergens: ['Soya', 'Huevo'], tags: ['Se puede recalentar'], delivery_cost: 2.5,
      available_from: '12:00', available_to: '18:30',
      extras: [{ id: 'gel', name: 'Gelatina de fresa', price: 2 }, { id: 'chi', name: 'Chicha morada (vaso)', price: 2.5 }, { id: 'ens', name: 'Ensalada de pepino', price: 1.5 }] }),
    d(juana, 'Cau cau', 13, 3, PHOTOS.caucau, { description: 'Guiso criollo de mondongo y papa con palillo y hierbabuena.',
      ingredients: 'mondongo, papa amarilla, ají amarillo, palillo, hierbabuena, cebolla, ajo, arroz', allergens: [], tags: ['Se puede recalentar'],
      extras: [{ id: 'arr', name: 'Porción extra de arroz', price: 1.5 }, { id: 'maz', name: 'Mazamorra morada', price: 3 }] }),
    d(juana, 'Caldo de gallina', 12, 6, PHOTOS.caldo, { category: 'Sopas', description: 'Caldo bien concentrado con fideo, papa y huevo. Levanta muertos.',
      ingredients: 'gallina, fideos, papa, huevo, kion, cebolla china', allergens: ['Gluten', 'Huevo'], tags: ['Se puede recalentar'] }),
    d(teo, 'Pejerrey frito del Titicaca', 15, 1, PHOTOS.pejerrey, { description: 'Pejerrey del lago, crocante por fuera y jugoso por dentro, con papas y ensalada.',
      ingredients: 'pejerrey, harina, papa, arroz, limón, ensalada', allergens: ['Pescado', 'Gluten'], tags: ['Consumir fresco'], delivery_mode: 'delivery', delivery_cost: 3, available_from: '12:00', available_to: '15:30' }),
    d(teo, 'Chairo puneño', 13, 6, PHOTOS.chairo, { category: 'Sopas', description: 'Sopa contundente del altiplano con chuño, chalona y habas.',
      ingredients: 'carne de res, chalona, chuño, habas, trigo, papa, zapallo, hierbabuena', allergens: ['Gluten'], tags: ['Se puede recalentar'],
      dine_in: true, extras: [{ id: 'pan', name: 'Pan de Chuquibambilla', price: 1 }, { id: 'mat', name: 'Mate de muña', price: 1.5 }] }),
    d(teo, 'Kispiñas', 5, 10, PHOTOS.kispinas, { category: 'Saludable', description: 'Panecillos aymaras de harina de quinua cocidos al vapor. Ideales para el lonche.',
      ingredients: 'harina de quinua, cal, sal, agua', allergens: [], tags: ['Vegano', 'Saludable'], delivery_cost: 2,
      available_from: '12:00', available_to: '18:30', dine_in: true }),
    d(marta, 'Olluquito con pollo', 15, 5, PHOTOS.olluquitoPollo, { description: 'Guiso tradicional con olluco en tiritas y pollo, con su arroz blanco.',
      ingredients: 'olluco, pollo, ají panca, ajo, cebolla, arroz, perejil', allergens: [], tags: ['Se puede recalentar'], delivery_mode: 'recojo', delivery_cost: null, available_from: '12:00', available_to: '14:30' }),
    d(marta, 'Olluquito con cerdo', 15, 0, PHOTOS.olluquitoCerdo, { description: 'La versión serrana: olluco con cerdo y arroz graneadito.',
      ingredients: 'olluco, carne de cerdo, ají panca, ajo, cebolla, arroz', allergens: [], tags: ['Se puede recalentar'], delivery_mode: 'recojo', delivery_cost: null }),
    d(elena, 'Chairo de la casa', 12, 4, PHOTOS.chairo2, { category: 'Sopas', description: 'Chairo con chuño negro, charqui y mote. Receta de la abuela.',
      ingredients: 'charqui, chuño, mote, habas, papa, zanahoria, hierbabuena, maní tostado', allergens: ['Maní'], tags: ['Se puede recalentar', 'Consumir fresco'], delivery_cost: 2,
      dine_in: true }),
    d(elena, 'Jugo de quinua', 4, 12, PHOTOS.jugoQuinua, { category: 'Saludable', description: 'Bebida tibia de quinua con manzana y canela.',
      ingredients: 'quinua, manzana, canela, clavo, azúcar, leche', allergens: ['Lactosa'], tags: ['Vegetariano', 'Saludable'], delivery_cost: 2 }),
  ]

  // Un pedido de ayer ya entregado y valorado, para que haya historial y valoraciones
  const ayer = iso(26 * 3600 * 1000)
  const chaufa = dishes[0]
  const orders: Order[] = [{
    id: uid(), code: 'MAM-4069714', comensal_id: comensal.profile.id, comensal_name: comensal.profile.full_name,
    mamita_id: juana, mamita_name: 'Juana Mamani', status: 'entregado', mode: 'recojo', payment_method: 'yape',
    subtotal: 12, delivery_cost: 0, total: 12, delivery_address: '', pickup_address: 'Jr. Ejemplo 101',
    delivery_lat: null, delivery_lng: null, pickup_lat: null, pickup_lng: null, receiver_name: comensal.profile.full_name,
    receiver_phone: comensal.profile.phone, payer_name: comensal.profile.full_name, notes: '', voucher_url: '',
    payment_id: 'DEMO-YAPE-4069714', payment_detail: 'accredited', paid_at: ayer,
    reserved_until: null, history: ['enviado', 'aceptado', 'preparando', 'listo', 'entregado'].map((s, i) => ({ status: s as OrderStatus, at: new Date(new Date(ayer).getTime() + i * 600000).toISOString() })),
    rating: 5, review: '¡Sabor de casa de verdad!', items: [{ dish_id: chaufa.id, dish_name: chaufa.name, unit_price: 12, qty: 1, photo: chaufa.photos[0], extras: [], extras_total: 0 }],
    guests: 1, terms_accepted_at: null, created_at: ayer,
  }]
  const cp = comensal.profile
  const rv = (kind: Review['kind'], dish: Dish | null, mamita_id: string, rating: number | null, body: string, author = cp, extra: Partial<Review> = {}): Review => ({
    id: uid(), kind, dish_id: dish?.id ?? null, mamita_id, order_id: kind === 'comment' ? null : orders[0].id, author_id: author.id,
    author_name: author.full_name, rating, body, verified: kind !== 'comment', reply: '', replied_at: null, created_at: ayer, ...extra,
  })
  const vecina = blankProfile({ full_name: 'Rocío Ticona' }), profe = blankProfile({ full_name: 'Prof. Hugo Q.' })
  const reviews: Review[] = [
    rv('mamita', null, juana, 5, '¡Sabor de casa de verdad! Muy puntual y amable.'),
    rv('dish', chaufa, juana, 5, 'El chaufa con cecina estuvo buenazo, porción generosa.', cp, { reply: '¡Gracias, hijito! Te espero la próxima semana 😊', replied_at: ayer }),
    rv('comment', dishes[4], teo, null, '¿El chairo lleva chalona de cordero o de alpaca?', vecina, { reply: 'De alpaca, como en Puno 🙂', replied_at: ayer }),
    rv('comment', dishes[3], teo, null, 'El pejerrey llega crocante aun en delivery, recomendado.', profe, { verified: true }),
    rv('comment', dishes[0], juana, null, 'La gelatina de fresa de extra es lo máximo.', vecina),
  ]

  return { v: 4, users: [...mamitas, comensal], dishes, orders, notifications: [], favorites: {}, reviews, session: null }
}

export class LocalApi implements Api {
  mode = 'demo' as const
  onlinePayments = 'demo' as const
  mercadoPagoPublicKey = ''
  private db: DB
  private challenges = new Map<string, { code: string; tries: number }>()

  constructor() {
    let db: DB | null = null
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null') } catch { db = null }
    this.db = db && db.v === 4 ? db : seed()
    try { localStorage.setItem(KEY, JSON.stringify(this.db)) } catch { /* sin almacenamiento: funciona en memoria */ }
  }

  private save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.db)) }
    catch (e) {
      if (e instanceof DOMException && /quota/i.test(e.name + e.message)) {
        throw new Error('El almacenamiento del teléfono está lleno. Usa fotos más livianas o borra pedidos antiguos.')
      }
    }
  }
  private delay<T>(v: T, ms = 120): Promise<T> { return new Promise((r) => setTimeout(() => r(structuredClone(v)), ms)) }
  private me(): Profile {
    const u = this.db.users.find((x) => x.profile.id === this.db.session)
    if (!u) throw new Error('NO_AUTENTICADO')
    return u.profile
  }
  private notify(user_id: string, title: string, body: string, order_id: string | null) {
    this.db.notifications.unshift({ id: uid(), user_id, title, body, order_id, read: false, created_at: new Date().toISOString() })
  }
  private expire() {
    const now = Date.now()
    for (const o of this.db.orders) {
      if (o.status === 'reservado' && o.reserved_until && new Date(o.reserved_until).getTime() < now) {
        o.status = 'expirado'
        o.history.push({ status: 'expirado', at: new Date().toISOString() })
      }
    }
  }
  private counts(dishId: string) {
    const today = limaDate(new Date())
    let sold = 0, reserved = 0
    for (const o of this.db.orders) {
      if (['rechazado', 'cancelado', 'expirado'].includes(o.status)) continue
      if (o.status === 'reservado' && o.reserved_until && new Date(o.reserved_until).getTime() < Date.now()) continue
      if (limaDate(o.created_at) !== today) continue
      for (const it of o.items) if (it.dish_id === dishId) o.status === 'reservado' ? (reserved += it.qty) : (sold += it.qty)
    }
    return { sold, reserved }
  }
  private avg(xs: number[]) { return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null }
  private view(d: Dish): DishView {
    const { sold, reserved } = this.counts(d.id)
    const m = this.db.users.find((u) => u.profile.id === d.mamita_id)!.profile
    const mr = this.db.reviews.filter((r) => r.kind === 'mamita' && r.mamita_id === d.mamita_id).map((r) => r.rating!)
    const dr = this.db.reviews.filter((r) => r.kind === 'dish' && r.dish_id === d.id).map((r) => r.rating!)
    return { ...d, extras: d.extras ?? [], dine_in: !!d.dine_in, sold, reserved, available: Math.max(d.portions - sold - reserved, 0), mamita_name: m.full_name,
      mamita_zone: m.zone, mamita_rating: this.avg(mr), rating: this.avg(dr),
      review_count: this.db.reviews.filter((r) => r.dish_id === d.id).length }
  }
  private pub(p: Profile): MamitaPublic {
    const r = this.db.reviews.filter((x) => x.kind === 'mamita' && x.mamita_id === p.id).map((x) => x.rating!)
    return {
      id: p.id, full_name: p.full_name, zone: p.zone, public_zone_label: p.public_zone_label, bio: p.bio,
      home_description: p.show_home ? p.home_description : '', home_photos: p.show_home ? p.home_photos : [],
      avatar_url: p.avatar_url, yape_name: p.yape_name, yape_phone: p.yape_phone, lat: p.lat, lng: p.lng,
      rating: this.avg(r), rating_count: r.length,
      dish_count: this.db.dishes.filter((d) => d.mamita_id === p.id && !d.paused).length,
    }
  }

  // ---------- Sesión ----------
  async currentProfile() { const u = this.db.users.find((x) => x.profile.id === this.db.session); return this.delay(u ? u.profile : null, 0) }
  async signIn(email: string, password: string) {
    const u = this.db.users.find((x) => x.profile.email.toLowerCase() === email.trim().toLowerCase())
    if (!u || u.password !== password) throw new Error('Invalid login credentials')
    this.db.session = u.profile.id; this.save()
    return this.delay(u.profile)
  }
  async signUp(input: SignUpInput) {
    const email = input.email.trim().toLowerCase()
    if (this.db.users.some((x) => x.profile.email === email)) throw new Error('User already registered')
    if (input.password.length < 6) throw new Error('Password should be at least 6 characters')
    const profile = blankProfile({ ...input.profile, role: input.role, email })
    const [la, ln] = ZONA_COORDS[profile.zone] ?? ZONA_COORDS['Puno Centro']
    if (input.role === 'mamita') { profile.lat = la; profile.lng = ln }
    this.db.users.push({ profile, password: input.password })
    this.db.session = profile.id; this.save()
    return this.delay({ profile, needsConfirmation: false })
  }
  async signOut() { this.db.session = null; this.save() }
  async resetPassword(email: string) {
    if (!this.db.users.some((x) => x.profile.email === email.trim().toLowerCase())) return this.delay(undefined, 300)
    return this.delay(undefined, 300) // en modo demo no se envían correos
  }
  async updateProfile(patch: Partial<Profile>) {
    const me = this.me()
    const { id: _i, role: _r, email: _e, ...rest } = patch
    void _i; void _r; void _e
    Object.assign(me, rest)
    if (me.role === 'mamita' && patch.zone && (me.lat == null || patch.zone)) {
      const [la, ln] = ZONA_COORDS[me.zone] ?? ZONA_COORDS['Puno Centro']; me.lat = la; me.lng = ln
    }
    this.save(); return this.delay(me)
  }

  // ---------- Catálogo ----------
  async listDishes() { this.expire(); return this.delay(this.db.dishes.filter((d) => !d.paused).map((d) => this.view(d))) }
  async getDish(id: string) { this.expire(); const d = this.db.dishes.find((x) => x.id === id); return this.delay(d ? this.view(d) : null) }
  async listMamitas() { return this.delay(this.db.users.filter((u) => u.profile.role === 'mamita').map((u) => this.pub(u.profile))) }
  async getMamita(id: string) { const u = this.db.users.find((x) => x.profile.id === id && x.profile.role === 'mamita'); return this.delay(u ? this.pub(u.profile) : null) }

  // ---------- Mamita ----------
  async listMyDishes() { const me = this.me(); this.expire(); return this.delay(this.db.dishes.filter((d) => d.mamita_id === me.id).map((d) => this.view(d))) }
  async saveDish(input: Partial<Dish>) {
    const me = this.me()
    if (me.role !== 'mamita') throw new Error('Solo las mamitas pueden publicar platos.')
    if (!input.ingredients || input.ingredients.trim().length < 3) throw new Error('Los ingredientes son obligatorios.')
    if (input.delivery_mode !== 'recojo' && (input.delivery_cost == null || input.delivery_cost < 0)) throw new Error('Indica un costo de delivery válido.')
    if (input.extras && (input.extras.length > 10 || input.extras.some((x) => x.name.trim().length < 2 || !(x.price >= 0 && x.price <= 50)))) {
      throw new Error('Revisa los extras: nombre de al menos 2 letras y precio entre S/ 0 y S/ 50.')
    }
    let d: Dish | undefined = input.id ? this.db.dishes.find((x) => x.id === input.id) : undefined
    if (d && d.mamita_id !== me.id) throw new Error('No puedes editar platos de otra mamita.')
    if (!d) {
      d = { id: uid(), mamita_id: me.id, name: '', description: '', category: 'Tradicional', price: 0, portions: 0, ingredients: '',
        allergens: [], tags: [], delivery_mode: 'ambos', delivery_cost: null, available_from: '11:30', available_to: '15:00',
        conservation: '', photos: [], paused: false, extras: [], dine_in: false, created_at: new Date().toISOString() }
      this.db.dishes.unshift(d)
    }
    const dish: Dish = d
    Object.assign(dish, input, { mamita_id: me.id, delivery_cost: input.delivery_mode === 'recojo' ? null : input.delivery_cost ?? dish.delivery_cost })
    this.save(); return this.delay(dish)
  }
  async deleteDish(id: string) {
    const me = this.me()
    this.db.dishes = this.db.dishes.filter((d) => !(d.id === id && d.mamita_id === me.id))
    this.save()
  }
  async uploadImage(_k: ImageKind, blob: Blob) { void _k; return blobToDataUrl(blob) }
  async resolveImage(_k: ImageKind, ref: string) { void _k; return ref }

  // ---------- Pedidos ----------
  async placeOrder(input: PlaceOrderInput) {
    const me = this.me()
    if (me.role !== 'comensal') throw new Error('SOLO_COMENSALES')
    this.expire()
    const mamita = this.db.users.find((u) => u.profile.id === input.mamita_id && u.profile.role === 'mamita')?.profile
    if (!mamita) throw new Error('MAMITA_NO_EXISTE')
    if (!input.items.length) throw new Error('CARRITO_VACIO')
    if (!['delivery', 'recojo', 'en_casa'].includes(input.mode)) throw new Error('MODALIDAD_INVALIDA')
    if (input.mode === 'delivery' && input.delivery_address.trim().length < 5) throw new Error('FALTA_DIRECCION')
    const guests = input.mode === 'en_casa' ? Math.round(input.guests ?? 1) : 1
    if (input.mode === 'en_casa') {
      if (!input.terms_accepted) throw new Error('TERMINOS_REQUERIDOS')
      if (guests < 1 || guests > 6) throw new Error('COMENSALES_INVALIDOS')
    }
    let subtotal = 0, delivery = 0
    const items = input.items.map((l) => {
      const d = this.db.dishes.find((x) => x.id === l.dish_id)
      if (!d) throw new Error('PLATO_NO_EXISTE')
      if (d.mamita_id !== mamita.id) throw new Error('PLATOS_DE_OTRA_MAMITA')
      if (d.paused) throw new Error(`PLATO_PAUSADO:${d.name}`)
      if (input.mode === 'delivery' && d.delivery_mode === 'recojo') throw new Error(`SOLO_RECOJO:${d.name}`)
      if (input.mode === 'recojo' && d.delivery_mode === 'delivery') throw new Error(`SOLO_DELIVERY:${d.name}`)
      if (input.mode === 'en_casa' && !d.dine_in) throw new Error(`SIN_COMER_EN_CASA:${d.name}`)
      const extras: Extra[] = []
      for (const id of new Set(l.extras ?? [])) {
        const x = (d.extras ?? []).find((e) => e.id === id)
        if (!x) throw new Error(`EXTRA_INVALIDO:${d.name}`)
        extras.push({ ...x })
      }
      const extrasTotal = extras.reduce((a, x) => a + x.price, 0)
      const { sold, reserved } = this.counts(d.id)
      if (l.qty < 1 || l.qty > 20) throw new Error('CANTIDAD_INVALIDA')
      if (l.qty > d.portions - sold - reserved) throw new Error(`SIN_STOCK:${d.name}`)
      subtotal += (d.price + extrasTotal) * l.qty
      if (input.mode === 'delivery') delivery = Math.max(delivery, d.delivery_cost ?? 0)
      return { dish_id: d.id, dish_name: d.name, unit_price: d.price, qty: l.qty, photo: d.photos[0] ?? '', extras, extras_total: extrasTotal }
    })
    const now = new Date()
    if (!['yape', 'tarjeta', 'yape_manual', 'efectivo'].includes(input.payment_method)) throw new Error('PAGO_INVALIDO')
    const dl = input.delivery_lat ?? null, dg = input.delivery_lng ?? null
    if ((dl == null) !== (dg == null) || (dl != null && !(dl >= -18.6 && dl <= 0.1 && dg! >= -81.5 && dg! <= -68.5))) throw new Error('UBICACION_INVALIDA')
    const status: OrderStatus = input.payment_method === 'efectivo' ? 'enviado' : 'reservado'
    const o: Order = {
      id: uid(), code: codigoPedido(), comensal_id: me.id, comensal_name: me.full_name, mamita_id: mamita.id,
      mamita_name: mamita.full_name, status, mode: input.mode, payment_method: input.payment_method, subtotal,
      delivery_cost: delivery, total: subtotal + delivery, delivery_address: input.mode === 'delivery' ? input.delivery_address.trim() : '', pickup_address: '',
      delivery_lat: input.mode === 'delivery' ? input.delivery_lat ?? null : null, delivery_lng: input.mode === 'delivery' ? input.delivery_lng ?? null : null,
      pickup_lat: null, pickup_lng: null,
      receiver_name: input.receiver_name.trim() || me.full_name, receiver_phone: input.receiver_phone.trim() || me.phone,
      payer_name: input.payer_name.trim() || me.full_name, notes: input.notes.slice(0, 300), voucher_url: '',
      payment_id: '', payment_detail: '', paid_at: null,
      reserved_until: status === 'reservado' ? new Date(now.getTime() + RESERVA_MINUTOS * 60000).toISOString() : null,
      history: [{ status, at: now.toISOString() }], rating: null, review: '', items, created_at: now.toISOString(),
      guests, terms_accepted_at: input.mode === 'en_casa' ? now.toISOString() : null,
    }
    this.db.orders.unshift(o)
    if (status === 'enviado') this.notify(mamita.id, '¡Nuevo pedido!', `${me.full_name} pidió (${o.code}), pago en efectivo.`, o.id)
    this.save(); return this.delay(o.id)
  }
  async submitVoucher(orderId: string, ref: string) {
    const me = this.me()
    const o = this.db.orders.find((x) => x.id === orderId && x.comensal_id === me.id)
    if (!o) throw new Error('PEDIDO_NO_EXISTE')
    this.expire()
    if (o.status === 'expirado') { this.save(); throw new Error('RESERVA_VENCIDA') }
    if (o.status !== 'reservado' || o.payment_method !== 'yape_manual') throw new Error('ESTADO_INVALIDO')
    if (!ref) throw new Error('FALTA_CONSTANCIA')
    o.voucher_url = ref; o.status = 'enviado'; o.reserved_until = null
    o.history.push({ status: 'enviado', at: new Date().toISOString() })
    this.notify(o.mamita_id, '¡Nuevo pedido!', `${o.comensal_name} pagó con Yape S/ ${o.total.toFixed(2)} (${o.code}). Revisa la constancia.`, o.id)
    this.save()
  }
  async listMyOrders() {
    const me = this.me(); this.expire(); this.save()
    return this.delay(this.db.orders.filter((o) => (me.role === 'mamita' ? o.mamita_id : o.comensal_id) === me.id))
  }
  async getOrder(id: string) {
    const me = this.me(); this.expire()
    const o = this.db.orders.find((x) => x.id === id && (x.comensal_id === me.id || x.mamita_id === me.id))
    return this.delay(o ?? null)
  }
  async setOrderStatus(id: string, status: OrderStatus, reason = '') {
    const me = this.me()
    const o = this.db.orders.find((x) => x.id === id)
    if (!o) throw new Error('PEDIDO_NO_EXISTE')
    let ok = false
    if (o.mamita_id === me.id) {
      ok = (o.status === 'enviado' && ['aceptado', 'rechazado'].includes(status))
        || (o.status === 'aceptado' && ['preparando', 'rechazado'].includes(status))
        || (o.status === 'preparando' && status === (o.mode === 'delivery' ? 'en_camino' : 'listo'))
        || (['listo', 'en_camino'].includes(o.status) && status === 'entregado')
    } else if (o.comensal_id === me.id) {
      ok = ['reservado', 'enviado'].includes(o.status) && status === 'cancelado'
    }
    if (!ok) throw new Error('TRANSICION_NO_PERMITIDA')
    const prev = o.status
    o.status = status
    if (status === 'aceptado' && (o.mode === 'recojo' || o.mode === 'en_casa')) {
      const mp = this.db.users.find((u) => u.profile.id === o.mamita_id)?.profile
      o.pickup_address = mp?.address ?? ''
      o.pickup_lat = mp?.home_lat ?? mp?.lat ?? null; o.pickup_lng = mp?.home_lng ?? mp?.lng ?? null
    }
    o.history.push({ status, at: new Date().toISOString() })
    const msg: Partial<Record<OrderStatus, string>> = {
      aceptado: '¡La mamita aceptó tu pedido! Ya verificó tu pago.',
      preparando: 'Tu almuerzo se está preparando con mucho cariño.',
      listo: o.mode === 'en_casa' ? '¡Tu mesa está lista! La mamita te espera.' : 'Tu pedido está listo para recojo.',
      en_camino: 'Tu pedido va en camino.',
      entregado: '¡Buen provecho! Cuéntanos qué tal estuvo.',
      rechazado: `La mamita no pudo aceptar tu pedido. ${reason}`.trim(),
    }
    if (status === 'cancelado') {
      if (prev === 'enviado') this.notify(o.mamita_id, 'Pedido cancelado', `${o.comensal_name} canceló el pedido ${o.code}.`, o.id)
    } else if (msg[status]) {
      const t = status.replace('_', ' ')
      this.notify(o.comensal_id, `${o.code} · ${t.charAt(0).toUpperCase()}${t.slice(1)}`, msg[status]!, o.id)
    }
    this.save()
  }
  async submitReviews(id: string, input: ReviewsInput) {
    const me = this.me()
    const o = this.db.orders.find((x) => x.id === id && x.comensal_id === me.id)
    if (!o) throw new Error('PEDIDO_NO_EXISTE')
    if (o.status !== 'entregado') throw new Error('AUN_NO_ENTREGADO')
    if (o.rating) throw new Error('YA_VALORADO')
    const ok = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5
    if (!ok(input.mamita.rating) || input.dishes.some((d) => !ok(d.rating))) throw new Error('VALORACION_INVALIDA')
    if (input.dishes.some((d) => !o.items.some((i) => i.dish_id === d.dish_id))) throw new Error('PLATO_NO_ESTA_EN_EL_PEDIDO')
    const now = new Date().toISOString()
    const base = { mamita_id: o.mamita_id, order_id: o.id, author_id: me.id, author_name: me.full_name, verified: true, reply: '', replied_at: null, created_at: now }
    this.db.reviews.unshift({ ...base, id: uid(), kind: 'mamita', dish_id: null, rating: input.mamita.rating, body: input.mamita.body.slice(0, 500) },
      ...input.dishes.map((d) => ({ ...base, id: uid(), kind: 'dish' as const, dish_id: d.dish_id, rating: d.rating, body: d.body.slice(0, 500) })))
    o.rating = input.mamita.rating; o.review = input.mamita.body.slice(0, 400)
    this.notify(o.mamita_id, `Nueva calificación ★${o.rating}`, `${o.comensal_name} calificó su pedido ${o.code}.`, o.id)
    this.save()
  }
  async listReviews(f: { dishId?: string; mamitaId?: string }) {
    const r = this.db.reviews.filter((x) => (f.dishId ? x.dish_id === f.dishId : true) && (f.mamitaId ? x.mamita_id === f.mamitaId : true))
    return this.delay([...r].sort((a, b) => b.created_at.localeCompare(a.created_at)), 60)
  }
  async addComment(dishId: string, body: string) {
    const me = this.me()
    if (me.role !== 'comensal') throw new Error('SOLO_COMENSALES')
    const d = this.db.dishes.find((x) => x.id === dishId)
    if (!d) throw new Error('PLATO_NO_EXISTE')
    if (body.trim().length < 2) throw new Error('COMENTARIO_VACIO')
    const hoy = this.db.reviews.filter((r) => r.author_id === me.id && r.kind === 'comment' && Date.now() - new Date(r.created_at).getTime() < 86400000)
    if (hoy.length >= 10) throw new Error('DEMASIADOS_COMENTARIOS')
    const verified = this.db.orders.some((o) => o.comensal_id === me.id && o.status === 'entregado' && o.items.some((i) => i.dish_id === dishId))
    this.db.reviews.unshift({ id: uid(), kind: 'comment', dish_id: dishId, mamita_id: d.mamita_id, order_id: null, author_id: me.id,
      author_name: me.full_name, rating: null, body: body.trim().slice(0, 500), verified, reply: '', replied_at: null, created_at: new Date().toISOString() })
    this.notify(d.mamita_id, `Nuevo comentario en ${d.name}`, `${me.full_name}: ${body.trim().slice(0, 80)}`, null)
    this.save()
  }
  async deleteComment(id: string) {
    const me = this.me()
    this.db.reviews = this.db.reviews.filter((r) => !(r.id === id && r.author_id === me.id && r.kind === 'comment'))
    this.save()
  }
  async replyReview(id: string, reply: string) {
    const me = this.me()
    const r = this.db.reviews.find((x) => x.id === id && x.mamita_id === me.id)
    if (!r) throw new Error('RESENA_NO_EXISTE')
    r.reply = reply.trim().slice(0, 500); r.replied_at = new Date().toISOString()
    if (r.reply) this.notify(r.author_id, 'La mamita respondió tu comentario', r.reply.slice(0, 120), r.order_id)
    this.save()
  }

  // ---------- Pagos en línea (SIMULADOS en modo demo: no se cobra nada) ----------
  private markPaid(o: Order, paymentId: string) {
    const now = new Date().toISOString()
    o.status = 'enviado'; o.paid_at = now; o.reserved_until = null
    o.payment_id = paymentId; o.payment_detail = 'accredited'
    o.history.push({ status: 'enviado', at: now })
    this.notify(o.mamita_id, '¡Nuevo pedido pagado!',
      `${o.comensal_name} pagó S/ ${o.total.toFixed(2)} con ${o.payment_method === 'yape' ? 'Yape' : 'tarjeta'} (${o.code}).`, o.id)
    this.save()
  }
  private payableOrder(orderId: string): Order | PayResult {
    const me = this.me()
    this.expire()
    const o = this.db.orders.find((x) => x.id === orderId && x.comensal_id === me.id)
    if (!o) throw new Error('PEDIDO_NO_EXISTE')
    if (o.status === 'expirado') return { status: 'rejected', message: 'Pasaron los 15 minutos de reserva. Vuelve a hacer tu pedido.' }
    if (o.status !== 'reservado') return { status: 'rejected', message: 'Este pedido ya no está esperando pago.' }
    return o
  }
  async payOnline(orderId: string, input: PayInput): Promise<PayResult> {
    const o = this.payableOrder(orderId)
    if ('status' in o && !('code' in o)) return o as PayResult
    const order = o as Order
    await sleep(1100)
    if (order.payment_method === 'yape') {
      const phone = (input.phone ?? '').replace(/\D/g, '')
      const otp = input.otp ?? ''
      if (!/^\d{9}$/.test(phone)) return { status: 'rejected', message: 'Ingresa tu celular Yape de 9 dígitos.' }
      if (!/^\d{6}$/.test(otp)) return { status: 'rejected', message: 'El código de aprobación tiene 6 dígitos.' }
      // Mismos números de prueba que publica Mercado Pago para Yape
      const PRUEBA: Record<string, string> = {
        '111111112': 'cc_rejected_call_for_authorize', '111111113': 'cc_amount_rate_limit_exceeded',
        '111111114': 'cc_unsupported_unsupported', '111111115': 'cc_rejected_card_type_not_allowed',
        '111111116': 'cc_rejected_max_attempts', '111111117': 'cc_rejected_bad_filled_security_code', '111111118': 'cc_rejected_form_error',
      }
      if (PRUEBA[phone]) return { status: 'rejected', message: MOTIVOS_PAGO[PRUEBA[phone]] }
      if (otp === '000000') return { status: 'rejected', message: MOTIVOS_PAGO.cc_rejected_bad_filled_security_code }
      this.markPaid(order, `DEMO-YAPE-${Date.now().toString().slice(-8)}`)
      return { status: 'approved' }
    }
    if (order.payment_method === 'tarjeta') {
      const c = input.card
      if (!c || !luhn(c.number)) return { status: 'rejected', message: 'El número de tarjeta no es válido.' }
      if (!expValida(c.exp)) return { status: 'rejected', message: 'La tarjeta está vencida o la fecha es incorrecta.' }
      if (!/^\d{3,4}$/.test(c.cvv)) return { status: 'rejected', message: 'El CVV debe tener 3 o 4 dígitos.' }
      const titular = c.name.trim().toUpperCase()
      if (titular.length < 2) return { status: 'rejected', message: 'Escribe el nombre como figura en la tarjeta.' }
      if (titular === 'OTHE') return { status: 'rejected', message: MOTIVOS_PAGO.cc_rejected_other_reason }
      if (titular === 'FUND') return { status: 'rejected', message: MOTIVOS_PAGO.cc_rejected_insufficient_amount }
      if (titular === 'SECU') return { status: 'rejected', message: MOTIVOS_PAGO.cc_rejected_bad_filled_security_code }
      // 3-D Secure: el "banco" envía un código de verificación
      const code = String(Math.floor(100000 + Math.random() * 900000))
      this.challenges.set(order.id, { code, tries: 0 })
      order.reserved_until = new Date(Math.max(Date.now() + 10 * 60000, new Date(order.reserved_until ?? 0).getTime())).toISOString()
      this.save()
      const me = this.me()
      return { status: 'challenge', demoCode: code, maskedPhone: `*** *** ${me.phone.slice(-3) || '000'}` }
    }
    throw new Error('PAGO_INVALIDO')
  }
  async confirmChallenge(orderId: string, code?: string): Promise<PayResult> {
    const o = this.payableOrder(orderId)
    if ('status' in o && !('code' in o)) return o as PayResult
    const ch = this.challenges.get(orderId)
    if (!ch) return { status: 'rejected', message: 'La verificación expiró. Intenta pagar de nuevo.' }
    await sleep(700)
    if ((code ?? '').trim() !== ch.code) {
      ch.tries++
      if (ch.tries >= 3) { this.challenges.delete(orderId); return { status: 'rejected', message: MOTIVOS_PAGO.cc_rejected_3ds_challenge } }
      throw new Error(`CODIGO_INCORRECTO:${3 - ch.tries}`)
    }
    this.challenges.delete(orderId)
    this.markPaid(o as Order, `DEMO-CARD-${Date.now().toString().slice(-8)}`)
    return { status: 'approved' }
  }

  // ---------- Avisos y favoritos ----------
  async listNotifications() { const me = this.me(); return this.delay(this.db.notifications.filter((n) => n.user_id === me.id).slice(0, 50), 0) }
  async markNotificationsRead() { const me = this.me(); this.db.notifications.forEach((n) => { if (n.user_id === me.id) n.read = true }); this.save() }
  async listFavorites() { const me = this.me(); return this.delay(this.db.favorites[me.id] ?? [], 0) }
  async toggleFavorite(dishId: string) {
    const me = this.me()
    const set = new Set(this.db.favorites[me.id] ?? [])
    const on = !set.has(dishId)
    on ? set.add(dishId) : set.delete(dishId)
    this.db.favorites[me.id] = [...set]; this.save()
    return on
  }
}
