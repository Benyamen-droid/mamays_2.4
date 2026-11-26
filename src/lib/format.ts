export const soles = (n: number) => `S/ ${n.toFixed(2)}`

export function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })
}

export function fechaHora(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}, ${hora(iso)}`
}

export function haceCuanto(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

export function primerNombre(full: string) {
  return (full || '').trim().split(/\s+/)[0] || ''
}

/** "11:30" → minutos del día */
export function toMin(hhmm: string) {
  const [h, m] = (hhmm || '0:0').split(':').map(Number)
  return h * 60 + (m || 0)
}

export function horarioTexto(from: string, to: string) {
  if (!from || !to) return ''
  const f = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const suf = h >= 12 ? 'p. m.' : 'a. m.'
    const hh = h % 12 === 0 ? 12 : h % 12
    return `${hh}:${String(m).padStart(2, '0')} ${suf}`
  }
  return `${f(from)} – ${f(to)}`
}

/** Versión corta para tarjetas: "11:30am–3:00pm" */
export function horarioCorto(from: string, to: string) {
  if (!from || !to) return ''
  const f = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
  }
  return `${f(from)}–${f(to)}`
}

/** Estado del horario respecto a la hora actual de Lima */
export function estadoHorario(from: string, to: string, now = new Date()) {
  if (!from || !to) return { abierto: true, texto: '' }
  const lima = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }))
  const m = lima.getHours() * 60 + lima.getMinutes()
  const a = toMin(from)
  const b = toMin(to)
  if (m < a) return { abierto: false, texto: `Desde las ${horarioTexto(from, to).split(' – ')[0]}` }
  if (m > b) return { abierto: false, texto: 'Horario de hoy terminado' }
  return { abierto: true, texto: `Hasta las ${horarioTexto(from, to).split(' – ')[1]}` }
}

export function codigoPedido() {
  return `MAM-${String(Math.floor(1000000 + Math.random() * 8999999))}`
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Reduce una imagen a JPEG liviano (para fotos y constancias) */
export async function comprimirImagen(file: File, maxLado = 1000, calidad = 0.72): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const k = Math.min(1, maxLado / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k)
    c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', calidad))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(b)
  })
}

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())
export const celularValido = (c: string) => /^9\d{8}$/.test(c.replace(/\D/g, ''))

/** Validación Luhn del número de tarjeta */
export function luhn(num: string) {
  const d = num.replace(/\D/g, '')
  if (d.length < 13 || d.length > 19) return false
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i])
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9 }
    sum += n
  }
  return sum % 10 === 0
}

export function cardBrand(num: string): 'visa' | 'mastercard' | 'amex' | 'diners' | '' {
  const d = num.replace(/\D/g, '')
  if (/^4/.test(d)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard'
  if (/^3[47]/.test(d)) return 'amex'
  if (/^3(0[0-5]|[68])/.test(d)) return 'diners'
  return ''
}

/** "MM/AA" vigente */
export function expValida(exp: string, now = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(exp.trim())
  if (!m) return false
  const mes = Number(m[1]), anio = 2000 + Number(m[2])
  if (mes < 1 || mes > 12) return false
  return new Date(anio, mes, 0, 23, 59) >= now
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
