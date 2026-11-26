/*
 * CONFIGURACIÓN DE MAMAYS
 * ------------------------------------------------------------------
 * Pega aquí los datos de tu proyecto de Supabase
 * (supabase.com → tu proyecto → Project Settings → API).
 *
 * Si los dejas vacíos, la app funciona en MODO DEMO: todo se guarda
 * solo en el teléfono/navegador y trae mamitas y platos de ejemplo.
 *
 * La "anon key" es pública por diseño (la protegen las políticas RLS
 * de supabase/schema.sql). NUNCA pongas aquí la "service_role key".
 */
window.MAMAYS_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',

  // PAGOS EN LÍNEA (Yape con código de aprobación y tarjeta con 3-D Secure)
  // Mercado Pago → Tus integraciones → tu aplicación → Credenciales → "Public Key"
  // (TEST-... para pruebas, APP_USR-... para cobrar de verdad).
  // El "Access Token" NO va aquí: va como secreto MP_ACCESS_TOKEN en Supabase.
  // Si lo dejas vacío (y hay Supabase), se ofrece "Yape a la mamita con constancia" y efectivo.
  mercadoPagoPublicKey: '',
}
