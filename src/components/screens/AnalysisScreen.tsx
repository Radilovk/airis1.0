import { useEffect, useState } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
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
  const [status, setStatus] = useState('Зареждане на AI конфигурация...')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [loadedConfig, setLoadedConfig] = useState<AIModelConfig | null>(null)
  const [analysisRunning, setAnalysisRunning] = useState(false)
  
  const [aiConfig] = useKVWithFallback<AIModelConfig>('ai-model-config', {
    provider: 'github-spark',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false,
    requestDelay: 60000,
    requestCount: 8
  })

  const getValidSparkModel = (model: string): 'gpt-4o' | 'gpt-4o-mini' => {
    if (model === 'gpt-4o' || model === 'gpt-4o-mini') {
      return model
    }
    console.warn(`⚠️ [МОДЕЛ] Невалиден модел за GitHub Spark: "${model}", използва се по подразбиране "gpt-4o"`)
    return 'gpt-4o'
  }

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
            maxOutputTokens: 16384
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
    maxRetries: number = 2
  ): Promise<string> => {
    let lastError: Error | null = null
    
    const storedConfig = await window.spark.kv.get<AIModelConfig>('ai-model-config')
    const finalConfig = storedConfig || aiConfig || {
      provider: 'github-spark',
      model: 'gpt-4o',
      apiKey: '',
      useCustomKey: false,
      requestDelay: 60000,
      requestCount: 8
    }
    
    const provider = finalConfig.provider
    const configuredModel = finalConfig.model
    const requestDelay = finalConfig.requestDelay || 60000
    
    const hasAPIKey = finalConfig.apiKey && finalConfig.apiKey.trim() !== ''
    const isExternalProvider = provider === 'gemini' || provider === 'openai'
    const hasCustomAPI = hasAPIKey && isExternalProvider
    const useCustomAPI = hasCustomAPI || (finalConfig.useCustomKey && hasAPIKey && isExternalProvider)
    
    console.log(`🔍 [LLM CONFIG DEBUG] Provider от конфигурация: "${provider}"`)
    console.log(`🔍 [LLM CONFIG DEBUG] Model от конфигурация: "${configuredModel}"`)
    console.log(`🔍 [LLM CONFIG DEBUG] useCustomKey flag: ${finalConfig.useCustomKey}`)
    console.log(`🔍 [LLM CONFIG DEBUG] Has API key: ${hasAPIKey}`)
    console.log(`🔍 [LLM CONFIG DEBUG] isExternalProvider: ${isExternalProvider}`)
    console.log(`🔍 [LLM CONFIG DEBUG] hasCustomAPI: ${hasCustomAPI}`)
    console.log(`🔍 [LLM CONFIG DEBUG] useCustomAPI (final): ${useCustomAPI}`)
    
    let actualModel: string
    let actualProvider: string
    let sparkModel: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o'
    
    if (useCustomAPI) {
      actualModel = configuredModel
      actualProvider = provider
      console.log(`🎯 [LLM CONFIG] ✅ Използване на СОБСТВЕН API`)
      console.log(`🎯 [LLM CONFIG] Provider: ${actualProvider}`)
      console.log(`🎯 [LLM CONFIG] Model: ${actualModel}`)
      addLog('info', `✓ AI Конфигурация заредена: ${actualProvider} / ${actualModel}`)
      addLog('info', `🔧 Режим: Собствен API (${actualProvider} - ${actualModel}) | Забавяне: ${requestDelay}ms`)
    } else {
      actualProvider = 'github-spark'
      sparkModel = getValidSparkModel(configuredModel)
      actualModel = sparkModel
      console.log(`✓ [LLM CONFIG] Използване на GitHub Spark API`)
      console.log(`🎯 [LLM CONFIG] Provider (актуален): ${actualProvider}`)
      console.log(`🎯 [LLM CONFIG] Настроен модел: "${configuredModel}"`)
      console.log(`🎯 [LLM CONFIG] Актуален модел: "${actualModel}"`)
      addLog('info', `✓ AI Конфигурация заредена: ${actualProvider} / ${actualModel}`)
      addLog('info', `🔧 Режим: GitHub Spark вграден модел (${actualModel}) | Забавяне: ${requestDelay}ms`)
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const waitTime = useCustomAPI ? 20000 : 180000
          addLog('warning', `Изчакване ${(waitTime / 1000).toFixed(0)}s преди опит ${attempt}/${maxRetries}...`)
          await sleep(waitTime)
        }
        
        addLog('info', `LLM заявка (опит ${attempt}/${maxRetries}) към ${actualProvider}/${actualModel}...`)
        console.log(`🤖 [LLM] Заявка ${attempt}/${maxRetries} към ${actualProvider} с модел ${actualModel}`)
        
        let response: string
        if (useCustomAPI) {
          addLog('info', `→ ✅ Извикване на СОБСТВЕН ${actualProvider} API с модел ${actualModel}`)
          console.log(`🔑 [API CALL] Използване на собствен ${actualProvider} API ключ`)
          response = await callExternalAPI(
            prompt,
            actualProvider as 'openai' | 'gemini',
            actualModel,
            finalConfig.apiKey,
            jsonMode
          )
        } else {
          addLog('info', `→ ✅ Използване на GitHub Spark API с модел ${actualModel}`)
          console.log(`🌟 [SPARK] Извикване на window.spark.llm с модел ${actualModel}`)
          response = await window.spark.llm(prompt, actualModel as 'gpt-4o' | 'gpt-4o-mini', jsonMode)
        }
        
        if (response && response.length > 0) {
          addLog('success', `LLM отговори успешно (${response.length} символа)`)
          console.log(`✅ [LLM] Успешен отговор от ${actualProvider}/${actualModel}`)
          return response
        } else {
          throw new Error('Празен отговор от LLM')
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const errorMsg = lastError.message
        
        if (errorMsg.includes('429') || errorMsg.includes('Too many requests') || errorMsg.includes('rate limit')) {
          addLog('error', `⏱️ Rate limit достигнат - твърде много заявки!`)
          if (attempt < maxRetries) {
            const backoffTime = useCustomAPI ? 30000 : 300000
            addLog('warning', `⏳ Изчакване ${(backoffTime / 60000).toFixed(1)} минути преди повторен опит...`)
            await sleep(backoffTime)
            continue
          } else {
            throw new Error(`Rate limit достигнат. ${useCustomAPI ? 'Проверете вашия API лимит и изчакайте.' : 'GitHub Spark API има ограничения. Моля изчакайте 5-10 минути или добавете собствен API ключ в Admin панела.'}`)
          }
        } else {
          addLog('error', `LLM грешка (опит ${attempt}): ${errorMsg}`)
          if (attempt < maxRetries) {
            await sleep(8000)
            continue
          }
        }
      }
    }
    
    throw lastError || new Error('LLM заявката се провали след всички опити')
  }

  const robustJSONParse = async (response: string, context: string): Promise<any> => {
    let cleaned = response.trim()
    
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      addLog('info', `Премахнати markdown блокове с \`\`\`json`)
    } else if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```\s*/g, '').trim()
      addLog('info', `Премахнати markdown блокове с \`\`\``)
    }
    
    try {
      return JSON.parse(cleaned)
    } catch (parseError) {
      addLog('error', `JSON parse грешка (${context}): ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      console.error(`❌ [${context}] JSON parse грешка:`, parseError)
      console.error(`📄 [${context}] Проблемен JSON (първи 500 символа):`, cleaned.substring(0, 500))
      console.error(`📄 [${context}] Проблемен JSON (последни 500 символа):`, cleaned.substring(cleaned.length - 500))
      
      addLog('warning', `Опит за почистване и повторно парсиране (${context})...`)
      
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
            
            extracted = extracted
              .replace(/,\s*$/, '')
              .replace(/,(\s*[}\]])/g, '$1')
            
            try {
              let fixed = extracted
              
              let quoteCount = 0
              let inString = false
              const fixedChars: string[] = []
              
              for (let i = 0; i < fixed.length; i++) {
                const char = fixed[i]
                const prevChar = i > 0 ? fixed[i - 1] : ''
                
                if (char === '"' && prevChar !== '\\') {
                  quoteCount++
                  inString = !inString
                }
                fixedChars.push(char)
              }
              
              if (quoteCount % 2 !== 0) {
                addLog('warning', 'Незатворен string - добавяне на затваряща кавичка')
                fixedChars.push('"')
                inString = false
              }
              
              fixed = fixedChars.join('')
              
              const openBraces = (fixed.match(/\{/g) || []).length
              const closeBraces = (fixed.match(/\}/g) || []).length
              const openBrackets = (fixed.match(/\[/g) || []).length
              const closeBrackets = (fixed.match(/\]/g) || []).length
              
              const missingBraces = openBraces - closeBraces
              const missingBrackets = openBrackets - closeBrackets
              
              if (missingBrackets > 0 || missingBraces > 0) {
                addLog('warning', `Липсват ${missingBrackets} затварящи скоби ] и ${missingBraces} затварящи скоби }`)
                
                const lastChar = fixed.trim().slice(-1)
                const needsComma = lastChar !== ',' && lastChar !== '[' && lastChar !== '{'
                
                if (missingBrackets > 0) {
                  if (needsComma && (lastChar === '"' || lastChar === '}')) {
                    fixed = fixed.trimEnd()
                  }
                  fixed += ']'.repeat(missingBrackets)
                }
                if (missingBraces > 0) {
                  fixed += '}'.repeat(missingBraces)
                }
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
                
                const missingBrackets = openBrackets - closeBrackets
                const missingBraces = openBraces - closeBraces
                
                if (missingBrackets > 0) {
                  aggressive += ']'.repeat(missingBrackets)
                }
                if (missingBraces > 0) {
                  aggressive += '}'.repeat(missingBraces)
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
    let mounted = true
    
    const loadConfigAndStartAnalysis = async () => {
      try {
        if (!mounted) {
          console.log('⚠️ [ANALYSIS] Component unmounted, aborting')
          return
        }
        
        if (configLoaded || analysisStarted || analysisRunning) {
          console.log('⚠️ [ANALYSIS] Анализ вече е стартиран, пропускане...')
          console.log(`📊 [ANALYSIS] configLoaded: ${configLoaded}, analysisStarted: ${analysisStarted}, analysisRunning: ${analysisRunning}`)
          return
        }
        
        console.log('🚀 [ANALYSIS] ANALYSIS SCREEN MOUNTED!')
        console.log('📍 [ANALYSIS] componentDidMount - започва зареждане на конфигурация')
        
        console.log('🔍 [ANALYSIS] Проверка на изображения преди старт...')
        if (!leftIris || !rightIris) {
          throw new Error('Липсват изображения на ириса')
        }
        
        if (!leftIris.dataUrl || !rightIris.dataUrl) {
          throw new Error('Невалидни данни на изображенията')
        }
        
        console.log('✅ [ANALYSIS] Изображения са валидни')
        console.log(`📊 [ANALYSIS] Left iris size: ${Math.round(leftIris.dataUrl.length / 1024)} KB`)
        console.log(`📊 [ANALYSIS] Right iris size: ${Math.round(rightIris.dataUrl.length / 1024)} KB`)
        
        await sleep(500)
        
        if (!mounted) {
          console.log('⚠️ [ANALYSIS] Component unmounted during sleep, aborting')
          return
        }
        
        console.log('⚙️ [ANALYSIS] Зареждане на AI конфигурация от KV storage...')
        const storedConfig = await window.spark.kv.get<AIModelConfig>('ai-model-config')
        const finalConfig = storedConfig || aiConfig
        
        if (!finalConfig) {
          console.warn('⚠️ [CONFIG] Няма конфигурация - използване на default')
          if (mounted) {
            setConfigLoaded(true)
            setAnalysisStarted(true)
            setAnalysisRunning(true)
            performAnalysis()
          }
          return
        }
        
        const hasAPIKey = finalConfig.apiKey && finalConfig.apiKey.trim() !== ''
        const isExternalProvider = finalConfig.provider === 'gemini' || finalConfig.provider === 'openai'
        const hasCustomAPI = hasAPIKey && isExternalProvider
        const useCustomAPI = hasCustomAPI || (finalConfig.useCustomKey && hasAPIKey && isExternalProvider)
        
        let modelToUse: string
        let providerToUse: string
        
        console.log('🔍 [CONFIG DEBUG] finalConfig от KV:', finalConfig)
        console.log('🔍 [CONFIG DEBUG] hasAPIKey:', hasAPIKey)
        console.log('🔍 [CONFIG DEBUG] isExternalProvider:', isExternalProvider)
        console.log('🔍 [CONFIG DEBUG] hasCustomAPI:', hasCustomAPI)
        console.log('🔍 [CONFIG DEBUG] useCustomAPI (final):', useCustomAPI)
        
        if (!useCustomAPI) {
          providerToUse = 'github-spark'
          modelToUse = getValidSparkModel(finalConfig.model)
          console.log(`🔧 [CONFIG] GitHub Spark режим - Конфигуриран модел: "${finalConfig.model}", валиден Spark модел: "${modelToUse}"`)
        } else {
          providerToUse = finalConfig.provider
          modelToUse = finalConfig.model
          console.log(`🔧 [CONFIG] Собствен API режим - Provider: ${providerToUse}, модел: "${modelToUse}"`)
        }
        
        if (!mounted) {
          console.log('⚠️ [ANALYSIS] Component unmounted before starting analysis, aborting')
          return
        }
        
        addLog('info', `✓ AI Конфигурация заредена: ${providerToUse} / ${modelToUse}`)
        console.log('🔧 [CONFIG] AI конфигурация заредена:', finalConfig)
        console.log('🎯 [CONFIG] Provider който ще се използва:', providerToUse)
        console.log('🎯 [CONFIG] Модел който ще се използва:', modelToUse)
        
        setLoadedConfig(finalConfig)
        setConfigLoaded(true)
        setAnalysisStarted(true)
        setAnalysisRunning(true)
        
        console.log('🎬 [ANALYSIS] Стартиране на performAnalysis()...')
        performAnalysis()
      } catch (error) {
        console.error('❌ [ANALYSIS] КРИТИЧНА ГРЕШКА при mount:', error)
        const errorMsg = error instanceof Error ? error.message : String(error)
        setError(`Грешка при стартиране на анализа: ${errorMsg}`)
        setStatus('Грешка при зареждане')
        addLog('error', `Фатална грешка при mount: ${errorMsg}`)
      }
    }
    
    console.log('🔄 [ANALYSIS] useEffect извикан')
    loadConfigAndStartAnalysis()
    
    return () => {
      console.log('🧹 [ANALYSIS] Component unmounting, cleanup')
      mounted = false
    }
  }, [])

  const performAnalysis = async () => {
    if (analysisRunning) {
      console.warn('⚠️ [АНАЛИЗ] performAnalysis вече работи, пропускане на дублирано извикване!')
      return
    }
    
    console.log('🎬 [АНАЛИЗ] performAnalysis() STARTED')
    console.log('📊 [АНАЛИЗ] leftIris валиден:', !!leftIris)
    console.log('📊 [АНАЛИЗ] rightIris валиден:', !!rightIris)
    console.log('📊 [АНАЛИЗ] questionnaireData валиден:', !!questionnaireData)
    
    try {
      const storedConfig = await window.spark.kv.get<AIModelConfig>('ai-model-config')
      const finalConfig = storedConfig || aiConfig || {
        provider: 'github-spark',
        model: 'gpt-4o',
        apiKey: '',
        useCustomKey: false,
        requestDelay: 60000,
        requestCount: 8
      }
      
      const provider = finalConfig.provider
      const configuredModel = finalConfig.model
      const requestDelay = finalConfig.requestDelay || 60000
      const requestCount = finalConfig.requestCount || 8
      
      const hasAPIKey = finalConfig.apiKey && finalConfig.apiKey.trim() !== ''
      const isExternalProvider = provider === 'gemini' || provider === 'openai'
      const hasCustomAPI = hasAPIKey && isExternalProvider
      const useCustomAPI = hasCustomAPI || (finalConfig.useCustomKey && hasAPIKey && isExternalProvider)
      
      let actualModel: string
      let actualProvider: string = provider
      
      if (!useCustomAPI) {
        actualProvider = 'github-spark'
        actualModel = getValidSparkModel(configuredModel)
        console.log(`🚀 [АНАЛИЗ] GitHub Spark режим - Конфигуриран: "${configuredModel}", валиден: "${actualModel}"`)
      } else {
        actualModel = configuredModel
        actualProvider = provider
        console.log(`🚀 [АНАЛИЗ] Собствен API режим - Provider: ${actualProvider}, модел: "${actualModel}"`)
      }
      
      addLog('info', 'Стартиране на анализ...')
      addLog('info', `⚙️ AI Настройки: Provider=${actualProvider}, Model=${actualModel}, CustomAPI=${useCustomAPI}`)
      addLog('info', `⚙️ Параметри: Забавяне=${requestDelay}ms, Заявки=${requestCount}`)
      addLog('info', `Данни от въпросник: Възраст ${questionnaireData.age}, Пол ${questionnaireData.gender}`)
      addLog('info', `Здравни цели: ${questionnaireData.goals.join(', ')}`)
      console.log('🚀 [АНАЛИЗ] Стартиране на анализ...')
      console.log('⚙️ [АНАЛИЗ] AI Конфигурация:', finalConfig)
      console.log('🎯 [АНАЛИЗ] Provider който ще се използва:', actualProvider)
      console.log('🎯 [АНАЛИЗ] Модел който ще се използва:', actualModel)
      console.log('📊 [АНАЛИЗ] Данни от въпросник:', questionnaireData)
      
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
      console.log('✅ [АНАЛИЗ] performAnalysis() ЗАВЪРШЕН УСПЕШНО')
      setAnalysisRunning(false)
      
      setTimeout(() => {
        console.log('🚀 [АНАЛИЗ] Извикване на onComplete() callback...')
        onComplete(report)
      }, 1000)
    } catch (error) {
      console.error('❌ [АНАЛИЗ] КРИТИЧНА ГРЕШКА в performAnalysis()!')
      setAnalysisRunning(false)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : 'Няма stack trace'
      
      let userFriendlyMessage = errorMessage
      if (errorMessage.includes('429') || errorMessage.includes('Too many requests') || errorMessage.includes('rate limit') || errorMessage.includes('Rate limit')) {
        userFriendlyMessage = `⏱️ Rate Limit Достигнат

GitHub Spark API има ограничения за брой заявки в минута.

🔧 Решения:
1. ⏳ Изчакайте 5-10 минути и опитайте отново
2. 🔑 Добавете собствен API ключ в Admin панела:
   • OpenAI (препоръчано за стабилност)
   • Google Gemini (безплатен tier с по-висок лимит)

💡 С собствен API ключ няма да имате rate limit проблеми.`
        addLog('error', 'Rate limit достигнат - твърде много заявки.')
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
РЕФЕРЕНТНА КАРТА НА ИРИСА(12h=0°,часовн_посока,360°_пълен_кръг):
${AIRIS_KNOWLEDGE.irisMap.zones.map(z => `${z.hour}(${z.angle[0]}-${z.angle[1]}°):${z.organ}(${z.system})`).join('|')}

АРТЕФАКТИ_И_ЗНАЧЕНИЯ:
${AIRIS_KNOWLEDGE.artifacts.types.map(a => `${a.name}:${a.interpretation}`).join('|')}

ПРЕПОРЪКИ_СИСТЕМИ:
Храносмилателна:${AIRIS_KNOWLEDGE.systemAnalysis.digestive.recommendations.join(',')}
Имунна:${AIRIS_KNOWLEDGE.systemAnalysis.immune.recommendations.join(',')}
Нервна:${AIRIS_KNOWLEDGE.systemAnalysis.nervous.recommendations.join(',')}
Детоксикация:${AIRIS_KNOWLEDGE.systemAnalysis.detox.recommendations.join(',')}
`
      addLog('success', `База знания заредена (${knowledgeContext.length} символа)`)
      
      addLog('info', 'Подготовка на prompt за LLM...')
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`ИРИДОЛОГ|IMG_ID:${imageHash}|СТРАНА:${sideName}

⚠️ КРИТИЧНО ПРАВИЛО - ОБЕКТИВЕН АНАЛИЗ:
АНАЛИЗИРАЙ САМО ТОВА, КОЕТО РЕАЛНО ВИЖДАШ НА СНИМКАТА!
НЕ създавай "виртуални" находки базирани на въпросника.
Топографската карта отразява ЕДИНСТВЕНО визуално наблюдаваното.

Въпросникът се използва САМО ЗА:
- Тълкуване на реално съществуващите находки
- Приоритизиране (висок приоритет = находка + симптом)
- Контекстуализиране на находките

ЛОГИКА ЗА МАРКИРАНЕ НА ЗОНИ:
1. ЯСНА НАХОДКА + СЪОТВЕТЕН СИМПТОМ = status:"concern"|priority:high
2. ЯСНА НАХОДКА БЕЗ СИМПТОМ = status:"attention"|priority:medium (потенциална уязвимост)
3. БЕЗ НАХОДКА + СИМПТОМ = status:"normal" (НЕ маркирай като проблем - търси други оси)
4. БЕЗ НАХОДКА БЕЗ СИМПТОМ = status:"normal"

КОНТЕКСТ_ПАЦИЕНТ (само_за_интерпретация):
Възр:${questionnaire.age}|Пол:${genderName}|BMI:${bmi}
Оплаквания:${complaintsText}
Цели:${goalsText}

КАРТА_ИРИС:
${knowledgeContext}

ЗАДАЧА:Обективен_визуален_анализ ${sideName} ирис.12h=0°=връх,часовн_посока.Angle_ВИНАГИ_0-360°.

1.ЗОНИ(8-12)–angle_ЗАДЪЛЖИТЕЛНО_правилни_0-360°:
   12h(0-30°)→Мозък/Нервна
   1-2h(30-90°)→Щ.жлеза/Ендокринна
   3h(90-120°)→Белодроб${side==='right'?'(R)':''}
   4h(120-150°)→Черен_дроб/Жлъчка
   5-6h(150-210°)→Стомах/Панкреас
   7-8h(210-270°)→Черва/Колон
   9h(270-300°)→Урогенитална${side==='left'?'(L)':''}
   10h(300-330°)→Бъбреци
   11h(330-360°)→Далак/Лимфна
   
Per_зона:id(1-12)|name(БГ)|organ(БГ)|status(normal/attention/concern)|findings(<80симв_БГ,описва_САМО_видимото)|angle=[start,end]°

⚠️ findings_трябва_да_описва:
- "Визуално_чиста_зона" АКО няма находки
- "Лека_дисколорация_в_горния_сектор" АКО има находка
- "Няколко_малки_лакуни_около_3h" АКО има находка
НЕ ПИШИ симптоми от въпросника!

2.АРТЕФАКТИ(0-8)–САМО_реално_видими:
ИГНОРИРАЙ:ярки_бели_отражения,огледални_ефекти,сенки_от_светлина
ВКЛЮЧИ_САМО_АКО_ВИДИШ:лакуни(тъмни_процепи)|крипти(малки_дупки)|пигменти(цветни_петна)|радиални_линии(център→ръб)|автоном_пръстен(кръг_зеница)

Per_артефакт:type(БГ)|location(часовник_БГ)|description(<60симв_БГ_визуално_описание)|severity(low/med/high)

⚠️ АКО_НЕ_ВИЖДАШ_артефакти → върни_празен_масив_[]

3.ОБЩО_ЗДРАВЕ:int 0-100 базирано_САМО_на_реални_визуални_находки

4.СИСТЕМНИ_ОЦЕНКИ(6 системи,0-100):
Храносмилателна,Имунна,Нервна,Сърдечно-съдова,Детоксикация,Ендокринна
Per_система:system(име_БГ)|score(int_базиран_на_визуални_находки)|description(<60симв_БГ)

ФОРМАТ:
-САМО_валиден_JSON
-БЕЗ_markdown(БЕЗ \`\`\`json или \`\`\`)
-БЕЗ_нови_редове_в_текст
-БЕЗ_двойни_кавички_в_strings
-САМО_БЪЛГАРСКИ_език

JSON:
{
  "analysis": {
    "zones": [
      {"id": 1, "name": "Мозъчна зона", "organ": "Мозък", "status": "normal", "findings": "Визуално чиста зона без забележими находки", "angle": [0, 30]}
    ],
    "artifacts": [
      {"type": "Лакуни", "location": "3:00-4:00", "description": "Две малки тъмни процепи", "severity": "low"}
    ],
    "overallHealth": 75,
    "systemScores": [
      {"system": "Храносмилателна", "score": 80, "description": "Умерена дисколорация в стомашната зона"}
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
      console.log('📊 [ПРЕПОРЪКИ] Десен ирис наход��и (не-нормални зони):', rightFindings)
      
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

КРИТИЧНО ВАЖНО ЗА ФОРМАТ:
- ВЪРНИ САМО ВАЛИДЕН JSON обект
- НЕ използвай markdown (БЕЗ \`\`\`json или \`\`\`)
- НЕ добавяй допълнителен текст или обяснения
- Директен JSON отговор
- БЕЗ нови редове (\\n) в текстове
- БЕЗ вътрешни двойни кавички
- Единични ' кавички в текстове

JSON формат:
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
        ...leftAnalysis.zones.filter(z => z.status !== 'normal').map(z => ({ organ: z.organ, findings: z.findings })),
        ...rightAnalysis.zones.filter(z => z.status !== 'normal').map(z => ({ organ: z.organ, findings: z.findings }))
      ]
      const uniqueOrgans = [...new Set(concernedOrgans.map(o => o.organ))].join(', ')
      
      const allSystemScores = [...leftAnalysis.systemScores, ...rightAnalysis.systemScores]
      const systemAverages = new Map<string, number[]>()
      allSystemScores.forEach(s => {
        const current = systemAverages.get(s.system) || []
        systemAverages.set(s.system, [...current, s.score])
      })
      const weakSystems = Array.from(systemAverages.entries())
        .map(([system, scores]) => ({
          system,
          score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        }))
        .filter(s => s.score < 70)
        .map(s => s.system)
        .join(', ')
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`ХРАНИТЕЛЕН_ПЛАН|КРАТКО

⚠️ ПРИНЦИП НА ОБЕКТИВНОСТТА:
Препоръчвай храни базирани на:
1. ПРИОРИТЕТ: Зони с визуални находки (status:concern/attention)
2. КОНТЕКСТ: Оплаквания и цели от въпросника
3. ИЗБЯГВАЙ: Общи съвети, които не са свързани с конкретните находки

НАХОДКИ (с визуални знаци):
Слаби_системи:${weakSystems || 'Няма'}
Засегнати_органи:${uniqueOrgans}

ПАЦИЕНТ:
Възр:${questionnaire.age}|BMI:${(questionnaire.weight / ((questionnaire.height / 100) ** 2)).toFixed(1)}
Цели:${questionnaire.goals.join(',')}
Оплаквания:${questionnaire.complaints || 'Няма'}
Алергии:${questionnaire.foodIntolerances || 'Няма'}

ЗАДАЧА-КРАТКО_И_СПЕЦИФИЧНО:

1.generalRecommendations(3 принципа):
   -ЕДИН принцип per айтем(30-40думи макс)
   -Връзка_със_специфична_находка
   -БЕЗ повторение

2.recommendedFoods(10-12 айтема):
   -Конкретни имена:"Киноа(протеини,магнезий)"
   -БЕЗ категории,БЕЗ дублиране
   -Кратка причина(5-8думи)

3.avoidFoods(8-10 айтема):
   -Конкретни имена:"Бяла захар(възпаление)"
   -Кратка причина(5-8думи)

КРИТИЧНО:
-КРАТКИ описания
-БЕЗ повторения
-Върни САМО валиден JSON
-БЕЗ markdown БЕЗ \`\`\`
-САМО БГ език

JSON:
{
  "foodPlan": {
    "generalRecommendations": ["препоръка 1", "препоръка 2", "препоръка 3"],
    "recommendedFoods": ["храна 1 (причина)", ...],
    "avoidFoods": ["храна 1 (причина)", ...]
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
      
      const allSystemScores = [...leftAnalysis.systemScores, ...rightAnalysis.systemScores]
      const systemAverages = new Map<string, number[]>()
      allSystemScores.forEach(s => {
        const current = systemAverages.get(s.system) || []
        systemAverages.set(s.system, [...current, s.score])
      })
      const weakSystemsDetailed = Array.from(systemAverages.entries())
        .map(([system, scores]) => ({
          system,
          score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        }))
        .filter(s => s.score < 75)
        .sort((a, b) => a.score - b.score)
      
      const concernedZones = [
        ...leftAnalysis.zones.filter(z => z.status !== 'normal'),
        ...rightAnalysis.zones.filter(z => z.status !== 'normal')
      ]
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`ДОБАВКИ|МАКС_3

⚠️ ПРИНЦИП НА ОБЕКТИВНОСТТА:
Препоръчвай добавки базирани на:
1. ПРИОРИТЕТ: Зони с визуални находки (concern/attention)
2. КОНТЕКСТ: Оплаквания, цели, слаби системи
3. КОРЕЛАЦИЯ: Добавката трябва да адресира визуална находка + симптом/цел

ПРАВИЛА_БЕЗОПАСНОСТ:
1.Базирай_на:слаби_системи+оплаквания+цели
2.ПРОВЕРИ_контраиндикации:медикаменти,здраве
3.КРИТИЧНО:ИЗКЛЮЧИ_вече_приемани(виж_Медикаменти)
4.Прием_медикаменти_НЕ_е_лимитиращ-анализирай_ЕФЕКТ_на_здраве
5.АКО_медикаменти_ВЛОШАВАТ_ирис→отбележи+препоръчай_лекар
6.АКО_добавки_НЕДОСТАТЪЧНИ→препоръчай_ДОПЪЛНИТЕЛНИ/РАЗЛИЧНИ

ТЕКУЩ_ПРИЕМ_АНАЛИЗ:
Медикаменти/Добавки:${questionnaire.medications || 'Няма'}
-АКО_вече_приема(напр.Магнезий,ВитD)→НЕ_препоръчвай_отново
-АКО_медикамент_ВЛОШАВА_ирис→маркирай+препоръчай_лекар
-АКО_добавки_НЕДОСТАТЪЧНИ→препоръчай_РАЗЛИЧНИ

ИРИС:
Слаби_системи(<75):${weakSystemsDetailed.map(s => `${s.system}:${s.score}/100`).join(',')}
Засегнати_зони:${concernedZones.map(z => `${z.organ}(${z.status})`).join(',')}
Ср_здраве:${Math.round((leftAnalysis.overallHealth + rightAnalysis.overallHealth) / 2)}/100

ПАЦИЕНТ:
Възр:${questionnaire.age}|Статус:${questionnaire.healthStatus.join(',')}
Оплаквания:${questionnaire.complaints || 'Няма'}
Цели:${questionnaire.goals.join(',')}
Медикаменти:${questionnaire.medications || 'Няма'}
Алергии:${questionnaire.allergies || 'Няма'}
Диета:${questionnaire.dietaryProfile.join(',')}
Активност:${questionnaire.activityLevel}
Стрес:${questionnaire.stressLevel}
Сън:${questionnaire.sleepHours}ч(${questionnaire.sleepQuality})

ЗАДАЧА:Създай 3 ПЕРСОНАЛИЗИРАНИ добавки:
-name:пълно_име(напр."Магнезий Бисглицинат","Витамин D3+K2")
  *НЕ_препоръчвай_ако_вече_приема!
  *Провери_списък_Медикаменти преди_препоръка
-dosage:безопасна_доза_за_възраст
-timing:детайлни_инструкции_прием
-notes:персонализирано_обяснение_ЗАЩО_точно_тази

ВАЖНО:
-ТОЧНО_3_добавки(НЕ_повече)
-Безопасни_дози_възраст
-Вземи_предвид_медикаменти_взаимодействия
-Фокус_КОРЕЛИРАНИ_проблеми
-Избягвай_контраиндикации
-КРИТИЧНО:БЕЗ_дублиране_вече_приемани!
-САМО_БГ_език
-БЕЗ_markdown

JSON:
{
  "supplements": [
    {
      "name": "име добавка БГ", 
      "dosage": "доза БГ", 
      "timing": "инструкции БГ", 
      "notes": "обяснение БГ"
    }
  ]
}`
/*REMOVE_START  

- dosage: КОНКРЕТНА дозировка базирана на възраст и състояние (напр. "500-1000мг дневно")

- timing: ДЕТАЙЛНО кога и как да се приема (напр. "Сутрин на гладно, 30 мин преди закуска, с вода")

- notes: Допълнителни бележки за:
  * Защо ИМЕННО тази добавка е важна за ТОЗИ пациент
  * Връзка с иридологичните находки И оплакванията
  * Взаимодействия с текущи медикаменти ако има
  * Ако някой текущ меди��амент ВЛОШАВА здравето според иридологичния анализ - отбележи това
  * Специални указания

ВАЖНО:
- Генерирай ТОЧНО 3 добавки (НЕ повече)
- Дозировките да са БЕЗОПАСНИ и подходящи за възрастта
- Вземи предвид ВСИЧКИ медикаменти и взаимодействия
- Фокусирай се на добавки които адресират КОРЕЛИРАНИ проблеми
- Избягвай добавки които противоречат на здравния статус
- КРИТИЧНО: Не дублирай вече приемани добавки!

Върни САМО валиден JSON:
{
  "supplements": [
    {
      "name": "име на добавката", 
      "dosage": "конкретн�� доза", 
      "timing": "детайлен прием", 
      "notes": "персонализирани бележки с обяснение защо"
    }
  ]
}`
REMOVE_END*/

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
      
      const nervousSystem = [...leftAnalysis.systemScores, ...rightAnalysis.systemScores]
        .filter(s => s.system.toLowerCase().includes('нервна'))
      const avgNervousScore = nervousSystem.length > 0 
        ? Math.round(nervousSystem.reduce((sum, s) => sum + s.score, 0) / nervousSystem.length)
        : 70
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`КРАТКИ_психолог_препоръки(3 бр).

ДАННИ:
Нервна_система:${avgNervousScore}/100
Стрес:${questionnaire.stressLevel}
Сън:${questionnaire.sleepHours}ч(${questionnaire.sleepQuality})
Цели:${questionnaire.goals.join(',')}

ЗАДАЧА-3_КРАТКИ_препоръки(всяка 25-35думи):
1.Стрес_управление-специфична_техника_за_ТОЗИ_клиент
2.Сън_подобрение-конкретен_протокол
3.Емоционален_баланс-практична_стратегия

ПРАВИЛА:
-КРАТКО(25-35думи_всяка)
-SPECIFIC_действия
-БЕЗ_общи_съвети
-САМО_БГ_език
-БЕЗ_markdown

JSON:
{
  "recommendations": ["препоръка 1", "препоръка 2", "препоръка 3"]
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
        ...leftAnalysis.artifacts.map(a => ({ type: a.type, location: a.location, description: a.description, severity: a.severity })),
        ...rightAnalysis.artifacts.map(a => ({ type: a.type, location: a.location, description: a.description, severity: a.severity }))
      ]
      
      const highPriorityZones = [
        ...leftAnalysis.zones.filter(z => z.status === 'concern'),
        ...rightAnalysis.zones.filter(z => z.status === 'concern')
      ]
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`КРАТКИ_специални_препоръки(3 бр,УНИКАЛНИ).

ДАННИ:
Притеснителни_зони:${highPriorityZones.map(z => z.organ).join(',')}
Цели:${questionnaire.goals.join(',')}
Оплаквания:${questionnaire.complaints || 'Няма'}

ЗАДАЧА-3_UNIQUE_препоръки(всяка 30-40думи):
1.Адресира_конкретна_зона+оплакване
2.Фокус_специфична_цел_клиента
3.Уникален_протокол/практика_ТОЗИ_клиент

ПРАВИЛА:
-КРАТКО(30-40думи_всяка)
-UNIQUE_за_клиента
-SPECIFIC_протоколи
-БЕЗ_общи_съвети
-САМО_БГ_език
-БЕЗ_markdown

JSON:
{
  "recommendations": ["препоръка 1", "препоръка 2", "препоръка 3"]
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
        ...leftAnalysis.zones.filter(z => z.status === 'concern' || z.status === 'attention'),
        ...rightAnalysis.zones.filter(z => z.status === 'concern' || z.status === 'attention')
      ]
      
      const allSystemScores = [...leftAnalysis.systemScores, ...rightAnalysis.systemScores]
      const systemAverages = new Map<string, number[]>()
      allSystemScores.forEach(s => {
        const current = systemAverages.get(s.system) || []
        systemAverages.set(s.system, [...current, s.score])
      })
      const weakSystems = Array.from(systemAverages.entries())
        .map(([system, scores]) => ({
          system,
          score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        }))
        .filter(s => s.score < 70)
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Препоръчай медицински изследвания на български език базирани на КОРЕЛАЦИЯ между иридологични находки и данни от въпросника.

⚠️ ПРИНЦИП НА ОБЕКТИВНОСТТА:
Препоръчвай изследвания САМО за:
1. ПРИОРИТЕТ ВИСОК: Зони с визуални находки + съответни симптоми (status:concern)
2. ПРИОРИТЕТ СРЕДЕН: Зони с визуални находки БЕЗ симптоми (status:attention) - за превантивна верификация
3. НЕ препоръчвай изследвания за: Зони БЕЗ визуални находки (дори ако има симптоми)

ИЗКЛЮЧЕНИЯ:
- Ако има СЕРИОЗНИ оплаквания без визуални находки в ириса → препоръчай общо изследване на системата

ИРИДОЛОГИЧНИ НАХОДКИ (с визуални знаци):
Зони с притеснения/внимание: ${concernZones.map(z => `${z.organ}: ${z.findings} (статус: ${z.status})`).join('; ')}
Слаби системи: ${weakSystems.map(s => `${s.system} (${s.score}/100)`).join(', ')}

ДАННИ ОТ ВЪПРОСНИК:
Възраст: ${questionnaire.age}
Здравен статус: ${questionnaire.healthStatus.join(', ')}
Оплаквания: ${questionnaire.complaints || 'Няма'}
Медикаменти: ${questionnaire.medications || 'Няма'}
Цели: ${questionnaire.goals.join(', ')}

Препоръчай ТОЧНО 2-3 медицински изследвания/тестове които са НАЙ-ВАЖНИ:

1. КРЪВНИ ТЕСТОВЕ (базирани на слаби системи) - избери НАЙ-ВАЖНОТО:
   - Пълна кръвна картина
   - Биохимични показатели
   - Хормонални панели (ако има индикации)
   - Витамини и минерали (при конкретни находки)

2. ОБРАЗНА ДИАГНОСТИКА (при притеснителни зони) - избери НАЙ-ВАЖНОТО ако е нужно:
   - Ехография на засегнати органи
   - Рентген/CT/MRI (при нужда)

3. ФУНКЦИОНАЛНИ/СПЕЦИАЛИЗИРАНИ ТЕСТОВЕ - избери НАЙ-ВАЖНОТО:
   - За засегнати системи/органи
   - Базирани на оплакванията
   - Алергични тестове (при индикации)
   - Хормонални профили
   - Имунологични изследвания

ВАЖНО:
- Всяко изследване да има ЯСНА връзка с находка от ириса + въпросника
- Да е КОНКРЕТНО име на изследване (не общо)
- Да е ПРАКТИЧНО и достъпно
- Приоритет на изследвания които потвърждават КОРЕЛИРАНИ находки

КРИТИЧНО ВАЖНО ЗА ФОРМАТ:
- ВЪРНИ САМО ВАЛИДЕН JSON обект
- НЕ използвай markdown (БЕЗ \`\`\`json или \`\`\`)
- НЕ добавяй допълнителен текст
- Директен JSON отговор

Върни масив от конкретни имена на изследвания.

JSON формат:
{
  "tests": ["конкретно изследване 1", "конкретно изследване 2"]
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
      
      const allSystemScores = [...leftAnalysis.systemScores, ...rightAnalysis.systemScores]
      const systemAverages = new Map<string, number[]>()
      allSystemScores.forEach(s => {
        const current = systemAverages.get(s.system) || []
        systemAverages.set(s.system, [...current, s.score])
      })
      const avgSystemScores = Array.from(systemAverages.entries()).map(([system, scores]) => ({
        system,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      })).sort((a, b) => a.score - b.score)
      
      const concernedZones = [
        ...leftAnalysis.zones.filter(z => z.status !== 'normal'),
        ...rightAnalysis.zones.filter(z => z.status !== 'normal')
      ]
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Създай кратък, фокусиран иридологичен анализ на български език (600-900 думи). 

⚠️ ПРИНЦИП НА ОБЕКТИВНОСТТА:
Включи САМО находки, които се ВИЖДАТ в ириса И се потвърждават от въпросника:
- ПРИОРИТЕТ ВИСОК: Визуална находка + съответен симптом (status:concern)
- ПРИОРИТЕТ СРЕДЕН: Визуална находка БЕЗ симптом (status:attention) - латентна уязвимост
- НЕ ВКЛЮЧВАЙ: Симптоми без визуални знаци в ириса

АКО има симптом БЕЗ визуална находка:
- Споменай че "въпреки оплакването, визуално зоната е чиста"
- Насочи към други възможни оси (стрес, детоксикация, комплексни връзки)
- Препоръчай медицинско изследване за верификация

ПРАВИЛА ЗА СЪДЪРЖАНИЕ:
- САМО находки които се потвърждават от ирис + въпросник
- БЕЗ повторения - всяка информация се споменава ВЕДНЪЖ
- БЕЗ общи фрази - само специфични за ТОЗИ клиент изводи
- КОНКРЕТНИ връзки между находки и симптоми/цели

ДАННИ:
Общо здраве: Ляв ${leftAnalysis.overallHealth}/100, Десен ${rightAnalysis.overallHealth}/100
Проблемни зони: ${concernedZones.map(z => z.organ).join(', ')}
Слаби системи (<75): ${avgSystemScores.filter(s => s.score < 75).map(s => `${s.system}:${s.score}`).join(', ')}

ПРОФИЛ:
Възраст: ${questionnaire.age}, BMI: ${(questionnaire.weight / ((questionnaire.height / 100) ** 2)).toFixed(1)}
Цели: ${questionnaire.goals.join(', ')}
Оплаквания: ${questionnaire.complaints || 'Няма'}
Сън: ${questionnaire.sleepHours}ч (${questionnaire.sleepQuality}), Стрес: ${questionnaire.stressLevel}
Активност: ${questionnaire.activityLevel}, Хидратация: ${questionnaire.hydration}л

СТРУКТУРА (КРАТКО И ПО СЪЩЕСТВО):
1. Обща оценка (1 параграф) - интегрирано състояние без ляв/десен разделяне
2. Най-важни находки (2 параграфа) - САМО проблеми които се виждат И в ириса И във въпросника
3. Връзка с целите (1 параграф) - кои системи са ключови за постигане на целите
4. Прогноза (1 параграф) - реалистична оценка и позитивна насока

ИЗИСКВАНИЯ:
- БЕЗ повторения на една и съща информация
- БЕЗ общи съвети (те са в плана)
- САМО корелирани находки
- Кратък, ясен, професионален език

Върни само текста без форматиране.`

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
      
      const allSystemScores = [...leftAnalysis.systemScores, ...rightAnalysis.systemScores]
      const systemAverages = new Map<string, number[]>()
      allSystemScores.forEach(s => {
        const current = systemAverages.get(s.system) || []
        systemAverages.set(s.system, [...current, s.score])
      })
      const avgSystemScores = Array.from(systemAverages.entries()).map(([system, scores]) => ({
        system,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      })).sort((a, b) => a.score - b.score)
      
      const concernedZones = [
        ...leftAnalysis.zones.filter(z => z.status !== 'normal'),
        ...rightAnalysis.zones.filter(z => z.status !== 'normal')
      ]
      const uniqueOrgans = [...new Set(concernedZones.map(z => z.organ))]
      
      const prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Създай ДВЕ резюмета на български език базирани на КОРЕЛАЦИЯ между иридологичен анализ И данни от въпросника:

КРИТИЧНО ВАЖНО - ПРАВИЛА ЗА ВАЛИДНОСТ НА ИЗВОДИТЕ:
- ВИСОК ПРИОРИТЕТ: Изводи които се потвърждават И от ирис анализа И от въпросника (взаимна корелация)
- СРЕДЕН ПРИОРИТЕТ: Находки които се виждат само в ириса (без противоречие с въпросника)
- НУЛЕВ ПРИОРИТЕТ: Игнорирай находки от ириса които ПРОТИВОРЕЧАТ на въпросника и общата информация за клиента

ВАЖНО: В резюмето НЕ споменавай "ляв ирис" или "десен ирис". Фокусирай се на:
1. Общо здравословно състояние (интегрирана оценка)
2. Най-засегнати системи по важност към общото здраве
3. Състояние на системи с пряка важност към целите на клиента

ДАННИ ЗА КОРЕЛАЦИЯ:

ИРИДОЛОГИЧНИ НАХОДКИ:
Общо здраве: ${avgHealth}/100
Засегнати органи: ${uniqueOrgans.join(', ')}
Системни оценки (по важност): ${avgSystemScores.slice(0, 3).map(s => `${s.system}: ${s.score}/100`).join(', ')}

ДАННИ ОТ ВЪПРОСНИК:
Възраст: ${questionnaire.age}
Цели: ${questionnaire.goals.join(', ')}
Здравен статус: ${questionnaire.healthStatus.join(', ')}
Оплаквания: ${questionnaire.complaints || 'Няма'}
Стрес: ${questionnaire.stressLevel}, Сън: ${questionnaire.sleepHours}ч (${questionnaire.sleepQuality})
Активност: ${questionnaire.activityLevel}
Хранене: ${questionnaire.dietaryHabits.join(', ')}

ЗАДАЧА:

1. КРАТКО РЕЗЮМЕ (briefSummary) - 3-5 КЛЮЧОВИ ТОЧКИ като масив:
   - Започни с ОБЩО здраве (не споменавай ляв/десен)
   - Посочи 2-3 най-засегнати системи които са ВАЖНИ за общото здраве
   - Посочи системи които имат ПРЯКА връзка с целите на клиента
   - Всеки извод да е базиран на КОРЕЛАЦИЯ ирис + въпросник
   - Много кратки, ясни изречения

2. МОТИВАЦИОННО РЕЗЮМЕ (motivationalSummary) - 1-2 изречения:
   - Оптимистично и мотивиращо
   - Обобщава основната идея на плана за действие
   - Дава увереност и насърчение
   - Базирано на реалистични възможности от анализа

КРИТИЧНО ВАЖНО ЗА ФОРМАТ:
- ВЪРНИ САМО ВАЛИДЕН JSON обект
- НЕ използвай markdown (БЕЗ \`\`\`json или \`\`\`)
- НЕ добавяй допълнителен текст
- Директен JSON отговор

JSON формат:
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
              {error ? 'Прочетете детайлите и следвайте инструкциите по-долу' : 'Анализираме вашите ириси с изкуствен интелект'}
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
                      ℹ️ {loadedConfig?.useCustomKey && loadedConfig.provider !== 'github-spark'
                        ? `Процесът с вашия ${loadedConfig.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API ключ отнема 1-2 минути.` 
                        : 'Процесът с GitHub Spark модела отнема 8-10 минути. Приложението изчаква 60 секунди между заявките за избягване на rate limit.'}
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
