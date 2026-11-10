import type { QuestionConfig } from '@/types'

/**
 * Въпросник v4 — адаптивен: всеки следващ въпрос зависи от предишните отговори.
 * Логиката е в questionnaire-logic.ts; редът тук определя flow-а.
 */
export const defaultQuestions: QuestionConfig[] = [
  // ── Профил ──
  {
    id: 'name',
    type: 'text',
    question: 'Как се казвате?',
    required: true,
    validation: { min: 2 },
  },
  {
    id: 'age',
    type: 'number',
    question: 'На колко години сте?',
    required: true,
    validation: { min: 1, max: 120 },
  },
  {
    id: 'gender',
    type: 'radio',
    question: 'Пол',
    required: true,
    options: [
      { value: 'male', label: 'Мъж' },
      { value: 'female', label: 'Жена' },
      { value: 'other', label: 'Предпочитам да не казвам' },
    ],
  },
  {
    id: 'weight',
    type: 'number',
    question: 'Тегло (кг)',
    required: true,
    validation: { min: 20, max: 300 },
  },
  {
    id: 'height',
    type: 'number',
    question: 'Ръст (см)',
    required: true,
    validation: { min: 50, max: 250 },
  },

  // ── Цели ──
  {
    id: 'goals',
    type: 'checkbox',
    question: 'Какво искате да постигнете?',
    description: 'Показваме само цели, подходящи за вашето тегло',
    required: true,
    allowOther: true,
    options: [
      { value: 'Отслабване', label: 'Отслабване' },
      { value: 'Наддаване на тегло', label: 'Наддаване на тегло' },
      { value: 'Подобряване на здравето', label: 'По-добро здраве' },
      { value: 'Увеличаване на енергията', label: 'Повече енергия' },
      { value: 'Подобряване на съня', label: 'По-добър сън' },
      { value: 'Емоционален баланс', label: 'Емоционален баланс' },
      { value: 'Укрепване на мускулите', label: 'По-силни мускули' },
    ],
  },

  // ── Здраве ──
  // Първо реалните състояния, после усещанията. Уточняващите въпроси и
  // списъкът с усещания се определят от отговора тук — виж questionnaire-logic.ts.
  // Подредбата е по това колко често се срещат и колко зависят от храненето;
  // логиката я пренарежда според пол, възраст и тегло.
  {
    id: 'healthStatus',
    type: 'checkbox',
    question: 'Кое от това се отнася за вас?',
    description: 'Отбележете всичко установено от лекар или трайно познато. Ако нищо не се отнася — изберете последното.',
    required: true,
    allowOther: true,
    options: [
      { value: 'Автоимунно заболяване', label: 'Автоимунно заболяване (напр. Хашимото, псориазис, ревматоиден артрит)' },
      { value: 'Затлъстяване', label: 'Наднормено тегло или затлъстяване' },
      { value: 'Хипертония', label: 'Високо кръвно налягане' },
      { value: 'Висок холестерол', label: 'Висок холестерол или триглицериди' },
      { value: 'Сърдечно-съдово заболяване', label: 'Друго сърдечно-съдово заболяване' },
      { value: 'Преддиабет или инсулинова резистентност', label: 'Висока кръвна захар, преддиабет или инсулинова резистентност' },
      { value: 'Диабет 2 тип', label: 'Диабет тип 2' },
      { value: 'Храносмилателни смущения', label: 'Храносмилателни смущения (рефлукс, гастрит, раздразнено черво)' },
      { value: 'Менопауза', label: 'Менопауза или перименопауза' },
      { value: 'Възстановяване след раждане', label: 'Възстановяване след раждане' },
      { value: 'Задържане на вода', label: 'Задържане на вода, отоци' },
      { value: 'Целулит', label: 'Целулит' },
      { value: 'Хипотиреоидизъм', label: 'Намалена функция на щитовидната жлеза' },
      { value: 'Мастен черен дроб', label: 'Мастен черен дроб' },
      { value: 'Поликистозни яйчници (ПКОС)', label: 'Поликистозни яйчници (ПКОС)' },
      { value: 'Бременност', label: 'Бременност' },
      { value: 'Нищо от изброените', label: 'Нищо от изброените' },
    ],
  },
  {
    id: 'autoimmuneType',
    type: 'checkbox',
    question: 'Кое автоимунно заболяване?',
    description: 'Храненето се различава според засегнатата система',
    required: false,
    allowOther: true,
    options: [
      { value: 'Автоимунен тиреоидит (Хашимото)', label: 'Хашимото (автоимунен тиреоидит)' },
      { value: 'Псориазис', label: 'Псориазис' },
      { value: 'Ревматоиден артрит', label: 'Ревматоиден артрит' },
      { value: 'Цьолиакия', label: 'Цьолиакия' },
      { value: 'Възпалително заболяване на червата', label: 'Болест на Крон или улцерозен колит' },
    ],
  },
  {
    id: 'postpartumStage',
    type: 'radio',
    question: 'Колко време мина от раждането?',
    required: true,
    options: [
      { value: 'до 3 месеца', label: 'До 3 месеца' },
      { value: '3–6 месеца', label: '3–6 месеца' },
      { value: '6–12 месеца', label: '6–12 месеца' },
      { value: 'над година', label: 'Повече от година' },
    ],
  },
  {
    id: 'breastfeeding',
    type: 'radio',
    question: 'Кърмите ли?',
    description: 'Променя нуждите от енергия и течности и кои добавки са подходящи',
    required: true,
    options: [
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Не' },
    ],
  },
  {
    id: 'menopauseSymptoms',
    type: 'checkbox',
    question: 'Кое от това ви съпътства?',
    required: false,
    options: [
      { value: 'Горещи вълни или нощно изпотяване', label: 'Горещи вълни или нощно изпотяване' },
      { value: 'Нарушен сън', label: 'Нарушен сън' },
      { value: 'Наддаване в областта на корема', label: 'Наддаване в областта на корема' },
      { value: 'Промени в настроението', label: 'Промени в настроението' },
      { value: 'Сухота на кожата и лигавиците', label: 'Сухота на кожата и лигавиците' },
    ],
  },
  {
    id: 'symptoms',
    type: 'checkbox',
    question: 'Кое от това усещате често?',
    description: 'Списъкът е съобразен с предишните ви отговори',
    required: false,
    options: [
      { value: 'Спад на енергия следобед', label: 'Спад на енергия следобед' },
      { value: 'Силен апетит за сладко', label: 'Силен апетит за сладко' },
      { value: 'Трудно отслабване', label: 'Трудно отслабване' },
      { value: 'Трайна умора', label: 'Трайна умора' },
      { value: 'Храносмилателен дискомфорт', label: 'Дискомфорт след хранене (подуване, киселини, нередовно изхождане)' },
      { value: 'Студени крайници или подути крака', label: 'Студени ръце и крака или подути крака вечер' },
      { value: 'Зиморничавост', label: 'Зиморничавост' },
      { value: 'Ставни болки или скованост', label: 'Ставни болки или скованост' },
      { value: 'Кожни проблеми (акне, екзема, сухота)', label: 'Кожни проблеми (акне, екзема, сухота)' },
      { value: 'Чести настинки', label: 'Чести настинки' },
    ],
  },
  {
    id: 'digestiveSymptoms',
    type: 'checkbox',
    question: 'Какво точно усещате при храносмилането?',
    required: false,
    options: [
      { value: 'Подуване или газове след хранене', label: 'Подуване или газове след хранене' },
      { value: 'Запек или нередовно изхождане', label: 'Запек или нередовно изхождане' },
      { value: 'Диария или кашави изпражнения', label: 'Диария или кашави изпражнения' },
      { value: 'Киселини или връщане на киселина', label: 'Киселини или връщане на киселина' },
      { value: 'Тежест след мазна храна', label: 'Тежест след мазна храна' },
      { value: 'Болки или спазми в корема', label: 'Болки или спазми в корема' },
      { value: 'Гадене', label: 'Гадене' },
    ],
  },
  {
    id: 'circulationSymptoms',
    type: 'checkbox',
    question: 'Кое от това ви е познато?',
    required: false,
    options: [
      { value: 'Студени ръце и крака', label: 'Студени ръце и крака' },
      { value: 'Тежки или подути крака вечер', label: 'Тежки или подути крака вечер' },
      { value: 'Изтръпване на ръцете или краката', label: 'Изтръпване на ръцете или краката' },
      { value: 'Разширени вени', label: 'Разширени вени' },
      { value: 'Задух при леко натоварване', label: 'Задух при леко натоварване' },
      { value: 'Сърцебиене', label: 'Сърцебиене' },
    ],
  },
  {
    id: 'complaints',
    type: 'textarea',
    question: 'Нещо друго, което трябва да знаем?',
    description: 'По избор — други диагнози, оплаквания или заболявания в семейството',
    required: false,
  },
  {
    id: 'medications',
    type: 'textarea',
    question: 'Лекарства и добавки',
    description: 'Включете витамини и безрецептурни продукти',
    required: false,
  },

  // ── Начин на живот ──
  {
    id: 'activityLevel',
    type: 'radio',
    question: 'Колко често се движите?',
    required: true,
    options: [
      { value: 'sedentary', label: 'Почти не се движа' },
      { value: 'light', label: '1–2 пъти седмично' },
      { value: 'moderate', label: '3–4 пъти седмично' },
      { value: 'active', label: '5–6 пъти седмично' },
      { value: 'very-active', label: 'Всеки ден, интензивно' },
    ],
  },
  {
    id: 'stressLevel',
    type: 'radio',
    question: 'Колко стрес имате ежедневно?',
    required: true,
    options: [
      { value: 'low', label: 'Малко' },
      { value: 'moderate', label: 'Умерено' },
      { value: 'high', label: 'Много' },
      { value: 'very-high', label: 'Постоянно висок' },
    ],
  },
  {
    id: 'sleepHours',
    type: 'slider',
    question: 'Колко часа спите?',
    required: true,
    validation: { min: 3, max: 12 },
  },
  {
    id: 'sleepQuality',
    type: 'radio',
    question: 'Как оценявате съня си?',
    description: 'Колко отпочинали се събуждате',
    required: true,
    options: [
      { value: 'poor', label: 'Лош' },
      { value: 'fair', label: 'Среден' },
      { value: 'good', label: 'Добър' },
      { value: 'excellent', label: 'Отличен' },
    ],
  },
  {
    id: 'waterLitres',
    type: 'slider',
    question: 'Колко литра вода пиете на ден?',
    description: 'Само вода и неподсладен чай — без кафе и сокове',
    required: true,
    validation: { min: 0, max: 4 },
  },

  // ── Хранене (gate или автоматично) ──
  {
    id: 'dietGate',
    type: 'radio',
    question: 'Искате ли да добавите хранителни предпочитания или ограничения?',
    description: 'При стандартен профил може да пропуснете',
    required: true,
    options: [
      { value: 'yes', label: 'Да, имам предпочитания или ограничения' },
      { value: 'no', label: 'Не, няма специални изисквания' },
    ],
  },
  {
    id: 'dietaryProfile',
    type: 'checkbox',
    question: 'Храните се по някакъв режим?',
    required: false,
    allowOther: true,
    options: [
      { value: 'Вегетариански', label: 'Вегетариански' },
      { value: 'Веган', label: 'Веган' },
      { value: 'Интермитентен фастинг', label: 'Интермитентен глад' },
      { value: 'Кето', label: 'Кето' },
      { value: 'Средиземноморска', label: 'Средиземноморска' },
      { value: 'Безглутенова', label: 'Без глутен' },
    ],
  },
  {
    id: 'dietaryHabits',
    type: 'checkbox',
    question: 'Кои от тези навици имате?',
    required: false,
    options: [
      { value: 'Бърза храна', label: 'Често бърза храна' },
      { value: 'Сладки храни', label: 'Много сладко' },
      { value: 'Алкохол', label: 'Редовен алкохол' },
      { value: 'Нередовност', label: 'Нередовно хранене' },
      { value: 'Прескачане на закуска', label: 'Прескачам закуска' },
      { value: 'Късно хранене', label: 'Храня се късно вечер' },
    ],
  },
  {
    id: 'foodRestrictions',
    type: 'textarea',
    question: 'Алергии или непоносимост към храни',
    description: 'Например: лактоза, глутен, ядки',
    required: false,
  },

  // ── Документи (само при здрав блок) ──
  {
    id: 'documents',
    type: 'file',
    question: 'Медицински документи',
    description: 'По избор — лабораторни резултати',
    required: false,
  },
]
