import type { QuestionConfig } from '@/types'

export const defaultQuestions: QuestionConfig[] = [
  {
    id: 'name',
    type: 'text',
    question: 'Как се казвате?',
    description: 'Въведете вашето име',
    required: true,
    validation: {
      min: 2
    }
  },
  {
    id: 'age',
    type: 'number',
    question: 'Колко години сте?',
    description: 'Въведете вашата възраст',
    required: true,
    validation: {
      min: 1,
      max: 120
    }
  },
  {
    id: 'gender',
    type: 'radio',
    question: 'Пол',
    required: true,
    options: [
      { value: 'male', label: 'Мъж' },
      { value: 'female', label: 'Жена' },
      { value: 'other', label: 'Друго' }
    ]
  },
  {
    id: 'weight',
    type: 'number',
    question: 'Колко е теглото ви?',
    description: 'В килограми (кг)',
    required: true,
    validation: {
      min: 20,
      max: 300
    }
  },
  {
    id: 'height',
    type: 'number',
    question: 'Колко е ръстът ви?',
    description: 'В сантиметри (см)',
    required: true,
    validation: {
      min: 50,
      max: 250
    }
  },
  {
    id: 'goals',
    type: 'checkbox',
    question: 'Каква е основната ви цел?',
    description: 'Изберете една или повече цели',
    required: true,
    allowOther: true,
    options: [
      { value: 'Отслабване', label: 'Отслабване' },
      { value: 'Подобряване на здравето', label: 'Подобряване на здравето' },
      { value: 'Антиейджинг', label: 'Антиейджинг' },
      { value: 'Укрепване на мускулите', label: 'Укрепване на мускулите' },
      { value: 'Емоционален баланс', label: 'Емоционален баланс' },
      { value: 'Увеличаване на енергията', label: 'Увеличаване на енергията' },
      { value: 'Подобряване на съня', label: 'Подобряване на съня' }
    ]
  },
  {
    id: 'healthStatus',
    type: 'checkbox',
    question: 'Здравен статус',
    description: 'Изберете всички, които се отнасят за вас',
    required: false,
    allowOther: true,
    options: [
      { value: 'Затлъстяване', label: 'Затлъстяване' },
      { value: 'Инсулинова резистентност', label: 'Инсулинова резистентност' },
      { value: 'Диабет 2 тип', label: 'Диабет 2 тип' },
      { value: 'Автоимунен тиреоидит', label: 'Автоимунен тиреоидит' },
      { value: 'Рефлуксна болест', label: 'Рефлуксна болест' },
      { value: 'Хипертония', label: 'Хипертония' },
      { value: 'Менопауза', label: 'Менопауза' },
      { value: 'Бременност', label: 'Бременност' }
    ]
  },
  {
    id: 'complaints',
    type: 'textarea',
    question: 'Текущи оплаквания',
    description: 'Опишете какви симптоми или оплаквания имате в момента',
    required: false
  },
  {
    id: 'medicalConditions',
    type: 'textarea',
    question: 'Медицински състояния',
    description: 'Споделете информация за хронични заболявания или медицински състояния',
    required: false
  },
  {
    id: 'familyHistory',
    type: 'textarea',
    question: 'Фамилна обремененост',
    description: 'Например: сърдечни заболявания, диабет в семейството',
    required: false
  },
  {
    id: 'activityLevel',
    type: 'radio',
    question: 'Ниво на физическа активност',
    description: 'Изберете нивото, което най-добре ви описва',
    required: true,
    options: [
      { value: 'sedentary', label: 'Заседнал (без физическа активност)' },
      { value: 'light', label: 'Лека активност (1-2 пъти седмично)' },
      { value: 'moderate', label: 'Умерена активност (3-4 пъти седмично)' },
      { value: 'active', label: 'Активен (5-6 пъти седмично)' },
      { value: 'very-active', label: 'Много активен (ежедневно интензивно)' }
    ]
  },
  {
    id: 'stressLevel',
    type: 'radio',
    question: 'Ниво на стрес',
    description: 'Как бихте оценили вашето ежедневно ниво на стрес?',
    required: true,
    options: [
      { value: 'low', label: 'Нисък' },
      { value: 'moderate', label: 'Умерен' },
      { value: 'high', label: 'Висок' },
      { value: 'very-high', label: 'Много висок' }
    ]
  },
  {
    id: 'sleepHours',
    type: 'slider',
    question: 'Колко часа спите на нощ?',
    description: 'Средно на нощ',
    required: true,
    validation: {
      min: 3,
      max: 12
    }
  },
  {
    id: 'sleepQuality',
    type: 'radio',
    question: 'Качество на съня',
    description: 'Как бихте оценили качеството на вашия сън?',
    required: true,
    options: [
      { value: 'poor', label: 'Лошо' },
      { value: 'fair', label: 'Средно' },
      { value: 'good', label: 'Добро' },
      { value: 'excellent', label: 'Отлично' }
    ]
  },
  {
    id: 'hydration',
    type: 'slider',
    question: 'Колко чаши вода пиете дневно?',
    description: 'Чаши вода (около 250мл)',
    required: true,
    validation: {
      min: 0,
      max: 15
    }
  },
  {
    id: 'dietaryProfile',
    type: 'checkbox',
    question: 'Хранителен режим',
    description: 'Изберете вашия хранителен режим',
    required: false,
    allowOther: true,
    options: [
      { value: 'Вегетариански', label: 'Вегетариански' },
      { value: 'Веган', label: 'Веган' },
      { value: 'Интермитентен фастинг', label: 'Интермитентен фастинг' },
      { value: 'Кето', label: 'Кето' },
      { value: 'Средиземноморска', label: 'Средиземноморска' },
      { value: 'Безглутенова', label: 'Безглутенова' }
    ]
  },
  {
    id: 'dietaryHabits',
    type: 'checkbox',
    question: 'Хранителни навици',
    description: 'Изберете навиците, които имате',
    required: false,
    options: [
      { value: 'Бърза храна', label: 'Бърза храна' },
      { value: 'Сладки храни', label: 'Сладки храни' },
      { value: 'Алкохол', label: 'Алкохол' },
      { value: 'Нередовност', label: 'Нередовно хранене' },
      { value: 'Прескачане на закуска', label: 'Прескачане на закуска' },
      { value: 'Късно хранене', label: 'Късно хранене' }
    ]
  },
  {
    id: 'foodIntolerances',
    type: 'textarea',
    question: 'Хранителна непоносимост',
    description: 'Например: лактоза, глутен',
    required: false
  },
  {
    id: 'allergies',
    type: 'textarea',
    question: 'Алергии',
    description: 'Например: ядки, морски дарове, пчелни продукти',
    required: false
  },
  {
    id: 'medications',
    type: 'textarea',
    question: 'Прием на медикаменти и хранителни добавки',
    description: 'Включете и безрецептурни лекарства, витамини, минерали',
    required: false
  },
  {
    id: 'documents',
    type: 'file',
    question: 'Медицински документи (опционално)',
    description: 'Качете снимки или документи на лабораторни тестове, анамнези и други изследвания',
    required: false
  }
]
