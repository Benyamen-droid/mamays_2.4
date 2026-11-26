import type { Api } from './api'
import { LocalApi } from './localApi'
import { SupabaseApi } from './supabaseApi'

declare global {
  interface Window { MAMAYS_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string; mercadoPagoPublicKey?: string } }
}

function build(): Api {
  const cfg = window.MAMAYS_CONFIG ?? {}
  const url = (cfg.supabaseUrl ?? '').trim()
  const key = (cfg.supabaseAnonKey ?? '').trim()
  const mp = (cfg.mercadoPagoPublicKey ?? '').trim()
  if (url.startsWith('https://') && key.length > 20) return new SupabaseApi(url, key, mp)
  return new LocalApi()
}

export const api: Api = build()
export { mensajeError } from './api'
