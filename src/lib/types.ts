export type Role = 'comensal' | 'mamita'

export type DeliveryMode = 'delivery' | 'recojo' | 'ambos'
export type OrderMode = 'delivery' | 'recojo' | 'en_casa'
/** yape = Yape en línea (celular + código) · tarjeta = con 3-D Secure · yape_manual = constancia a la mamita */
export type PaymentMethod = 'yape' | 'tarjeta' | 'yape_manual' | 'efectivo'

export type OrderStatus =
  | 'reservado' // esperando constancia de Yape (15 min)
  | 'enviado' // llegó a la mamita, esperando su revisión
  | 'aceptado'
  | 'preparando'
  | 'listo' // listo para recojo
  | 'en_camino' // delivery en camino
  | 'entregado'
  | 'rechazado'
  | 'cancelado'
  | 'expirado'

export interface Profile {
  id: string
  role: Role
  full_name: string
  email: string
  phone: string
  zone: string
  address: string // privada
  // comensal
  allergies: string[]
  other_allergies: string
  preferences: string
  avoid_foods: string
  // mamita
  public_zone_label: string
  bio: string
  home_description: string
  show_home: boolean
  home_photos: string[]
  avatar_url: string
  yape_name: string
  yape_phone: string
  lat: number | null
  lng: number | null
  /** ubicación exacta de la cocina (privada; solo se comparte en pedidos aceptados) */
  home_lat: number | null
  home_lng: number | null
  onboarded: boolean
}

export interface MamitaPublic {
  id: string
  full_name: string
  zone: string
  public_zone_label: string
  bio: string
  home_description: string
  home_photos: string[]
  avatar_url: string
  yape_name: string
  yape_phone: string
  lat: number | null
  lng: number | null
  rating: number | null
  rating_count: number
  dish_count: number
}

export interface Extra { id: string; name: string; price: number }

export interface Dish {
  id: string
  mamita_id: string
  name: string
  description: string
  category: string
  price: number
  portions: number // porciones del día (inicial)
  ingredients: string
  allergens: string[]
  tags: string[]
  delivery_mode: DeliveryMode
  delivery_cost: number | null
  available_from: string // "11:30"
  available_to: string // "14:30"
  conservation: string
  photos: string[]
  paused: boolean
  extras: Extra[]
  /** la mamita recibe comensales en su hogar para este plato */
  dine_in: boolean
  created_at: string
}

export interface DishStock {
  sold: number
  reserved: number
  available: number
}

export type DishView = Dish & DishStock & {
  mamita_name: string
  mamita_zone: string
  mamita_rating: number | null
  rating: number | null
  review_count: number
}

export interface OrderItem {
  dish_id: string
  dish_name: string
  unit_price: number
  qty: number
  photo?: string
  extras: Extra[]
  extras_total: number
}

export interface StatusEvent {
  status: OrderStatus
  at: string
  reason?: string
}

export interface Order {
  id: string
  code: string
  comensal_id: string
  comensal_name: string
  mamita_id: string
  mamita_name: string
  status: OrderStatus
  mode: OrderMode
  payment_method: PaymentMethod
  subtotal: number
  delivery_cost: number
  total: number
  delivery_address: string
  pickup_address: string
  /** punto de entrega compartido por el comensal (delivery) */
  delivery_lat: number | null
  delivery_lng: number | null
  /** punto exacto de recojo / hogar (se revela al aceptar) */
  pickup_lat: number | null
  pickup_lng: number | null
  receiver_name: string
  receiver_phone: string
  payer_name: string
  notes: string
  voucher_url: string
  payment_id: string
  payment_detail: string
  paid_at: string | null
  reserved_until: string | null
  guests: number
  terms_accepted_at: string | null
  history: StatusEvent[]
  rating: number | null
  review: string
  items: OrderItem[]
  created_at: string
}

export interface AppNotification {
  id: string
  user_id: string
  title: string
  body: string
  order_id: string | null
  read: boolean
  created_at: string
}

export interface CartLine {
  dish_id: string
  qty: number
  extras?: string[]
}

export interface PlaceOrderInput {
  mamita_id: string
  items: CartLine[]
  mode: OrderMode
  payment_method: PaymentMethod
  delivery_address: string
  receiver_name: string
  receiver_phone: string
  payer_name: string
  notes: string
  guests?: number
  delivery_lat?: number | null
  delivery_lng?: number | null
  terms_accepted?: boolean
  terms_version?: string
}

export interface SignUpInput {
  role: Role
  email: string
  password: string
  profile: Partial<Profile>
}

/** Datos de una tarjeta SOLO para el modo demo (nunca se guardan). Con Mercado Pago se usan campos seguros. */
export interface DemoCard { number: string; name: string; exp: string; cvv: string }

export interface PayInput {
  /** token de Mercado Pago (Yape o tarjeta) */
  token?: string
  payment_method_id?: string
  issuer_id?: string
  installments?: number
  identification?: { type: string; number: string }
  /** solo modo demo */
  phone?: string
  otp?: string
  card?: DemoCard
}

export type PayResult =
  | { status: 'approved'; payment_id?: string }
  | { status: 'rejected'; message: string }
  | { status: 'pending'; message: string }
  | { status: 'challenge'; url?: string; creq?: string; demoCode?: string; maskedPhone?: string }

export interface Review {
  id: string
  kind: 'dish' | 'mamita' | 'comment'
  dish_id: string | null
  mamita_id: string
  order_id: string | null
  author_id: string
  author_name: string
  rating: number | null
  body: string
  verified: boolean
  reply: string
  replied_at: string | null
  created_at: string
}

export interface ReviewsInput {
  mamita: { rating: number; body: string }
  dishes: { dish_id: string; rating: number; body: string }[]
}
