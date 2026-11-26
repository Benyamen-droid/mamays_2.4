// Compila MAMAYS en UN solo archivo HTML (modo demo), para compartir una vista previa sin servidor.
// Uso: npm run build:demo  →  dist-demo/index.html
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const soloDemo: Plugin = {
  name: 'mamays-solo-demo',
  transformIndexHtml: (html) => html
    .replace(/\s*<script src="\.\/config\.js"><\/script>/, '')
    .replace(/\s*<link rel="(icon|apple-touch-icon|manifest)"[^>]*>/g, ''),
}

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_MEMORY_ROUTER': JSON.stringify('1') },
  plugins: [react(), tailwindcss(), soloDemo, viteSingleFile()],
  publicDir: false,
  build: { outDir: 'dist-demo', chunkSizeWarningLimit: 4000 },
})
