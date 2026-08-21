/**
 * iris-pipeline.ts — оркестраторът на новия анализ.
 *
 * ПОТОК
 * ─────
 *   снимка ─▶ [код] геометрия ─▶ [код] качество ─▶ [код] разгъвка + мрежа
 *                                     │
 *                                     ├─▶ [LLM] детекция върху structure слоя
 *                                     ├─▶ [LLM] детекция върху pigment слоя
 *                                     └─▶ [LLM] конституция (кратко)
 *                                            │
 *                        [код] нормализация + отхвърляне на невалидни находки
 *                                            │
 *                        [код] детерминистични системни оценки + драйвери
 *                                            │
 *                                     [LLM] интерпретация и план
 *
 * Всичко, което е геометрия, филтриране, валидиране и приоритизиране, се прави
 * в код. LLM-ът върши само двете неща, в които е добър: разпознаване на визуални
 * шаблони и писане на текст.
 *
 * Ако който и да е LLM пас се провали, анализът продължава. Провалът намалява
 * количеството информация, но не спира плана — той се генерира и само от
 * въпросника.
 */

import type { IrisImage, QuestionnaireData } from '@/types'
import type { IrisGeometry } from './iris-geometry'
import { analyseIrisQualityFromDataUrl, type QualityReport } from './iris-quality'
import {
  readabilityToPhysical,
  stripSectorToPhysical,
  unwrapAnalysisFromDataUrl,
  type AnalysisViews,
  type StripLayer,
  type UnwrapResult,
} from './iris-unwrap'
import {
  buildConstitutionPrompt,
  buildDetectionPrompt,
  buildInterpretationPrompt,
} from './analysis-prompts'
import {
  computeScores,
  mergeSeamReadings,
  normalizeFindings,
  type NormalizedFinding,
  type ScoringResult,
} from './iris-scoring'
import {
  CONSTITUTIONS,
  MAX_FINDINGS_PER_EYE,
  sectorsFor,
  type Constitution,
  type Side,
} from './iris-map'

export type LogLevel = 'info' | 'success' | 'error' | 'warning'
export type AddLog = (level: LogLevel, message: string) => void
export type OnProgress = (step: string, progress: number) => void
export type CallLLM = (
  prompt: string,
  jsonMode: boolean,
  retries: number,
  imageDataUrl?: string
) => Promise<string>

export interface EyePreparation {
  side: Side
  geometry: IrisGeometry
  /** 0–100. Идва от калибратора, ако снимката е минала през него. */
  qualityScore: number
  qualityVerdict: 'pass' | 'warn' | 'reject'
  /** Дали геометрията е потвърдена/коригирана ръчно от потребителя. */
  manualGeometry: boolean
  /** Изведено от снимката, не предположено: има ли отблясък от светкавица. */
  flash: boolean
  strips: Record<StripLayer, UnwrapResult>
  /** Двата независими прочита с различен шев. Виж `mergeSeamReadings`. */
  readings: AnalysisViews['readings']
}

export interface EyeDetection {
  side: Side
  findings: NormalizedFinding[]
  constitution: Constitution
  /** Колко LLM паса са успели (0–5: 2 слоя × 2 шева + конституция). */
  passesOk: number
  rejectedCount: number
  /**
   * Измерена повторяемост: какъв дял от находките са се появили и в двата
   * прочита с различен шев. Това е увереност, която е ИЗМЕРЕНА, за разлика от
   * числото `confidence`, което моделът обявява сам.
   */
  agreement: number
  confirmedCount: number
}

export interface IrisPipelineResult {
  left: EyeDetection
  right: EyeDetection
  preparation: { left: EyePreparation; right: EyePreparation }
  scoring: ScoringResult
  /** Суровият JSON от интерпретиращия пас, или null при провал. */
  interpretation: InterpretationOutput | null
  imageQuality: number
  stripCoverage: number
  /** Средна повторяемост на двата прочита с различен шев, 0–1. */
  agreement: number
  confirmedCount: number
}

export interface InterpretationOutput {
  summary?: string
  briefSummary?: string
  motivational?: string
  systemNotes?: Array<{ system: string; note: string }>
  zoneSummaries?: Array<{ sector: number; side: Side; note: string }>
  plan?: {
    priorities?: string[]
    eatMore?: string[]
    eatLess?: string[]
    dayStructure?: { breakfast?: string; lunch?: string; dinner?: string; notes?: string }
    supplements?: Array<{ name: string; dosage: string; timing: string; notes?: string }>
    lifestyle?: { sleep?: string[]; stress?: string[]; activity?: string[] }
    firstWeek?: string[]
    followUp?: string[]
    /** Имена на рутинни изследвания за обсъждане с лекар — без интерпретация. */
    suggestedChecks?: string[]
  }
}

/* ── помощни ─────────────────────────────────────────────────────────────── */

/** Изчиства ограждащи ```json блокове и парсва. Хвърля при неуспех. */
export function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim()
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim()
  }
  // Някои модели добавят текст преди/след обекта.
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first > 0 || (last >= 0 && last < cleaned.length - 1)) {
    if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1)
  }
  return JSON.parse(cleaned)
}

function isConstitution(v: unknown): v is Constitution {
  return typeof v === 'string' && v in CONSTITUTIONS
}

/* ── стъпка 1: подготовка (само код) ─────────────────────────────────────── */

/**
 * Измерва геометрията, оценява качеството и построява трите ленти.
 * Няма мрежови заявки — работи офлайн и е детерминистично.
 */
export async function prepareEye(
  iris: IrisImage,
  side: Side,
  addLog: AddLog
): Promise<EyePreparation> {
  const name = side === 'left' ? 'ляв' : 'десен'

  // Ако снимката е минала през калибратора, геометрията и оценката вече са
  // измерени и потвърдени от потребителя. Повторното им смятане тук е и излишно
  // (пълната детекция е ~1–2 s на око), и вредно: изхвърляше ръчната корекция
  // и заместваше потвърдената оценка с нова, автоматична.
  let geometry: IrisGeometry
  let qualityScore: number
  let qualityVerdict: 'pass' | 'warn' | 'reject'
  const manualGeometry = iris.geometry?.manual === true

  if (iris.geometry && iris.quality) {
    geometry = iris.geometry
    qualityScore = iris.quality.score
    qualityVerdict = iris.quality.verdict
    addLog(
      'info',
      `[Подготовка ${name}] Използвам калибрацията от екрана за качване` +
        `${manualGeometry ? ' (коригирана ръчно)' : ''} — качество ${qualityScore}/100`
    )
  } else {
    addLog('info', `[Подготовка ${name}] Няма запазена калибрация — измервам геометрията...`)
    const quality: QualityReport = await analyseIrisQualityFromDataUrl(iris.dataUrl)
    geometry = iris.geometry ?? quality.geometry
    qualityScore = quality.score
    qualityVerdict = quality.verdict
    addLog(
      quality.verdict === 'reject' ? 'warning' : 'info',
      `[Подготовка ${name}] Качество ${quality.score}/100 — ` +
        `зеница ${Math.round(geometry.pupilConfidence * 100)} %, ` +
        `лимбус ${Math.round(geometry.limbusConfidence * 100)} %`
    )
  }

  addLog('info', `[Подготовка ${name}] Пречертаване на лентата...`)
  const views = await unwrapAnalysisFromDataUrl(iris.dataUrl, geometry, side)
  // `strips` остава с шев на 12:00 — за конституцията, за показване и за
  // историята. Детекцията ползва `views.readings`.
  const strips: Record<StripLayer, UnwrapResult> = {
    base: views.base,
    structure: views.readings[0].structure,
    pigment: views.readings[0].pigment,
  }

  // Оценката се преизчислява СЛЕД лентата: покритието ѝ е единственото число,
  // което описва какво реално вижда моделът. Без него оценяваме снимката, а не
  // анализа.
  const recomputed = await analyseIrisQualityFromDataUrl(iris.dataUrl, {
    stripCoverage: strips.base.coverage,
  })
  if (!(iris.geometry && iris.quality)) {
    qualityScore = recomputed.score
    qualityVerdict = recomputed.verdict
  } else if (Math.abs(recomputed.score - qualityScore) > 12) {
    // Калибраторът е дал своя оценка; ако разминаването е голямо, вярваме на
    // тази, която включва покритието.
    addLog(
      'info',
      `[Подготовка ${name}] Оценката е коригирана с покритието на лентата: ` +
        `${qualityScore} → ${recomputed.score}`
    )
    qualityScore = recomputed.score
    qualityVerdict = recomputed.verdict
  }

  const coverage = Math.round(strips.base.coverage * 100)
  addLog(
    coverage < 60 ? 'warning' : 'success',
    `[Подготовка ${name}] Лентата е готова — ${coverage} % четима площ` +
      (strips.base.unreadableCells.length
        ? `, ${strips.base.unreadableCells.length} нечетими клетки`
        : '')
  )

  // Прагът е КАЛИБРИРАН по измерване, не избран на око: върху пет реални снимки
  // четирите при околна светлина дават 0.0 %, а тази със светкавица — 1.7 %.
  // 0.5 % лежи в средата на празнината.
  const flash = recomputed.metrics.pupilSpecular > 0.005
  if (flash) addLog('info', `[Подготовка ${name}] Разпозната светкавица — четенето е нагласено за нея`)

  return {
    side,
    geometry,
    qualityScore,
    qualityVerdict,
    manualGeometry,
    flash,
    strips,
    readings: views.readings,
  }
}

/* ── стъпка 2: детекция (LLM) ────────────────────────────────────────────── */

/**
 * Пуска двата детекторски паса + конституцията за едно око.
 * Всеки пас се проваля независимо — грешка в един не спира останалите.
 */
export async function detectEye(
  prep: EyePreparation,
  callLLM: CallLLM,
  addLog: AddLog,
  onProgress: OnProgress,
  delayBetweenCalls: number
): Promise<EyeDetection> {
  const sideName = prep.side === 'left' ? 'ляв' : 'десен'
  let rejected = 0
  let passesOk = 0

  // Резултатите се държат ПО ПРОЧИТ (по индекс на шева), защото сливането е
  // именно между тях. Смесването им тук би заличило информацията, заради която
  // се прави вторият прочит.
  const perReading: NormalizedFinding[][] = prep.readings.map(() => [])

  const runDetection = async (
    layer: Exclude<StripLayer, 'base'>,
    readingIdx: number,
    progress: number
  ) => {
    const view = prep.readings[readingIdx]
    const strip = view[layer]
    const label = layer === 'structure' ? 'структурен' : 'пигментен'
    const seam = view.rotationSectors === 0 ? '12:00' : `${(view.rotationSectors % 12) || 12}:00`
    onProgress(`Детекция (${sideName}, ${label}, шев ${seam})`, progress)
    addLog('info', `[Детекция ${sideName}] ${label} слой, шев на ${seam}...`)

    const prompt = buildDetectionPrompt({
      side: prep.side,
      layer,
      unreadableCells: strip.unreadableCells,
      partialCells: strip.partialCells,
      qualityScore: prep.qualityScore,
      flash: prep.flash,
    })

    try {
      const response = await callLLM(prompt, true, 2, strip.dataUrl)
      const parsed = parseJsonResponse(response) as Record<string, unknown>
      const rawList = Array.isArray(parsed.findings) ? parsed.findings : []

      // Секторите се връщат към ФИЗИЧЕСКИ преди нормализирането: приоритетните
      // зони и картата на органите работят с физически координати, не с колони.
      const physical = rawList.map(item => {
        if (!item || typeof item !== 'object') return item
        const o = item as Record<string, unknown>
        const sec = Number(o.sector)
        if (!Number.isFinite(sec)) return item
        return { ...o, sector: stripSectorToPhysical(sec, view.rotationSectors) }
      })

      const normalized = normalizeFindings(physical, prep.side, {
        readability: readabilityToPhysical(strip.readability, view.rotationSectors),
        partialCells: strip.partialCells.map(c => ({
          sector: stripSectorToPhysical(c.sector, view.rotationSectors),
          ring: c.ring,
        })),
      })
      rejected += rawList.length - normalized.length
      perReading[readingIdx].push(...normalized)
      passesOk++
      addLog(
        'success',
        `[Детекция ${sideName}] ${label}, шев ${seam}: ${normalized.length} приети` +
          (rawList.length > normalized.length
            ? `, ${rawList.length - normalized.length} отхвърлени като невалидни`
            : '')
      )
    } catch (e) {
      addLog(
        'warning',
        `[Детекция ${sideName}] ${label}, шев ${seam} се провали: ` +
          `${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  // Четири независими паса: два слоя × два шева. Всички са независими помежду
  // си — при липса на ограничение на честотата вървят наведнъж.
  const jobs: Array<[Exclude<StripLayer, 'base'>, number, number]> = []
  prep.readings.forEach((_, idx) => {
    jobs.push(['structure', idx, 15 + idx * 10])
    jobs.push(['pigment', idx, 35 + idx * 10])
  })

  if (delayBetweenCalls > 0) {
    for (const [layer, idx, progress] of jobs) {
      await runDetection(layer, idx, progress)
      await sleep(delayBetweenCalls)
    }
  } else {
    await Promise.all(jobs.map(([layer, idx, progress]) => runDetection(layer, idx, progress)))
  }

  // Сливане на двата прочита. Тук се ражда измерената повторяемост.
  const merged = mergeSeamReadings(perReading[0] ?? [], perReading[1] ?? [])
  const collected = merged.findings
  addLog(
    merged.agreement >= 0.5 ? 'success' : 'warning',
    `[Детекция ${sideName}] Два прочита с различен шев: ${merged.confirmed} от ` +
      `${merged.total} находки съвпадат (${Math.round(merged.agreement * 100)} % повторяемост)`
  )

  // Конституция — кратък пас върху базовия слой.
  let constitution: Constitution = 'unclear'
  try {
    if (delayBetweenCalls > 0) await sleep(delayBetweenCalls)
    onProgress(`Конституция (${sideName})`, 65)
    const response = await callLLM(buildConstitutionPrompt(prep.side), true, 1, prep.strips.base.dataUrl)
    const parsed = parseJsonResponse(response) as Record<string, unknown>
    if (isConstitution(parsed.constitution)) {
      constitution = parsed.constitution
      passesOk++
      addLog('info', `[Детекция ${sideName}] Конституция: ${CONSTITUTIONS[constitution].label}`)
    }
  } catch (e) {
    addLog('warning', `[Детекция ${sideName}] Конституцията не бе определена`)
    void e
  }

  // Де-дублиране между слоевете. Подредбата е по тежест ПРЕДИ филтъра, за да
  // оцелее потвърдената находка, ако някога съвпадне по адрес с непотвърдена.
  const seen = new Set<string>()
  const deduped = collected
    .slice()
    .sort((a, b) => (b.confirmations ?? 1) - (a.confirmations ?? 1) || b.load - a.load)
    .filter(f => {
      const k = `${f.type}:${f.sector}:${f.ring}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

  // Твърд таван. Промптът иска максимум 14 находки, но това е молба, не гаранция —
  // модел, който върне 40, иначе би размил сигнала и би обърнал всяка система в
  // „проблемна". Задържаме най-тежките.
  const findings = deduped
    .slice()
    .sort((a, b) => b.load - a.load)
    .slice(0, MAX_FINDINGS_PER_EYE)

  if (deduped.length > findings.length) {
    addLog(
      'warning',
      `[Детекция ${sideName}] ${deduped.length} находки надхвърлят тавана — задържани най-тежките ${MAX_FINDINGS_PER_EYE}`
    )
  }

  if (passesOk === 0) {
    addLog('error', `[Детекция ${sideName}] Нито един пас не успя — окото няма ирисов принос.`)
  }

  return {
    side: prep.side,
    findings,
    constitution,
    passesOk,
    rejectedCount: rejected,
    agreement: merged.agreement,
    confirmedCount: findings.filter(f => f.confirmations === 2).length,
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/* ── стъпка 3: пълният анализ ────────────────────────────────────────────── */

export interface RunPipelineOptions {
  leftIris: IrisImage
  rightIris: IrisImage
  questionnaire: QuestionnaireData
  callLLM: CallLLM
  addLog: AddLog
  onProgress: OnProgress
  /** Пауза между LLM заявките, ms (срещу rate limit). */
  requestDelay?: number
}

export async function runIrisPipeline(opts: RunPipelineOptions): Promise<IrisPipelineResult> {
  const { leftIris, rightIris, questionnaire, callLLM, addLog, onProgress } = opts
  const delay = opts.requestDelay ?? 0

  // ── 1. подготовка (паралелно, само код) ────────────────────────────────
  onProgress('Подготовка на изображенията', 5)
  const [leftPrep, rightPrep] = await Promise.all([
    prepareEye(leftIris, 'left', addLog),
    prepareEye(rightIris, 'right', addLog),
  ])

  const imageQuality = (leftPrep.qualityScore + rightPrep.qualityScore) / 2
  const stripCoverage = (leftPrep.strips.base.coverage + rightPrep.strips.base.coverage) / 2

  addLog(
    'info',
    `Средно качество ${Math.round(imageQuality)}/100, средно покритие ${Math.round(stripCoverage * 100)} %`
  )

  for (const prep of [leftPrep, rightPrep]) {
    if (prep.qualityVerdict === 'reject') {
      addLog(
        'warning',
        `[${prep.side === 'left' ? 'Ляв' : 'Десен'}] Снимката е под прага за качество — ` +
          'ирисовият принос ще бъде силно свит, планът стъпва на въпросника.'
      )
    }
  }

  // ── 2. детекция ─────────────────────────────────────────────────────────
  // Двете очи също са независими помежду си.
  let left: EyeDetection
  let right: EyeDetection
  if (delay > 0) {
    onProgress('Анализ на ляв ирис', 15)
    left = await detectEye(leftPrep, callLLM, addLog, (s, p) => onProgress(s, 15 + p * 0.25), delay)
    await sleep(delay)
    onProgress('Анализ на десен ирис', 40)
    right = await detectEye(rightPrep, callLLM, addLog, (s, p) => onProgress(s, 40 + p * 0.25), delay)
  } else {
    onProgress('Анализ на двата ириса', 15)
    ;[left, right] = await Promise.all([
      detectEye(leftPrep, callLLM, addLog, (s, p) => onProgress(s, 15 + p * 0.25), delay),
      detectEye(rightPrep, callLLM, addLog, (s, p) => onProgress(s, 40 + p * 0.25), delay),
    ])
  }

  const allFindings = [...left.findings, ...right.findings]
  const passTotal = left.passesOk + right.passesOk
  if (passTotal < 10) {
    addLog('warning', `Успели LLM паса: ${passTotal} от 10 — част от данните липсват.`)
  }
  const agreement = (left.agreement + right.agreement) / 2
  addLog(
    agreement >= 0.5 ? 'success' : 'warning',
    `Повторяемост на разчитането: ${Math.round(agreement * 100)} % ` +
      `(${left.confirmedCount + right.confirmedCount} потвърдени находки от два независими прочита)`
  )
  addLog(
    'success',
    `Общо ${allFindings.length} приети находки` +
      (left.rejectedCount + right.rejectedCount > 0
        ? ` (${left.rejectedCount + right.rejectedCount} отхвърлени при валидация)`
        : '')
  )

  // ── 3. детерминистични оценки ──────────────────────────────────────────
  onProgress('Изчисляване на системните оценки', 65)
  const scoring = computeScores({
    findings: allFindings,
    questionnaire,
    imageQuality: imageQuality / 100,
    stripCoverage,
    agreement,
  })
  addLog(
    'success',
    `Оценки готови — обща ${scoring.overall}/100, тежест на ириса ${Math.round(scoring.irisWeight * 100)} %`
  )
  addLog('info', `Фокус: ${scoring.focus.join(' → ')}`)
  addLog('info', `${scoring.drivers.length} хранителни драйвера`)

  // ── 4. интерпретация ────────────────────────────────────────────────────
  onProgress('Изготвяне на плана', 75)
  if (delay > 0) await sleep(delay)

  let interpretation: InterpretationOutput | null = null
  const constitution =
    left.constitution !== 'unclear'
      ? CONSTITUTIONS[left.constitution].label
      : right.constitution !== 'unclear'
        ? CONSTITUTIONS[right.constitution].label
        : undefined

  try {
    const prompt = buildInterpretationPrompt({
      scoring,
      findings: allFindings,
      questionnaire,
      constitution,
      imageQuality,
    })
    const response = await callLLM(prompt, true, 2)
    interpretation = parseJsonResponse(response) as InterpretationOutput
    addLog('success', 'Планът е готов')
  } catch (e) {
    addLog('error', `Интерпретацията се провали: ${e instanceof Error ? e.message : String(e)}`)
  }

  onProgress('Готово', 95)

  return {
    left,
    right,
    preparation: { left: leftPrep, right: rightPrep },
    scoring,
    interpretation,
    imageQuality,
    stripCoverage,
    agreement,
    confirmedCount: left.confirmedCount + right.confirmedCount,
  }
}

/* ── стъпка 4: превод към формата на отчета ──────────────────────────────── */

import type { Artifact, IrisAnalysis, IrisZone, SystemScore } from '@/types'
import { FINDINGS, minuteToClock } from './iris-map'

/**
 * Превежда резултата към структурата `IrisAnalysis`, която очакват
 * съществуващите екрани. 12-те визуални зони се запазват, но с ОБЩИ
 * (функционални) етикети вместо органни имена.
 */
export function toIrisAnalysis(
  detection: EyeDetection,
  scoring: ScoringResult,
  interpretation: InterpretationOutput | null
): IrisAnalysis {
  const sectors = sectorsFor(detection.side)

  const noteFor = (sector: number): string | undefined =>
    interpretation?.zoneSummaries?.find(z => z.sector === sector && z.side === detection.side)?.note

  const zones: IrisZone[] = sectors.map(sec => {
    const inZone = detection.findings.filter(f => f.sector === sec.id)
    const load = inZone.reduce((s, f) => s + f.load, 0)

    const status: IrisZone['status'] = load >= 1.2 ? 'concern' : load > 0 ? 'attention' : 'normal'

    const generated =
      inZone.length > 0
        ? inZone
            .slice(0, 2)
            .map(f => `${FINDINGS[f.type].label} R${f.ring}`)
            .join('; ')
        : 'Без отчетени признаци'

    return {
      id: sec.id,
      name: sec.clock,
      // ОБЩ етикет, не орган — визуализацията остава 12-зонна.
      organ: sec.label,
      status,
      findings: (noteFor(sec.id) || generated).slice(0, 70),
      angle: [sec.minuteStart * 6, sec.minuteEnd * 6],
      minute_start: sec.minuteStart,
      minute_end: sec.minuteEnd,
    }
  })

  const artifacts: Artifact[] = detection.findings
    .slice()
    .sort((a, b) => b.load - a.load)
    .slice(0, 8)
    .map(f => ({
      type: FINDINGS[f.type].label,
      location: `сектор ${f.sector} (${minuteToClock((f.sector - 1) * 5 + 2.5)}) · R${f.ring}`,
      description: f.note || FINDINGS[f.type].meaning,
      severity: f.load >= 1.1 ? 'high' : f.load >= 0.6 ? 'medium' : 'low',
      minute: (f.sector - 1) * 5 + 2,
      ring: f.ring,
      clock_pos: minuteToClock((f.sector - 1) * 5 + 2.5),
    }))

  const systemScores: SystemScore[] = scoring.systems.map(s => {
    const note = interpretation?.systemNotes?.find(n => n.system === s.label)?.note
    return {
      system: s.label,
      score: s.score,
      description: (note || s.description).slice(0, 120),
    }
  })

  return {
    side: detection.side,
    zones,
    artifacts,
    overallHealth: scoring.overall,
    systemScores,
  }
}
