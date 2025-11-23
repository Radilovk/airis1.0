import { useState, useEffect } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  Brain, 
  BookOpen, 
  ChatCircleDots, 
  Sparkle, 
  MagnifyingGlass,
  Info,
  CheckCircle,
  Warning
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AIModelStrategy } from '@/types'

const DEFAULT_STRATEGY: AIModelStrategy = {
  manualWeight: 40,
  promptWeight: 30,
  llmKnowledgeWeight: 25,
  webSearchWeight: 5,
  useWebSearch: false,
  temperature: 0.7,
  maxTokens: 4000,
  topP: 0.9,
  lastModified: new Date().toISOString()
}

export default function AIModelStrategyTab() {
  const [strategy, setStrategy] = useKVWithFallback<AIModelStrategy>('ai-model-strategy', DEFAULT_STRATEGY)
  
  const [manualWeight, setManualWeight] = useState(strategy?.manualWeight ?? 40)
  const [promptWeight, setPromptWeight] = useState(strategy?.promptWeight ?? 30)
  const [llmKnowledgeWeight, setLlmKnowledgeWeight] = useState(strategy?.llmKnowledgeWeight ?? 25)
  const [webSearchWeight, setWebSearchWeight] = useState(strategy?.webSearchWeight ?? 5)
  const [useWebSearch, setUseWebSearch] = useState(strategy?.useWebSearch ?? false)
  const [temperature, setTemperature] = useState(strategy?.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(strategy?.maxTokens ?? 4000)
  const [topP, setTopP] = useState(strategy?.topP ?? 0.9)

  useEffect(() => {
    if (strategy) {
      setManualWeight(strategy.manualWeight ?? 40)
      setPromptWeight(strategy.promptWeight ?? 30)
      setLlmKnowledgeWeight(strategy.llmKnowledgeWeight ?? 25)
      setWebSearchWeight(strategy.webSearchWeight ?? 5)
      setUseWebSearch(strategy.useWebSearch ?? false)
      setTemperature(strategy.temperature ?? 0.7)
      setMaxTokens(strategy.maxTokens ?? 4000)
      setTopP(strategy.topP ?? 0.9)
    }
  }, [strategy])

  const totalWeight = manualWeight + promptWeight + llmKnowledgeWeight + webSearchWeight
  const isBalanced = totalWeight === 100

  const handleSave = async () => {
    if (!isBalanced) {
      toast.error('Сумата на теглата трябва да бъде точно 100%')
      return
    }

    try {
      await setStrategy({
        manualWeight,
        promptWeight,
        llmKnowledgeWeight,
        webSearchWeight,
        useWebSearch,
        temperature,
        maxTokens,
        topP,
        lastModified: new Date().toISOString()
      })
      toast.success('AI стратегията е запазена успешно')
    } catch (error) {
      console.error('Error saving strategy:', error)
      toast.error('Грешка при запазване на стратегията')
    }
  }

  const handleReset = async () => {
    setManualWeight(DEFAULT_STRATEGY.manualWeight)
    setPromptWeight(DEFAULT_STRATEGY.promptWeight)
    setLlmKnowledgeWeight(DEFAULT_STRATEGY.llmKnowledgeWeight)
    setWebSearchWeight(DEFAULT_STRATEGY.webSearchWeight)
    setUseWebSearch(DEFAULT_STRATEGY.useWebSearch)
    setTemperature(DEFAULT_STRATEGY.temperature)
    setMaxTokens(DEFAULT_STRATEGY.maxTokens)
    setTopP(DEFAULT_STRATEGY.topP)
    
    await setStrategy({
      ...DEFAULT_STRATEGY,
      lastModified: new Date().toISOString()
    })
    toast.success('Стратегията е възстановена до фабричните настройки')
  }

  const normalizeWeights = () => {
    const current = manualWeight + promptWeight + llmKnowledgeWeight + webSearchWeight
    if (current === 0) return

    const factor = 100 / current
    setManualWeight(Math.round(manualWeight * factor))
    setPromptWeight(Math.round(promptWeight * factor))
    setLlmKnowledgeWeight(Math.round(llmKnowledgeWeight * factor))
    setWebSearchWeight(Math.round(webSearchWeight * factor))
    
    toast.success('Теглата са нормализирани до 100%')
  }

  const getWeightColor = (weight: number) => {
    if (weight >= 40) return 'text-primary'
    if (weight >= 25) return 'text-accent'
    if (weight >= 10) return 'text-muted-foreground'
    return 'text-destructive'
  }

  const getWeightBgColor = (weight: number) => {
    if (weight >= 40) return 'bg-primary'
    if (weight >= 25) return 'bg-accent'
    if (weight >= 10) return 'bg-secondary'
    return 'bg-muted'
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">AI Модел Стратегия</h3>
        <p className="text-sm text-muted-foreground">
          Конфигурирайте как AI моделът взема решения при генериране на иридологичен анализ
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Определете относителното тегло на всеки източник на информация. Сумата на всички тегла трябва да бъде точно <strong>100%</strong>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Източници на Информация</span>
            <Badge variant={isBalanced ? 'default' : 'destructive'}>
              {isBalanced ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Балансирано</>
              ) : (
                <><Warning className="h-3 w-3 mr-1" /> Сума: {totalWeight}%</>
              )}
            </Badge>
          </CardTitle>
          <CardDescription>
            Разпределение на влиянието на различните източници при анализ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-6">
            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" weight="duotone" />
                  <Label className="text-base font-semibold">Иридологично Ръководство</Label>
                </div>
                <span className={`text-2xl font-bold ${getWeightColor(manualWeight)}`}>
                  {manualWeight}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground ml-7">
                Структурираното ръководство с иридологични зони, органи и интерпретации
              </p>
              <Slider
                value={[manualWeight]}
                onValueChange={([value]) => setManualWeight(value)}
                min={0}
                max={100}
                step={5}
                className="ml-7"
              />
              <div 
                className={`h-2 rounded-full ${getWeightBgColor(manualWeight)} transition-all ml-7`}
                style={{ width: `${manualWeight}%` }}
              />
            </motion.div>

            <Separator />

            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChatCircleDots className="h-5 w-5 text-accent" weight="duotone" />
                  <Label className="text-base font-semibold">AI Prompt Template</Label>
                </div>
                <span className={`text-2xl font-bold ${getWeightColor(promptWeight)}`}>
                  {promptWeight}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground ml-7">
                Специфични инструкции и контекст, дефинирани в AI prompt шаблона
              </p>
              <Slider
                value={[promptWeight]}
                onValueChange={([value]) => setPromptWeight(value)}
                min={0}
                max={100}
                step={5}
                className="ml-7"
              />
              <div 
                className={`h-2 rounded-full ${getWeightBgColor(promptWeight)} transition-all ml-7`}
                style={{ width: `${promptWeight}%` }}
              />
            </motion.div>

            <Separator />

            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkle className="h-5 w-5 text-yellow-500" weight="duotone" />
                  <Label className="text-base font-semibold">Собствени Знания на LLM</Label>
                </div>
                <span className={`text-2xl font-bold ${getWeightColor(llmKnowledgeWeight)}`}>
                  {llmKnowledgeWeight}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground ml-7">
                Предварително обучени знания на езиковия модел за иридология и здраве
              </p>
              <Slider
                value={[llmKnowledgeWeight]}
                onValueChange={([value]) => setLlmKnowledgeWeight(value)}
                min={0}
                max={100}
                step={5}
                className="ml-7"
              />
              <div 
                className={`h-2 rounded-full ${getWeightBgColor(llmKnowledgeWeight)} transition-all ml-7`}
                style={{ width: `${llmKnowledgeWeight}%` }}
              />
            </motion.div>

            <Separator />

            <motion.div 
              className="space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MagnifyingGlass className="h-5 w-5 text-blue-500" weight="duotone" />
                  <Label className="text-base font-semibold">Интернет Търсене</Label>
                  <Badge variant="outline" className="text-xs">
                    {useWebSearch ? 'Активно' : 'Неактивно'}
                  </Badge>
                </div>
                <span className={`text-2xl font-bold ${getWeightColor(webSearchWeight)}`}>
                  {webSearchWeight}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground ml-7">
                Динамично търсене на актуална информация в интернет (експериментално)
              </p>
              <div className="flex items-center gap-3 ml-7">
                <Switch
                  checked={useWebSearch}
                  onCheckedChange={setUseWebSearch}
                />
                <Label className="text-sm">
                  {useWebSearch ? 'Включено' : 'Изключено'}
                </Label>
              </div>
              <Slider
                value={[webSearchWeight]}
                onValueChange={([value]) => setWebSearchWeight(value)}
                min={0}
                max={100}
                step={5}
                className="ml-7"
                disabled={!useWebSearch}
              />
              <div 
                className={`h-2 rounded-full ${getWeightBgColor(webSearchWeight)} transition-all ml-7 ${!useWebSearch ? 'opacity-30' : ''}`}
                style={{ width: `${webSearchWeight}%` }}
              />
            </motion.div>
          </div>

          {!isBalanced && (
            <Alert variant="destructive">
              <Warning className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Общата сума е {totalWeight}%. Трябва да бъде точно 100%.</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={normalizeWeights}
                >
                  Автоматично балансиране
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" weight="duotone" />
            Параметри на Модела
          </CardTitle>
          <CardDescription>
            Допълнителни настройки за контрол на поведението на AI модела
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature (Креативност)</Label>
              <Badge variant="outline">{temperature.toFixed(2)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              По-високата стойност (0.8-1.0) = по-креативни отговори. По-ниска (0.3-0.5) = по-консервативни и точни.
            </p>
            <Slider
              value={[temperature]}
              onValueChange={([value]) => setTemperature(Math.round(value * 100) / 100)}
              min={0}
              max={1}
              step={0.1}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max Tokens (Дължина на отговора)</Label>
              <Badge variant="outline">{maxTokens}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Максимален брой tokens за генериране. По-високо = по-дълги анализи (препоръчано: 3000-5000).
            </p>
            <Slider
              value={[maxTokens]}
              onValueChange={([value]) => setMaxTokens(value)}
              min={1000}
              max={8000}
              step={500}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Top P (Nucleus Sampling)</Label>
              <Badge variant="outline">{topP.toFixed(2)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Контролира разнообразието на отговорите. Препоръчано: 0.9-0.95 за балансиран резултат.
            </p>
            <Slider
              value={[topP]}
              onValueChange={([value]) => setTopP(Math.round(value * 100) / 100)}
              min={0.1}
              max={1}
              step={0.05}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Как работи AI моделът?</CardTitle>
          <CardDescription className="text-xs">
            Детайлно обяснение на взаимодействието между различните източници на информация
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="flex gap-3">
              <BookOpen className="h-5 w-5 shrink-0 text-primary" weight="duotone" />
              <div>
                <strong className="text-foreground">Иридологично Ръководство (Manual):</strong>
                <p className="text-xs mt-1">
                  Структурираната база данни с иридологични зони, органи и симптоми. Това е основният източник на 
                  медицински точна информация. Съдържа детайлни карти на ириса, свързани с конкретни органи и системи.
                </p>
                <p className="text-xs mt-1 italic">
                  💡 По-високо тегло → По-строго придържане към класическата иридологична наука
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <ChatCircleDots className="h-5 w-5 shrink-0 text-accent" weight="duotone" />
              <div>
                <strong className="text-foreground">AI Prompt Template:</strong>
                <p className="text-xs mt-1">
                  Дефинира КАК моделът трябва да обработва информацията - какъв тон да използва, как да структурира 
                  отговора, какви препоръки да дава, как да корелира данни от въпросника с визуалните находки.
                </p>
                <p className="text-xs mt-1 italic">
                  💡 По-високо тегло → По-персонализиран подход към всеки пациент
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <Sparkle className="h-5 w-5 shrink-0 text-yellow-500" weight="duotone" />
              <div>
                <strong className="text-foreground">Собствени Знания на LLM:</strong>
                <p className="text-xs mt-1">
                  Предварително обучени знания на езиковия модел за иридология, анатомия, физиология и здравословен 
                  живот от неговия тренировъчен dataset. Това включва широк спектър от медицински знания, но НЕ е 
                  специализирано само за иридология.
                </p>
                <p className="text-xs mt-1 italic">
                  💡 По-високо тегло → По-креативни интерпретации и холистичен подход
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <MagnifyingGlass className="h-5 w-5 shrink-0 text-blue-500" weight="duotone" />
              <div>
                <strong className="text-foreground">Интернет Търсене (Web Search):</strong>
                <p className="text-xs mt-1">
                  Експериментална функция за динамично търсене на най-актуална информация от интернет. 
                  Забележка: Може да забави анализа значително и да не е винаги налична.
                </p>
                <p className="text-xs mt-1 italic">
                  ⚠️ Понастоящем НЕ Е АКТИВНА в GitHub Spark API
                </p>
              </div>
            </div>
          </div>
          
          <Separator className="my-4" />

          <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
            <h4 className="text-sm font-semibold text-foreground mb-2">🔬 Как се комбинират източниците?</h4>
            <div className="space-y-2 text-xs">
              <p>
                <strong>1. Визуален анализ:</strong> AI моделът първо анализира изображенията на ирисите 
                и идентифицира визуални находки (петна, линии, изменения в цвета).
              </p>
              <p>
                <strong>2. Картиране:</strong> Използва <strong>Иридологичното ръководство</strong> ({manualWeight}%) 
                за да определи в коя зона са находките и с кои органи са свързани.
              </p>
              <p>
                <strong>3. Корелация:</strong> <strong>AI Prompt Template</strong> ({promptWeight}%) указва как да се 
                корелират визуалните находки с данните от въпросника (симптоми, здравни проблеми, начин на живот).
              </p>
              <p>
                <strong>4. Интерпретация:</strong> <strong>LLM знанията</strong> ({llmKnowledgeWeight}%) добавят 
                контекст за анатомия, физиология, хранене и здравословен начин на живот.
              </p>
              <p>
                <strong>5. Генериране на препоръки:</strong> Крайният анализ комбинира всички източници в 
                персонализиран доклад с конкретни препоръки.
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="bg-accent/5 p-3 rounded-lg border border-accent/20">
            <h4 className="text-sm font-semibold text-foreground mb-2">📊 Примери за различни стратегии:</h4>
            <div className="space-y-3 text-xs">
              <div>
                <strong className="text-accent">Консервативна (за максимална точност):</strong>
                <div className="mt-1 space-y-1">
                  <div>• Ръководство: 60% - Строго придържане към класическата иридология</div>
                  <div>• Prompt: 25% - Структурирано представяне</div>
                  <div>• LLM: 15% - Минимални допълнителни знания</div>
                  <div className="text-muted-foreground italic">→ Подходяща за професионални иридолози</div>
                </div>
              </div>

              <div>
                <strong className="text-primary">Балансирана (препоръчителна):</strong>
                <div className="mt-1 space-y-1">
                  <div>• Ръководство: 40% - Солидна база от иридологични знания</div>
                  <div>• Prompt: 30% - Персонализиран подход</div>
                  <div>• LLM: 25% - Холистична интерпретация</div>
                  <div>• Търсене: 5% - Актуална информация (ако е активно)</div>
                  <div className="text-muted-foreground italic">→ Най-добър компромис за повечето случаи</div>
                </div>
              </div>

              <div>
                <strong className="text-yellow-600">Холистична (за широк контекст):</strong>
                <div className="mt-1 space-y-1">
                  <div>• Ръководство: 25% - База за визуална интерпретация</div>
                  <div>• Prompt: 30% - Силна персонализация</div>
                  <div>• LLM: 40% - Широк медицински контекст</div>
                  <div>• Търсене: 5% - Допълнителна информация</div>
                  <div className="text-muted-foreground italic">→ За пациенти, които търсят холистичен подход</div>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Важно:</strong> Настройките на стратегията влияят на ЦЯЛОСТНИЯ анализ - и на визуалната 
              интерпретация, и на препоръките за хранене, добавки, психология и изследвания. Експериментирайте 
              с различни настройки за да намерите баланса, който най-добре отговаря на вашата практика.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} className="flex-1" disabled={!isBalanced}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Запази Стратегията
        </Button>
        <Button onClick={handleReset} variant="outline">
          Фабрични Настройки
        </Button>
      </div>

      {strategy?.lastModified && (
        <p className="text-xs text-muted-foreground text-center">
          Последна промяна: {new Date(strategy.lastModified).toLocaleString('bg-BG')}
        </p>
      )}
    </div>
  )
}
