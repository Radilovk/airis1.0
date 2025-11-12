import { useEffect, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkle, Warning, Bug } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { QuestionnaireData, IrisImage, AnalysisReport, IrisAnalysis, AIModelConfig, IridologyTextbook } from '@/types'

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
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false
  })
  
  const [textbooks] = useKV<IridologyTextbook[]>('iridology-textbooks', [])

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
    provider: 'openai' | 'gemini',
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
    
    const useCustomAPI = aiConfig?.useCustomKey && aiConfig?.apiKey
    const provider = aiConfig?.provider || 'openai'
    const actualModel = aiConfig?.model || 'gpt-4o'
    
    if (useCustomAPI) {
      addLog('info', `🔧 Режим: Собствен API (${provider} - ${actualModel})`)
    } else {
      addLog('info', `🔧 Режим: GitHub Spark вграден модел (gpt-4o-mini за по-малко заявки)`)
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const waitTime = useCustomAPI ? 5000 : Math.min(30000 * attempt, 120000)
          addLog('warning', `Изчакване ${(waitTime / 1000).toFixed(0)}s преди опит ${attempt}/${maxRetries}...`)
          await sleep(waitTime)
        }
        
        addLog('info', `LLM заявка (опит ${attempt}/${maxRetries})...`)
        
        let response: string
        if (useCustomAPI) {
          response = await callExternalAPI(
            prompt,
            provider,
            actualModel,
            aiConfig!.apiKey,
            jsonMode
          )
        } else {
          response = await window.spark.llm(prompt, 'gpt-4o-mini', jsonMode)
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
            const openBraces = (extracted.match(/\{/g) || []).length
            const closeBraces = (extracted.match(/\}/g) || []).length
            const openBrackets = (extracted.match(/\[/g) || []).length
            const closeBrackets = (extracted.match(/\]/g) || []).length
            
            if (openBraces > closeBraces) {
              addLog('warning', `Липсват ${openBraces - closeBraces} затварящи скоби }`)
              extracted += '}'.repeat(openBraces - closeBraces)
            }
            if (openBrackets > closeBrackets) {
              addLog('warning', `Липсват ${openBrackets - closeBrackets} затварящи скоби ]`)
              extracted += ']'.repeat(openBrackets - closeBrackets)
            }
            
            const quotes = (extracted.match(/(?<!\\)"/g) || []).length
            if (quotes % 2 !== 0) {
              addLog('warning', 'Нечетен брой кавички - опит за поправка')
              const lastQuoteIndex = extracted.lastIndexOf('"')
              if (lastQuoteIndex > -1) {
                const beforeLastQuote = extracted.substring(0, lastQuoteIndex)
                const afterLastQuote = extracted.substring(lastQuoteIndex + 1)
                const commaIndex = afterLastQuote.indexOf(',')
                const braceIndex = afterLastQuote.indexOf('}')
                const bracketIndex = afterLastQuote.indexOf(']')
                
                const indices = [commaIndex, braceIndex, bracketIndex].filter(i => i > -1)
                if (indices.length > 0) {
                  const insertIndex = Math.min(...indices)
                  extracted = beforeLastQuote + '"' + afterLastQuote.substring(0, insertIndex) + '"' + afterLastQuote.substring(insertIndex)
                } else {
                  extracted += '"'
                }
              }
            }
            
            try {
              const result = JSON.parse(extracted)
              addLog('success', `JSON поправен и парсиран успешно (${context})`)
              return result
            } catch (repairError) {
              addLog('warning', `Поправката не помогна, опит с по-агресивна поправка...`)
              
              try {
                let aggressive = extracted
                  .replace(/,(\s*[}\]])/g, '$1')
                  .replace(/([}\]])([}\]])/g, '$1,$2')
                  .replace(/\s+/g, ' ')
                
                const result = JSON.parse(aggressive)
                addLog('success', `JSON парсиран след агресивна поправка (${context})`)
                return result
              } catch (aggressiveError) {
                addLog('error', `Агресивната поправка също не помогна`)
              }
            }
          }
        } catch (extractError) {
          addLog('error', `Не може да се извлече валиден JSON (${context})`)
        }
        
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
      
      const waitTime = aiConfig?.useCustomKey ? 3000 : 60000
      addLog('info', `⏳ Изчакване ${waitTime/1000} сек. за избягване на rate limit...`)
      await sleep(waitTime)
      
      setProgress(40)
      setStatus('Анализиране на десен ирис...')
      addLog('info', 'Започване анализ на десен ирис...')
      console.log('👁️ [АНАЛИЗ] Започване анализ на десен ирис...')
      
      const rightAnalysis = await analyzeIris(rightIris, 'right', questionnaireData)
      addLog('success', 'Десен ирис анализиран успешно')
      console.log('✅ [АНАЛИЗ] Десен ирис анализиран успешно:', rightAnalysis)
      
      const waitTime2 = aiConfig?.useCustomKey ? 3000 : 60000
      addLog('info', `⏳ Изчакване ${waitTime2/1000} сек. за избягване на rate limit...`)
      await sleep(waitTime2)
      
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
      
      const waitTime3 = aiConfig?.useCustomKey ? 3000 : 60000
      addLog('info', `⏳ Изчакване ${waitTime3/1000} сек. за избягване на rate limit...`)
      await sleep(waitTime3)
      
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
        leftIrisImage: leftIris,
        rightIrisImage: rightIris,
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
      
      addLog('info', `BMI: ${bmi}, Възраст: ${questionnaire.age}, Пол: ${genderName}`)
      console.log(`📝 [ИРИС ${side}] BMI: ${bmi}, Възраст: ${questionnaire.age}, Пол: ${genderName}`)
      console.log(`📝 [ИРИС ${side}] Цели: ${goalsText}`)
      
      let textbookContext = ''
      if (textbooks && textbooks.length > 0) {
        addLog('info', `Зареждане на ${textbooks.length} учебника/учебници за контекст...`)
        textbookContext = '\n\nРЕФЕРЕНТНИ МАТЕРИАЛИ ПО ИРИДОЛОГИЯ:\n\n'
        textbooks.forEach((tb) => {
          textbookContext += `--- ${tb.name} ---\n${tb.content.substring(0, 2000)}\n\n`
        })
        addLog('success', `Учебници заредени (${textbookContext.length} символа)`)
      }
      
      addLog('info', 'Подготовка на prompt за LLM...')
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Ти си иридолог. Анализирай ${sideName} ирис.

Пациент: Възраст ${questionnaire.age}, Пол ${genderName}, BMI ${bmi}
Цели: ${goalsText}
Оплаквания: ${complaintsText}
${textbookContext}

Анализирай 8-12 зони по часовника (12:00 горе): Мозък, Щитовидна, Белодробна, Черен дроб, Стомах, Дебело черво, Урогенитална, Бъбреци, Далак, Сърце, Ендокринна, Нервна.

За всяка зона: status (normal/attention/concern), findings (до 60 символа).

Идентифицирай 2-4 артефакта: лакуни, крипти, пигменти, радиални линии, пръстени.

Генерирай 6 system scores (0-100): Храносмилателна, Имунна, Нервна, Сърдечно-съдова, Детоксикация, Ендокринна.

ВАЖНО:
- Върни САМО валиден JSON
- Кратки описания (до 60 символа)
- БЕЗ нови редове (\\n) в текстове
- БЕЗ вътрешни двойни кавички
- Използвай единични кавички ' вместо двойни " в текстове

JSON формат:
{
  "analysis": {
    "zones": [{"id": 1, "name": "име", "organ": "орган", "status": "normal", "findings": "текст до 60 символа", "angle": [0, 30]}],
    "artifacts": [{"type": "тип", "location": "локация", "description": "текст до 60 символа", "severity": "low"}],
    "overallHealth": 75,
    "systemScores": [{"system": "система", "score": 80, "description": "текст до 60 символа"}]
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
