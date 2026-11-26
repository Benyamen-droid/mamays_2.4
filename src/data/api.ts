import type {
  AppNotification, Dish, DishView, MamitaPublic, Order, OrderStatus, PayInput, PayResult, PlaceOrderInput, Profile, Review, ReviewsInput, SignUpInput,
} from '../lib/types'

export type ImageKind = 'dish' | 'avatar' | 'home' | 'voucher'

/** Contrato único: la app no sabe si habla con Supabase o con el modo demo. */
export interface Api {
  mode: 'demo' | 'supabase'
  /** Pagos en línea: demo (simulados), mercadopago (reales) o none (solo constancia/efectivo) */
  onlinePayments: 'demo' | 'mercadopago' | 'none'
  mercadoPagoPublicKey: string

  // Sesión
  currentProfile(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<Profile>
  signUp(input: SignUpInput): Promise<{ profile: Profile | null; needsConfirmation: boolean }>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  updateProfile(patch: Partial<Profile>): Promise<Profile>

  // Catálogo público
  listDishes(): Promise<DishView[]>
  getDish(id: string): Promise<DishView | null>
  listMamitas(): Promise<MamitaPublic[]>
  getMamita(id: string): Promise<MamitaPublic | null>

  // Mamita
  listMyDishes(): Promise<DishView[]>
  saveDish(d: Partial<Dish>): Promise<Dish>
  deleteDish(id: string): Promise<void>
  uploadImage(kind: ImageKind, blob: Blob): Promise<string>
  resolveImage(kind: ImageKind, ref: string): Promise<string>

  // Pedidos
  placeOrder(input: PlaceOrderInput): Promise<string>
  submitVoucher(orderId: string, voucherRef: string): Promise<void>
  listMyOrders(): Promise<Order[]>
  getOrder(id: string): Promise<Order | null>
  setOrderStatus(id: string, status: OrderStatus, reason?: string): Promise<void>
  /** Calificación tras la entrega: mamita + cada plato (compra verificada) */
  submitReviews(orderId: string, input: ReviewsInput): Promise<void>

  // Comentarios y reseñas
  listReviews(filter: { dishId?: string; mamitaId?: string }): Promise<Review[]>
  addComment(dishId: string, body: string): Promise<void>
  deleteComment(id: string): Promise<void>
  replyReview(id: string, reply: string): Promise<void>

  // Pagos en línea (Yape con código de aprobación / tarjeta con 3-D Secure)
  payOnline(orderId: string, input: PayInput): Promise<PayResult>
  /** Tras la verificación 3-D Secure: en demo valida el código; con Mercado Pago consulta el estado */
  confirmChallenge(orderId: string, code?: string): Promise<PayResult>

  // Avisos y favoritos
  listNotifications(): Promise<AppNotification[]>
  markNotificationsRead(): Promise<void>
  listFavorites(): Promise<string[]>
  toggleFavorite(dishId: string): Promise<boolean>
}

/** Traduce los códigos de error del servidor a mensajes para el usuario */
export function mensajeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '')
  const [code, extra] = raw.split(':').map((x) => x.trim())
  const map: Record<string, string> = {
    SIN_STOCK: `Ya no quedan porciones suficientes de ${extra ?? 'ese plato'}.`,
    PLATO_PAUSADO: `${extra ?? 'El plato'} está pausado por la mamita.`,
    SOLO_RECOJO: `${extra ?? 'Este plato'} solo está disponible para recojo.`,
    SOLO_DELIVERY: `${extra ?? 'Este plato'} solo está disponible por delivery.`,
    PLATOS_DE_OTRA_MAMITA: 'Tu carrito solo puede tener platos de una misma mamita.',
    FALTA_DIRECCION: 'Indica la dirección de entrega para el delivery.',
    CARRITO_VACIO: 'Tu carrito está vacío.',
    RESERVA_VENCIDA: 'Pasaron los 15 minutos de reserva. Vuelve a hacer tu pedido.',
    FALTA_CONSTANCIA: 'Adjunta la captura de tu pago.',
    TRANSICION_NO_PERMITIDA: 'Ese cambio de estado ya no es posible.',
    YA_VALORADO: 'Ya valoraste este pedido.',
    SOLO_COMENSALES: 'Solo las cuentas de comensal pueden hacer pedidos.',
    NO_AUTENTICADO: 'Tu sesión terminó. Vuelve a ingresar.',
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'User already registered': 'Ya existe una cuenta con ese correo.',
    'Email not confirmed': 'Confirma tu correo antes de ingresar (revisa tu bandeja de entrada).',
    'Failed to fetch': 'Sin conexión. Revisa tu internet e inténtalo otra vez.',
    PAGO_INVALIDO: 'Ese medio de pago no está disponible.',
    TERMINOS_REQUERIDOS: 'Para comer en el hogar de la mamita debes aceptar los términos de seguridad y convivencia.',
    SIN_COMER_EN_CASA: `${extra ?? 'Este plato'} no está disponible para comer en el hogar de la mamita.`,
    COMENSALES_INVALIDOS: 'Pueden ir de 1 a 6 personas.',
    EXTRA_INVALIDO: `Uno de los extras de ${extra ?? 'tu plato'} ya no está disponible.`,
    COMENTARIO_VACIO: 'Escribe tu comentario.',
    DEMASIADOS_COMENTARIOS: 'Ya comentaste mucho hoy. Inténtalo mañana.',
    PLATO_NO_ESTA_EN_EL_PEDIDO: 'Ese plato no estaba en tu pedido.',
    AUN_NO_ENTREGADO: 'Podrás calificar cuando recibas tu pedido.',
    UBICACION_DENEGADA: 'No diste permiso de ubicación. Actívalo en Ajustes → Apps → MAMAYS → Permisos → Ubicación.',
    UBICACION_NO_DISPONIBLE: 'No pudimos obtener tu ubicación. Activa el GPS e inténtalo de nuevo.',
    UBICACION_INVALIDA: 'La ubicación no es válida. Vuelve a marcarla.',
    CODIGO_INCORRECTO: `Código incorrecto.${extra ? ` Te quedan ${extra} intentos.` : ''}`,
  }
  for (const k of Object.keys(map)) if (raw.includes(k) || code === k) return map[k]
  if (/Password should be at least/i.test(raw)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/rate limit/i.test(raw)) return 'Demasiados intentos. Espera un minuto.'
  return raw || 'Ocurrió un error inesperado.'
}
