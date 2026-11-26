/** Ilustraciones SVG livianas para los platos de ejemplo del modo demo (sin fotos externas). */
const PALETAS: Record<string, [string, string, string]> = {
  arroz: ['#F4E3B5', '#E8A33D', '#6DA34D'],
  queso: ['#F6D98B', '#E9B949', '#F2EFE6'],
  aji: ['#F2C14E', '#E5A11B', '#FFFFFF'],
  trucha: ['#D9A066', '#B5651D', '#7FB069'],
  sopa: ['#E9C46A', '#C0392B', '#81B29A'],
  quinua: ['#F1E3C6', '#7FB069', '#E63946'],
  verde: ['#A7C957', '#6A994E', '#F2E8CF'],
  carne: ['#9C4A2B', '#E9C46A', '#F4E3B5'],
  morado: ['#5B2A86', '#9D4EDD', '#F4E3B5'],
}

export function dishArt(tipo: keyof typeof PALETAS | string, seed = 1): string {
  const [a, b, c] = PALETAS[tipo] ?? PALETAS.arroz
  const r = (n: number) => ((Math.sin(seed * 97 + n * 13) + 1) / 2)
  const bits = Array.from({ length: 14 }, (_, i) => {
    const ang = r(i) * Math.PI * 2
    const rad = 40 + r(i + 30) * 85
    const x = 200 + Math.cos(ang) * rad
    const y = 150 + Math.sin(ang) * rad * 0.62
    const col = i % 3 === 0 ? c : i % 2 ? b : a
    return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(10 + r(i + 7) * 16).toFixed(0)}" ry="${(7 + r(i + 9) * 10).toFixed(0)}" fill="${col}" opacity="0.95"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs><radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#3a2a2e"/><stop offset="1" stop-color="#1c1416"/></radialGradient>
<radialGradient id="pl" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e1da"/></radialGradient></defs>
<rect width="400" height="300" fill="url(#bg)"/>
<ellipse cx="200" cy="168" rx="178" ry="112" fill="#00000055"/>
<ellipse cx="200" cy="152" rx="172" ry="108" fill="url(#pl)"/>
<ellipse cx="200" cy="150" rx="140" ry="86" fill="${a}" opacity="0.55"/>
${bits}
<ellipse cx="150" cy="105" rx="40" ry="12" fill="#fff" opacity="0.25"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function kitchenArt(seed = 1): string {
  const h = 20 + (seed * 37) % 40
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<rect width="400" height="300" fill="hsl(${h},45%,88%)"/>
<rect y="190" width="400" height="110" fill="hsl(${h},30%,70%)"/>
<rect x="30" y="40" width="120" height="90" rx="6" fill="#fff" stroke="hsl(${h},30%,60%)" stroke-width="6"/>
<rect x="200" y="120" width="170" height="70" rx="6" fill="hsl(${h},25%,55%)"/>
<circle cx="250" cy="110" r="22" fill="#5a4a4a"/><circle cx="320" cy="110" r="18" fill="#7a6a6a"/>
<rect x="60" y="150" width="80" height="40" rx="8" fill="#A3173B" opacity=".85"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
