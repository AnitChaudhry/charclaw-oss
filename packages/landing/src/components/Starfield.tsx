import { useEffect, useRef } from "react"

interface Star {
  x: number
  y: number
  r: number
  /** baseline alpha 0-1 */
  a: number
  /** twinkle phase in radians */
  phase: number
  /** twinkle speed (radians/ms) */
  speed: number
}

const STAR_DENSITY = 1 / 2400 // ~3x denser than before — matches the reference frame
const CURSOR_RADIUS = 180     // px — stars within this distance twinkle faster
const CURSOR_SPEED_BOOST = 6  // multiplier on twinkle speed under the cursor
const CURSOR_BRIGHT_BOOST = 0.6 // additive alpha boost at the very center

/**
 * Full-viewport, fixed-position starfield canvas.
 * Stars twinkle slowly everywhere; stars within CURSOR_RADIUS of the
 * mouse pointer twinkle faster and brighter — falloff is a smooth
 * 1 - d/R curve squared. No trails, no spawned dots; the cursor just
 * "lights up" the existing stars under it.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const starsRef = useRef<Star[]>([])
  const cursorRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -10000,
    y: -10000,
    active: false,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    const seedStars = (w: number, h: number) => {
      const count = Math.max(120, Math.round(w * h * STAR_DENSITY))
      const stars: Star[] = []
      for (let i = 0; i < count; i++) {
        // Mostly tiny dots with a few larger highlight stars — matches a
        // realistic night-sky distribution rather than a uniform grid.
        const big = Math.random() < 0.08
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: big ? Math.random() * 1.1 + 1.0 : Math.random() * 0.8 + 0.3,
          a: Math.random() * 0.55 + 0.3,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.0007 + 0.0002,
        })
      }
      starsRef.current = stars
    }

    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedStars(w, h)
    }

    const onMove = (e: MouseEvent) => {
      cursorRef.current.x = e.clientX
      cursorRef.current.y = e.clientY
      cursorRef.current.active = true
    }
    const onLeave = () => {
      cursorRef.current.active = false
    }

    const draw = (t: number) => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)

      const cx = cursorRef.current.x
      const cy = cursorRef.current.y
      const cursorActive = cursorRef.current.active
      const R2 = CURSOR_RADIUS * CURSOR_RADIUS

      ctx.fillStyle = "rgba(255,255,255,1)"
      for (const s of starsRef.current) {
        // Proximity factor — 1 right under the cursor, 0 outside the radius.
        let prox = 0
        if (cursorActive) {
          const dx = s.x - cx
          const dy = s.y - cy
          const d2 = dx * dx + dy * dy
          if (d2 < R2) {
            const k = 1 - Math.sqrt(d2) / CURSOR_RADIUS
            prox = k * k // smooth falloff
          }
        }

        // Faster twinkle near the cursor.
        const speed = s.speed * (1 + prox * (CURSOR_SPEED_BOOST - 1))
        const wobble = (Math.sin(s.phase + t * speed) + 1) / 2 // 0-1

        // Brighter peak near the cursor.
        const baseAlpha = s.a * (0.45 + 0.55 * wobble)
        const alpha = Math.min(1, baseAlpha + prox * CURSOR_BRIGHT_BOOST)

        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener("resize", resize, { passive: true })
    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("mouseleave", onLeave, { passive: true })
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseleave", onLeave)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  )
}
