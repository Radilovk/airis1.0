/**
 * iris-quality.ts — обективна проверка на снимката ПРЕДИ да тръгне анализ.
 *
 * Досега приложението приемаше всяка снимка, която се събира в лимита за размер.
 * Ако зеницата не се вижда, координатната система няма къде да стъпи и всичко
 * надолу (разгъвка, минути, пръстени, находки) е измислено. Затова тук се прави
 * измеримо решение: `pass` / `warn` / `reject`, с конкретно съобщение какво да
 * оправи потребителят.
 *
 * Всички метрики се смятат върху НАМАЛЕНО копие (≈320 px) — достатъчно за
 * преценка и достатъчно бързо за мобилен браузър.
 */

import {
  detectIrisGeometry,
  irisFrameCoverage,
  pupilRatio,
  type IrisGeometry,
} from './iris-geometry'

export type QualityVerdict = 'pass' | 'warn' | 'reject'

export type QualityIssueCode =
  | 'pupil_not_found'
  | 'pupil_low_contrast'
  | 'limbus_not_found'
  | 'blurry'
  | 'glare'
  | 'reflection'
  | 'too_dark'
  | 'too_bright'
  | 'iris_too_small'
  | 'iris_cropped'
  | 'occluded'
  | 'low_resolution'
  | 'grayscale'

export interface QualityIssue {
  code: QualityIssueCode
  /** 'error' блокира анализа, 'warning' само предупреждава. */
  level: 'error' | 'warning'
  /** Какво не е наред — на български, за потребителя. */
  message: string
  /** Как да го оправи — конкретно действие. */
  fix: string
}

export interface QualityMetrics {
  /** Дисперсия на Лапласиана, нормирана 0..1 (по-високо = по-рязко). */
  sharpness: number
  /** Дял на пресветените пиксели, 0..1. */
  glare: number
  /**
   * Дял от ирисовата площ, покрит от огледално отражение, 0..1.
   *
   * Различава се от `glare`: `glare` брои само напълно избелени пиксели, докато
   * тук се хваща и отражение със среден интензитет — например огледален образ на
   * дървета и небе, който напълно заличава текстурата, без да е бял.
   */
  reflection: number
  /** Средна яркост 0..1. */
  brightness: number
  /** Дял на диска на ириса, попадащ в кадъра, 0..1. */
  frameCoverage: number
  /** Диаметър на ириса спрямо по-малката страна на кадъра, 0..1. */
  irisFill: number
  /** Отношение зеница/ирис. */
  pupilRatio: number
  /** Дял на площта на ириса, засенчена от клепач/мигли, 0..1. */
  occlusion: number
  /** Насищане на цвета 0..1 (много ниско = черно-бяла снимка). */
  saturation: number
  /** Резолюция по по-малката страна, px. */
  minDimension: number
}

export interface QualityReport {
  verdict: QualityVerdict
  /** Обобщена оценка 0..100 за UI. */
  score: number
  issues: QualityIssue[]
  metrics: QualityMetrics
  geometry: IrisGeometry
  /** Заглавие за диалога към потребителя. */
  headline: string
}

const WORK = 360

interface Sampled {
  gray: Float32Array
  rgba: Uint8ClampedArray
  w: number
  h: number
  scale: number
}

function sample(img: HTMLImageElement): Sampled {
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const scale = Math.min(1, WORK / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const rgba = ctx.getImageData(0, 0, w, h).data
  const gray = new Float32Array(w * h)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
  }
  return { gray, rgba, w, h, scale }
}

/** Дисперсия на Лапласиана — стандартната мярка за фокус. */
function laplacianVariance(s: Sampled, mask?: (x: number, y: number) => boolean): number {
  const { gray, w, h } = s
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mask && !mask(x, y)) continue
      const i = y * w + x
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]
      sum += lap
      sumSq += lap * lap
      n++
    }
  }
  if (n < 50) return 0
  const mean = sum / n
  return sumSq / n - mean * mean
}

export function analyseIrisQuality(img: HTMLImageElement): QualityReport {
  const s = sample(img)
  const geometry = detectIrisGeometry(img)

  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const minDimension = Math.min(srcW, srcH)

  // Геометрия в координатите на намаленото копие
  const g = {
    cx: geometry.limbus.cx * s.scale,
    cy: geometry.limbus.cy * s.scale,
    r: geometry.limbus.r * s.scale,
  }
  const insideIris = (x: number, y: number) =>
    (x - g.cx) ** 2 + (y - g.cy) ** 2 <= g.r * g.r

  // ── метрики върху зоната на ириса ─────────────────────────────────────────
  let bright = 0
  let glareCount = 0
  let darkCount = 0
  let irisPixels = 0
  let satSum = 0
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (g.r > 2 && !insideIris(x, y)) continue
      const i = y * s.w + x
      const p = i * 4
      const r = s.rgba[p]
      const gg = s.rgba[p + 1]
      const b = s.rgba[p + 2]
      const max = Math.max(r, gg, b)
      const min = Math.min(r, gg, b)
      satSum += max === 0 ? 0 : (max - min) / max
      bright += s.gray[i]
      if (s.gray[i] > 244) glareCount++
      if (s.gray[i] < 18) darkCount++
      irisPixels++
    }
  }
  if (irisPixels === 0) irisPixels = 1

  const brightness = bright / irisPixels / 255
  const glare = glareCount / irisPixels
  const saturation = satSum / irisPixels

  // Оклузия: тъмни пиксели в горната и долната трета на диска, извън зеницата,
  // са типично мигли/клепач. Оценка чрез дела на много тъмни пиксели.
  const pupilArea = Math.PI * (geometry.pupil.r * s.scale) ** 2
  const irisArea = Math.PI * g.r * g.r
  const expectedPupilShare = irisArea > 0 ? pupilArea / irisArea : 0
  const occlusion = Math.max(0, darkCount / irisPixels - expectedPupilShare)

  // ── покритие от отражение ────────────────────────────────────────────────
  // Мери се в ирисовия пръстен. Отражението носи цвета на източника, тоест е
  // значително по-малко наситено от пигментираната тъкан, и е по-светло от нея.
  // Праговете са относителни, за да важат и за сиви/сини ириси.
  let reflection = 0
  {
    const rIn0 = geometry.pupil.r * s.scale * 1.1
    const rOut0 = g.r * 0.97
    const lum: number[] = []
    const sat: number[] = []
    const idx: number[] = []
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const d2 = (x - g.cx) ** 2 + (y - g.cy) ** 2
        if (d2 < rIn0 * rIn0 || d2 > rOut0 * rOut0) continue
        const i = y * s.w + x
        const p = i * 4
        const mx = Math.max(s.rgba[p], s.rgba[p + 1], s.rgba[p + 2])
        const mn = Math.min(s.rgba[p], s.rgba[p + 1], s.rgba[p + 2])
        lum.push(s.gray[i])
        sat.push(mx < 1 ? 0 : (mx - mn) / mx)
        idx.push(i)
      }
    }
    if (lum.length > 300) {
      const ls = [...lum].sort((a, b) => a - b)
      const ss = [...sat].sort((a, b) => a - b)
      const lMed = ls[Math.floor(ls.length * 0.5)]
      const sMed = ss[Math.floor(ss.length * 0.5)]
      const lHard = Math.max(165, ls[Math.floor(ls.length * 0.98)])
      const lSoft = Math.max(140, lMed * 1.45)
      const sSoft = sMed * 0.55
      let hit = 0
      for (let k = 0; k < lum.length; k++) {
        if (lum[k] >= lHard || (lum[k] > lSoft && sat[k] < sSoft)) hit++
      }
      reflection = hit / lum.length
    }
  }

  // Фокус: мери се САМО върху пръстена на ириса (не върху фона/склерата)
  const rIn = geometry.pupil.r * s.scale * 1.15
  const rOut = g.r * 0.95
  const focusMask = (x: number, y: number) => {
    const d2 = (x - g.cx) ** 2 + (y - g.cy) ** 2
    return d2 >= rIn * rIn && d2 <= rOut * rOut
  }
  const lapVar = laplacianVariance(s, g.r > 4 ? focusMask : undefined)
  // Нормиране: <40 = размазано, >400 = много рязко
  const sharpness = Math.max(0, Math.min(1, (lapVar - 25) / 375))

  const frameCoverage = irisFrameCoverage(geometry)
  const irisFill = minDimension > 0 ? (geometry.limbus.r * 2) / minDimension : 0
  const ratio = pupilRatio(geometry)

  const metrics: QualityMetrics = {
    sharpness,
    glare,
    reflection,
    brightness,
    frameCoverage,
    irisFill,
    pupilRatio: ratio,
    occlusion,
    saturation,
    minDimension,
  }

  // ── правила ───────────────────────────────────────────────────────────────
  const issues: QualityIssue[] = []

  if (geometry.pupilConfidence < 0.18 || geometry.pupil.r <= 0) {
    issues.push({
      code: 'pupil_not_found',
      level: 'error',
      message: 'Зеницата не се разпознава на снимката.',
      fix: 'Снимайте отблизо, така че окото да заема почти целия кадър, и погледнете право в камерата.',
    })
  } else if (geometry.pupilConfidence < 0.35) {
    issues.push({
      code: 'pupil_low_contrast',
      level: 'error',
      message: 'Границата на зеницата е неясна — не може да се постави координатна система.',
      fix: 'Осветете окото странично (не с директна светкавица) и снимайте отново на рязко.',
    })
  } else if (geometry.pupilConfidence < 0.55) {
    // Средна лента на увереността. Автоматиката е дала резултат, но не е сигурна —
    // това е точно случаят, в който потребителят трябва да ПОГЛЕДНЕ кръговете,
    // вместо да му се каже „всичко е наред". Измерено: снимка, при която зеницата
    // излезе с радиус 30 вместо ≈46, дава увереност 0.48 и иначе не задействаше
    // никакво предупреждение.
    issues.push({
      code: 'pupil_low_contrast',
      level: 'warning',
      message: 'Автоматиката не е напълно сигурна къде е границата на зеницата.',
      fix: 'Погледнете синия кръг по-горе. Ако не съвпада със зеницата, нагласете го — от него зависи цялата координатна система.',
    })
  }

  if (geometry.limbusConfidence < 0.15) {
    issues.push({
      code: 'limbus_not_found',
      level: 'warning',
      message: 'Външният ръб на ириса се разпознава трудно.',
      fix: 'Отворете окото по-широко и внимавайте да не хвърляте сянка върху него.',
    })
  }

  // Отношението зеница/ирис е най-надеждният признак, че АВТОМАТИКАТА се е
  // объркала. Измерено: три годни снимки дават 0.19–0.24, а снимка, при която
  // огледално отражение на дървесна корона беше сбъркано със зеница — 0.56.
  //
  // Това нарочно е ПРЕДУПРЕЖДЕНИЕ, а не отхвърляне: при слаба светлина зеницата
  // наистина се разширява до 0.5–0.6. Затова вниманието се насочва към
  // калибратора, където потребителят вижда кръговете и може да ги поправи —
  // точно за това съществува тази стъпка.
  if (ratio > 0.5) {
    issues.push({
      code: 'pupil_low_contrast',
      level: 'warning',
      message: 'Зеницата изглежда необичайно голяма спрямо ириса.',
      fix: 'Проверете сините и жълтите кръгове по-горе. Ако не съвпадат с окото, нагласете ги с влачене — иначе всички находки ще се локализират погрешно.',
    })
  }

  if (sharpness < 0.14) {
    issues.push({
      code: 'blurry',
      level: 'error',
      message: 'Снимката е размазана — влакната на ириса не се различават.',
      fix: 'Задръжте телефона неподвижно, докоснете екрана за фокус върху ириса и снимайте отново.',
    })
  } else if (sharpness < 0.28) {
    issues.push({
      code: 'blurry',
      level: 'warning',
      message: 'Детайлът е на границата на достатъчния.',
      fix: 'По-рязка снимка ще подобри точността осезаемо.',
    })
  }

  if (glare > 0.09) {
    issues.push({
      code: 'glare',
      level: 'error',
      message: 'Голям светлинен отблясък закрива част от ириса.',
      fix: 'Изключете светкавицата и застанете така, че лампата или прозорецът да са встрани, а не отпред.',
    })
  } else if (glare > 0.035) {
    issues.push({
      code: 'glare',
      level: 'warning',
      message: 'Има отблясъци върху ириса.',
      fix: 'Леко завъртане на главата спрямо източника на светлина ги премахва.',
    })
  }

  // Огледално отражение върху ириса. Това е отделно правило от `glare`, защото
  // отражение на прозорец, дървета или небе заличава текстурата, без да е бяло:
  // измерено върху реална снимка с отразена корона на дърво — 60 % от ирисовата
  // площ, а старите правила не отчитаха нищо.
  if (reflection > 0.34) {
    issues.push({
      code: 'reflection',
      level: 'error',
      message: 'Огледално отражение покрива голяма част от ириса.',
      fix: 'Застанете с гръб към прозореца или влезте на сянка. Отражението на небе, дървета или лампа скрива тъканта и анализът няма какво да разчете.',
    })
  } else if (reflection > 0.18) {
    issues.push({
      code: 'reflection',
      level: 'warning',
      message: 'Част от ириса е закрита от отражение.',
      fix: 'Леко завъртане на главата спрямо светлината намалява отражението.',
    })
  }

  if (brightness < 0.16) {
    issues.push({
      code: 'too_dark',
      level: 'error',
      message: 'Снимката е твърде тъмна.',
      fix: 'Снимайте на дневна светлина или добавете разсеяно осветление отстрани.',
    })
  } else if (brightness > 0.82) {
    issues.push({
      code: 'too_bright',
      level: 'warning',
      message: 'Снимката е пресветена и цветовете са изгубени.',
      fix: 'Намалете експонацията или се отдалечете от източника на светлина.',
    })
  }

  // Праговете са свалени по измерване върху реални снимки: при коректно изрязан
  // кадър ирисът заема 35–45 % от по-малката страна, защото около него трябва да
  // остане склера и клепач. Старите прагове (грешка <34 %, предупреждение <50 %)
  // маркираха нормалните снимки като проблемни.
  if (irisFill < 0.18) {
    issues.push({
      code: 'iris_too_small',
      level: 'error',
      message: 'Ирисът заема твърде малка част от кадъра.',
      fix: 'Приближете камерата или изрежете снимката така, че окото да запълва кадъра.',
    })
  } else if (irisFill < 0.3) {
    issues.push({
      code: 'iris_too_small',
      level: 'warning',
      message: 'Ирисът може да е по-едър в кадъра.',
      fix: 'Приближаването увеличава видимия детайл.',
    })
  }

  // Изрязаният кадър от редактора често е плътно около ириса, затова праговете
  // са хлабави: предупреждение при леко отрязване, грешка само при сериозно.
  if (frameCoverage < 0.92) {
    issues.push({
      code: 'iris_cropped',
      level: frameCoverage < 0.62 ? 'error' : 'warning',
      message: 'Част от ириса излиза извън кадъра.',
      fix: 'Центрирайте окото така, че целият цветен кръг да е вътре в снимката.',
    })
  }

  if (occlusion > 0.3) {
    issues.push({
      code: 'occluded',
      level: 'error',
      message: 'Клепачите или миглите закриват голяма част от ириса.',
      fix: 'Отворете окото широко (може да повдигнете леко клепача с пръст) и снимайте отново.',
    })
  } else if (occlusion > 0.18) {
    issues.push({
      code: 'occluded',
      level: 'warning',
      message: 'Клепачът закрива част от горния сектор.',
      fix: 'Отворете окото малко по-широко за пълен обхват.',
    })
  }

  if (minDimension < 500) {
    issues.push({
      code: 'low_resolution',
      level: minDimension < 320 ? 'error' : 'warning',
      message: `Резолюцията е ниска (${minDimension} px).`,
      fix: 'Използвайте основната камера на телефона, не предната, и не намалявайте снимката преди качване.',
    })
  }

  if (saturation < 0.06) {
    issues.push({
      code: 'grayscale',
      level: 'warning',
      message: 'Снимката изглежда почти черно-бяла.',
      fix: 'Цветната информация е нужна за пигментния слой — изключете черно-бял филтър.',
    })
  }

  // ── обобщение ─────────────────────────────────────────────────────────────
  const hasError = issues.some(i => i.level === 'error')
  const warnCount = issues.filter(i => i.level === 'warning').length

  const score = Math.round(
    100 *
      Math.max(
        0,
        Math.min(
          1,
          0.3 * sharpness +
            0.22 * geometry.pupilConfidence +
            0.14 * geometry.limbusConfidence +
            0.12 * Math.min(1, irisFill / 0.6) +
            0.1 * frameCoverage +
            0.05 * (1 - Math.min(1, glare / 0.12)) +
            0.04 * (1 - Math.min(1, occlusion / 0.35)) +
            0.03 * (1 - Math.min(1, reflection / 0.4))
        )
      )
  )

  const verdict: QualityVerdict = hasError ? 'reject' : warnCount > 0 ? 'warn' : 'pass'

  const headline = hasError
    ? 'Нужна е нова снимка'
    : warnCount > 0
      ? 'Снимката става, но може по-добре'
      : 'Отлична снимка'

  return { verdict, score, issues, metrics, geometry, headline }
}

/** Удобна обвивка за data URL. */
export function analyseIrisQualityFromDataUrl(dataUrl: string): Promise<QualityReport> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        resolve(analyseIrisQuality(img))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Изображението не може да бъде заредено'))
    img.src = dataUrl
  })
}

/** Само блокиращите проблеми. */
export function blockingIssues(report: QualityReport): QualityIssue[] {
  return report.issues.filter(i => i.level === 'error')
}
