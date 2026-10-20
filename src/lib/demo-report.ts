/**
 * demo-report.ts — примерен доклад с демо данни.
 *
 * Показва се от началния екран („Виж примерен доклад"), за да види човек какво
 * ще получи, ПРЕДИ да инвестира 5–10 минути във въпросник и снимки. Снимките се
 * рисуват в браузъра (няма чужди очи в репото), а находките са подбрани така, че
 * да покажат всеки елемент на доклада — включително офталмологичния скрининг.
 *
 * Докладът носи `demo: true` и не се записва в историята.
 */
import type {
  AnalysisReport,
  CalibratedAnalysisPayload,
  IrisAnalysis,
  IrisGeometrySnapshot,
  IrisImage,
  QuestionnaireData,
} from '@/types'
import { assessEyeHealth, eyeHealthChecks } from './eye-health'
import { sectorsFor, FINDINGS, type FindingType } from './iris-map'

const SIZE = 720
const CX = SIZE / 2
const CY = SIZE / 2
const RL = 250
const RP = 78

/** Детерминистичен псевдослучаен генератор — демото изглежда еднакво всеки път. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function polar(angleDeg: number, r: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const
}

/** Рисува правдоподобно око: склера, ирис с влакна, коларета, зеница, отблясък. */
function drawEye(side: 'left' | 'right'): string {
  const c = document.createElement('canvas')
  c.width = SIZE
  c.height = SIZE
  const x = c.getContext('2d')!
  const rand = rng(side === 'left' ? 7 : 11)

  // кожа + склера
  x.fillStyle = '#d9b49a'
  x.fillRect(0, 0, SIZE, SIZE)
  const sclera = x.createRadialGradient(CX, CY, RL * 0.9, CX, CY, SIZE * 0.62)
  sclera.addColorStop(0, '#f7f3ee')
  sclera.addColorStop(1, '#e6d9cf')
  x.fillStyle = sclera
  x.beginPath()
  x.ellipse(CX, CY, SIZE * 0.6, SIZE * 0.42, 0, 0, Math.PI * 2)
  x.fill()

  // фини съдове по склерата
  x.strokeStyle = 'rgba(190,70,70,0.25)'
  x.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const a = rand() * 360
    let [px, py] = polar(a, RL + 12)
    x.beginPath()
    x.moveTo(px, py)
    for (let k = 0; k < 5; k++) {
      ;[px, py] = polar(a + (rand() - 0.5) * 12, RL + 20 + k * 18)
      x.lineTo(px, py)
    }
    x.stroke()
  }

  // ирис — основа (смесен: синкаво-зелена основа с кафяв център)
  const base = x.createRadialGradient(CX, CY, RP, CX, CY, RL)
  base.addColorStop(0, '#8a5a2b')
  base.addColorStop(0.32, '#7d6a3e')
  base.addColorStop(0.45, '#5f7d77')
  base.addColorStop(0.85, '#4f6f78')
  base.addColorStop(1, '#2f3f48')
  x.fillStyle = base
  x.beginPath()
  x.arc(CX, CY, RL, 0, Math.PI * 2)
  x.fill()

  // радиални влакна
  for (let i = 0; i < 900; i++) {
    const a = rand() * 360
    const r0 = RP + rand() * 20
    const r1 = RL * (0.75 + rand() * 0.25)
    const [x0, y0] = polar(a, r0)
    const [x1, y1] = polar(a + (rand() - 0.5) * 4, r1)
    x.strokeStyle = rand() > 0.5 ? 'rgba(220,230,225,0.10)' : 'rgba(20,30,30,0.12)'
    x.lineWidth = 0.6 + rand() * 1.2
    x.beginPath()
    x.moveTo(x0, y0)
    x.lineTo(x1, y1)
    x.stroke()
  }

  // коларета (автономен пръстен) — вълниста
  x.strokeStyle = 'rgba(210,170,110,0.55)'
  x.lineWidth = 3
  x.beginPath()
  for (let a = 0; a <= 360; a += 3) {
    const r = RL * 0.38 + Math.sin((a * Math.PI) / 18) * 5 + (side === 'right' && a > 120 && a < 160 ? 10 : 0)
    const [px, py] = polar(a, r)
    if (a === 0) x.moveTo(px, py)
    else x.lineTo(px, py)
  }
  x.closePath()
  x.stroke()

  // лакуни / дефекти във влакната
  const holes: Array<[number, number, number]> =
    side === 'right'
      ? [[135, 0.62, 16], [205, 0.55, 12]]
      : [[255, 0.6, 14]]
  for (const [a, rr, s] of holes) {
    const [px, py] = polar(a, RL * rr)
    x.fillStyle = 'rgba(18,22,26,0.55)'
    x.beginPath()
    x.ellipse(px, py, s * 0.7, s, ((a - 90) * Math.PI) / 180, 0, Math.PI * 2)
    x.fill()
  }

  // пигментно петно
  if (side === 'right') {
    const [px, py] = polar(268, RL * 0.66)
    x.fillStyle = 'rgba(176,96,28,0.85)'
    x.beginPath()
    x.arc(px, py, 10, 0, Math.PI * 2)
    x.fill()
  }

  // стресови пръстени (контракционни дъги)
  x.strokeStyle = 'rgba(15,20,24,0.35)'
  x.lineWidth = 2
  for (const rr of [0.7, 0.8]) {
    x.beginPath()
    x.arc(CX, CY, RL * rr, (-150 * Math.PI) / 180, (-30 * Math.PI) / 180)
    x.stroke()
  }

  // arcus — светла дъга по ръба горе
  x.strokeStyle = 'rgba(235,235,230,0.55)'
  x.lineWidth = 9
  x.beginPath()
  x.arc(CX, CY, RL - 7, (-160 * Math.PI) / 180, (-20 * Math.PI) / 180)
  x.stroke()

  // лимбус
  x.strokeStyle = 'rgba(20,28,32,0.85)'
  x.lineWidth = 5
  x.beginPath()
  x.arc(CX, CY, RL, 0, Math.PI * 2)
  x.stroke()

  // зеница
  x.fillStyle = '#07090b'
  x.beginPath()
  x.arc(CX, CY, RP, 0, Math.PI * 2)
  x.fill()

  // отблясък
  x.fillStyle = 'rgba(255,255,255,0.9)'
  x.beginPath()
  x.ellipse(CX + RP * 0.35, CY - RP * 0.35, 14, 10, -0.6, 0, Math.PI * 2)
  x.fill()

  return c.toDataURL('image/jpeg', 0.88)
}

function geometry(): IrisGeometrySnapshot {
  return {
    pupil: { cx: CX, cy: CY, r: RP },
    limbus: { cx: CX, cy: CY, r: RL },
    imageWidth: SIZE,
    imageHeight: SIZE,
    pupilConfidence: 0.9,
    limbusConfidence: 0.9,
    manual: true,
  }
}

type F = CalibratedAnalysisPayload['findings'][number]

function finding(
  side: 'left' | 'right',
  type: FindingType,
  sector: number,
  ring: number,
  confidence: number,
  extra: Partial<F> = {}
): F {
  return {
    side,
    type,
    label: FINDINGS[type].label,
    sector,
    ring,
    size: 'm',
    confidence,
    priorityZones: [],
    confirmations: confidence >= 0.75 ? 2 : 1,
    ...extra,
  }
}

const QUESTIONNAIRE: QuestionnaireData = {
  name: 'Мария (пример)',
  age: 44,
  gender: 'female',
  weight: 68,
  height: 166,
  goals: ['Повече енергия', 'По-добро храносмилане', 'По-спокоен сън'],
  medicalConditions: '',
  familyHistory: 'Висок холестерол (баща)',
  activityLevel: 'light',
  stressLevel: 'high',
  sleepHours: 6,
  sleepQuality: 'fair',
  hydration: 5,
  dietaryProfile: [],
  dietaryHabits: ['Сладко следобед', 'Късна вечеря'],
  foodIntolerances: '',
  allergies: '',
  medications: '',
  complaints: 'Подуване след хранене, умора следобед',
  healthStatus: [],
}

function irisAnalysis(side: 'left' | 'right', overall: number): IrisAnalysis {
  return {
    side,
    zones: sectorsFor(side).map(s => ({
      id: s.id,
      name: s.clock,
      organ: s.label,
      status: 'normal',
      findings: 'Без значими признаци в този сектор',
      angle: [s.minuteStart * 6, s.minuteEnd * 6],
    })),
    artifacts: [],
    overallHealth: overall,
    systemScores: [],
  }
}

export function buildDemoReport(): AnalysisReport {
  const geo = geometry()
  const leftImage: IrisImage = { side: 'left', dataUrl: drawEye('left'), geometry: geo }
  const rightImage: IrisImage = { side: 'right', dataUrl: drawEye('right'), geometry: geo }

  const findings: F[] = [
    finding('right', 'collarette_deform', 6, 3, 0.82, { bilateral: true }),
    finding('right', 'fiber_defect', 5, 7, 0.78),
    finding('right', 'pigment_orange', 9, 7, 0.71),
    finding('right', 'nerve_rings', 1, 8, 0.74, { bilateral: true }),
    finding('right', 'fiber_defect', 7, 6, 0.62),
    finding('right', 'sodium_ring', 1, 11, 0.7),
    finding('left', 'collarette_deform', 7, 3, 0.76, { bilateral: true }),
    finding('left', 'fiber_defect', 9, 7, 0.68),
    finding('left', 'nerve_rings', 1, 8, 0.72, { bilateral: true }),
    finding('left', 'lymphatic_rosary', 1, 10, 0.55),
  ]

  const eyeHealth = assessEyeHealth({
    photo: {
      left: { side: 'left', signs: [{ key: 'arcus', confidence: 0.72, detail: 'частична дъга' }], visibleCount: 8 },
      right: { side: 'right', signs: [{ key: 'arcus', confidence: 0.76, detail: 'частична дъга' }], visibleCount: 8 },
    },
    geometry: { left: geo, right: geo },
    findings,
    age: QUESTIONNAIRE.age,
  })

  const systems: CalibratedAnalysisPayload['systems'] = [
    { key: 'digestive', label: 'Храносмилане', score: 58, priority: true, description: 'Подуването и знаците около коларетата сочат към ритъма на храносмилането.', reasons: ['Деформирана коларета в двете очи', 'Подуване след хранене (въпросник)', 'Късна вечеря'] },
    { key: 'nervous', label: 'Нервна система', score: 61, priority: true, description: 'Висок стрес, кратък сън и стресови пръстени в двете очи.', reasons: ['Стресови пръстени — двустранно', 'Сън 6 ч, качество „средно"', 'Стрес „висок"'] },
    { key: 'metabolic', label: 'Метаболизъм', score: 66, priority: true, description: 'Следобедният спад на енергия и оранжевият пигмент насочват към стабилна кръвна захар.', reasons: ['Оранжев пигмент в зоната на кръвната захар', 'Сладко следобед'] },
    { key: 'circulatory', label: 'Кръвообращение', score: 72, priority: false, description: 'Фамилна обремененост с холестерол и светъл ръб на ириса.', reasons: ['Фамилна анамнеза', 'Светъл ръб по периферията'] },
    { key: 'detox', label: 'Детоксикация', score: 74, priority: false, description: 'Без силни знаци.', reasons: [] },
    { key: 'immune', label: 'Имунитет и лимфа', score: 78, priority: false, description: 'Лека лимфна сигнализация.', reasons: [] },
    { key: 'endocrine', label: 'Ендокринна регулация', score: 80, priority: false, description: 'Стабилно.', reasons: [] },
  ]

  const calibrated: CalibratedAnalysisPayload = {
    imageQuality: 82,
    stripCoverage: 0.88,
    irisWeight: 0.3,
    focus: ['digestive', 'nervous', 'metabolic'],
    systems,
    drivers: [
      { id: 'd1', system: 'digestive', strength: 'high', observation: 'Храносмилането има нужда от ритъм', action: 'Вечеря поне 3 часа преди сън и бавно хранене, седнали — без екран.', source: 'both' },
      { id: 'd2', system: 'nervous', strength: 'high', observation: 'Нервната система работи на висока предавка', action: 'Лягане в един и същ час и 10 минути разходка навън след обяд.', source: 'both' },
      { id: 'd3', system: 'metabolic', strength: 'medium', observation: 'Следобедният спад идва от скок на кръвната захар', action: 'Сменете сладкото следобед с ябълка и шепа ядки.', source: 'questionnaire' },
    ],
    findings,
    agreement: 0.71,
    confirmedCount: findings.filter(f => (f.confirmations ?? 1) >= 2).length,
    constitution: 'mixed',
    density: { left: 'medium', right: 'medium' },
    eyeHealth,
    notices: [],
  }

  return {
    id: 'demo-report',
    timestamp: new Date().toISOString(),
    demo: true,
    questionnaireData: QUESTIONNAIRE,
    leftIris: irisAnalysis('left', 69),
    rightIris: irisAnalysis('right', 67),
    leftIrisImage: leftImage,
    rightIrisImage: rightImage,
    recommendations: [],
    summary:
      'Основата е добра, но храносмилането и нервната система работят под напрежение. Ритъмът на хранене и сън ще даде най-бърз ефект.',
    briefSummary:
      'Започнете с храносмилането и нервната система — ритъмът на хранене и сън ще даде най-бърз ефект.',
    detailedAnalysis:
      'Основата е добра, но храносмилането и нервната система работят под напрежение. Ритъмът на хранене и сън ще даде най-бърз ефект.',
    motivationalSummary: 'Две малки промени — по-ранна вечеря и един час за лягане — често стигат за видима разлика за две седмици.',
    detailedPlan: {
      generalRecommendations: [
        'Вечеря до 19:30, лека и сготвена',
        'Белтък и зеленчуци на всяко хранене',
        'Лягане в 23:00 всяка вечер',
      ],
      recommendedFoods: ['Сготвени зеленчуци всеки ден', 'Овесени ядки на закуска', 'Риба 2 пъти седмично', 'Кисело мляко', 'Шепа ядки следобед', 'Горчиви салати (рукола, радикио)'],
      avoidFoods: ['Сладко следобед (скок на захарта)', 'Тежка късна вечеря (подуване)', 'Газирани напитки (подуване)'],
      supplements: [
        { name: 'Магнезий', dosage: 'общ ориентир 200–300 мг', timing: 'вечер', notes: 'за отпускане; съгласувайте с лекар' },
      ],
      psychologicalRecommendations: ['5 минути бавно дишане преди сън'],
      specialRecommendations: ['Първа седмица: вечеря до 19:30', 'Първа седмица: разходка след обяд'],
      recommendedTests: Array.from(new Set([...eyeHealthChecks(eyeHealth), 'Кръвна захар на гладно'])),
    },
    calibrated,
  }
}
