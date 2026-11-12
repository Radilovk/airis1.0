/**
 * iris-reading.ts — „разчитане" на една находка на човешки език.
 *
 * Детекцията и скорингът дават сух адрес: тип × сектор × пръстен × увереност.
 * Тук адресът се превежда в четири въпроса, които човек всъщност задава:
 *
 *   1. КЪДЕ е?         — око, часова позиция, зона, пояс (от зеницата навън)
 *   2. КАКВО е?        — как изглежда и какво означава в иридологията
 *   3. КОЛКО Е СИГУРНО? — потвърдено в двата прочита, в двете очи, сила на сигнала
 *   4. КАКВО ДА ПРАВЯ? — една изпълнима стъпка; плюс офталмологична бележка, ако
 *                         същият видим знак има значение и за очния лекар
 *
 * Всички текстове са формулирани като насоки за начин на живот, не като
 * диагноза. Органните съответствия (`reference`) се показват само като справка
 * от иридологичната карта — по изрично изискване зоните носят функционални имена.
 */
import type { CalibratedAnalysisPayload, FiberDensity } from '@/types'
import {
  FINDINGS,
  ringBand,
  sectorsFor,
  isRingFinding,
  systemLabel,
  type FindingType,
  type RingBandKey,
  type SystemKey,
} from './iris-map'

type Finding = CalibratedAnalysisPayload['findings'][number]

/** Какво „казва" всеки пръстенен пояс в иридологичната топография. */
export const BAND_MEANING: Record<RingBandKey, string> = {
  IPB: 'Зеничният ръб отразява вегетативния тонус — как нервната система регулира вътрешните органи.',
  STOM: 'Най-вътрешният пояс се свързва с горното храносмилане — стомах, киселинност, усвояване.',
  ANW: 'Поясът на червата и коларетата (автономния пръстен) — връзката между храносмилането и нервите.',
  ORG: 'Органната зона — тук значението идва от часовата позиция на знака.',
  LYM: 'Периферията се свързва с лимфата и кръвообращението — дренаж и имунен фон.',
  SCU: 'Най-външният ръб се свързва с кожата като орган за изчистване.',
}

/** Една изпълнима стъпка за всеки тип знак. Без лечение, без дози. */
const SUPPORT: Record<FindingType, string> = {
  fiber_defect:
    'Зона, която заслужава щадящ режим. Сравнете със собствените си усещания — ако съвпадат, започнете от нея.',
  radial_furrow: 'Редовен ритъм на хранене и сън, паузи през деня и повече фибри за редовен транзит.',
  fiber_thinning: 'Тонусът се гради бавно — движение всеки ден, пълноценен белтък и достатъчно сън.',
  collarette_deform:
    'Хранете се бавно и седнали, предпочитайте топла сготвена храна, ферментирали храни — постепенно.',
  transversal_fiber: 'Следа от преминала реакция. Достатъчно е наблюдение — без специални мерки.',
  pigment_orange: 'Стабилна кръвна захар: белтък и фибри на всяко хранене, по-малко захар и бяло брашно.',
  pigment_brown: 'По-малко натоварване за черния дроб: горчиви зеленчуци, без алкохол, по-ранна и по-лека вечеря.',
  pigment_yellow: 'Достатъчно вода през деня, по-малко сол и преработени храни.',
  pigment_diffuse: 'Повече зеленчуци и прости храни, по-малко пакетирани и преработени продукти.',
  nerve_rings: 'Нервната система има нужда от отдушник: дишане, разходка навън, лягане в един и същ час.',
  lymphatic_rosary: 'Лимфата се движи с движение: ходене, леки подскоци, вода; по-малко захар и мляко.',
  scurf_rim: 'За по-чиста кожа: движение до леко изпотяване, достатъчно вода и фибри.',
  sodium_ring: 'Движение, по-малко наситени мазнини и сол — и липиден профил при следващите изследвания.',
  pupil_flattening: 'Наблюдение; грижа за стойката, шията и паузите от екрана.',
}

/**
 * Какво означава знакът — на езика на храненето и начина на живот. Едно
 * изречение, без органни диагнози.
 */
const CLIENT_MEANING: Record<FindingType, string> = {
  fiber_defect: 'По-слабо място в тази зона — там тялото се натоварва по-лесно.',
  radial_furrow: 'Свързва се със стрес и с бавен или неравен чревен транзит.',
  fiber_thinning: 'По-нисък тонус в зоната — възстановяването след натоварване е по-бавно.',
  collarette_deform: 'Храносмилането работи неравномерно — подуване, тежест или нередовност.',
  transversal_fiber: 'Следа от отминало натоварване на зоната.',
  pigment_orange: 'Свързва се с колебания в кръвната захар — следобедни спадове и апетит за сладко.',
  pigment_brown: 'Свързва се с по-голямо натоварване на черния дроб — мазна храна, алкохол, лекарства.',
  pigment_yellow: 'Свързва се с бъбреците и водния баланс.',
  pigment_diffuse: 'Общо метаболитно натоварване — често при много преработени храни.',
  nerve_rings: 'Натрупано напрежение — тялото трудно превключва към почивка и храносмилане.',
  lymphatic_rosary: 'Бавен лимфен дренаж и склонност към възпалителен фон.',
  scurf_rim: 'Кожата поема повече от изчистването — често при малко вода и движение.',
  sodium_ring: 'Свързва се с обмяната на мазнини и минерали — добре е да знаете холестерола си.',
  pupil_flattening: 'Локална асиметрия в нервния тонус — за наблюдение.',
}

/**
 * Колко пряко знакът се управлява с хранене, диета и начин на живот (0–1).
 * Използва се за подредбата на ключовите знаци: при равна сигурност напред
 * излиза този, по който човек може да направи нещо с чинията си.
 */
const NUTRITION_RELEVANCE: Record<FindingType, number> = {
  pigment_orange: 1,
  sodium_ring: 1,
  collarette_deform: 1,
  pigment_brown: 0.95,
  lymphatic_rosary: 0.9,
  pigment_diffuse: 0.85,
  nerve_rings: 0.8,
  pigment_yellow: 0.8,
  radial_furrow: 0.75,
  fiber_defect: 0.7,
  scurf_rim: 0.6,
  fiber_thinning: 0.6,
  transversal_fiber: 0.3,
  pupil_flattening: 0.3,
}

/** Колко ключови знака на око се показват; останалите са свити. */
export const KEY_SIGNS_PER_EYE = 5

/** Видян в два независими прочита или и в двете очи. */
export function isConfirmedFinding(f: Finding): boolean {
  return (f.confirmations ?? 1) >= 2 || !!f.bilateral
}

/** Ключът на хранителната област, към която знакът сочи най-силно (тип + зона). */
export function findingAreaKey(f: Finding): SystemKey | undefined {
  const def = FINDINGS[f.type as FindingType]
  if (!def) return undefined
  const weights: Partial<Record<SystemKey, number>> = { ...def.systems }
  if (!isRingFinding(f)) {
    const sector = sectorsFor(f.side)[f.sector - 1]
    for (const [k, w] of Object.entries(sector?.systems ?? {}) as Array<[SystemKey, number]>) {
      weights[k] = (weights[k] ?? 0) + w * 0.8
    }
  }
  const top = (Object.entries(weights) as Array<[SystemKey, number]>).sort((a, b) => b[1] - a[1])[0]
  return top?.[0]
}

/** Хранителната област, към която знакът сочи — с име за клиента. */
export function findingArea(f: Finding): string | undefined {
  const key = findingAreaKey(f)
  return key ? systemLabel(key) : undefined
}

/**
 * Иридологичното име на знака — така, както е в методиките (лакуна, коларета,
 * пигментно петно, натриев пръстен…). Първото е за ясен знак, второто — за
 * по-слаб: тогава името е предпазливо („възможна“, „лека“), за да не обещава
 * повече, отколкото се вижда на снимката.
 */
const VISIBLE: Record<FindingType, [clear: string, faint: string]> = {
  collarette_deform: ['Неравна коларета', 'Леко неравна коларета'],
  pigment_orange: ['Оранжево пигментно петно', 'Оранжева пигментация'],
  pigment_brown: ['Тъмно пигментно петно', 'Тъмна пигментация'],
  pigment_yellow: ['Жълто пигментно петно', 'Жълтеникава пигментация'],
  pigment_diffuse: ['Дифузна пигментация', 'Лека дифузна пигментация'],
  fiber_defect: ['Лакуна', 'Възможна лакуна'],
  fiber_thinning: ['Разредени влакна', 'Леко разредени влакна'],
  radial_furrow: ['Радиална бразда', 'Възможна радиална бразда'],
  nerve_rings: ['Нервни пръстени', 'Слаби нервни пръстени'],
  lymphatic_rosary: ['Лимфна броеница', 'Възможна лимфна броеница'],
  scurf_rim: ['Кожен пръстен', 'Слабо изразен кожен пръстен'],
  sodium_ring: ['Натриев пръстен', 'Натриева дъга'],
  transversal_fiber: ['Трансверзала', 'Възможна трансверзала'],
  pupil_flattening: ['Сплескване на зеничния ръб', 'Леко сплескване на зеничния ръб'],
}

/** Какво представлява знакът — едно изречение, за да го разпознае човек на снимката. */
const GLOSS: Record<FindingType, string> = {
  collarette_deform: 'Коларетата е назъбената линия около зеницата; тук тя е неравна или изтеглена.',
  pigment_orange: 'Оранжево-ръждиво оцветяване върху влакната.',
  pigment_brown: 'Кафяво до тъмнокафяво петно върху влакната.',
  pigment_yellow: 'Жълтеникаво оцветяване върху влакната.',
  pigment_diffuse: 'Разлято оцветяване без ясен ръб.',
  fiber_defect: 'Затворено, по-тъмно място, в което влакната се разтварят.',
  fiber_thinning: 'По-редки и по-бледи влакна, без ясна граница.',
  radial_furrow: 'Тъмна линия, която тръгва от зеницата към края на ириса.',
  nerve_rings: 'Концентрични дъги около зеницата, наричани още стресови пръстени.',
  lymphatic_rosary: 'Верига от бледи точици близо до края на ириса.',
  scurf_rim: 'Тъмна ивица по самия край на ириса.',
  sodium_ring: 'Бял или млечен пръстен по края на ириса, наричан още холестеролов.',
  transversal_fiber: 'Влакно, което пресича останалите напряко.',
  pupil_flattening: 'Ръбът на зеницата е изправен в един участък, вместо да е кръгъл.',
}

/** Иридологичното име на знака, предпазливо при по-слаб знак. */
/** Слят модел: много радиални бразди в едно око (`collapseRadialPattern`). */
export function isRadialPattern(f: Finding): boolean {
  return f.type === 'radial_furrow' && f.spread === 'circumferential'
}

/** Пигментът около коларетата по цялата обиколка — цветът на смесения ирис. */
export function isCentralPigment(f: Finding): boolean {
  return f.type === 'pigment_diffuse' && f.spread === 'circumferential' && f.ring <= 4
}

/**
 * Знаците, които атласите четат на ниво „конституция/предразположеност", а не
 * като отделен орган: описание, значение и обяснение за клиента.
 */
function patternText(f: Finding): { title: string; meaning: string; gloss: string } | null {
  if (isRadialPattern(f)) {
    return {
      title: 'Радиални бразди в много сектори',
      meaning:
        'Много радиални бразди се четат като предразположеност на нервната система: напрежението лесно ' +
        'се отразява на съня и на храносмилането. Не сочат към отделен орган.',
      gloss: 'Тъмни линии като спици на колело, в много части на ириса.',
    }
  }
  if (isCentralPigment(f)) {
    return {
      title: 'Пигмент около коларетата',
      meaning:
        'Смесен (зелено-кафяв) тип ирис: пигментът около коларетата е част от цвета му, не петно. ' +
        'В школата на Deck този тип се свързва с натоварване на черния дроб и жлъчката.',
      gloss: 'Оранжево-кафяв пръстен около зеницата, по цялата обиколка.',
    }
  }
  return null
}

export function visibleLabel(f: Finding): string {
  const pattern = patternText(f)
  if (pattern) return pattern.title
  const pair = VISIBLE[f.type as FindingType]
  if (!pair) return f.label
  return signalStrength(f.confidence) === 'clear' ? pair[0] : pair[1]
}

const DIR8 = ['горе', 'горе вдясно', 'вдясно', 'долу вдясно', 'долу', 'долу вляво', 'вляво', 'горе вляво']
const DIR4 = ['горе', 'вдясно', 'долу', 'вляво']

/**
 * Къде е знакът — както изглежда на снимката, без часове и имена на пояси.
 * При по-слаб знак посоката е само в четири части: точността не бива да
 * надхвърля сигурността.
 */
export function plainLocation(f: Finding): string {
  const band = ringBand(f.ring)
  const depth =
    band.key === 'IPB' || band.key === 'STOM' || band.key === 'ANW'
      ? 'около зеницата'
      : band.key === 'ORG'
        ? 'в средата на ириса'
        : 'по края'
  if (f.sectors?.length) {
    return f.sectors.length >= 10 ? 'почти по цялата обиколка' : `в ${f.sectors.length} от 12-те сектора`
  }
  if (isRingFinding(f)) return `${depth}, по цялата обиколка`
  // Секторът покрива минути (id−1)·5 … id·5 по часовника на снимката.
  const hour = (f.sector - 0.5) % 12
  const clear = signalStrength(f.confidence) === 'clear'
  const dir = clear ? DIR8[Math.round(hour / 1.5) % 8] : DIR4[Math.round(hour / 3) % 4]
  return depth === 'около зеницата' ? `${depth}, ${dir}` : `${dir}, ${depth}`
}

/** Тежест за подредба: сигурност × значение за храненето. */
export function keySignWeight(f: Finding): number {
  const type = f.type as FindingType
  const rel = NUTRITION_RELEVANCE[type] ?? 0.5
  // Сигурността тежи повече от темата: потвърден знак изпреварва непотвърден
  // с малко по-голямо значение за храненето.
  const sure = ((f.confirmations ?? 1) >= 2 ? 1.6 : 1) * (f.bilateral ? 1.25 : 1)
  return f.confidence * sure * rel * (FINDINGS[type]?.weight ?? 0.5)
}

/**
 * Ключовите знаци за едно око: само ясно видимите, подредени по сигурност и
 * значение за храненето. `key` — до `KEY_SIGNS_PER_EYE`, `more` — останалите.
 */
export function rankKeySigns(findings: Finding[]): { key: Finding[]; more: Finding[] } {
  const ranked = findings.slice().sort((a, b) => keySignWeight(b) - keySignWeight(a))
  return { key: ranked.slice(0, KEY_SIGNS_PER_EYE), more: ranked.slice(KEY_SIGNS_PER_EYE) }
}

/** Кога същият видим знак е важен и за офталмолога. */
const OPHTHALMIC_NOTE: Partial<Record<FindingType, string>> = {
  sodium_ring:
    'Офталмологично същият бял пръстен по ръба се нарича arcus. Под 50 г. си струва липиден профил и очен преглед.',
  pigment_brown:
    'Ясно очертано тъмно петно върху ириса в офталмологията се нарича невус — почти винаги безобидно, но се следи.',
  pupil_flattening:
    'Ако зеницата е видимо некръгла и с просто око, покажете я на очен лекар.',
}

export type SignalStrength = 'clear' | 'moderate' | 'faint'

export interface FindingReading {
  title: string
  sideLabel: string
  /** Кратък адрес: „Десен ирис · 4–5 ч · Органна зона". */
  where: string
  /** Функционалното име на зоната. */
  zone?: string
  /** Органните съответствия от иридологичната карта — само за справка. */
  mapReference?: string
  /** Как изглежда знакът. */
  appearance: string
  /** Какво означава — на езика на храненето. */
  meaning: string
  /** Хранителната област, към която сочи. */
  area?: string
  /** Какво представлява знакът — едно изречение. */
  gloss?: string
  /** Какво означава поясът. */
  bandMeaning: string
  support: string
  ophthalmicNote?: string
  strength: SignalStrength
  strengthLabel: string
  /** Чипове за надеждност. */
  reliability: string[]
  circumferential: boolean
}

export function signalStrength(confidence: number): SignalStrength {
  if (confidence >= 0.75) return 'clear'
  if (confidence >= 0.6) return 'moderate'
  return 'faint'
}

const STRENGTH_LABEL: Record<SignalStrength, string> = {
  clear: 'вижда се ясно',
  moderate: 'вижда се слабо',
  faint: 'едва се вижда',
}

function cleanAppearance(text: string): string {
  // Описанията в речника са писани за модела (за разгънатата лента) — с главни
  // букви и препратки към код. За човек се оставя само първото изречение.
  const first = text.split(/;|—/)[0].trim()
  const lower = first.toLowerCase().replace(/`[^`]*`/g, '').replace(/\s+/g, ' ').trim()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function readFinding(f: Finding): FindingReading {
  const type = f.type as FindingType
  const def = FINDINGS[type]
  const band = ringBand(f.ring)
  const circumferential = isRingFinding(f)
  const sector = circumferential ? undefined : sectorsFor(f.side)[f.sector - 1]
  const sideLabel = f.side === 'left' ? 'Ляв ирис' : 'Десен ирис'
  // Секторът носи смисъл само в органната зона; във вътрешните пояси и по
  // ръба значението идва от самия пояс и името на сектора само обърква.
  const zone = band.key === 'ORG' ? sector?.label : undefined


  const strength = signalStrength(f.confidence)
  const reliability: string[] = [STRENGTH_LABEL[strength]]
  if ((f.confirmations ?? 1) >= 2) reliability.push('потвърден при повторен прочит')
  if (f.bilateral) reliability.push('и в двете очи')
  if (f.alsoLabels?.length) reliability.push(`на същото място: ${f.alsoLabels.join(', ').toLowerCase()}`)

  return {
    title: visibleLabel(f),
    sideLabel,
    where: `${f.side === 'left' ? 'Ляво око' : 'Дясно око'} · ${plainLocation(f)}`,
    zone,
    mapReference: sector?.reference,
    appearance: def ? cleanAppearance(def.appearanceUnwrapped) : '',
    meaning: patternText(f)?.meaning ?? CLIENT_MEANING[type] ?? def?.meaning ?? '',
    area: findingArea(f),
    gloss: patternText(f)?.gloss ?? GLOSS[type],
    bandMeaning: BAND_MEANING[band.key],
    support: SUPPORT[type] ?? 'Наблюдение и общ здравословен режим.',
    ophthalmicNote: OPHTHALMIC_NOTE[type],
    strength,
    strengthLabel: STRENGTH_LABEL[strength],
    reliability,
    circumferential,
  }
}

/* ── конституция и плътност ─────────────────────────────────────────────── */

export interface ConstitutionReading {
  title: string
  body: string
  support: string
}

const CONSTITUTION_READING: Record<string, ConstitutionReading> = {
  lymphatic: {
    title: 'Лимфатичен тип — син или сив ирис',
    body:
      'Иридологията свързва светлия ирис с по-реактивна лимфна система и лигавици — по-лесно ' +
      'се трупа застой, по-чести са хремите и чувствителността към млечни храни.',
    support: 'Движение всеки ден, достатъчно вода, по-малко захар и мляко.',
  },
  hematogenic: {
    title: 'Хематогенен тип — кафяв ирис',
    body:
      'Кафявият ирис се свързва с кръвта и жлезите — по-често натоварване на черния дроб и ' +
      'на минералния баланс.',
    support: 'Зеленчуци и горчиви храни, достатъчно течности, умерено с алкохола и пърженото.',
  },
  mixed: {
    title: 'Смесен (билиарен) тип — зелено-кафяв ирис',
    body:
      'Кафяв пигмент върху светла основа. Свързва се с храносмилането и жлъчката — тежката и ' +
      'мазна храна се усеща повече.',
    support: 'Редовно хранене, горчиви зеленчуци, по-малко пържено и тежко вечер.',
  },
}

const DENSITY_READING: Record<Exclude<FiberDensity, 'unclear'>, { label: string; body: string }> = {
  dense: {
    label: 'Плътни влакна',
    body: 'Силна конституционна основа — тялото се възстановява бързо, ако му дадете шанс.',
  },
  medium: {
    label: 'Средна плътност',
    body: 'Добра основа. Важно е натоварванията да не се трупат без почивка.',
  },
  loose: {
    label: 'Рехави влакна',
    body: 'По-чувствителна конституция — ритъмът, сънят и почивката тежат повече от всяка добавка.',
  },
}

/** Ключът на конституцията от етикета или ключа, запазен в отчета. */
export function constitutionKey(value?: string): 'lymphatic' | 'hematogenic' | 'mixed' | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.startsWith('lymph') || v.includes('лимф')) return 'lymphatic'
  if (v.startsWith('hemat') || v.includes('хемат')) return 'hematogenic'
  if (v.startsWith('mixed') || v.includes('смес')) return 'mixed'
  return null
}

export function readConstitution(value?: string): ConstitutionReading | null {
  const key = constitutionKey(value)
  return key ? CONSTITUTION_READING[key] : null
}

export function readDensity(density?: { left?: FiberDensity; right?: FiberDensity }) {
  const pick = [density?.left, density?.right].filter(
    (d): d is Exclude<FiberDensity, 'unclear'> => !!d && d !== 'unclear'
  )
  if (pick.length === 0) return null
  // По-рехавото око определя — веригата е силна колкото най-слабото звено.
  const order: Array<Exclude<FiberDensity, 'unclear'>> = ['loose', 'medium', 'dense']
  const worst = order.find(o => pick.includes(o))!
  return { key: worst, ...DENSITY_READING[worst] }
}
