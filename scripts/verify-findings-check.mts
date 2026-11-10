/**
 * Калибриране на проверката по снимката (src/lib/finding-verify.ts).
 *
 * Синтетичен ирис: радиални влакна с различна яркост, естествени крипти
 * (малки тъмни петна) на случайни места, шум и леко цветово петнистост.
 * Слага се ЕДИН истински знак на известно място и се мери:
 *   - колко често знакът се намира на истинското място (чувствителност);
 *   - колко често празно място минава прага (лъжливо „видяно“).
 *
 *   npx tsx scripts/verify-findings-check.mts
 */
import { patchGrid, verifyAgainstGrid, SEEN_THRESHOLD } from '../src/lib/finding-verify.ts'

const W = 900, H = 900, CX = 450, CY = 450, RP = 90, RI = 330

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

type Spot = { type: 'dark' | 'orange' | 'brown'; sector: number; ring: number; strength: number }

function drawIris(seed: number, spot: Spot | null) {
  const rand = rng(seed)
  const data = new Uint8ClampedArray(W * H * 4)
  const fibers = Array.from({ length: 360 }, () => (rand() - 0.5) * 34)
  // естествени крипти: тъмни петна с различна сила, навсякъде
  const crypts = Array.from({ length: 26 }, () => ({
    m: rand() * 60, r: rand(), size: 0.6 + rand() * 1.4, depth: 10 + rand() * 25,
  }))
  const base = [92 + rand() * 30, 110 + rand() * 20, 70 + rand() * 30]
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - CX, dy = y - CY
    const r = Math.hypot(dx, dy)
    const i = (y * W + x) * 4
    if (r < RP) { data[i] = data[i+1] = data[i+2] = 10; data[i+3] = 255; continue }
    if (r > RI) { data[i] = 235; data[i+1] = 230; data[i+2] = 225; data[i+3] = 255; continue }
    const ang = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)
    const minute = (ang / (Math.PI * 2)) * 60
    const ringPos = ((r - RP) / (RI - RP)) * 12
    let v = fibers[Math.floor((ang / (Math.PI * 2)) * 360) % 360]
    v += (Math.random() - 0.5) * 22 // пикселен шум
    v += ringPos < 4 ? 18 : 0 // по-светла зона около зеницата
    let [R, G, B] = [base[0] + v, base[1] + v, base[2] + v * 0.8]
    for (const c of crypts) {
      const dm = Math.min(Math.abs(minute - c.m), 60 - Math.abs(minute - c.m)) * (r * Math.PI * 2 / 60) / 10
      const dr = (ringPos - (2 + c.r * 9)) * ((RI - RP) / 12) / 10
      const d = Math.hypot(dm, dr) / c.size
      if (d < 1) { R -= c.depth * (1 - d); G -= c.depth * (1 - d); B -= c.depth * (1 - d) }
    }
    if (spot) {
      const sm = (spot.sector - 0.5) * 5
      const dm = Math.min(Math.abs(minute - sm), 60 - Math.abs(minute - sm)) * (r * Math.PI * 2 / 60)
      const dr = (ringPos - (spot.ring + 0.5)) * ((RI - RP) / 12)
      const d = Math.hypot(dm, dr) / 11
      if (d < 1) {
        const k = spot.strength * (1 - d * d)
        if (spot.type === 'dark') { R -= 45 * k; G -= 45 * k; B -= 40 * k }
        if (spot.type === 'orange') { R += 70 * k; G += 10 * k; B -= 40 * k }
        if (spot.type === 'brown') { R -= 10 * k; G -= 35 * k; B -= 45 * k }
      }
    }
    data[i] = R; data[i+1] = G; data[i+2] = B; data[i+3] = 255
  }
  return { data, width: W, height: H }
}

const geo = { pupil: { r: RP }, limbus: { cx: CX, cy: CY, r: RI } }
const TYPE = { dark: 'fiber_defect', orange: 'pigment_orange', brown: 'pigment_brown' } as const

for (const strength of [0.5, 0.8, 1]) {
  let hit = 0, falseSeen = 0, n = 0, empty = 0
  for (let seed = 1; seed <= 24; seed++) {
    const rand = rng(seed * 7)
    const kind = (['dark', 'orange', 'brown'] as const)[seed % 3]
    const spot: Spot = { type: kind, sector: 1 + Math.floor(rand() * 12), ring: 2 + Math.floor(rand() * 8), strength }
    const grid = patchGrid(drawIris(seed, spot), geo)
    const v = verifyAgainstGrid({ type: TYPE[kind], sector: spot.sector, ring: spot.ring }, grid)
    n++; if (v.check === 'seen') hit++
    // празни места: същият тип, сектор на 3+ сектора разстояние
    for (let k = 0; k < 4; k++) {
      const sector = ((spot.sector + 2 + k * 2) % 12) + 1
      const ring = 1 + Math.floor(rand() * 10)
      const e = verifyAgainstGrid({ type: TYPE[kind], sector, ring }, grid)
      empty++; if (e.check === 'seen') falseSeen++
    }
  }
  console.log(`сила ${strength}: истински ${hit}/${n} видени · празни места минали ${falseSeen}/${empty} (праг ${SEEN_THRESHOLD})`)
}
