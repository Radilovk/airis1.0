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
  isCircumferentialFinding,
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
  pigment_brown: 'Подкрепа за черния дроб: горчиви зеленчуци, без алкохол, по-ранна и по-лека вечеря.',
  pigment_yellow: 'Достатъчно вода през деня, по-малко сол и преработени храни.',
  pigment_diffuse: 'Повече зеленчуци и прости храни, по-малко пакетирани и преработени продукти.',
  nerve_rings: 'Нервната система има нужда от отдушник: дишане, разходка навън, лягане в един и същ час.',
  lymphatic_rosary: 'Лимфата се движи с движение: ходене, леки подскоци, вода; по-малко захар и мляко.',
  scurf_rim: 'Подкрепа за кожното изчистване: движение до леко изпотяване, вода, фибри.',
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
  if (!isCircumferentialFinding(def.type)) {
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
 * Как изглежда знакът — с думи, които човек може сам да провери на снимката.
 * Първото е за ясен знак, второто — за по-слаб: колкото по-несигурен е
 * знакът, толкова по-общо е описанието, за да не обещава повече, отколкото
 * се вижда.
 */
const VISIBLE: Record<FindingType, [clear: string, faint: string]> = {
  collarette_deform: ['Неравна линия около зеницата', 'Леко неравна линия около зеницата'],
  pigment_orange: ['Оранжев пигмент', 'Оранжев оттенък'],
  pigment_brown: ['Тъмен пигмент', 'По-тъмен участък'],
  pigment_yellow: ['Жълтеникав пигмент', 'Жълтеникав оттенък'],
  pigment_diffuse: ['Дифузен пигмент', 'Неравномерен цвят'],
  fiber_defect: ['Празнина във влакната', 'По-рехав участък'],
  fiber_thinning: ['Разредени влакна', 'Леко разредени влакна'],
  radial_furrow: ['Радиална бразда', 'Радиална линия'],
  nerve_rings: ['Концентрични пръстени', 'Слаби концентрични линии'],
  lymphatic_rosary: ['Светли точки по периферията', 'Бледи точки по периферията'],
  scurf_rim: ['Тъмен периферен ръб', 'По-тъмен периферен ръб'],
  sodium_ring: ['Светъл периферен пръстен', 'Светла периферна дъга'],
  transversal_fiber: ['Напречно влакно', 'Слабо напречно влакно'],
  pupil_flattening: ['Сплескан ръб на зеницата', 'Леко неравен ръб на зеницата'],
}

/** Описание на знака, което човек може да провери на снимката. */
export function visibleLabel(f: Finding): string {
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
  if (isCircumferentialFinding(f.type as FindingType)) return `${depth}, по цялата обиколка`
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
  const circumferential = isCircumferentialFinding(type)
  const sector = circumferential ? undefined : sectorsFor(f.side)[f.sector - 1]
  const sideLabel = f.side === 'left' ? 'Ляв ирис' : 'Десен ирис'
  // Секторът носи смисъл само в органната зона; във вътрешните пояси и по
  // ръба значението идва от самия пояс и името на сектора само обърква.
  const zone = band.key === 'ORG' ? sector?.label : undefined


  const strength = signalStrength(f.confidence)
  const reliability: string[] = [STRENGTH_LABEL[strength]]
  if ((f.confirmations ?? 1) >= 2) reliability.push('потвърден при повторен прочит')
  if (f.bilateral) reliability.push('и в двете очи')

  return {
    title: visibleLabel(f),
    sideLabel,
    where: `${f.side === 'left' ? 'Ляво око' : 'Дясно око'} · ${plainLocation(f)}`,
    zone,
    mapReference: sector?.reference,
    appearance: def ? cleanAppearance(def.appearanceUnwrapped) : '',
    meaning: CLIENT_MEANING[type] ?? def?.meaning ?? '',
    area: findingArea(f),
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
