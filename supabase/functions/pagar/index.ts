// =====================================================================
//  MAMAYS · Edge Function "pagar"  (Supabase → Edge Functions)
//  Cobra con Mercado Pago:  Yape (celular + código de aprobación)
//                           Tarjeta (crédito/débito con 3-D Secure)
//
//  Secreto requerido (Supabase → Edge Functions → Secrets):
//    MP_ACCESS_TOKEN = Access Token de Mercado Pago (TEST-... para pruebas, APP_USR-... en producción)
//  SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.
//
//  El monto SIEMPRE se toma del pedido guardado en la base de datos, nunca del celular.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const MP_API = 'https://api.mercadopago.com/v1/payments'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Mensajes claros para el comensal según la respuesta de Mercado Pago
const MOTIVOS: Record<string, string> = {
  cc_rejected_bad_filled_security_code: 'El código de aprobación o el CVV es incorrecto o ya venció. Genera uno nuevo e inténtalo otra vez.',
  cc_rejected_call_for_authorize: 'Tu banco o Yape pide que autorices este pago. Revisa tu app e inténtalo de nuevo.',
  cc_amount_rate_limit_exceeded: 'Superaste el límite diario de tu Yape. Prueba con otro medio de pago.',
  cc_rejected_insufficient_amount: 'Saldo insuficiente.',
  cc_rejected_max_attempts: 'Demasiados intentos. Espera unos minutos o usa otro medio de pago.',
  cc_rejected_card_type_not_allowed: 'Este medio de pago no está permitido para esta compra.',
  cc_unsupported_unsupported: 'Este medio de pago no está disponible.',
  cc_rejected_form_error: 'Hay un dato incorrecto. Revisa e inténtalo otra vez.',
  cc_rejected_bad_filled_card_number: 'El número de tarjeta es incorrecto.',
  cc_rejected_bad_filled_date: 'La fecha de vencimiento es incorrecta.',
  cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Prueba con otro medio de pago.',
  cc_rejected_3ds_challenge: 'No se pudo verificar tu identidad con tu banco.',
  cc_rejected_duplicated_payment: 'Ya hiciste un pago igual hace un momento.',
  cc_rejected_other_reason: 'Tu banco rechazó el pago.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')
    if (!MP_TOKEN) return json({ error: 'Falta configurar MP_ACCESS_TOKEN en los secretos de Supabase.' }, 500)

    // 1) ¿Quién llama? (token del usuario que inició sesión en la app)
    const auth = req.headers.get('Authorization') ?? ''
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'NO_AUTENTICADO' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body = await req.json()
    const { data: order } = await admin.from('orders').select('*').eq('id', body.order_id).maybeSingle()
    if (!order || order.comensal_id !== user.id) return json({ error: 'PEDIDO_NO_EXISTE' }, 404)

    const mpHeaders = { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json' }

    // 2a) Consultar el estado (después del 3-D Secure)
    if (body.action === 'status') {
      if (order.paid_at) return json({ status: 'approved' })
      if (!order.payment_id) return json({ status: 'rejected', message: 'No hay un pago en curso.' })
      const p = await (await fetch(`${MP_API}/${order.payment_id}`, { headers: mpHeaders })).json()
      return json(await resultado(admin, order.id, p))
    }

    // 2b) Cobrar
    if (order.status !== 'reservado') return json({ status: 'rejected', message: 'Este pedido ya no está esperando pago.' })
    if (order.reserved_until && new Date(order.reserved_until).getTime() < Date.now()) {
      return json({ status: 'rejected', message: 'Pasaron los 15 minutos de reserva. Vuelve a hacer tu pedido.' })
    }
    if (!['yape', 'tarjeta'].includes(order.payment_method)) return json({ error: 'ESTADO_INVALIDO' }, 400)
    if (typeof body.token !== 'string' || body.token.length < 8) return json({ error: 'Falta el token de pago.' }, 400)

    const esYape = order.payment_method === 'yape'
    const pago: Record<string, unknown> = {
      transaction_amount: Number(order.total),
      token: body.token,
      description: `MAMAYS ${order.code} · ${order.mamita_name}`,
      installments: esYape ? 1 : Math.max(1, Math.min(12, Number(body.installments) || 1)),
      payment_method_id: esYape ? 'yape' : String(body.payment_method_id ?? ''),
      external_reference: order.id,
      statement_descriptor: 'MAMAYS',
      payer: {
        email: user.email,
        ...(body.identification?.number ? { identification: { type: String(body.identification.type || 'DNI'), number: String(body.identification.number) } } : {}),
      },
      metadata: { order_id: order.id, order_code: order.code },
    }
    if (!esYape) {
      if (body.issuer_id) pago.issuer_id = body.issuer_id
      // 3-D Secure: el banco puede pedir una verificación extra (código por SMS o app)
      pago.three_d_secure_mode = 'optional'
      pago.capture = true
      pago.binary_mode = false
    }

    const r = await fetch(MP_API, {
      method: 'POST',
      headers: { ...mpHeaders, 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(pago),
    })
    const p = await r.json()
    if (!r.ok) {
      console.error('MP error', p)
      return json({ status: 'rejected', message: p?.message ? `Mercado Pago: ${p.message}` : 'No se pudo procesar el pago.' })
    }
    await admin.rpc('register_payment_attempt', { p_order: order.id, p_payment_id: String(p.id), p_detail: String(p.status_detail ?? '') })
    return json(await resultado(admin, order.id, p))
  } catch (e) {
    console.error(e)
    return json({ error: 'Error interno al procesar el pago.' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function resultado(admin: any, orderId: string, p: any) {
  if (p.status === 'approved') {
    const { error } = await admin.rpc('confirm_online_payment', { p_order: orderId, p_payment_id: String(p.id), p_detail: String(p.status_detail ?? '') })
    if (error) console.error('confirm_online_payment', error)
    return { status: 'approved', payment_id: String(p.id) }
  }
  if (p.status === 'pending' && p.status_detail === 'pending_challenge' && p.three_ds_info) {
    return { status: 'challenge', url: p.three_ds_info.external_resource_url, creq: p.three_ds_info.creq, payment_id: String(p.id) }
  }
  if (p.status === 'in_process' || p.status === 'pending') {
    return { status: 'pending', message: 'Tu pago está en revisión. Te avisaremos apenas se confirme.' }
  }
  return { status: 'rejected', message: MOTIVOS[p.status_detail] ?? 'El pago fue rechazado.' }
}
