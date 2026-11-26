/**
 * Fotos REALES de platos andinos/peruanos para el modo demo.
 * Fuente: Wikimedia Commons (licencias libres CC BY / CC BY-SA). Autor y licencia en cada enlace.
 * Se cargan desde internet; si no hay conexión, la app muestra una ilustración de respaldo.
 * En la versión con Supabase, las fotos las sube cada mamita desde su celular.
 */
export interface RealPhoto { file: string; title: string }

export const PHOTOS = {
  chairo: { file: 'Chairo.jpg', title: 'Chairo' },
  chairo2: { file: 'Chairo paceno.jpg', title: 'Chairo' },
  pejerrey: { file: 'Pejerrey frito.jpg', title: 'Pejerrey frito' },
  olluquitoPollo: { file: 'Olluquito con pollo y arroz blanco B 11082011.jpg', title: 'Olluquito con pollo' },
  olluquitoCerdo: { file: 'Olluquito con cerdo y arroz blanco 21042010.JPG', title: 'Olluquito con cerdo' },
  chaufa: { file: 'Chaufa salvaje Selva 17042010.JPG', title: 'Arroz chaufa' },
  caucau: { file: 'Caucau.jpg', title: 'Cau cau' },
  caldo: { file: 'Caldo Gallina.jpg', title: 'Caldo de gallina' },
  kispinas: { file: 'Kispiñas.jpg', title: 'Kispiñas' },
  jugoQuinua: { file: 'Jugo de Quinua.jpg', title: 'Jugo de quinua' },
} satisfies Record<string, RealPhoto>

/** URL directa (miniatura de 800 px) vía Special:FilePath, el enlace estable que recomienda Commons */
export const photoUrl = (p: RealPhoto, width = 800) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.file.replace(/ /g, '_'))}?width=${width}`

export const photoPage = (p: RealPhoto) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file.replace(/ /g, '_'))}`

export const CREDITS = Object.values(PHOTOS)
