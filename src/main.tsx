import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Solo el subconjunto "latin" (incluye á, é, ñ, ¿, ¡): la app pesa mucho menos
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import '@fontsource/playfair-display/latin-600.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/playfair-display/latin-400-italic.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// App web instalable (PWA): solo en navegador, no dentro del APK
const isNative = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
if ('serviceWorker' in navigator && location.protocol === 'https:' && !isNative) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
