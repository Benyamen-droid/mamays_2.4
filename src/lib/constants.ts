import type { OrderStatus, OrderMode } from './types'

export const ZONAS = [
  'Puno Centro',
  'Bellavista',
  'Alto Puno',
  'Jayllihuaya',
  'Salcedo',
  'Chanu Chanu',
  'Huaje',
  'Barrio Mañazo',
  'Ciudad Universitaria (UNAP)',
  'Juliaca',
] as const

/** Coordenadas aproximadas para centrar el mapa por zona */
export const ZONA_COORDS: Record<string, [number, number]> = {
  'Puno Centro': [-15.8402, -70.0219],
  Bellavista: [-15.8322, -70.0265],
  'Alto Puno': [-15.8195, -70.0281],
  Jayllihuaya: [-15.8738, -69.9993],
  Salcedo: [-15.8645, -70.0102],
  'Chanu Chanu': [-15.8233, -70.0368],
  Huaje: [-15.8174, -70.0138],
  'Barrio Mañazo': [-15.8366, -70.0302],
  'Ciudad Universitaria (UNAP)': [-15.8253, -70.0158],
  Juliaca: [-15.4997, -70.1336],
}
export const PUNO_CENTER: [number, number] = [-15.8402, -70.0219]

export const ALERGENOS = [
  'Gluten',
  'Lactosa',
  'Maní',
  'Frutos secos',
  'Huevo',
  'Mariscos',
  'Pescado',
  'Soya',
] as const

export const CATEGORIAS = ['Tradicional', 'Vegetariano', 'Vegano', 'Saludable', 'Sopas', 'Postres'] as const

export const ETIQUETAS = [
  'Vegetariano',
  'Vegano',
  'Saludable',
  'Bajo en sal',
  'Se puede recalentar',
  'Consumir fresco',
] as const

export const STATUS_LABEL: Record<OrderStatus, string> = {
  reservado: 'Esperando pago',
  enviado: 'Esperando revisión de la mamita',
  aceptado: 'Pedido aceptado',
  preparando: 'En preparación',
  listo: 'Listo para recojo',
  en_camino: 'En camino',
  entregado: 'Pedido entregado',
  rechazado: 'Rechazado por la mamita',
  cancelado: 'Cancelado',
  expirado: 'Reserva vencida',
}

export const STATUS_BADGE: Record<OrderStatus, string> = {
  reservado: 'PAGO PENDIENTE',
  enviado: 'NUEVO',
  aceptado: 'ACEPTADO',
  preparando: 'EN PREPARACIÓN',
  listo: 'LISTO',
  en_camino: 'EN CAMINO',
  entregado: 'ENTREGADO',
  rechazado: 'RECHAZADO',
  cancelado: 'CANCELADO',
  expirado: 'VENCIDO',
}

export const ACTIVE_STATUSES: OrderStatus[] = ['reservado', 'enviado', 'aceptado', 'preparando', 'listo', 'en_camino']
export const CLOSED_STATUSES: OrderStatus[] = ['entregado', 'rechazado', 'cancelado', 'expirado']

/** Recorrido visible en el timeline del comensal, según la modalidad */
export function timelineSteps(mode: OrderMode): OrderStatus[] {
  return ['enviado', 'aceptado', 'preparando', mode === 'delivery' ? 'en_camino' : 'listo', 'entregado']
}

/** Texto del estado según la modalidad (comer en el hogar usa sus propias palabras) */
export function statusLabel(s: OrderStatus, mode: OrderMode) {
  if (mode === 'en_casa' && s === 'listo') return 'Tu mesa está lista'
  if (mode === 'en_casa' && s === 'entregado') return 'Atendido en el hogar'
  return STATUS_LABEL[s]
}

export const MODE_LABEL: Record<OrderMode, string> = {
  delivery: 'Delivery',
  recojo: 'Recojo',
  en_casa: 'Comer en el hogar',
}

/** Horarios rápidos para que la mamita publique (incluye ofrecer toda la tarde) */
export const HORARIOS: { id: string; label: string; from: string; to: string }[] = [
  { id: 'almuerzo', label: 'Almuerzo', from: '11:30', to: '15:00' },
  { id: 'tarde', label: 'Toda la tarde', from: '12:00', to: '18:30' },
  { id: 'lonche', label: 'Lonche', from: '16:00', to: '19:00' },
  { id: 'cena', label: 'Cena', from: '18:30', to: '21:30' },
  { id: 'dia', label: 'Todo el día', from: '08:00', to: '21:00' },
]
export function horarioPreset(from: string, to: string) {
  return HORARIOS.find((h) => h.from === from && h.to === to) ?? null
}

/** Términos de seguridad y convivencia para comer en el hogar de la mamita (versión) */
export const TERMINOS_VERSION = 'v1-2026-11'
export const TERMINOS_HOGAR: { t: string; d: string }[] = [
  { t: 'Puntualidad', d: 'Llega dentro del horario acordado. Si te retrasas más de 15 minutos, la mamita puede no atenderte.' },
  { t: 'Solo las personas indicadas', d: 'Asiste únicamente con el número de comensales que registraste en el pedido.' },
  { t: 'Respeto al hogar y la familia', d: 'Trato amable con la mamita y su familia. No ingreses a otras áreas de la casa sin permiso.' },
  { t: 'Sin alcohol ni sustancias', d: 'No se permite llevar ni consumir bebidas alcohólicas ni otras sustancias, ni fumar.' },
  { t: 'Alergias e higiene', d: 'Avisa tus alergias antes de comer. Es una cocina doméstica: puede haber contacto cruzado.' },
  { t: 'Derecho de admisión', d: 'La mamita puede no recibirte si no se cumplen estas normas, por su seguridad y la de su familia.' },
  { t: 'Seguridad personal', d: 'Comparte con alguien de confianza a dónde vas. La dirección exacta se muestra solo cuando la mamita acepta tu pedido.' },
  { t: 'Daños y pertenencias', d: 'Eres responsable de los daños que causes. MAMAYS conecta a comensales y mamitas, y no responde por objetos personales.' },
]


/** Siguiente estado que puede marcar la mamita */
export function nextStatus(status: OrderStatus, mode: OrderMode): OrderStatus | null {
  switch (status) {
    case 'enviado':
      return 'aceptado'
    case 'aceptado':
      return 'preparando'
    case 'preparando':
      return mode === 'delivery' ? 'en_camino' : 'listo'
    case 'listo':
    case 'en_camino':
      return 'entregado'
    default:
      return null
  }
}

export function nextActionLabel(s: OrderStatus, mode: OrderMode) {
  if (s === 'listo' && mode === 'en_casa') return 'Mesa lista para recibir'
  if (s === 'entregado' && mode === 'en_casa') return 'Comensal atendido'
  return NEXT_ACTION_LABEL[s] ?? 'Actualizar'
}

export const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  aceptado: 'Aceptar pedido',
  preparando: 'Empezar a preparar',
  listo: 'Marcar listo para recojo',
  en_camino: 'Salió para delivery',
  entregado: 'Pedido entregado',
}

export const RESERVA_MINUTOS = 15

/** Motivos de rechazo de Mercado Pago, en palabras simples (los mismos que usa la Edge Function) */
export const MOTIVOS_PAGO: Record<string, string> = {
  cc_rejected_bad_filled_security_code: 'El código de aprobación o el CVV es incorrecto o ya venció. Genera uno nuevo e inténtalo otra vez.',
  cc_rejected_call_for_authorize: 'Tu banco o Yape pide que autorices este pago. Revisa tu app e inténtalo de nuevo.',
  cc_amount_rate_limit_exceeded: 'Superaste el límite diario de tu Yape. Prueba con otro medio de pago.',
  cc_rejected_insufficient_amount: 'Saldo insuficiente.',
  cc_rejected_max_attempts: 'Demasiados intentos. Espera unos minutos o usa otro medio de pago.',
  cc_rejected_card_type_not_allowed: 'Este medio de pago no está permitido para esta compra.',
  cc_unsupported_unsupported: 'Este medio de pago no está disponible.',
  cc_rejected_form_error: 'Hay un dato incorrecto. Revisa e inténtalo otra vez.',
  cc_rejected_3ds_challenge: 'No se pudo verificar tu identidad con tu banco.',
  cc_rejected_other_reason: 'Tu banco rechazó el pago.',
}

export const PAYMENT_LABEL: Record<string, string> = {
  yape: 'Yape en línea',
  tarjeta: 'Tarjeta de crédito/débito',
  yape_manual: 'Yape a la mamita (constancia)',
  efectivo: 'Efectivo al recibir',
}
