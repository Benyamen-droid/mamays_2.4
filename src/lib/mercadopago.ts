/**
 * MercadoPago.js v2 (SDK oficial). Se carga solo cuando hace falta pagar.
 * Los datos de la tarjeta viajan en campos seguros (iframes de Mercado Pago):
 * nunca pasan por MAMAYS. Para Yape se envían celular + código de aprobación y se recibe un token.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { MercadoPago?: any } }

let loader: Promise<any> | null = null

export function getMercadoPago(publicKey: string): Promise<any> {
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const done = () => {
        try { resolve(new window.MercadoPago(publicKey, { locale: 'es-PE' })) } catch (e) { reject(e) }
      }
      if (window.MercadoPago) return done()
      const s = document.createElement('script')
      s.src = 'https://sdk.mercadopago.com/js/v2'
      s.async = true
      s.onload = done
      s.onerror = () => { loader = null; reject(new Error('No se pudo cargar Mercado Pago. Revisa tu conexión.')) }
      document.head.appendChild(s)
    })
  }
  return loader
}

/** Token de Yape a partir del celular y el código de aprobación (6 dígitos) */
export async function crearTokenYape(publicKey: string, phoneNumber: string, otp: string): Promise<string> {
  const mp = await getMercadoPago(publicKey)
  const yape = mp.yape({ otp, phoneNumber })
  const t = await yape.create()
  if (!t?.id) throw new Error('No se pudo validar el código de Yape. Genera uno nuevo.')
  return t.id
}

export const MP_FIELD_STYLE = {
  height: '100%',
  fontSize: '16px',
  color: '#2E2326',
  fontFamily: 'Inter, system-ui, sans-serif',
  placeholderColor: '#a8999c',
}
