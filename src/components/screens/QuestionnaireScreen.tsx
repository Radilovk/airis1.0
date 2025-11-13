import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Target, 
  Activity,
  Heartbeat,
  ForkKnife,
  Pill
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { QuestionnaireData } from '@/types'

interface QuestionnaireScreenProps {
  onComplete: (data: QuestionnaireData) => void
  initialData: QuestionnaireData | null
}

const defaultData: Partial<QuestionnaireData> = {
  name: '',
  goals: [],
  dietaryProfile: [],
  dietaryHabits: [],
  complaints: '',
  medicalConditions: '',
  familyHistory: '',
  foodIntolerances: '',
  allergies: '',
  medications: '',
  activityLevel: 'moderate',
  stressLevel: 'moderate',
  sleepHours: 7,
  sleepQuality: 'good',
  hydration: 8
}

export default function QuestionnaireScreen({ onComplete, initialData }: QuestionnaireScreenProps) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<Partial<QuestionnaireData>>(initialData || defaultData)

  const healthGoals = [
    'Отслабване',
    'Общ тонус',
    'Антиейджинг',
    'Здраве',
    'Увеличаване на енергията',
    'Укрепване на имунната система',
    'Намаляване на стреса',
    'Подобряване на съня',
    'Детоксикация',
    'Подобряване на храносмилането'
  ]

  const dietaryProfiles = [
    'Вегетариански',
    'Веган',
    'Интермитентен фастинг',
    'Кето',
    'Средиземноморска',
    'Безглутенова',
    'Нисковъглехидратна',
    'Друго'
  ]

  const dietaryHabits = [
    'Бърза храна',
    'Сладки храни',
    'Алкохол',
    'Нередовност в храненето',
    'Прескачане на закуска',
    'Късно хранене',
    'Газирани напитки'
  ]

  const totalSteps = 6
  const progress = (step / totalSteps) * 100

  const handleNext = () => {
    if (step === 1) {
      if (!data.name || !data.age || !data.gender || !data.weight || !data.height) {
        toast.error('Моля, попълнете всички задължителни полета')
        return
      }
      if (data.age < 1 || data.age > 120) {
        toast.error('Моля, въведете валидна възраст')
        return
      }
      if (data.weight < 20 || data.weight > 300) {
        toast.error('Моля, въведете валидно тегло')
        return
      }
      if (data.height < 50 || data.height > 250) {
        toast.error('Моля, въведете валиден ръст')
        return
      }
    }

    if (step === 2) {
      if (!data.goals || data.goals.length === 0) {
        toast.error('Моля, изберете поне една цел')
        return
      }
    }

    if (step < totalSteps) {
      setStep(step + 1)
    } else {
      onComplete(data as QuestionnaireData)
    }
  }

  const toggleArrayItem = (array: string[] | undefined, item: string) => {
    const current = array || []
    if (current.includes(item)) {
      return current.filter(i => i !== item)
    } else {
      return [...current, item]
    }
  }

  const getStepIcon = () => {
    switch (step) {
      case 1: return <User size={24} weight="duotone" className="text-primary" />
      case 2: return <Target size={24} weight="duotone" className="text-primary" />
      case 3: return <Heartbeat size={24} weight="duotone" className="text-primary" />
      case 4: return <Activity size={24} weight="duotone" className="text-primary" />
      case 5: return <ForkKnife size={24} weight="duotone" className="text-primary" />
      case 6: return <Pill size={24} weight="duotone" className="text-primary" />
      default: return <User size={24} weight="duotone" className="text-primary" />
    }
  }

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'Лични Данни'
      case 2: return 'Цели'
      case 3: return 'Здравен Статус'
      case 4: return 'Начин на Живот'
      case 5: return 'Хранителен Профил'
      case 6: return 'Медикаменти'
      default: return 'Въпросник'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="max-w-3xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              {getStepIcon()}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{getStepTitle()}</h2>
              <p className="text-muted-foreground">Стъпка {step} от {totalSteps}</p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>

        <Card className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-semibold mb-1">Основна Информация</h3>
                  <p className="text-sm text-muted-foreground">Въведете вашите основни данни</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Име *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Вашето име"
                    value={data.name || ''}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    className="text-base"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="age">Възраст *</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="напр. 35"
                      value={data.age || ''}
                      onChange={(e) => setData({ ...data, age: parseInt(e.target.value) || 0 })}
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Пол *</Label>
                    <RadioGroup
                      value={data.gender}
                      onValueChange={(value) => setData({ ...data, gender: value as any })}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="male" />
                        <Label htmlFor="male" className="font-normal cursor-pointer">Мъж</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="female" />
                        <Label htmlFor="female" className="font-normal cursor-pointer">Жена</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="other" />
                        <Label htmlFor="other" className="font-normal cursor-pointer">Друго</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Тегло (кг) *</Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="напр. 70"
                      value={data.weight || ''}
                      onChange={(e) => setData({ ...data, weight: parseInt(e.target.value) || 0 })}
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height">Ръст (см) *</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="напр. 175"
                      value={data.height || ''}
                      onChange={(e) => setData({ ...data, height: parseInt(e.target.value) || 0 })}
                      className="text-base"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-semibold mb-1">Здравни Цели</h3>
                  <p className="text-sm text-muted-foreground">Изберете една или повече цели *</p>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {healthGoals.map((goal) => (
                    <div
                      key={goal}
                      className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        data.goals?.includes(goal)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }`}
                      onClick={() => setData({ ...data, goals: toggleArrayItem(data.goals, goal) })}
                    >
                      <Checkbox
                        checked={data.goals?.includes(goal)}
                        className="mt-0.5"
                      />
                      <Label className="font-normal cursor-pointer leading-snug flex-1">
                        {goal}
                      </Label>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-semibold mb-1">Здравен Статус</h3>
                  <p className="text-sm text-muted-foreground">Споделете информация за вашето здраве</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medicalConditions">Медицински и Здравен Статус</Label>
                  <Textarea
                    id="medicalConditions"
                    placeholder="напр. Хипертония, диабет, хормонални проблеми..."
                    value={data.medicalConditions || ''}
                    onChange={(e) => setData({ ...data, medicalConditions: e.target.value })}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="familyHistory">Фамилна Обремененост</Label>
                  <Textarea
                    id="familyHistory"
                    placeholder="напр. Сърдечни заболявания, диабет в семейството..."
                    value={data.familyHistory || ''}
                    onChange={(e) => setData({ ...data, familyHistory: e.target.value })}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="complaints">Текущи Оплаквания</Label>
                  <Textarea
                    id="complaints"
                    placeholder="напр. Често уморен, главоболие, проблеми със съня..."
                    value={data.complaints || ''}
                    onChange={(e) => setData({ ...data, complaints: e.target.value })}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-semibold mb-1">Начин на Живот</h3>
                  <p className="text-sm text-muted-foreground">Информация за вашата дневна активност</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>Ниво на Активност</Label>
                    <RadioGroup
                      value={data.activityLevel}
                      onValueChange={(value) => setData({ ...data, activityLevel: value as any })}
                      className="grid grid-cols-2 md:grid-cols-3 gap-3"
                    >
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.activityLevel === 'sedentary' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="sedentary" id="sedentary" />
                        <Label htmlFor="sedentary" className="font-normal cursor-pointer text-sm">Заседнал</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.activityLevel === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="light" id="light" />
                        <Label htmlFor="light" className="font-normal cursor-pointer text-sm">Лека</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.activityLevel === 'moderate' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="moderate" id="moderate" />
                        <Label htmlFor="moderate" className="font-normal cursor-pointer text-sm">Умерена</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.activityLevel === 'active' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="active" id="active" />
                        <Label htmlFor="active" className="font-normal cursor-pointer text-sm">Активна</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.activityLevel === 'very-active' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="very-active" id="very-active" />
                        <Label htmlFor="very-active" className="font-normal cursor-pointer text-sm">Много активна</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Ниво на Стрес</Label>
                    <RadioGroup
                      value={data.stressLevel}
                      onValueChange={(value) => setData({ ...data, stressLevel: value as any })}
                      className="grid grid-cols-2 md:grid-cols-4 gap-3"
                    >
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.stressLevel === 'low' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="low" id="low" />
                        <Label htmlFor="low" className="font-normal cursor-pointer text-sm">Нисък</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.stressLevel === 'moderate' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="moderate" id="stress-moderate" />
                        <Label htmlFor="stress-moderate" className="font-normal cursor-pointer text-sm">Умерен</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.stressLevel === 'high' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="high" id="high" />
                        <Label htmlFor="high" className="font-normal cursor-pointer text-sm">Висок</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.stressLevel === 'very-high' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="very-high" id="very-high" />
                        <Label htmlFor="very-high" className="font-normal cursor-pointer text-sm">Много висок</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sleepHours">Часове Сън на Нощ</Label>
                      <span className="text-lg font-semibold text-primary">{data.sleepHours || 7}ч</span>
                    </div>
                    <Slider
                      id="sleepHours"
                      min={3}
                      max={12}
                      step={0.5}
                      value={[data.sleepHours || 7]}
                      onValueChange={(value) => setData({ ...data, sleepHours: value[0] })}
                      className="py-4"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Качество на Съня</Label>
                    <RadioGroup
                      value={data.sleepQuality}
                      onValueChange={(value) => setData({ ...data, sleepQuality: value as any })}
                      className="grid grid-cols-2 md:grid-cols-4 gap-3"
                    >
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.sleepQuality === 'poor' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="poor" id="poor" />
                        <Label htmlFor="poor" className="font-normal cursor-pointer text-sm">Лошо</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.sleepQuality === 'fair' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="fair" id="fair" />
                        <Label htmlFor="fair" className="font-normal cursor-pointer text-sm">Средно</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.sleepQuality === 'good' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="good" id="good" />
                        <Label htmlFor="good" className="font-normal cursor-pointer text-sm">Добро</Label>
                      </div>
                      <div className={`relative flex items-center space-x-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        data.sleepQuality === 'excellent' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}>
                        <RadioGroupItem value="excellent" id="excellent" />
                        <Label htmlFor="excellent" className="font-normal cursor-pointer text-sm">Отлично</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hydration">Дневна Хидратация (чаши вода)</Label>
                      <span className="text-lg font-semibold text-primary">{data.hydration || 8}</span>
                    </div>
                    <Slider
                      id="hydration"
                      min={0}
                      max={15}
                      step={1}
                      value={[data.hydration || 8]}
                      onValueChange={(value) => setData({ ...data, hydration: value[0] })}
                      className="py-4"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-semibold mb-1">Хранителен Профил</h3>
                  <p className="text-sm text-muted-foreground">Информация за вашето хранене</p>
                </div>

                <div className="space-y-3">
                  <Label>Хранителен Режим</Label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {dietaryProfiles.map((profile) => (
                      <div
                        key={profile}
                        className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          data.dietaryProfile?.includes(profile)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        }`}
                        onClick={() => setData({ ...data, dietaryProfile: toggleArrayItem(data.dietaryProfile, profile) })}
                      >
                        <Checkbox
                          checked={data.dietaryProfile?.includes(profile)}
                          className="mt-0.5"
                        />
                        <Label className="font-normal cursor-pointer leading-snug flex-1 text-sm">
                          {profile}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Хранителни Навици</Label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {dietaryHabits.map((habit) => (
                      <div
                        key={habit}
                        className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          data.dietaryHabits?.includes(habit)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/30'
                        }`}
                        onClick={() => setData({ ...data, dietaryHabits: toggleArrayItem(data.dietaryHabits, habit) })}
                      >
                        <Checkbox
                          checked={data.dietaryHabits?.includes(habit)}
                          className="mt-0.5"
                        />
                        <Label className="font-normal cursor-pointer leading-snug flex-1 text-sm">
                          {habit}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foodIntolerances">Хранителна Непоносимост</Label>
                  <Textarea
                    id="foodIntolerances"
                    placeholder="напр. Лактоза, глутен..."
                    value={data.foodIntolerances || ''}
                    onChange={(e) => setData({ ...data, foodIntolerances: e.target.value })}
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergies">Алергии</Label>
                  <Textarea
                    id="allergies"
                    placeholder="напр. Ядки, морски дарове, пчелни продукти..."
                    value={data.allergies || ''}
                    onChange={(e) => setData({ ...data, allergies: e.target.value })}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-semibold mb-1">Медикаменти</h3>
                  <p className="text-sm text-muted-foreground">Информация за приемани лекарства и добавки</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medications">Прием на Медикаменти и Хранителни Добавки</Label>
                  <Textarea
                    id="medications"
                    placeholder="напр. Витамин D 2000 IU, Магнезий 400mg, Омега-3..."
                    value={data.medications || ''}
                    onChange={(e) => setData({ ...data, medications: e.target.value })}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Включете и безрецептурни лекарства, витамини, минерали и други добавки
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Забележка:</span> Информацията от този въпросник ще бъде използвана само за иридологичния анализ и няма да бъде споделена с трети страни.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between mt-8 pt-6 border-t">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="gap-2"
              >
                <ArrowLeft size={16} weight="bold" />
                Назад
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="ml-auto gap-2"
            >
              {step === totalSteps ? 'Напред към Снимките' : 'Напред'}
              <ArrowRight size={16} weight="bold" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
