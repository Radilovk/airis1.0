export const AIRIS_KNOWLEDGE = {
  irisMap: {
    zones: [
      { angle: [0, 30], hour: "12-1", organ: "Мозък", system: "Нервна" },
      { angle: [30, 60], hour: "1-2", organ: "Хипофиза", system: "Ендокринна" },
      { angle: [60, 90], hour: "2-3", organ: "Щитовидна жлеза", system: "Ендокринна" },
      { angle: [90, 120], hour: "3-4", organ: "Белодробна", system: "Респираторна" },
      { angle: [120, 150], hour: "4-5", organ: "Черен дроб", system: "Храносмилателна" },
      { angle: [150, 180], hour: "5-6", organ: "Стомах", system: "Храносмилателна" },
      { angle: [180, 210], hour: "6-7", organ: "Панкреас", system: "Храносмилателна" },
      { angle: [210, 240], hour: "7-8", organ: "Бъбреци", system: "Урогенитална" },
      { angle: [240, 270], hour: "8-9", organ: "Надбъбречни жлези", system: "Ендокринна" },
      { angle: [270, 300], hour: "9-10", organ: "Сърце", system: "Сърдечно-съдова" },
      { angle: [300, 330], hour: "10-11", organ: "Далак", system: "Имунна" },
      { angle: [330, 360], hour: "11-12", organ: "Лимфна система", system: "Имунна" }
    ],
    laterality: {
      left: "Лявата страна на тялото, емоционални аспекти",
      right: "Дясната страна на тялото, физически аспекти"
    }
  },
  
  artifacts: {
    types: [
      {
        name: "Лакуни",
        description: "Открити пространства в стромата на ириса",
        severity: ["low", "medium", "high"],
        interpretation: "Индикират слабост или недостатъчна функция в съответния орган"
      },
      {
        name: "Крипти",
        description: "Дълбоки дупки в стромата",
        severity: ["medium", "high"],
        interpretation: "Показват хронична слабост или възпалителни процеси"
      },
      {
        name: "Пигментни петна",
        description: "Цветни петна в ириса",
        severity: ["low", "medium", "high"],
        interpretation: "Могат да индикират токсични натрупвания или метаболитни проблеми"
      },
      {
        name: "Радиални линии",
        description: "Линии от зеницата навън",
        severity: ["low", "medium"],
        interpretation: "Стрес, невротоксичност или нервна слабост"
      },
      {
        name: "Концентрични пръстени",
        description: "Кръгове около зеницата",
        severity: ["low", "medium"],
        interpretation: "Спазми, стрес или проблеми с детоксикацията"
      }
    ]
  },
  
  constitutions: {
    types: [
      {
        name: "Лимфатична",
        color: "Син/Синьо-сив",
        characteristics: "Склонност към възпаления, алергии, лимфна конгестия",
        recommendations: "Детоксикация, антиоксиданти, подкрепа на имунната система"
      },
      {
        name: "Хематогенна",
        color: "Кафяв/Кехлибарен",
        characteristics: "Склонност към кръвни разстройства, анемия, проблеми с черния дроб",
        recommendations: "Желязо, B витамини, подкрепа на черния дроб"
      },
      {
        name: "Смесена",
        color: "Комбинация",
        characteristics: "Комбинирани характеристики",
        recommendations: "Индивидуален подход"
      }
    ]
  },
  
  systemAnalysis: {
    digestive: {
      zones: ["Стомах", "Черен дроб", "Панкреас", "Дебело черво"],
      findings: ["Слабост на стомашната стена", "Конгестия на черния дроб", "Възпаление"],
      recommendations: ["Пробиотици", "Ензими", "Фибри", "Хидратация"]
    },
    immune: {
      zones: ["Далак", "Лимфна система", "Щитовидна жлеза"],
      findings: ["Лимфна конгестия", "Слаб имунен отговор"],
      recommendations: ["Витамин C", "Цинк", "Ехинацея", "Почивка"]
    },
    nervous: {
      zones: ["Мозък", "Нервна система"],
      findings: ["Стрес знаци", "Радиални линии", "Нервна възбудимост"],
      recommendations: ["Магнезий", "B-комплекс", "Адаптогени", "Медитация"]
    },
    cardiovascular: {
      zones: ["Сърце", "Кръвоносни съдове"],
      findings: ["Слабост на сърдечната зона", "Циркулаторни проблеми"],
      recommendations: ["Омега-3", "CoQ10", "Упражнения", "Антиоксиданти"]
    },
    detox: {
      zones: ["Черен дроб", "Бъбреци", "Лимфна система"],
      findings: ["Токсични натрупвания", "Слаба детоксикация"],
      recommendations: ["Вода", "Зелени листни зеленчуци", "Млечен бодил", "Сауна"]
    },
    endocrine: {
      zones: ["Хипофиза", "Щитовидна жлеза", "Надбъбречни жлези"],
      findings: ["Хормонален дисбаланс", "Слабост на жлезите"],
      recommendations: ["Йод", "Селен", "Адаптогени", "Балансирано хранене"]
    }
  },
  
  analysisGuidelines: {
    normal: "Нормална плътност, цвят и структура на ириса. Няма значими находки.",
    attention: "Леки отклонения. Превантивни мерки препоръчителни.",
    concern: "Значителни находки. Необходима е консултация със специалист."
  },
  
  dietaryRecommendations: {
    antiInflammatory: ["Куркума", "Джинджифил", "Риба", "Зехтин", "Зелени листни зеленчуци"],
    detoxSupport: ["Вода", "Лимон", "Зелен чай", "Кориандър", "Цвекло"],
    immuneBoost: ["Чесън", "Мед", "Кисело мляко", "Ядки", "Ягоди"],
    digestiveHealth: ["Ферментирали храни", "Фибри", "Пробиотици", "Алое вера"],
    nerveSupport: ["Тъмна листна зеленчук", "Авокадо", "Яйца", "Бобови култури"]
  },
  
  supplementGuidelines: {
    general: ["Мултивитамини", "Витамин D", "Омега-3", "Пробиотици"],
    targeted: {
      liver: ["Млечен бодил", "Артишок", "Куркума"],
      immune: ["Витамин C", "Цинк", "Ехинацея", "Бъз"],
      nervous: ["Магнезий", "B-комплекс", "Ашваганда", "L-теанин"],
      digestive: ["Пребиотици", "Пробиотици", "Храносмилателни ензими"],
      cardiovascular: ["CoQ10", "Омега-3", "Боров марков екстракт"]
    }
  },
  
  lifestyleAdvice: {
    general: [
      "8 часа сън на нощ",
      "Редовна физическа активност (30 мин/ден)",
      "Управление на стреса (медитация, йога)",
      "Хидратация (2-3 литра вода дневно)",
      "Избягване на тютюнопушене и алкохол"
    ],
    specific: {
      stress: ["Дълбоко дишане", "Прогулки на природа", "Хоби", "Социални контакти"],
      sleep: ["Редовен режим", "Тъмна стая", "Без екрани 1 час преди сън"],
      digestion: ["Бавно хранене", "Добро дъвчене", "Редовни хранения"],
      circulation: ["Кардио упражнения", "Разтягане", "Масажи"]
    }
  }
}

export const getZoneByAngle = (angle: number) => {
  return AIRIS_KNOWLEDGE.irisMap.zones.find(
    zone => angle >= zone.angle[0] && angle < zone.angle[1]
  )
}

export const getSystemRecommendations = (systemName: string) => {
  const key = systemName.toLowerCase() as keyof typeof AIRIS_KNOWLEDGE.systemAnalysis
  return AIRIS_KNOWLEDGE.systemAnalysis[key] || null
}

export const getArtifactInfo = (artifactType: string) => {
  return AIRIS_KNOWLEDGE.artifacts.types.find(
    a => a.name.toLowerCase() === artifactType.toLowerCase()
  )
}

export const getConstitutionInfo = (color: string) => {
  return AIRIS_KNOWLEDGE.constitutions.types.find(
    c => c.color.toLowerCase().includes(color.toLowerCase())
  )
}
