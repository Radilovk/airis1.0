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
  type FindingType,
  type RingBandKey,
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
    'Зона, която заслужава щадящ режим. Сравнете със собствените си усещания — ако съвпадат, тя е първа за подкрепа.',
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
  /** Какво означава в иридологията. */
  meaning: string
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
  clear: 'ясен знак',
  moderate: 'умерен знак',
  faint: 'слаб знак',
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

  const where = [
    sideLabel,
    circumferential ? 'по цялата обиколка' : sector?.clock,
    band.label.replace(/\s*\(.*\)$/, ''),
  ]
    .filter(Boolean)
    .join(' · ')

  const strength = signalStrength(f.confidence)
  const reliability: string[] = [STRENGTH_LABEL[strength]]
  if ((f.confirmations ?? 1) >= 2) reliability.push('потвърден в 2 независими прочита')
  if (f.bilateral) reliability.push('и в двете очи')

  return {
    title: def?.label ?? f.label,
    sideLabel,
    where,
    zone: sector?.label,
    mapReference: sector?.reference,
    appearance: def ? cleanAppearance(def.appearanceUnwrapped) : '',
    meaning: def?.meaning ?? '',
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
