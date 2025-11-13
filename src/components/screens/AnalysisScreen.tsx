import { useEffect, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkle, Warning, Bug } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { AIRIS_KNOWLEDGE } from '@/lib/airis-knowledge'
import type { QuestionnaireData, IrisImage, AnalysisReport, IrisAnalysis, AIModelConfig, Recommendation, SupplementRecommendation } from '@/types'

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
  
  const [aiConfig] = useKV<AIModelConfig>('ai-model-config', {
    provider: 'github-spark',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false,
    requestDelay: 30000,
    requestCount: 8
  })

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

  const callExternalAPI = async (
    prompt: string,
    provider: 'openai' | 'gemini' | 'github-spark',
    model: string,
    apiKey: string,
    jsonMode: boolean = true
  ): Promise<string> => {
    addLog('info', `🔑 Използване на собствен API: ${provider} / ${model}`)
    
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          response_format: jsonMode ? { type: 'json_object' } : undefined,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API грешка ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } else {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: jsonMode 
                ? `${prompt}\n\nВърни САМО валиден JSON обект, без допълнителен текст.`
                : prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini API грешка ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      return data.candidates[0].content.parts[0].text
    }
  }

  const callLLMWithRetry = async (
    prompt: string,
    jsonMode: boolean = true,
    maxRetries: number = 3
  ): Promise<string> => {
    let lastError: Error | null = null
    
    const useCustomAPI = aiConfig?.useCustomKey && aiConfig?.apiKey && aiConfig?.provider !== 'github-spark'
    const provider = aiConfig?.provider || 'github-spark'
    const actualModel = aiConfig?.model || 'gpt-4o'
    const requestDelay = aiConfig?.requestDelay || 30000
    
    if (useCustomAPI) {
      addLog('info', `🔧 Режим: Собствен API (${provider} - ${actualModel}) | Забавяне: ${requestDelay}ms`)
    } else {
      addLog('info', `🔧 Режим: GitHub Spark вграден модел (${actualModel}) | Забавяне: ${requestDelay}ms`)
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const waitTime = useCustomAPI ? Math.min(requestDelay, 10000) : Math.min(requestDelay * attempt, 120000)
          addLog('warning', `Изчакване ${(waitTime / 1000).toFixed(0)}s преди опит ${attempt}/${maxRetries}...`)
          await sleep(waitTime)
        }
        
        addLog('info', `LLM заявка (опит ${attempt}/${maxRetries})...`)
        
        let response: string
        if (useCustomAPI && provider !== 'github-spark') {
          response = await callExternalAPI(
            prompt,
            provider as 'openai' | 'gemini',
            actualModel,
            aiConfig!.apiKey,
            jsonMode
          )
        } else {
          response = await window.spark.llm(prompt, actualModel as any, jsonMode)
        }
        
        if (response && response.length > 0) {
          addLog('success', `LLM отговори успешно (${response.length} символа)`)
          return response
        } else {
          throw new Error('Празен отговор от LLM')
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const errorMsg = lastError.message
        
        if (errorMsg.includes('429') || errorMsg.includes('Too many requests') || errorMsg.includes('rate limit')) {
          addLog('warning', `⏱️ Rate limit (429) - твърде много заявки! Опит ${attempt}/${maxRetries}`)
          if (attempt < maxRetries) {
            const backoffTime = useCustomAPI ? 15000 : 120000
            addLog('info', `⏳ Изчакване ${(backoffTime / 1000).toFixed(0)}s преди повторен опит поради rate limit...`)
            await sleep(backoffTime)
            continue
          } else {
            throw new Error(`Rate limit достигнат след всички опити. ${useCustomAPI ? 'Проверете вашия API лимит.' : 'Моля изчакайте 3-5 минути преди да опитате отново.'}`)
          }
        } else {
          addLog('error', `LLM грешка (опит ${attempt}): ${errorMsg}`)
          if (attempt < maxRetries) {
            await sleep(5000)
            continue
          }
        }
      }
    }
    
    throw lastError || new Error('LLM заявката се провали след всички опити')
  }

  const robustJSONParse = async (response: string, context: string): Promise<any> => {
    try {
      return JSON.parse(response)
    } catch (parseError) {
      addLog('error', `JSON parse грешка (${context}): ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      console.error(`❌ [${context}] JSON parse грешка:`, parseError)
      console.error(`📄 [${context}] Проблемен JSON (първи 500 символа):`, response.substring(0, 500))
      console.error(`📄 [${context}] Проблемен JSON (последни 500 символа):`, response.substring(response.length - 500))
      
      addLog('warning', `Опит за почистване и повторно парсиране (${context})...`)
      
      let cleaned = response.trim()
      
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '')
        addLog('info', 'Премахнати markdown code fence блокове')
      }
      
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '')
        addLog('info', 'Премахнати generic markdown code fence блокове')
      }
      
      try {
        cleaned = cleaned
          .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
          .replace(/\r\n/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\r/g, ' ')
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' ')
        
        const result = JSON.parse(cleaned)
        addLog('success', `JSON парсиран успешно след почистване (${context})`)
        return result
      } catch (cleanError) {
        addLog('warning', `Опит за извличане на JSON от текст (${context})...`)
        
        try {
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            let extracted = jsonMatch[0]
            
            addLog('info', 'Опит за поправка на незатворени кавички и скоби...')
            
            try {
              let fixed = extracted
              
              const openBraces = (fixed.match(/\{/g) || []).length
              const closeBraces = (fixed.match(/\}/g) || []).length
              const openBrackets = (fixed.match(/\[/g) || []).length
              const closeBrackets = (fixed.match(/\]/g) || []).length
              
              if (openBraces > closeBraces) {
                addLog('warning', `Липсват ${openBraces - closeBraces} затварящи скоби }`)
                fixed += '}'.repeat(openBraces - closeBraces)
              }
              if (openBrackets > closeBrackets) {
                addLog('warning', `Липсват ${openBrackets - closeBrackets} затварящи скоби ]`)
                fixed += ']'.repeat(openBrackets - closeBrackets)
              }
              
              const result = JSON.parse(fixed)
              addLog('success', `JSON поправен и парсиран успешно (${context})`)
              return result
            } catch (repairError) {
              addLog('warning', `Базовата поправка не помогна, опит с по-агресивна поправка...`)
              
              try {
                let aggressive = extracted
                  .replace(/,(\s*[}\]])/g, '$1')
                  .replace(/\s+/g, ' ')
                
                const openBraces = (aggressive.match(/\{/g) || []).length
                const closeBraces = (aggressive.match(/\}/g) || []).length
                const openBrackets = (aggressive.match(/\[/g) || []).length
                const closeBrackets = (aggressive.match(/\]/g) || []).length
                
                if (openBrackets > closeBrackets) {
                  aggressive += ']'.repeat(openBrackets - closeBrackets)
                }
                if (openBraces > closeBraces) {
                  aggressive += '}'.repeat(openBraces - closeBraces)
                }
                
                const result = JSON.parse(aggressive)
                addLog('success', `JSON парсиран след агресивна поправка (${context})`)
                return result
              } catch (aggressiveError) {
                addLog('error', `Агресивната поправка също не помогна`)
                console.error(`❌ [${context}] Опит за поправка се провали:`, aggressiveError)
              }
            }
          }
        } catch (extractError) {
          addLog('error', `Не може да се извлече валиден JSON (${context})`)
          console.error(`❌ [${context}] Грешка при извличане:`, extractError)
        }
        
        addLog('error', `Не може да се парсира JSON дори след почистване (${context})`)
        addLog('warning', `Опит да помоля AI да препрати валиден JSON...`)
        
        const fixPrompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Следният JSON е невалиден и не може да се парсира. Моля, поправи го и върни САМО валидния JSON, без допълнителен текст:

${response}

ВАЖНО: Върни само валиден JSON обект. Никакъв друг текст.`

        try {
          addLog('info', 'Изпращане на заявка за поправка на JSON...')
          const fixedResponse = await callLLMWithRetry(fixPrompt, true, 1)
          
          let fixedCleaned = fixedResponse.trim()
          if (fixedCleaned.startsWith('```json')) {
            fixedCleaned = fixedCleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '')
          }
          if (fixedCleaned.startsWith('```')) {
            fixedCleaned = fixedCleaned.replace(/^```\s*/, '').replace(/```\s*$/, '')
          }
          
          const fixedMatch = fixedCleaned.match(/\{[\s\S]*\}/)
          if (fixedMatch) {
            const result = JSON.parse(fixedMatch[0])
            addLog('success', `JSON поправен от AI и парсиран успешно (${context})`)
            return result
          }
        } catch (fixError) {
          addLog('error', `AI не успя да поправи JSON (${context})`)
          console.error(`❌ [${context}] AI fix грешка:`, fixError)
        }
        
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
      
      const requestDelay = aiConfig?.requestDelay || 30000
      const requestCount = aiConfig?.requestCount || 8
      const progressPerStep = 90 / requestCount
      let currentProgress = 5
      
      setProgress(currentProgress)
      setStatus('Анализиране на ляв ирис - структура...')
      addLog('info', 'Започване анализ на ляв ирис...')
      console.log('👁️ [АНАЛИЗ] Започване анализ на ляв ирис...')
      
      const leftAnalysis = await analyzeIris(leftIris, 'left', questionnaireData)
      addLog('success', 'Ляв ирис анализиран успешно')
      console.log('✅ [АНАЛИЗ] Ляв ирис анализиран успешно:', leftAnalysis)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setStatus('Анализиране на десен ирис - структура...')
      addLog('info', 'Започване анализ на десен ирис...')
      console.log('👁️ [АНАЛИЗ] Започване анализ на десен ирис...')
      
      const rightAnalysis = await analyzeIris(rightIris, 'right', questionnaireData)
      addLog('success', 'Десен ирис анализиран успешно')
      console.log('✅ [АНАЛИЗ] Десен ирис анализиран успешно:', rightAnalysis)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setStatus('Генериране на детайлен план за храни...')
      addLog('info', 'Започване генериране на хранителен план...')
      console.log('🍎 [АНАЛИЗ] Започване генериране на хранителен план...')
      
      const foodPlan = await generateFoodPlan(leftAnalysis, rightAnalysis, questionnaireData)
      addLog('success', 'Хранителен план генериран успешно')
      console.log('✅ [АНАЛИЗ] Хранителен план генериран успешно:', foodPlan)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setStatus('Генериране на препоръки за добавки...')
      addLog('info', 'Започване генериране на хранителни добавки...')
      console.log('💊 [АНАЛИЗ] Започване генериране на хранителни добавки...')
      
      const supplements = await generateSupplements(leftAnalysis, rightAnalysis, questionnaireData)
      addLog('success', `Добавки генерирани успешно (${supplements.length} бр.)`)
      console.log('✅ [АНАЛИЗ] Добавки генерирани успешно:', supplements)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setStatus('Генериране на психологически препоръки...')
      addLog('info', 'Започване генериране на психологически препоръки...')
      console.log('🧠 [АНАЛИЗ] Започване генериране на психологически препоръки...')
      
      const psychRecs = await generatePsychologicalRecommendations(leftAnalysis, rightAnalysis, questionnaireData)
      addLog('success', 'Психологически препоръки генерирани успешно')
      console.log('✅ [АНАЛИЗ] Психологически препоръки генерирани успешно:', psychRecs)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setStatus('Генериране на специални препоръки...')
      addLog('info', 'Започване генериране на специални препоръки...')
      console.log('⭐ [АНАЛИЗ] Започване генериране на специални препоръки...')
      
      const specialRecs = await generateSpecialRecommendations(leftAnalysis, rightAnalysis, questionnaireData)
      addLog('success', 'Специални препоръки генерирани успешно')
      console.log('✅ [АНАЛИЗ] Специални препоръки генерирани успешно:', specialRecs)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setStatus('Генериране на препоръки за изследвания...')
      addLog('info', 'Започване генериране на препоръки за изследвания...')
      console.log('🔬 [АНАЛИЗ] Започване генериране на препоръки за изследвания...')
      
      const testRecs = await generateTestRecommendations(leftAnalysis, rightAnalysis, questionnaireData)
      addLog('success', 'Препоръки за изследвания генерирани успешно')
      console.log('✅ [АНАЛИЗ] Препоръки за изследвания генерирани успешно:', testRecs)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setStatus('Генериране на детайлен анализ...')
      addLog('info', 'Започване генериране на детайлен анализ...')
      console.log('📝 [АНАЛИЗ] Започване генериране на детайлен анализ...')
      
      const detailedAnalysis = await generateDetailedAnalysis(leftAnalysis, rightAnalysis, questionnaireData)
      addLog('success', 'Детайлен анализ генериран успешно')
      console.log('✅ [АНАЛИЗ] Детайлен анализ генериран успешно:', detailedAnalysis)
      
      currentProgress += progressPerStep
      setProgress(currentProgress)
      addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
      await sleep(requestDelay)
      
      setProgress(95)
      setStatus('Финализиране на доклад...')
      addLog('info', 'Започване генериране на резюмета...')
      console.log('📝 [АНАЛИЗ] Започване генериране на резюмета...')
      
      const { briefSummary, motivationalSummary } = await generateSummaries(leftAnalysis, rightAnalysis, questionnaireData, detailedAnalysis)
      addLog('success', 'Резюмета генерирани успешно')
      console.log('✅ [АНАЛИЗ] Резюмета генерирани успешно')
      
      const recommendations = convertToRecommendations(foodPlan, supplements, psychRecs, specialRecs)
      
      setProgress(100)
      setStatus('Завършено!')
      addLog('success', '🎉 Доклад завършен успешно!')
      
      const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const report: AnalysisReport = {
        id: reportId,
        timestamp: new Date().toISOString(),
        questionnaireData,
        leftIris: leftAnalysis,
        rightIris: rightAnalysis,
        leftIrisImage: leftIris,
        rightIrisImage: rightIris,
        recommendations,
        summary: detailedAnalysis,
        briefSummary,
        detailedAnalysis,
        motivationalSummary,
        detailedPlan: {
          generalRecommendations: foodPlan.generalRecommendations,
          recommendedFoods: foodPlan.recommendedFoods,
          avoidFoods: foodPlan.avoidFoods,
          supplements,
          psychologicalRecommendations: psychRecs,
          specialRecommendations: specialRecs,
          recommendedTests: testRecs
        }
      }
      
      console.log('🎉 [АНАЛИЗ] Доклад завършен успешно!')
      
      setTimeout(() => {
        onComplete(report)
      }, 1000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : 'Няма stack trace'
      
      let userFriendlyMessage = errorMessage
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests') || errorMessage.includes('rate limit')) {
        userFriendlyMessage = '⏱️ Твърде много заявки към AI модела.\n\n💡 Моля изчакайте 1-2 минути и натиснете "Опитай отново".\n\nПричина: GitHub Spark има лимит за брой AI заявки в кратък период от време. Изчакването ще позволи на системата да се възстанови.'
        addLog('error', 'Rate limit достигнат - твърде много заявки. Изчакайте 1-2 минути.')
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
      
      setStatus(`Грешка: ${userFriendlyMessage.split('\n\n')[0]}`)
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
      
      const imageHash = iris.dataUrl.substring(0, 50)
      
      addLog('info', `BMI: ${bmi}, Възраст: ${questionnaire.age}, Пол: ${genderName}`)
      console.log(`📝 [ИРИС ${side}] BMI: ${bmi}, Възраст: ${questionnaire.age}, Пол: ${genderName}`)
      console.log(`📝 [ИРИС ${side}] Цели: ${goalsText}`)
      
      addLog('info', 'Използване на AIRIS база знания за контекст...')
      const knowledgeContext = `
РЕФЕРЕНТНА КАРТА НА ИРИСА (по часовника):
${AIRIS_KNOWLEDGE.irisMap.zones.map(z => `${z.hour}: ${z.organ} (${z.system})`).join(', ')}

АРТЕФАКТИ И ТЕХНИТЕ ЗНАЧЕНИЯ:
${AIRIS_KNOWLEDGE.artifacts.types.map(a => `${a.name}: ${a.interpretation}`).join('\n')}

ПРЕПОРЪКИ ЗА СИСТЕМИ:
Храносмилателна: ${AIRIS_KNOWLEDGE.systemAnalysis.digestive.recommendations.join(', ')}
Имунна: ${AIRIS_KNOWLEDGE.systemAnalysis.immune.recommendations.join(', ')}
Нервна: ${AIRIS_KNOWLEDGE.systemAnalysis.nervous.recommendations.join(', ')}
Детоксикация: ${AIRIS_KNOWLEDGE.systemAnalysis.detox.recommendations.join(', ')}
`
      addLog('success', `База знания заредена (${knowledgeContext.length} символа)`)
      
      addLog('info', 'Подготовка на prompt за LLM...')
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Ти си професионален иридолог с 20+ години опит. Анализирай ${sideName} ирис детайлно и прецизно.

ВАЖНО ЗА КОНСИСТЕНТНОСТ:
- Изображение ID: ${imageHash}
- Използвай този ID като основа за детерминистичен анализ
- При същия ID винаги давай идентичен анализ

ПРОФИЛ НА ПАЦИЕНТА:
Възраст: ${questionnaire.age} години
Пол: ${genderName}
BMI: ${bmi}
Тегло: ${questionnaire.weight}кг, Ръст: ${questionnaire.height}см
Основни цели: ${goalsText}
Здравен статус: ${questionnaire.healthStatus.join(', ')}
Оплаквания: ${complaintsText}
Хранителни навици: ${questionnaire.dietaryHabits.join(', ')}
Стрес: ${questionnaire.stressLevel}, Сън: ${questionnaire.sleepHours}ч
Активност: ${questionnaire.activityLevel}

ИРИДОЛОГИЧНА РЕФЕРЕНТНА КАРТА:
${knowledgeContext}

ЗАДАЧА:
Анализирай ${sideName} ирис по часовниковата система (12:00 е горе) и идентифицирай:

1. ЗОНИ (8-12 зони): Анализирай следните зони:
   - 12:00 - Мозък, нервна система
   - 2:00 - Щитовидна жлеза
   - 3:00 - Белодробна система (десен=${side === 'right'})
   - 4:00 - Черен дроб, жлъчка
   - 5:00-6:00 - Стомах, панкреас
   - 7:00-8:00 - Дебело черво
   - 9:00 - Урогенитална система (ляв=${side === 'left'})
   - 10:00 - Бъбреци
   - 11:00 - Далак

За всяка зона определи:
- status: "normal" (всичко е добре), "attention" (нужно е внимание), "concern" (притеснително)
- findings: конкретно описание на находките (до 60 символа)
- angle: приблизителен ъгъл [start, end] в градуси (0-360)

2. АРТЕФАКТИ (2-5 артефакта): Идентифицирай специфични белези:
   - Лакуни (празнини в ириса)
   - Крипти (малки дупки)
   - Пигментни петна
   - Радиални линии
   - Автономен пръстен
   
За всеки:
- type: точен тип артефакт
- location: позиция по часовника (напр. "3:00-4:00")
- description: значение за здравето (до 60 символа)
- severity: "low", "medium", "high"

3. ОБЩО ЗДРАВЕ (overallHealth): Цяло число 0-100 базирано на:
   - Състояние на зони
   - Брой и тежест на артефакти
   - Възраст и здравен статус
   - Конституционен тип

4. СИСТЕМНИ ОЦЕНКИ (systemScores): 6 системи, всяка с оценка 0-100:
   - Храносмилателна система
   - Имунна система
   - Нервна система
   - Сърдечно-съдова система
   - Детоксикационна система
   - Ендокринна система

За всяка система:
- score: числова оценка
- description: кратко състояние (до 60 символа)

ПРАВИЛА ЗА КОНСИСТЕНТНОСТ:
- Базирай анализа на Image ID за детерминистични резултати
- Използвай точна медицинска терминология
- Бъди специфичен и обективен
- Свържи находките с профила на пациента
- БЕЗ нови редове в текстове
- БЕЗ двойни кавички вътре в текстове
- Използвай единични кавички при нужда

ВЪРНИ САМО ВАЛИДЕН JSON:
{
  "analysis": {
    "zones": [
      {"id": 1, "name": "име на зона", "organ": "засегнат орган", "status": "normal/attention/concern", "findings": "описание до 60 символа", "angle": [0, 30]}
    ],
    "artifacts": [
      {"type": "тип", "location": "3:00-4:00", "description": "значение до 60 символа", "severity": "low/medium/high"}
    ],
    "overallHealth": 75,
    "systemScores": [
      {"system": "Храносмилателна система", "score": 80, "description": "състояние до 60 символа"}
    ]
  }
}`

      addLog('info', `Изпращане на prompt до LLM (${prompt.length} символа)...`)
      console.log(`🤖 [ИРИС ${side}] Изпращане на prompt до LLM...`)
      console.log(`📄 [ИРИС ${side}] Prompt дължина: ${prompt.length} символа`)
      
      addLog('warning', 'Изчакване на отговор от AI модела... (това може да отнеме 10-30 сек)')
      const response = await callLLMWithRetry(prompt, true)
      
      addLog('success', `Получен отговор от LLM (${response.length} символа)`)
      console.log(`✅ [ИРИС ${side}] Получен отговор от LLM`)
      console.log(`📄 [ИРИС ${side}] Отговор дължина: ${response.length} символа`)
      console.log(`📄 [ИРИС ${side}] RAW отговор:`, response)
      
      addLog('info', 'Парсиране на JSON отговор...')
      const parsed = await robustJSONParse(response, `ИРИС ${side}`)
      
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
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Генерирай персонализирани препоръки на български.

Ляв ирис: ${leftFindings}
Десен ирис: ${rightFindings}
Цели: ${goalsText}
Оплаквания: ${complaintsText}

Генерирай минимум:
- 5 хранителни препоръки (храни за консумация/избягване)
- 3-5 хранителни добавки
- 2-3 препоръки за начин на живот

Всяка препоръка:
- category: "diet", "supplement", "lifestyle"
- title: кратко (до 40 символа)
- description: подробно (до 120 символа, БЕЗ нови редове)
- priority: "high", "medium", "low"

ВАЖНО:
- Върни САМО валиден JSON
- БЕЗ нови редове (\\n)
- БЕЗ вътрешни двойни кавички
- Единични ' кавички в текстове

JSON:
{
  "recommendations": [
    {"category": "diet", "title": "заглавие", "description": "описание", "priority": "high"}
  ]
}`

      addLog('info', 'Изпращане на prompt за препоръки до LLM...')
      console.log('🤖 [ПРЕПОРЪКИ] Изпращане на prompt до LLM...')
      console.log('📄 [ПРЕПОРЪКИ] Prompt дължина:', prompt.length)
      
      addLog('warning', 'Изчакване на отговор от AI модела...')
      const response = await callLLMWithRetry(prompt, true)
      
      addLog('success', `Получен отговор (${response.length} символа)`)
      console.log('✅ [ПРЕПОРЪКИ] Получен отговор от LLM')
      console.log('📄 [ПРЕПОРЪКИ] Отговор дължина:', response.length)
      console.log('📄 [ПРЕПОРЪКИ] RAW отговор:', response)
      
      addLog('info', 'Парсиране на JSON...')
      const parsed = await robustJSONParse(response, 'ПРЕПОРЪКИ')
      
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

  const generateFoodPlan = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Генериране на персонализиран хранителен план...')
      
      const concernedOrgans = [
        ...leftAnalysis.zones.filter(z => z.status !== 'normal').map(z => z.organ),
        ...rightAnalysis.zones.filter(z => z.status !== 'normal').map(z => z.organ)
      ]
      const uniqueOrgans = [...new Set(concernedOrgans)].join(', ')
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Създай детайлен персонализиран хранителен план на български език за пациент с:

ИРИДОЛОГИЧНИ НАХОДКИ:
Проблемни органи/системи: ${uniqueOrgans}
Общо здраве: Ляв ${leftAnalysis.overallHealth}/100, Десен ${rightAnalysis.overallHealth}/100

ПАЦИЕНТ ПРОФИЛ:
Възраст: ${questionnaire.age}
Тегло: ${questionnaire.weight}кг, Ръст: ${questionnaire.height}см
Цели: ${questionnaire.goals.join(', ')}
Здравен статус: ${questionnaire.healthStatus.join(', ')}
Хранителен профил: ${questionnaire.dietaryProfile.join(', ')}
Алергии/непоносимост: ${questionnaire.foodIntolerances || 'Няма'}

Създай JSON с:
1. generalRecommendations - масив от 5-7 общи хранителни принципа (кратки изречения)
2. recommendedFoods - масив от 15-20 конкретни храни за консумация (само имена на храни)
3. avoidFoods - масив от 10-15 храни за избягване (само имена на храни)

ВАЖНО:
- Всички препоръки да са базирани на иридологичните находки
- Храните да са конкретни и специфични
- Вземи предвид алергии и хранителен профил
- Върни САМО валиден JSON без допълнителен текст

JSON формат:
{
  "foodPlan": {
    "generalRecommendations": ["препоръка 1", "препоръка 2"],
    "recommendedFoods": ["храна 1", "храна 2"],
    "avoidFoods": ["храна 1", "храна 2"]
  }
}`

      const response = await callLLMWithRetry(prompt, true)
      const parsed = await robustJSONParse(response, 'FOOD PLAN')
      
      addLog('success', 'Хранителен план генериран успешно')
      return parsed.foodPlan
    } catch (error) {
      addLog('error', `Грешка при хранителен план: ${error}`)
      throw error
    }
  }

  const generateSupplements = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Генериране на препоръки за хранителни добавки...')
      
      const systemScores = [...leftAnalysis.systemScores, ...rightAnalysis.systemScores]
      const weakSystems = systemScores.filter(s => s.score < 70).map(s => s.system).join(', ')
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Препоръчай хранителни добавки с точна дозировка и прием на български език за:

СЛАБИ СИСТЕМИ: ${weakSystems}
ЗДРАВЕН СТАТУС: ${questionnaire.healthStatus.join(', ')}
ВЪЗРАСТ: ${questionnaire.age}
МЕДИКАМЕНТИ: ${questionnaire.medications || 'Няма'}

Създай 8-12 персонализирани препоръки за хранителни добавки с:
- name: пълно име на добавката
- dosage: точна дозировка (напр. "1000-2000мг")
- timing: кога и как да се приема (напр. "Сутрин на гладно с вода")
- notes: допълнителни бележки ако е нужно (опционално)

Вземи предвид взаимодействия с медикаменти и здравен статус.

Върни САМО валиден JSON:
{
  "supplements": [
    {"name": "име", "dosage": "доза", "timing": "прием", "notes": "бележки"}
  ]
}`

      const response = await callLLMWithRetry(prompt, true)
      const parsed = await robustJSONParse(response, 'SUPPLEMENTS')
      
      addLog('success', `${parsed.supplements.length} добавки генерирани успешно`)
      return parsed.supplements
    } catch (error) {
      addLog('error', `Грешка при добавки: ${error}`)
      throw error
    }
  }

  const generatePsychologicalRecommendations = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Генериране на психологически препоръки...')
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Създай психологически и емоционални препоръки на български език за:

ПРОФИЛ:
Стрес: ${questionnaire.stressLevel}
Сън: ${questionnaire.sleepHours}ч, качество: ${questionnaire.sleepQuality}
Цели: ${questionnaire.goals.join(', ')}
Оплаквания: ${questionnaire.complaints || 'Няма'}

Създай 6-10 конкретни, практични психологически препоръки за:
- Управление на стреса
- Подобряване на съня
- Емоционален баланс
- Мотивация към целите
- Mindfulness и медитация

Върни масив от изречения на български.

JSON формат:
{
  "recommendations": ["препоръка 1", "препоръка 2"]
}`

      const response = await callLLMWithRetry(prompt, true)
      const parsed = await robustJSONParse(response, 'PSYCHOLOGICAL')
      
      addLog('success', 'Психологически препоръки генерирани успешно')
      return parsed.recommendations
    } catch (error) {
      addLog('error', `Грешка при психологически препоръки: ${error}`)
      throw error
    }
  }

  const generateSpecialRecommendations = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Генериране на специални индивидуални препоръки...')
      
      const uniqueFindings = [
        ...leftAnalysis.artifacts.map(a => `${a.type} в ${a.location}`),
        ...rightAnalysis.artifacts.map(a => `${a.type} в ${a.location}`)
      ]
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Създай високо персонализирани специални препоръки на български език базирани на:

УНИКАЛНИ ИРИДОЛОГИЧНИ НАХОДКИ:
${uniqueFindings.join('\n')}

СПЕЦИФИЧНИ ЦЕЛИ:
${questionnaire.goals.join(', ')}

ЗДРАВЕН СТАТУС:
${questionnaire.healthStatus.join(', ')}

АКТИВНОСТ: ${questionnaire.activityLevel}

Създай 6-10 специални, индивидуални препоръки които:
- Адресират конкретните иридологични находки
- Са фокусирани към личните цели
- Включват специфични протоколи и практики
- Са уникални за този пациент

Върни масив от детайлни изречения.

JSON формат:
{
  "recommendations": ["препоръка 1", "препоръка 2"]
}`

      const response = await callLLMWithRetry(prompt, true)
      const parsed = await robustJSONParse(response, 'SPECIAL')
      
      addLog('success', 'Специални препоръки генерирани успешно')
      return parsed.recommendations
    } catch (error) {
      addLog('error', `Грешка при специални препоръки: ${error}`)
      throw error
    }
  }

  const generateTestRecommendations = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Генериране на препоръки за медицински изследвания...')
      
      const concernZones = [
        ...leftAnalysis.zones.filter(z => z.status === 'concern'),
        ...rightAnalysis.zones.filter(z => z.status === 'concern')
      ]
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Препоръчай медицински изследвания на български език за:

ЗОНИ С ПРИТЕСНЕНИЯ:
${concernZones.map(z => `${z.organ}: ${z.findings}`).join('\n')}

ЗДРАВЕН СТАТУС: ${questionnaire.healthStatus.join(', ')}
ВЪЗРАСТ: ${questionnaire.age}
ОПЛАКВАНИЯ: ${questionnaire.complaints || 'Няма'}

Препоръчай 8-15 конкретни медицински изследвания/тестове които:
- Са релевантни към иридологичните находки
- Помагат за верификация на състоянията
- Са практични и достъпни
- Включват кръвни тестове, хормонални панели, образна диагностика

Върни масив от имена на изследвания.

JSON формат:
{
  "tests": ["изследване 1", "изследване 2"]
}`

      const response = await callLLMWithRetry(prompt, true)
      const parsed = await robustJSONParse(response, 'TESTS')
      
      addLog('success', 'Препоръки за изследвания генерирани успешно')
      return parsed.tests
    } catch (error) {
      addLog('error', `Грешка при изследвания: ${error}`)
      throw error
    }
  }

  const generateDetailedAnalysis = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData
  ) => {
    try {
      addLog('info', 'Генериране на детайлен иридологичен анализ...')
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Създай задълбочен, детайлен иридологичен анализ на български език (800-1200 думи).

ДАННИ ЗА АНАЛИЗ:
Ляв ирис - Здраве: ${leftAnalysis.overallHealth}/100
Зони: ${JSON.stringify(leftAnalysis.zones.map(z => ({organ: z.organ, status: z.status, findings: z.findings})))}
Артефакти: ${JSON.stringify(leftAnalysis.artifacts)}
Системи: ${JSON.stringify(leftAnalysis.systemScores)}

Десен ирис - Здраве: ${rightAnalysis.overallHealth}/100
Зони: ${JSON.stringify(rightAnalysis.zones.map(z => ({organ: z.organ, status: z.status, findings: z.findings})))}
Артефакти: ${JSON.stringify(rightAnalysis.artifacts)}
Системи: ${JSON.stringify(rightAnalysis.systemScores)}

ПАЦИЕНТ:
Възраст: ${questionnaire.age}, Пол: ${questionnaire.gender}
BMI: ${(questionnaire.weight / ((questionnaire.height / 100) ** 2)).toFixed(1)}
Цели: ${questionnaire.goals.join(', ')}
Здравен статус: ${questionnaire.healthStatus.join(', ')}
Оплаквания: ${questionnaire.complaints}

Създай професионален, задълбочен анализ който включва:

1. ОБЩ ПРЕГЛЕД (2-3 параграфа)
   - Обща оценка на здравословното състояние
   - Конституционен тип на ириса
   - Генетична предразположеност

2. ДЕТАЙЛЕН АНАЛИЗ ПО ЗОНИ (4-5 параграфа)
   - Подробно описание на всяка проблемна зона
   - Връзки между зони и системи
   - Патологични индикатори

3. АРТЕФАКТИ И ЗНАЧЕНИЯ (2-3 параграфа)
   - Интерпретация на лакуни, крипти, пигменти
   - Значение за здравето
   - Хронология на състоянията

4. СИСТЕМЕН АНАЛИЗ (3-4 параграфа)
   - Детайлна оценка на всяка система
   - Взаимовръзки между системите
   - Компенсаторни механизми

5. ПЕРСОНАЛИЗИРАНИ ИЗВОДИ (2-3 параграфа)
   - Връзка с целите на пациента
   - Специфични рискови фактори
   - Прогноза и потенциал за подобрение

Текстът да е професионален, но разбираем за пациента.
Върни само текста (не JSON), добре структуриран с параграфи.`

      const response = await callLLMWithRetry(prompt, false)
      
      addLog('success', `Детайлен анализ генериран (${response.length} символа)`)
      return response
    } catch (error) {
      addLog('error', `Грешка при детайлен анализ: ${error}`)
      throw error
    }
  }

  const generateSummaries = async (
    leftAnalysis: IrisAnalysis,
    rightAnalysis: IrisAnalysis,
    questionnaire: QuestionnaireData,
    detailedAnalysis: string
  ) => {
    try {
      addLog('info', 'Генериране на резюмета...')
      
      const avgHealth = Math.round((leftAnalysis.overallHealth + rightAnalysis.overallHealth) / 2)
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Създай ДВЕ резюмета на български език:

1. КРАТКО РЕЗЮМЕ (briefSummary) - 3-5 КЛЮЧОВИ ТОЧКИ като масив
   - Много кратки, ясни изречения
   - Само най-важната информация
   - Фокус върху общото състояние и основни находки

2. МОТИВАЦИОННО РЕЗЮМЕ (motivationalSummary) - 1-2 изречения
   - Оптимистично и мотивиращо
   - Обобщава основната идея на плана
   - Дава увереност и насърчение

ДАННИ:
Общо здраве: ${avgHealth}/100
Цели: ${questionnaire.goals.join(', ')}
Основни находки: ${detailedAnalysis.substring(0, 500)}...

Върни САМО валиден JSON:
{
  "briefSummary": ["точка 1", "точка 2", "точка 3"],
  "motivationalSummary": "мотивиращ текст"
}`

      const response = await callLLMWithRetry(prompt, true)
      const parsed = await robustJSONParse(response, 'SUMMARIES')
      
      addLog('success', 'Резюмета генерирани успешно')
      return {
        briefSummary: parsed.briefSummary.join('\n• '),
        motivationalSummary: parsed.motivationalSummary
      }
    } catch (error) {
      addLog('error', `Грешка при резюмета: ${error}`)
      throw error
    }
  }

  const convertToRecommendations = (foodPlan: any, supplements: any[], psychRecs: string[], specialRecs: string[]): Recommendation[] => {
    const recs: Recommendation[] = []
    
    foodPlan.generalRecommendations.forEach((rec: string) => {
      recs.push({
        category: 'diet',
        title: 'Хранителна препоръка',
        description: rec,
        priority: 'high'
      })
    })
    
    supplements.forEach((supp: any) => {
      recs.push({
        category: 'supplement',
        title: supp.name,
        description: `${supp.dosage} - ${supp.timing}`,
        priority: 'high'
      })
    })
    
    psychRecs.forEach((rec: string) => {
      recs.push({
        category: 'lifestyle',
        title: 'Психологическа препоръка',
        description: rec,
        priority: 'medium'
      })
    })
    
    return recs
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
      const response = await callLLMWithRetry(prompt, false)
      
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
              {error ? 'Моля, изчакайте 1-2 минути и натиснете "Опитай отново"' : 'Анализираме вашите ириси с изкуствен интелект'}
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
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      ℹ️ {aiConfig?.useCustomKey 
                        ? `Процесът с вашия ${aiConfig.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API ключ отнема 30-60 секунди.` 
                        : 'Процесът с GitHub Spark модела (gpt-4o-mini) отнема 4-6 минути. Приложението изчаква 60 секунди между заявките за избягване на rate limit.'}
                    </p>
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
