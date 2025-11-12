import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkle, Warning, Bug } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { QuestionnaireData, IrisImage, AnalysisReport, IrisAnalysis } from '@/types'

interface AnalysisScreenProps {
  questionnaireData: QuestionnaireData
  leftIris: IrisImage
  rightIris: IrisImage
  onComplete: (report: AnalysisReport) => void
}

interface LogEntry {
  timestamp: string
  level: 'info' | 'success' | 'error' | 'warning'
  message: string
}

export default function AnalysisScreen({
  questionnaireData,
  leftIris,
  rightIris,
  onComplete
}: AnalysisScreenProps) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Подготовка за анализ...')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLog = (level: LogEntry['level'], message: string) => {
    const timestamp = new Date().toLocaleTimeString('bg-BG', { hour12: false })
    setLogs(prev => [...prev, { timestamp, level, message }])
    
    const emoji = {
      info: '📝',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[level]
    
    console.log(`${emoji} [${timestamp}] ${message}`)
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const callLLMWithRetry = async (
    prompt: string,
    modelName: string = 'gpt-4o',
    jsonMode: boolean = true,
    maxRetries: number = 3
  ): Promise<string> => {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          addLog('warning', `Изчакване ${waitTime}ms преди опит ${attempt}/${maxRetries}...`)
          await sleep(waitTime)
        }
        
        addLog('info', `LLM заявка (опит ${attempt}/${maxRetries})...`)
        const response = await window.spark.llm(prompt, modelName, jsonMode)
        
        if (response && response.length > 0) {
          addLog('success', `LLM отговори успешно (${response.length} символа)`)
          return response
        } else {
          throw new Error('Празен отговор от LLM')
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const errorMsg = lastError.message
        
        if (errorMsg.includes('429') || errorMsg.includes('Too many requests')) {
          addLog('warning', `Rate limit (429) - твърде много заявки! Опит ${attempt}/${maxRetries}`)
          if (attempt < maxRetries) {
            const backoffTime = Math.min(2000 * Math.pow(2, attempt), 15000)
            addLog('info', `Изчакване ${backoffTime}ms преди повторен опит...`)
            await sleep(backoffTime)
            continue
          }
        } else {
          addLog('error', `LLM грешка (опит ${attempt}): ${errorMsg}`)
          if (attempt < maxRetries) {
            continue
          }
        }
      }
    }
    
    throw lastError || new Error('LLM заявката се провали след всички опити')
  }

  const robustJSONParse = (response: string, context: string): any => {
    try {
      return JSON.parse(response)
    } catch (parseError) {
      addLog('error', `JSON parse грешка (${context}): ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      console.error(`❌ [${context}] JSON parse грешка:`, parseError)
      console.error(`📄 [${context}] Проблемен JSON (първи 500 символа):`, response.substring(0, 500))
      console.error(`📄 [${context}] Проблемен JSON (последни 500 символа):`, response.substring(response.length - 500))
      
      addLog('warning', `Опит за почистване и повторно парсиране (${context})...`)
      try {
        const cleaned = response
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
          .replace(/\n/g, ' ')
          .replace(/\r/g, '')
          .replace(/\t/g, ' ')
          .replace(/\\/g, '')
          .trim()
        
        const result = JSON.parse(cleaned)
        addLog('success', `JSON парсиран успешно след почистване (${context})`)
        return result
      } catch (cleanError) {
        addLog('error', `Не може да се парсира JSON дори след почистване (${context})`)
        throw new Error(`Невалиден JSON отговор от AI: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }
    }
  }

  useEffect(() => {
    performAnalysis()
  }, [])

  const performAnalysis = async () => {
    try {
      addLog('info', 'Стартиране на анализ...')
      addLog('info', `Данни от въпросник: Възраст ${questionnaireData.age}, Пол ${questionnaireData.gender}`)
      addLog('info', `Здравни цели: ${questionnaireData.goals.join(', ')}`)
      console.log('🚀 [АНАЛИЗ] Стартиране на анализ...')
      console.log('📊 [АНАЛИЗ] Данни от въпросник:', questionnaireData)
      
      setProgress(10)
      setStatus('Анализиране на ляв ирис...')
      addLog('info', 'Започване анализ на ляв ирис...')
      console.log('👁️ [АНАЛИЗ] Започване анализ на ляв ирис...')
      
      const leftAnalysis = await analyzeIris(leftIris, 'left', questionnaireData)
      addLog('success', 'Ляв ирис анализиран успешно')
      console.log('✅ [АНАЛИЗ] Ляв ирис анализиран успешно:', leftAnalysis)
      
      addLog('info', 'Изчакване 2 сек. преди следваща заявка...')
      await sleep(2000)
      
      setProgress(40)
      setStatus('Анализиране на десен ирис...')
      addLog('info', 'Започване анализ на десен ирис...')
      console.log('👁️ [АНАЛИЗ] Започване анализ на десен ирис...')
      
      const rightAnalysis = await analyzeIris(rightIris, 'right', questionnaireData)
      addLog('success', 'Десен ирис анализиран успешно')
      console.log('✅ [АНАЛИЗ] Десен ирис анализиран успешно:', rightAnalysis)
      
      addLog('info', 'Изчакване 2 сек. преди следваща заявка...')
      await sleep(2000)
      
      setProgress(70)
      setStatus('Генериране на препоръки...')
      addLog('info', 'Започване генериране на препоръки...')
      console.log('💊 [АНАЛИЗ] Започване генериране на препоръки...')
      
      const recommendations = await generateRecommendations(
        leftAnalysis,
        rightAnalysis,
        questionnaireData
      )
      addLog('success', `Препоръки генерирани успешно (${recommendations.length} бр.)`)
      console.log('✅ [АНАЛИЗ] Препоръки генерирани успешно:', recommendations)
      
      addLog('info', 'Изчакване 2 сек. преди следваща заявка...')
      await sleep(2000)
      
      setProgress(90)
      setStatus('Подготовка на доклад...')
      addLog('info', 'Започване генериране на резюме...')
      console.log('📝 [АНАЛИЗ] Започване генериране на резюме...')
      
      const summary = await generateSummary(leftAnalysis, rightAnalysis, questionnaireData)
      addLog('success', 'Резюме генерирано успешно')
      console.log('✅ [АНАЛИЗ] Резюме генерирано успешно:', summary)
      
      setProgress(100)
      setStatus('Завършено!')
      addLog('success', '🎉 Доклад завършен успешно!')
      
      const report: AnalysisReport = {
        timestamp: new Date().toISOString(),
        questionnaireData,
        leftIris: leftAnalysis,
        rightIris: rightAnalysis,
        recommendations,
        summary
      }
      
      console.log('🎉 [АНАЛИЗ] Доклад завършен успешно!')
      
      setTimeout(() => {
        onComplete(report)
      }, 1000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : 'Няма stack trace'
      
      let userFriendlyMessage = errorMessage
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
        userFriendlyMessage = '⏱️ Твърде много заявки към AI модела. Моля изчакайте 30 секунди и опитайте отново.'
        addLog('error', 'Rate limit достигнат - твърде много заявки')
      } else {
        addLog('error', `Фатална грешка: ${errorMessage}`)
      }
      
      setError(`${userFriendlyMessage}\n\n⚠️ Технически детайли:\n${errorMessage}\n\nStack: ${errorStack}`)
      
      console.error('❌ [ГРЕШКА] Фатална грешка при анализ:', error)
      console.error('❌ [ГРЕШКА] Име на грешка:', (error as Error)?.name)
      console.error('❌ [ГРЕШКА] Съобщение:', (error as Error)?.message)
      console.error('❌ [ГРЕШКА] Stack trace:', (error as Error)?.stack)
      console.error('❌ [ГРЕШКА] Текущ прогрес при грешка:', progress)
      console.error('❌ [ГРЕШКА] Текущ статус при грешка:', status)
      
      setStatus(`Грешка: ${userFriendlyMessage}`)
      setShowDebug(true)
    }
  }

  const analyzeIris = async (
    iris: IrisImage,
    side: 'left' | 'right',
    questionnaire: QuestionnaireData
  ): Promise<IrisAnalysis> => {
    try {
      addLog('info', `Стартиране анализ на ${side === 'left' ? 'ляв' : 'десен'} ирис`)
      console.log(`👁️ [ИРИС ${side}] Стартиране анализ на ${side} ирис...`)
      
      const sideName = side === 'left' ? 'ляв' : 'десен'
      const genderName = questionnaire.gender === 'male' ? 'мъж' : questionnaire.gender === 'female' ? 'жена' : 'друго'
      const bmi = (questionnaire.weight / ((questionnaire.height / 100) ** 2)).toFixed(1)
      const goalsText = questionnaire.goals.join(', ')
      const complaintsText = questionnaire.complaints || 'Няма'
      
      addLog('info', `BMI: ${bmi}, Възраст: ${questionnaire.age}, Пол: ${genderName}`)
      console.log(`📝 [ИРИС ${side}] BMI: ${bmi}, Възраст: ${questionnaire.age}, Пол: ${genderName}`)
      console.log(`📝 [ИРИС ${side}] Цели: ${goalsText}`)
      
      addLog('info', 'Подготовка на prompt за LLM...')
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Ти си експерт иридолог. Анализирай този ${sideName} ирис и генерирай детайлен иридологичен анализ.

Пациент информация:
- Възраст: ${questionnaire.age}
- Пол: ${genderName}
- BMI: ${bmi}
- Здравни цели: ${goalsText}
- Оплаквания: ${complaintsText}

Анализирай според 12-те иридологични зони (по часовника):
1. Мозък/Хипофиза (12:00)
2. Бронхи/Щитовидна жлеза (1:00)
3. Рамо/Белодробна зона (2:00)
4. Черен дроб/Жлъчка (3:00 за десен, 9:00 за ляв)
5. Стомах/Панкреас (4:00-5:00)
6. Дебело черво (5:00-7:00)
7. Урогенитална зона (6:00)
8. Бъбреци (5:00-7:00)
9. Далак (3:00 за ляв, 9:00 за десен)
10. Сърце (2:00-3:00 за ляв)
11. Ендокринна система (централно)
12. Нервна система (автономен пръстен)

За всяка зона оцени:
- Статус: normal (норма), attention (внимание), concern (притеснение)
- Конкретни находки

Също така идентифицирай типични иридологични артефакти:
- Лакуни (празнини в структурата)
- Криптe (вдлъбнатини)
- Пигментни петна
- Радиални линии
- Контракционни пръстени
- Плътност на ириса

Генерирай оценки за различни органни системи (0-100):
- Храносмилателна система
- Имунна система  
- Нервна система
- Сърдечно-съдова система
- Детоксикация
- Ендокринна система

ВАЖНО: Върни валиден JSON обект. В стойности на всички текстови полета използвай само обикновен текст - БЕЗ кавички, БЕЗ нови редове, БЕЗ табулации. Всички текстови описания трябва да са на един ред.

Върни резултата като JSON обект с property "analysis" съдържащ: 
{
  "analysis": {
    "zones": [{"id": 1, "name": "име", "organ": "орган", "status": "normal", "findings": "кратко описание без нови редове", "angle": [0, 30]}],
    "artifacts": [{"type": "тип", "location": "локация", "description": "кратко описание без нови редове", "severity": "low"}],
    "overallHealth": 75,
    "systemScores": [{"system": "система", "score": 80, "description": "кратко описание без нови редове"}]
  }
}`

      addLog('info', `Изпращане на prompt до LLM (${prompt.length} символа)...`)
      console.log(`🤖 [ИРИС ${side}] Изпращане на prompt до LLM...`)
      console.log(`📄 [ИРИС ${side}] Prompt дължина: ${prompt.length} символа`)
      
      addLog('warning', 'Изчакване на отговор от AI модела... (това може да отнеме 10-30 сек)')
      const response = await callLLMWithRetry(prompt, 'gpt-4o', true)
      
      addLog('success', `Получен отговор от LLM (${response.length} символа)`)
      console.log(`✅ [ИРИС ${side}] Получен отговор от LLM`)
      console.log(`📄 [ИРИС ${side}] Отговор дължина: ${response.length} символа`)
      console.log(`📄 [ИРИС ${side}] RAW отговор:`, response)
      
      addLog('info', 'Парсиране на JSON отговор...')
      const parsed = robustJSONParse(response, `ИРИС ${side}`)
      
      addLog('success', 'JSON парсиран успешно')
      console.log(`✅ [ИРИС ${side}] JSON парсиран успешно`)
      console.log(`📊 [ИРИС ${side}] Парсиран обект:`, parsed)
      
      if (!parsed.analysis) {
        addLog('error', `Липсва 'analysis' property в отговора!`)
        console.error(`❌ [ИРИС ${side}] ГРЕШКА: Липсва 'analysis' property в отговора!`)
        throw new Error(`Невалиден формат на отговор - липсва 'analysis' property`)
      }
      
      const result = {
        side,
        ...parsed.analysis
      }
      
      addLog('success', `Анализ завършен: ${result.zones.length} зони, ${result.artifacts.length} артефакта`)
      console.log(`✅ [ИРИС ${side}] Финален резултат:`, result)
      
      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog('error', `ГРЕШКА при анализ на ${side} ирис: ${errorMsg}`)
      console.error(`❌ [ИРИС ${side}] ГРЕШКА при анализ на ${side} ирис:`, error)
      console.error(`❌ [ИРИС ${side}] Име на грешка:`, (error as Error)?.name)
      console.error(`❌ [ИРИС ${side}] Съобщение:`, (error as Error)?.message)
      console.error(`❌ [ИРИС ${side}] Stack:`, (error as Error)?.stack)
      throw error
    }
  }

  const generateRecommendations = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Стартиране генериране на препоръки...')
      console.log('💊 [ПРЕПОРЪКИ] Стартиране генериране на препоръки...')
      
      const leftFindings = JSON.stringify(leftAnalysis.zones.filter(z => z.status !== 'normal'))
      const rightFindings = JSON.stringify(rightAnalysis.zones.filter(z => z.status !== 'normal'))
      const goalsText = questionnaire.goals.join(', ')
      const complaintsText = questionnaire.complaints || 'Няма'
      
      addLog('info', `Проблемни зони ляв ирис: ${leftAnalysis.zones.filter(z => z.status !== 'normal').length}`)
      addLog('info', `Проблемни зони десен ирис: ${rightAnalysis.zones.filter(z => z.status !== 'normal').length}`)
      console.log('📊 [ПРЕПОРЪКИ] Ляв ирис находки (не-нормални зони):', leftFindings)
      console.log('📊 [ПРЕПОРЪКИ] Десен ирис находки (не-нормални зони):', rightFindings)
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Базирано на иридологичния анализ, генерирай персонализирани препоръки на български език.

Ляв ирис находки: ${leftFindings}
Десен ирис находки: ${rightFindings}

Здравни цели: ${goalsText}
Оплаквания: ${complaintsText}

Генерирай минимум:
- 5 специфични хранителни препоръки (храни за консумация/избягване)
- 3-5 препоръки за хранителни добавки
- 2-3 препоръки за начин на живот

Всяка препоръка трябва да има:
- category: "diet", "supplement" или "lifestyle"
- title: кратко заглавие (на един ред)
- description: подробно обяснение (на един ред, без нови редове)
- priority: "high", "medium" или "low"

ВАЖНО: Върни валиден JSON. Използвай само обикновен текст в стойности - БЕЗ кавички в текста, БЕЗ нови редове, БЕЗ табулации.

Върни като JSON обект с property "recommendations" съдържащ масив от препоръки:
{
  "recommendations": [
    {"category": "diet", "title": "заглавие", "description": "описание на един ред", "priority": "high"}
  ]
}`

      addLog('info', 'Изпращане на prompt за препоръки до LLM...')
      console.log('🤖 [ПРЕПОРЪКИ] Изпращане на prompt до LLM...')
      console.log('📄 [ПРЕПОРЪКИ] Prompt дължина:', prompt.length)
      
      addLog('warning', 'Изчакване на отговор от AI модела...')
      const response = await callLLMWithRetry(prompt, 'gpt-4o', true)
      
      addLog('success', `Получен отговор (${response.length} символа)`)
      console.log('✅ [ПРЕПОРЪКИ] Получен отговор от LLM')
      console.log('📄 [ПРЕПОРЪКИ] Отговор дължина:', response.length)
      console.log('📄 [ПРЕПОРЪКИ] RAW отговор:', response)
      
      addLog('info', 'Парсиране на JSON...')
      const parsed = robustJSONParse(response, 'ПРЕПОРЪКИ')
      
      addLog('success', 'JSON парсиран успешно')
      console.log('✅ [ПРЕПОРЪКИ] JSON парсиран успешно')
      console.log('📊 [ПРЕПОРЪКИ] Парсиран обект:', parsed)
      
      if (!parsed.recommendations) {
        addLog('error', 'Липсва "recommendations" property!')
        console.error('❌ [ПРЕПОРЪКИ] ГРЕШКА: Липсва "recommendations" property!')
        throw new Error('Невалиден формат на отговор - липсва "recommendations" property')
      }
      
      addLog('success', `Генерирани ${parsed.recommendations.length} препоръки`)
      console.log('✅ [ПРЕПОРЪКИ] Брой препоръки:', parsed.recommendations.length)
      
      return parsed.recommendations
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog('error', `ГРЕШКА при препоръки: ${errorMsg}`)
      console.error('❌ [ПРЕПОРЪКИ] ГРЕШКА при генериране на препоръки:', error)
      console.error('❌ [ПРЕПОРЪКИ] Име на грешка:', (error as Error)?.name)
      console.error('❌ [ПРЕПОРЪКИ] Съобщение:', (error as Error)?.message)
      console.error('❌ [ПРЕПОРЪКИ] Stack:', (error as Error)?.stack)
      throw error
    }
  }

  const generateSummary = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Стартиране генериране на резюме...')
      console.log('📝 [РЕЗЮМЕ] Стартиране генериране на резюме...')
      
      const leftZones = leftAnalysis.zones.filter(z => z.status !== 'normal').map(z => z.organ).join(', ')
      const rightZones = rightAnalysis.zones.filter(z => z.status !== 'normal').map(z => z.organ).join(', ')
      const goalsText = questionnaire.goals.join(', ')
      
      addLog('info', `Общо здраве: Ляв ${leftAnalysis.overallHealth}/100, Десен ${rightAnalysis.overallHealth}/100`)
      console.log('📊 [РЕЗЮМЕ] Общо здраве ляв ирис:', leftAnalysis.overallHealth)
      console.log('📊 [РЕЗЮМЕ] Общо здраве десен ирис:', rightAnalysis.overallHealth)
      console.log('📊 [РЕЗЮМЕ] Проблемни зони ляв:', leftZones || 'Няма')
      console.log('📊 [РЕЗЮМЕ] Проблемни зони десен:', rightZones || 'Няма')
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Генерирай кратко резюме (3-4 параграфа) на иридологичния анализ на български език.

Общо здравословно състояние:
- Ляв ирис: ${leftAnalysis.overallHealth}/100
- Десен ирис: ${rightAnalysis.overallHealth}/100

Основни находки (зони с проблеми):
Ляв: ${leftZones}
Десен: ${rightZones}

Здравни цели на пациента: ${goalsText}

Създай професионално, но разбираемо резюме което:
1. Обобщава общото здравословно състояние
2. Посочва основните зони, които изискват внимание
3. Свързва находките със заявените здравни цели
4. Дава обща перспектива и насърчение

Върни само текста на резюмето (не JSON).`

      addLog('info', 'Изпращане на prompt за резюме до LLM...')
      console.log('🤖 [РЕЗЮМЕ] Изпращане на prompt до LLM...')
      console.log('📄 [РЕЗЮМЕ] Prompt дължина:', prompt.length)
      
      addLog('warning', 'Изчакване на отговор от AI модела...')
      const response = await callLLMWithRetry(prompt, 'gpt-4o', false)
      
      addLog('success', `Получено резюме (${response.length} символа)`)
      console.log('✅ [РЕЗЮМЕ] Получен отговор от LLM')
      console.log('📄 [РЕЗЮМЕ] Отговор дължина:', response.length)
      console.log('📄 [РЕЗЮМЕ] RAW отговор:', response)
      
      if (!response || response.length === 0) {
        addLog('error', 'Празен отговор от LLM!')
        console.error('❌ [РЕЗЮМЕ] ГРЕШКА: Празен отговор от LLM!')
        throw new Error('Празен отговор при генериране на резюме')
      }
      
      addLog('success', 'Резюме генерирано успешно')
      console.log('✅ [РЕЗЮМЕ] Резюме генерирано успешно')
      
      return response
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      addLog('error', `ГРЕШКА при резюме: ${errorMsg}`)
      console.error('❌ [РЕЗЮМЕ] ГРЕШКА при генериране на резюме:', error)
      console.error('❌ [РЕЗЮМЕ] Име на грешка:', (error as Error)?.name)
      console.error('❌ [РЕЗЮМЕ] Съобщение:', (error as Error)?.message)
      console.error('❌ [РЕЗЮМЕ] Stack:', (error as Error)?.stack)
      throw error
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Card className="p-8 md:p-12">
            <motion.div
              animate={{
                rotate: error ? 0 : [0, 360],
                scale: error ? 1 : [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: error ? 0 : Infinity,
                ease: "easeInOut"
              }}
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
                error 
                  ? 'bg-destructive' 
                  : 'bg-gradient-to-br from-primary to-accent'
              }`}
            >
              {error ? (
                <Warning size={40} weight="duotone" className="text-destructive-foreground" />
              ) : (
                <Sparkle size={40} weight="duotone" className="text-primary-foreground" />
              )}
            </motion.div>

            <h2 className="text-2xl font-bold mb-2">
              {error ? 'Възникна грешка' : 'AI Анализ в ход'}
            </h2>
            <p className={`mb-8 ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
              {error ? 'Моля, проверете логовете за повече информация' : 'Анализираме вашите ириси с изкуствен интелект'}
            </p>

            {!error && (
              <>
                <div className="space-y-4">
                  <Progress value={progress} className="h-3" />
                  <p className="text-sm font-medium text-center">{status}</p>
                  <p className="text-xs text-muted-foreground text-center">
                    {progress}% завършено
                  </p>
                </div>

                <div className="mt-8 space-y-2 text-left">
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${progress >= 10 ? 'bg-primary' : 'bg-muted'}`} />
                    <span className={progress >= 10 ? 'text-foreground' : 'text-muted-foreground'}>
                      Анализ на структура
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${progress >= 40 ? 'bg-primary' : 'bg-muted'}`} />
                    <span className={progress >= 40 ? 'text-foreground' : 'text-muted-foreground'}>
                      Картографиране на зони
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${progress >= 70 ? 'bg-primary' : 'bg-muted'}`} />
                    <span className={progress >= 70 ? 'text-foreground' : 'text-muted-foreground'}>
                      Генериране на препоръки
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${progress >= 90 ? 'bg-primary' : 'bg-muted'}`} />
                    <span className={progress >= 90 ? 'text-foreground' : 'text-muted-foreground'}>
                      Финализиране на доклад
                    </span>
                  </div>
                </div>
              </>
            )}

            {error && (
              <>
                <div className="mt-6 p-4 bg-destructive/10 rounded-lg text-left space-y-3">
                  <div className="text-sm font-semibold text-destructive">
                    {error.split('\n\n')[0]}
                  </div>
                  {error.includes('⚠️ Технически детайли:') && (
                    <details className="text-xs text-destructive/80">
                      <summary className="cursor-pointer hover:underline">
                        Покажи технически детайли
                      </summary>
                      <pre className="mt-2 font-mono whitespace-pre-wrap">
                        {error.split('⚠️ Технически детайли:')[1]}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="mt-4 flex gap-2 justify-center">
                  <Button
                    onClick={() => {
                      setError(null)
                      setProgress(0)
                      setStatus('Подготовка за анализ...')
                      setLogs([])
                      performAnalysis()
                    }}
                    className="gap-2"
                  >
                    <Sparkle size={20} />
                    Опитай отново
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="gap-2"
                  >
                    Рестартирай приложението
                  </Button>
                </div>
              </>
            )}

            <div className="mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="gap-2"
              >
                <Bug size={16} />
                {showDebug ? 'Скрий логове' : 'Покажи логове'}
              </Button>
            </div>

            {showDebug && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6"
              >
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Bug size={20} className="text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Debug Логове</h3>
                  </div>
                  <ScrollArea className="h-[300px] w-full">
                    <div className="space-y-1 text-left">
                      {logs.map((log, index) => (
                        <div
                          key={index}
                          className={`text-xs font-mono p-2 rounded ${
                            log.level === 'error'
                              ? 'bg-destructive/10 text-destructive'
                              : log.level === 'success'
                              ? 'bg-primary/10 text-primary'
                              : log.level === 'warning'
                              ? 'bg-accent/10 text-accent'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <span className="opacity-60">[{log.timestamp}]</span>{' '}
                          <span className="font-semibold uppercase text-[10px]">
                            {log.level}
                          </span>
                          : {log.message}
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Няма логове
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
