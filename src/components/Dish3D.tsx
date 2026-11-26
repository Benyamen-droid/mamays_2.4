/**
 * Visor 3D del plato (three.js / WebGL).
 * Arma un plato de cerámica en 3D y "sirve" encima la foto real de la comida, con relieve
 * calculado a partir de la propia foto. Se gira con el dedo, se acerca con dos dedos y gira solo.
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { dishFallbackArt } from './ui'

/** Los SVG sin tamaño propio se dibujan mal en canvas: les damos 800×600 */
function conTamano(src: string) {
  const pre = 'data:image/svg+xml;charset=utf-8,'
  if (!src.startsWith(pre)) return src
  const svg = decodeURIComponent(src.slice(pre.length))
  return pre + encodeURIComponent(svg.includes(' width=') && svg.indexOf(' width=') < svg.indexOf('>') ? svg : svg.replace('<svg ', '<svg width="800" height="600" '))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  src = conTamano(src)
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

/** Recorte cuadrado centrado de la foto + mapa de relieve (gris difuminado) */
function buildTextures(img: HTMLImageElement) {
  const S = 1024
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!
  const iw = img.naturalWidth || 800, ih = img.naturalHeight || 600
  const side = Math.min(iw, ih)
  g.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, S, S)
  const color = new THREE.CanvasTexture(c)
  color.colorSpace = THREE.SRGBColorSpace
  color.anisotropy = 4

  const h = document.createElement('canvas'); h.width = h.height = 256
  const hg = h.getContext('2d')!
  hg.filter = 'grayscale(1) blur(3px) contrast(1.15)'
  hg.drawImage(c, 0, 0, 256, 256)
  // borde más bajo: la comida "se asienta" en el plato
  const fade = hg.createRadialGradient(128, 128, 30, 128, 128, 104)
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.7, 'rgba(0,0,0,0.45)'); fade.addColorStop(1, 'rgba(0,0,0,1)')
  hg.filter = 'none'; hg.fillStyle = fade; hg.fillRect(0, 0, 256, 256)
  const height = new THREE.CanvasTexture(h)

  const a = document.createElement('canvas'); a.width = a.height = 256
  const ag = a.getContext('2d')!
  const grad = ag.createRadialGradient(128, 128, 104, 128, 128, 124)
  grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#000')
  ag.fillStyle = grad; ag.fillRect(0, 0, 256, 256)
  const alpha = new THREE.CanvasTexture(a)
  return { color, height, alpha }
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

export function Dish3DViewer({ src, name, onClose }: { src?: string; name: string; onClose: () => void }) {
  const mount = useRef<HTMLDivElement>(null)
  const ctrl = useRef<OrbitControls | null>(null)
  const [auto, setAuto] = useState(true)
  const [status, setStatus] = useState<'loading' | 'ready' | 'nogl'>('loading')
  const reset = useRef<() => void>(() => {})

  useEffect(() => {
    if (!webglOk()) { setStatus('nogl'); return }
    const el = mount.current!
    const W = () => el.clientWidth, H = () => el.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W(), H())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, W() / H(), 0.1, 50)
    const dir = new THREE.Vector3(0, 2.6, 3.1).normalize()
    // distancia para que el plato (radio ~1.45) entre completo, también en pantallas verticales
    const encuadre = () => {
      const v = THREE.MathUtils.degToRad(camera.fov) / 2
      const h = Math.atan(Math.tan(v) * camera.aspect)
      return Math.min(8.5, Math.max(3.4, 1.42 / Math.sin(Math.min(v, h))))
    }
    camera.position.copy(dir).multiplyScalar(encuadre())

    scene.add(new THREE.HemisphereLight(0xfff6ee, 0x3a2a2e, 1.1))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(2.5, 4, 2)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -2; sun.shadow.camera.right = 2; sun.shadow.camera.top = 2; sun.shadow.camera.bottom = -2
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0xffc9d6, 0.8); rim.position.set(-3, 1.5, -2); scene.add(rim)

    // Mantel guinda que recibe la sombra
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: 0x7e1230, roughness: 0.95 }))
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true
    scene.add(floor)

    // Plato de cerámica (torneado): borde, ala y fondo
    const profile = [
      [0, 0], [0.86, 0], [0.92, 0.03], [0.98, 0.09], [1.18, 0.16], [1.3, 0.2], [1.33, 0.23], [1.3, 0.25], [1.17, 0.205], [0.97, 0.14], [0.9, 0.07], [0.8, 0.055], [0, 0.055],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const plate = new THREE.Mesh(new THREE.LatheGeometry(profile, 128),
      new THREE.MeshPhysicalMaterial({ color: 0xfbf7f2, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.18, side: THREE.DoubleSide }))
    plate.castShadow = true; plate.receiveShadow = true
    scene.add(plate)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.008, 8, 160), new THREE.MeshStandardMaterial({ color: 0xa3173b, roughness: 0.4 }))
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.178; scene.add(ring)

    const group = new THREE.Group(); scene.add(group); group.add(plate, ring)
    let food: THREE.Mesh | null = null
    const disposables: { dispose: () => void }[] = []

    async function serve() {
      let img: HTMLImageElement
      try { img = await loadImage(src || dishFallbackArt(name)) } catch { img = await loadImage(dishFallbackArt(name)) }
      const { color, height, alpha } = buildTextures(img)
      // malla subdividida para que el relieve tenga detalle; el borde circular lo da el alphaMap
      const plane = new THREE.PlaneGeometry(1.76, 1.76, 220, 220)
      const mat = new THREE.MeshStandardMaterial({
        map: color, displacementMap: height, displacementScale: 0.2, displacementBias: -0.01,
        alphaMap: alpha, alphaTest: 0.5, roughness: 0.62, metalness: 0,
      })
      food = new THREE.Mesh(plane, mat)
      food.rotation.x = -Math.PI / 2
      food.position.y = 0.06
      food.castShadow = false; food.receiveShadow = true
      group.add(food)
      disposables.push(color, height, alpha, plane, mat)
      setStatus('ready')
    }
    serve().catch(() => setStatus('ready'))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 2.2; controls.maxDistance = 9
    controls.maxPolarAngle = Math.PI * 0.47
    controls.autoRotate = true; controls.autoRotateSpeed = 1.6
    controls.target.set(0, 0.1, 0)
    ctrl.current = controls
    reset.current = () => { camera.position.copy(dir).multiplyScalar(encuadre()); controls.target.set(0, 0.1, 0); controls.update() }

    let raf = 0
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop) }
    loop()
    const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix() })
    ro.observe(el)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose()
      disposables.forEach((d) => d.dispose())
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mm = m.material as THREE.Material | undefined; mm?.dispose?.() })
      renderer.dispose(); renderer.domElement.remove()
    }
  }, [src, name])

  useEffect(() => { if (ctrl.current) ctrl.current.autoRotate = auto }, [auto])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#2b1d21] to-[#120c0e] text-white" role="dialog" aria-modal="true" aria-label={`Vista 3D de ${name}`}>
      <div className="flex items-center justify-between px-5 pb-2 pt-4 safe-top">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#F7B6C8]">Vista 3D</div>
          <div className="font-serif text-xl font-bold">{name}</div>
        </div>
        <button onClick={onClose} aria-label="Cerrar vista 3D" className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><X /></button>
      </div>
      <div ref={mount} className="relative flex-1 touch-none" data-testid="visor-3d">
        {status === 'loading' && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Sirviendo el plato…</div>}
        {status === 'nogl' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-white/80">
            {src && <img src={src} alt={name} className="max-h-[50vh] rounded-2xl" />}
            Tu teléfono no permite gráficos 3D. Te mostramos la foto.
          </div>
        )}
      </div>
      <div className="px-5 pb-6 pt-3 safe-bottom">
        <p className="mb-3 text-center text-[13px] text-white/70">Arrastra para girar · pellizca para acercar</p>
        <div className="flex justify-center gap-3">
          <button onClick={() => setAuto(!auto)} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold">
            {auto ? <><Pause size={16} /> Pausar giro</> : <><Play size={16} /> Girar solo</>}
          </button>
          <button onClick={() => reset.current()} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold"><RotateCcw size={16} /> Centrar</button>
        </div>
      </div>
    </div>
  )
}

export default Dish3DViewer
