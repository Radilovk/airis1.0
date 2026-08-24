/**
 * safety-profile.ts — физиологичните огради на плана.
 *
 * ЗАЩО СЪЩЕСТВУВА
 * ───────────────
 * Одит по персони показа, че двигателят раздаваше съвети без никаква проверка
 * за противопоказания. Конкретни примери, всеки от които е реален профил от
 * собствения въпросник на приложението:
 *
 *   • „Автоимунен тиреоидит" е опция в здравния статус. Правилото
 *     `thyroid_minerals` препоръчва ЙОД (морска риба, водорасли) — при
 *     автоимунен тиреоидит излишъкът от йод може да влоши състоянието.
 *   • „Хипертония" е опция. Правилото `adrenal_load` казва „сол не се
 *     ограничава излишно".
 *   • `sodium_potassium` препоръчва повече калий — противопоказано при
 *     бъбречно заболяване и при АСЕ-инхибитори / калий-съхраняващи диуретици.
 *   • `protein_floor` дава 1.2–1.6 г белтък/кг — не бива при бъбречно
 *     заболяване без лекарски контрол.
 *   • `meal_rhythm` изисква „3 хранения без междинни хапвания" — неподходящо
 *     при бременност, при инсулин/сулфонилурейни, при поднормено тегло и при
 *     непълнолетни.
 *   • „Бременност" изобщо не се разпознаваше: бременна получаваше 100/100 по
 *     всички системи и празен план.
 *
 * Тук профилът се извлича веднъж и всяко правило се проверява срещу него.
 * Принципът е консервативен: при съмнение съветът се СМЕКЧАВА или ОТПАДА,
 * а на потребителя се показва защо.
 *
 * ВАЖНО: това не прави приложението медицински безопасно. То прави съветите
 * по-малко вероятно вредни и препраща към лекар там, където е нужно.
 */

import type { QuestionnaireData } from '@/types'

export interface SafetyProfile {
  /** Бременност — най-силната ограда. */
  pregnancy: boolean
  breastfeeding: boolean
  /** Под 18 г. */
  minor: boolean
  /** ИТМ < 18.5 */
  underweight: boolean
  /** Съобщено разстройство в храненето. */
  eatingDisorder: boolean
  kidneyDisease: boolean
  liverDisease: boolean
  /** Автоимунен тиреоидит / Хашимото — йодът е противопоказан. */
  autoimmuneThyroid: boolean
  hypertension: boolean
  /** Диабет ИЛИ инсулинова резистентност. */
  diabetes: boolean
  /** Медикаменти, при които пропускането на хранене носи риск от хипогликемия. */
  glucoseLoweringMeds: boolean
  /** АСЕ-инхибитори / сартани / калий-съхраняващи диуретици. */
  potassiumSensitiveMeds: boolean
  /** Възпалително чревно заболяване или активно раздразнение. */
  bowelInflammation: boolean
  histamineIntolerance: boolean
  vegan: boolean
  vegetarian: boolean
  glutenFree: boolean
  lactoseIntolerant: boolean

  /* ── животински етапи ─────────────────────────────────────────────────── */
  /** 65 г. и нагоре — нуждата от белтък е ПО-ВИСОКА, не по-ниска. */
  senior: boolean
  /** Пери-/постменопауза — костна маса и променен енергиен обмен. */
  menopause: boolean
  /** Поликистозни яйчници — инсулинова чувствителност е водеща тема. */
  pcos: boolean
  /** Редовно интензивно натоварване — нуждите са над общите. */
  athlete: boolean

  /* ── лекарствени взаимодействия с храна ───────────────────────────────── */
  /** Варфарин / синтром — витамин K трябва да е ПОСТОЯНЕН, не избягван. */
  warfarin: boolean
  /** Левотироксин — калций и желязо се отделят на 4 часа от приема. */
  levothyroxine: boolean
  /** Метформин — дългосрочно изчерпва B12. */
  metformin: boolean
  /** Инхибитори на протонната помпа — дългосрочно B12 и магнезий. */
  ppi: boolean

  /* ── състояния, които променят менюто ─────────────────────────────────── */
  /** Подагра / висока пикочна киселина. */
  gout: boolean
  /** Синдром на раздразнено черво — различно от възпалително заболяване. */
  ibs: boolean
  /** Цьолиакия — глутенът е забрана, не предпочитание. */
  celiac: boolean
  /** Желязодефицитна анемия. */
  anemia: boolean
  /** Остеопороза / остеопения. */
  osteoporosis: boolean

  /** Има ли изобщо някакво състояние, изискващо предпазливост. */
  anyCaution: boolean
}

export interface SafetyNotice {
  level: 'critical' | 'caution'
  title: string
  body: string
}

/* ── помощни ─────────────────────────────────────────────────────────────── */

/** Търси подниз в списък от избори (case-insensitive). */
function inList(list: string[] | undefined, ...needles: string[]): boolean {
  if (!list || list.length === 0) return false
  const joined = list.join(' ').toLowerCase()
  return needles.some(n => joined.includes(n.toLowerCase()))
}

/**
 * Търси подниз в СВОБОДЕН ТЕКСТ. Приема няколко полета наведнъж, защото
 * потребителите пишат едно и също нещо на различни места — „бременна съм"
 * може да е в оплакванията, в медицинските състояния или никъде.
 */
function inText(needles: string[], ...fields: Array<string | undefined>): boolean {
  const joined = fields.filter(Boolean).join(' ').toLowerCase()
  if (!joined) return false
  return needles.some(n => joined.includes(n.toLowerCase()))
}

/* ── извличане ───────────────────────────────────────────────────────────── */

export function buildSafetyProfile(q: QuestionnaireData): SafetyProfile {
  const free = [q.medicalConditions, q.complaints, q.healthStatus?.join(' '), q.medications]
  const meds = (q.medications || '').toLowerCase()

  const heightM = (q.height || 170) / 100
  const bmi = (q.weight || 70) / (heightM * heightM)

  const pregnancy =
    inList(q.healthStatus, 'бременност') || inText(['бременн', 'бременост'], ...free)

  const breastfeeding =
    inList(q.healthStatus, 'кърмен', 'лактаци') || inText(['кърм', 'лактаци'], ...free)

  const minor = (q.age ?? 30) < 18

  const eatingDisorder = inText(
    ['анорекси', 'булими', 'разстройство в храненето', 'хранително разстройство', 'преяждан'],
    ...free
  )

  const kidneyDisease = inText(
    ['бъбречн', 'бъбрек', 'нефро', 'хбн', 'креатинин', 'диализ'],
    ...free
  )

  const liverDisease = inText(
    ['чернодроб', 'черен дроб', 'хепатит', 'стеатоз', 'цироз'],
    ...free
  )

  const autoimmuneThyroid =
    inList(q.healthStatus, 'автоимунен тиреоидит') ||
    inText(['хашимото', 'тиреоидит', 'автоимунен тиреоид'], ...free)

  const hypertension =
    inList(q.healthStatus, 'хипертония') ||
    inText(['хипертон', 'високо кръвно', 'високо налягане'], ...free)

  const diabetes =
    inList(q.healthStatus, 'диабет', 'инсулинова резистентност') ||
    inText(['диабет', 'инсулинова резистентност', 'преддиабет', 'hba1c'], ...free)

  // Медикаменти, при които пропуснато хранене носи риск от хипогликемия.
  const glucoseLoweringMeds = inText(
    ['инсулин', 'глимепирид', 'гликлазид', 'сулфонилур', 'новонорм', 'репаглинид'],
    meds
  )

  const potassiumSensitiveMeds = inText(
    [
      'периндоприл', 'еналаприл', 'рамиприл', 'лизиноприл', 'каптоприл',
      'лозартан', 'валсартан', 'кандесартан', 'телмисартан',
      'спиронолактон', 'еплеренон', 'верошпирон',
      'ace', 'арб', 'сартан',
    ],
    meds
  )

  const bowelInflammation = inText(
    ['улцерозен', 'улцерозна', 'крон', 'колит', 'ибд', 'ibd', 'дивертикул'],
    ...free
  )

  const histamineIntolerance = inText(
    ['хистамин', 'сибо', 'sibo'],
    q.foodIntolerances,
    q.allergies,
    ...free
  )

  // ── животински етапи ───────────────────────────────────────────────────
  const senior = (q.age ?? 30) >= 65

  const menopause =
    inList(q.healthStatus, 'менопауз') || inText(['менопауз', 'климактер'], ...free)

  const pcos =
    inList(q.healthStatus, 'пкос', 'поликистоз') ||
    inText(['пкос', 'поликистоз', 'pcos'], ...free)

  const athlete =
    q.activityLevel === 'very-active' ||
    inText(['спортист', 'тренирам', 'културизъм', 'фитнес', 'маратон', 'състезател'], ...free)

  // ── лекарствени взаимодействия ─────────────────────────────────────────
  // Търсенето е и по молекула, и по търговско име, защото потребителят пише
  // това, което е на кутията.
  const warfarin = inText(
    ['варфарин', 'warfarin', 'синтром', 'sintrom', 'аценокумарол', 'мареван'],
    meds
  )

  const levothyroxine = inText(
    ['левотироксин', 'levothyroxine', 'еутирокс', 'euthyrox', 'l-тироксин', 'letrox', 'летрокс'],
    meds
  )

  const metformin = inText(['метформин', 'metformin', 'сиофор', 'glucophage', 'глюкофаж'], meds)

  const ppi = inText(
    ['омепразол', 'пантопразол', 'езомепразол', 'лансопразол', 'нексиум', 'controloc',
     'контролок', 'ланзул', 'омез', 'протонна помпа'],
    meds
  )

  // ── състояния ──────────────────────────────────────────────────────────
  const gout = inText(['подагра', 'пикочна киселина', 'урат', 'gout'], ...free)

  const celiac = inText(['цьолиак', 'целиак', 'глутенова ентеропати'], ...free, q.foodIntolerances)

  // ИБС (раздразнено черво) е различно от ИБД (възпалително заболяване).
  // Смесването им дава грешен съвет: при ИБС елиминацията е временна и
  // структурирана, при ИБД режимът се води от гастроентеролог.
  const ibs =
    inText(['раздразнено черво', 'синдром на раздразнен', 'ибс', 'ibs', 'fodmap', 'фодмап'], ...free) &&
    !bowelInflammation

  const anemia = inText(['анеми', 'нисък хемоглобин', 'феритин', 'желязодефицит'], ...free)

  const osteoporosis = inText(['остеопороз', 'остеопени', 'ниска костна плътност'], ...free)

  const vegan = inList(q.dietaryProfile, 'веган')
  const vegetarian = vegan || inList(q.dietaryProfile, 'вегетариан')
  const glutenFree =
    inList(q.dietaryProfile, 'безглутен') || inText(['глутен', 'целиак'], q.foodIntolerances)
  const lactoseIntolerant = inText(['лактоз', 'млечн'], q.foodIntolerances)

  const profile: SafetyProfile = {
    pregnancy,
    breastfeeding,
    minor,
    underweight: bmi < 18.5,
    eatingDisorder,
    kidneyDisease,
    liverDisease,
    autoimmuneThyroid,
    hypertension,
    diabetes,
    glucoseLoweringMeds,
    potassiumSensitiveMeds,
    bowelInflammation,
    histamineIntolerance,
    vegan,
    vegetarian,
    glutenFree,
    lactoseIntolerant,
    senior,
    menopause,
    pcos,
    athlete,
    warfarin,
    levothyroxine,
    metformin,
    ppi,
    gout,
    ibs,
    celiac,
    anemia,
    osteoporosis,
    anyCaution: false,
  }

  profile.anyCaution =
    pregnancy ||
    breastfeeding ||
    minor ||
    profile.underweight ||
    eatingDisorder ||
    kidneyDisease ||
    liverDisease ||
    autoimmuneThyroid ||
    hypertension ||
    diabetes ||
    glucoseLoweringMeds ||
    potassiumSensitiveMeds ||
    bowelInflammation ||
    warfarin ||
    levothyroxine ||
    gout ||
    celiac ||
    osteoporosis

  return profile
}

/* ── съобщения към потребителя ───────────────────────────────────────────── */

/**
 * Видими предупреждения. Показват се в отчета И се подават на модела, за да не
 * може да ги пренапише. Формулировките са без диагнози и без плашене.
 */
export function safetyNotices(p: SafetyProfile): SafetyNotice[] {
  const out: SafetyNotice[] = []

  if (p.pregnancy || p.breastfeeding) {
    out.push({
      level: 'critical',
      title: p.pregnancy ? 'Бременност' : 'Кърмене',
      body:
        'Планът е в поддържащ режим: без ограничаване на калориите, без периоди на гладуване ' +
        'и без хранителни добавки по преценка. Нуждите в този период се определят от ' +
        'наблюдаващия лекар или акушерка — съгласувайте всяка промяна с тях.',
    })
  }

  if (p.minor) {
    out.push({
      level: 'critical',
      title: 'Възраст под 18 години',
      body:
        'Приложението не е разработено за деца и подрастващи. Растежът изисква различен ' +
        'подход от този при възрастни, а ограничителните режими могат да навредят. ' +
        'Показваме само общи насоки за режим; всичко останало е за разговор с педиатър.',
    })
  }

  if (p.eatingDisorder) {
    out.push({
      level: 'critical',
      title: 'Разстройство в храненето',
      body:
        'Не показваме калорийни цели, ограничения или съвети за отслабване. Работата с ' +
        'храненето при това състояние се води от специалист — потърсете такъв.',
    })
  }

  if (p.underweight) {
    out.push({
      level: 'critical',
      title: 'Тегло под нормата',
      body:
        'Планът е насочен към набавяне на достатъчно храна и хранителни вещества, ' +
        'не към ограничаване. Ако теглото пада без причина, това е повод за лекар.',
    })
  }

  if (p.kidneyDisease) {
    out.push({
      level: 'caution',
      title: 'Бъбречно състояние',
      body:
        'Пропускаме препоръките за повишен белтък и за повече калий — при бъбречно ' +
        'заболяване тези количества се определят индивидуално от лекар.',
    })
  }

  if (p.autoimmuneThyroid) {
    out.push({
      level: 'caution',
      title: 'Автоимунен тиреоидит',
      body:
        'Не препоръчваме източници на йод (водорасли, йодирана сол на воля). При ' +
        'автоимунен тиреоидит излишъкът от йод може да е неблагоприятен. Селенът и ' +
        'цинкът остават, но количествата се съгласуват с ендокринолог.',
    })
  }

  if (p.hypertension) {
    out.push({
      level: 'caution',
      title: 'Повишено кръвно налягане',
      body:
        'Съветите, свързани със солта, са в посока намаляване, не свободен прием.' +
        (p.potassiumSensitiveMeds
          ? ' Заради приеманите медикаменти пропускаме и препоръката за повече калий.'
          : ''),
    })
  }

  if (p.diabetes || p.glucoseLoweringMeds) {
    out.push({
      level: 'caution',
      title: 'Кръвна захар под медикаментозен контрол',
      body:
        p.glucoseLoweringMeds
          ? 'Не препоръчваме удължени паузи между храненията — при вашите медикаменти ' +
            'това носи риск от спад на кръвната захар. Всяка промяна в режима на хранене ' +
            'се съгласува с лекуващия лекар, защото може да наложи промяна в дозите.'
          : 'Промените в храненето могат да повлияят на кръвната захар — следете стойностите ' +
            'и ги обсъдете с лекуващия лекар.',
    })
  }

  if (p.bowelInflammation) {
    out.push({
      level: 'caution',
      title: 'Възпалително чревно състояние',
      body:
        'Не увеличаваме рязко фибрите и не препоръчваме сурови зеленчуци — при активно ' +
        'възпаление това влошава оплакванията. Режимът се води от гастроентеролог.',
    })
  }

  if (p.vegan || p.vegetarian) {
    out.push({
      level: 'caution',
      title: p.vegan ? 'Веган режим' : 'Вегетариански режим',
      body:
        'Препоръките са преформулирани с растителни източници. При веган режим ' +
        'витамин B12 се набавя само с добавка — това е единственото, което не подлежи ' +
        'на избор.',
    })
  }

  if (p.warfarin) {
    out.push({
      level: 'critical',
      title: 'Антикоагулант (варфарин / синтром)',
      body:
        'Витамин K НЕ се избягва — приемът трябва да е ПОСТОЯНЕН. Зелените листни ' +
        'зеленчуци не отпадат от менюто; важното е количеството да не се променя рязко ' +
        'от седмица на седмица, защото дозата на лекарството е нагласена спрямо него. ' +
        'Всяка съществена промяна в менюто се съобщава на лекаря, който следи INR.',
    })
  }

  if (p.levothyroxine) {
    out.push({
      level: 'caution',
      title: 'Левотироксин',
      body:
        'Калцият и желязото — от добавка или от млечни продукти — намаляват усвояването ' +
        'на лекарството. Приемът им се отделя на поне 4 часа от таблетката. Самата ' +
        'таблетка се взима сутрин на празен стомах, 30–60 минути преди първата храна.',
    })
  }

  if (p.metformin || p.ppi) {
    out.push({
      level: 'caution',
      title: p.metformin && p.ppi ? 'Метформин и лекарство за киселини' : p.metformin ? 'Метформин' : 'Лекарство за киселини',
      body:
        'Продължителният прием е свързан с по-ниски нива на витамин B12' +
        (p.metformin && p.ppi ? ', а комбинацията от двете носи по-висок риск от всяко поотделно' : '') +
        '. Това не е повод за самолечение с добавки — стойността се проверява с кръвно ' +
        'изследване и решението е на лекаря.',
    })
  }

  if (p.senior) {
    out.push({
      level: 'caution',
      title: 'Възраст над 65 г.',
      body:
        'Нуждата от белтък в тази възраст е ПО-ВИСОКА, не по-ниска — заради загубата на ' +
        'мускулна маса. Планът не съдържа ограничителни режими без лекарска преценка.',
    })
  }

  if (p.gout) {
    out.push({
      level: 'caution',
      title: 'Подагра / висока пикочна киселина',
      body:
        'Менюто избягва вътрешности, аншоа/сардина, бира и подсладени с фруктоза напитки. ' +
        'Достатъчният прием на течности е част от режима.',
    })
  }

  if (p.celiac) {
    out.push({
      level: 'critical',
      title: 'Цьолиакия',
      body:
        'Глутенът отпада напълно и пожизнено — това не е предпочитание, а лечение. ' +
        'Внимава се и за кръстосано замърсяване (общ тостер, общо олио, насипни продукти).',
    })
  }

  return out
}

/** Кратък текстов блок за промпта — моделът няма право да ги пренапише. */
export function safetyToPromptBlock(p: SafetyProfile, notices: SafetyNotice[]): string {
  if (notices.length === 0) return 'Няма установени специални състояния.'
  const lines = notices.map(n => `• [${n.level === 'critical' ? 'ЗАДЪЛЖИТЕЛНО' : 'ВНИМАНИЕ'}] ${n.title}: ${n.body}`)
  const hard: string[] = []
  if (p.pregnancy || p.breastfeeding || p.minor || p.underweight || p.eatingDisorder) {
    hard.push('ЗАБРАНЕНО: калорийни ограничения, цели за отслабване, гладуване, детокс режими.')
  }
  if (p.autoimmuneThyroid) hard.push('ЗАБРАНЕНО: йод, водорасли, йодирана сол като препоръка.')
  if (p.kidneyDisease) hard.push('ЗАБРАНЕНО: повишен белтък, повече калий, добавки без лекар.')
  if (p.hypertension) hard.push('ЗАБРАНЕНО: съвети за свободен прием на сол.')
  if (p.glucoseLoweringMeds) hard.push('ЗАБРАНЕНО: удължени паузи между храненията, пропускане на хранене.')
  if (p.bowelInflammation) hard.push('ЗАБРАНЕНО: рязко увеличаване на фибри, сурови зеленчуци, ферментирали храни на воля.')
  if (p.warfarin)
    hard.push(
      'ЗАБРАНЕНО: съвет да се ИЗБЯГВА витамин K или зелени листни зеленчуци. ' +
        'Правилното е ПОСТОЯНЕН прием. Забранено е и да се препоръчват промени, ' +
        'които рязко увеличават или намаляват зелените зеленчуци.'
    )
  if (p.celiac) hard.push('ЗАБРАНЕНО: каквато и да е форма на глутен, включително „малко" или „понякога".')
  if (p.senior) hard.push('ЗАБРАНЕНО: намаляване на белтъка; нуждата в тази възраст е по-висока.')
  if (p.gout) hard.push('ЗАБРАНЕНО: вътрешности, високопуринови риби на воля, бира, фруктозни напитки.')
  return [...lines, ...hard].join('\n')
}
