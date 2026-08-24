import type { QuestionConfig } from '@/types'

/**
 * Въпросник v3 — decision tree с gate въпроси и автоматично разклоняване.
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

  // ── Здраве (gate или автоматично) ──
  {
    id: 'healthGate',
    type: 'radio',
    question: 'Имате ли диагностицирано състояние, бременност или приемате лекарства?',
    description: 'При здрав профил може да пропуснете следващите здравни въпроси',
    required: true,
    options: [
      { value: 'yes', label: 'Да, има нещо за споделяне' },
      { value: 'no', label: 'Не, здрав съм / няма нищо специално' },
    ],
  },
  {
    id: 'healthStatus',
    type: 'checkbox',
    question: 'Кои от следните състояния имате?',
    description: 'Списъкът е адаптиран според пол, възраст и тегло',
    required: false,
    allowOther: true,
    options: [
      { value: 'Затлъстяване', label: 'Затлъстяване' },
      { value: 'Инсулинова резистентност', label: 'Инсулинова резистентност' },
      { value: 'Диабет 2 тип', label: 'Диабет тип 2' },
      { value: 'Автоимунен тиреоидит', label: 'Автоимунен тиреоидит' },
      { value: 'Рефлуксна болест', label: 'Рефлукс' },
      { value: 'Хипертония', label: 'Високо кръвно' },
      { value: 'Менопауза', label: 'Менопауза' },
      { value: 'Бременност', label: 'Бременност' },
      { value: 'Кърмене', label: 'Кърмене / лактация' },
    ],
  },
  {
    id: 'complaints',
    type: 'textarea',
    question: 'Оплаквания, диагнози или семейна обремененост',
    description: 'По избор — помага за по-точен план',
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
    description: 'Показва се при недостатъчен сън или ако сте посочили сън като цел',
    required: true,
    options: [
      { value: 'poor', label: 'Лош' },
      { value: 'fair', label: 'Среден' },
      { value: 'good', label: 'Добър' },
      { value: 'excellent', label: 'Отличен' },
    ],
  },
  {
    id: 'hydration',
    type: 'slider',
    question: 'Колко чаши вода пиете на ден?',
    description: 'Една чаша ≈ 250 ml',
    required: true,
    validation: { min: 0, max: 15 },
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
