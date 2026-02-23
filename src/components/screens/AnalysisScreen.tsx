import { useEffect, useState, useRef } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { useIrisUnwrap } from '@/hooks/useIrisUnwrap'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkle, Warning, Bug } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { AIRIS_KNOWLEDGE } from '@/lib/airis-knowledge'
import { MAX_VISION_TOKENS } from '@/lib/image-utils'
import { executeV9Pipeline } from '@/lib/pipeline-v9'
import { DEFAULT_AI_PROMPT, DEFAULT_IRIDOLOGY_MANUAL } from '@/lib/default-prompts'
import { DEFAULT_PIPELINE_CONFIG } from '@/lib/github-api'
import type { QuestionnaireData, IrisImage, AnalysisReport, IrisAnalysis, AIModelConfig, Recommendation, AIPromptTemplate, IridologyManual, AIModelStrategy, PipelineConfig } from '@/types'

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
  const [diagnosticResponses, setDiagnosticResponses] = useState<{left?: string, right?: string}>({})
  const [showDiagnostics, setShowDiagnostics] = useState(true)

  // Iris unwrap integration – calls method1/app.py when VITE_IRIS_BACKEND_URL is set
  const {
    unwrapImages,
    leftResult: leftUnwrap,
    rightResult: rightUnwrap,
    backendAvailable: unwrapBackendAvailable,
  } = useIrisUnwrap()
  const unwrapCalledRef = useRef(false)
  
  const [aiConfig] = useKVWithFallback<AIModelConfig>('ai-model-config', {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false,
    requestDelay: 20000,
    requestCount: 8,
    enableDiagnostics: true,  // Default: enable diagnostic checks
    usePipelineV9: true       // Default: use new v9 pipeline
  })

  // Load custom AI prompt template from admin settings
  const [aiPromptTemplate] = useKVWithFallback<AIPromptTemplate>('ai-prompt-template', {
    content: DEFAULT_AI_PROMPT,
    lastModified: new Date().toISOString()
  })

  // Load custom iridology manual from admin settings
  const [iridologyManual] = useKVWithFallback<IridologyManual>('iridology-manual', {
    content: DEFAULT_IRIDOLOGY_MANUAL,
    lastModified: new Date().toISOString()
  })

  // Load AI model strategy settings (temperature, maxTokens, topP, weights)
  const [aiModelStrategy] = useKVWithFallback<AIModelStrategy>('ai-model-strategy', {
    manualWeight: 40,
    promptWeight: 30,
    llmKnowledgeWeight: 25,
    webSearchWeight: 5,
    useWebSearch: false,
    temperature: 0.7,
    maxTokens: 4000,
    topP: 0.9,
    lastModified: new Date().toISOString()
  })

  // Load pipeline configuration from admin panel (with default fallback)
  const [pipelineConfig] = useKVWithFallback<PipelineConfig>('pipeline-config', DEFAULT_PIPELINE_CONFIG)

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
    jsonMode: boolean = true,
    imageDataUrl?: string,
    modelStrategy?: AIModelStrategy | null
  ): Promise<string> => {
    // Get model settings from strategy or use defaults
    const temperature = modelStrategy?.temperature ?? 0.7
    const maxTokens = modelStrategy?.maxTokens ?? 4000
    const topP = modelStrategy?.topP ?? 0.9
    
    addLog('info', `🔑 Използване на собствен API: ${provider} / ${model}${imageDataUrl ? ' (с изображение)' : ''} (temp=${temperature}, maxTokens=${maxTokens}, topP=${topP})`)
    
    if (provider === 'openai') {
      // Build content array - text + optional image
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: prompt }
      ]
      
      if (imageDataUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: imageDataUrl }
        })
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: imageDataUrl ? content : prompt }],
          response_format: jsonMode ? { type: 'json_object' } : undefined,
          temperature: temperature,
          max_tokens: Math.min(maxTokens, MAX_VISION_TOKENS),
          top_p: topP
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API грешка ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } else {
      // Gemini supports vision
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = []
      
      if (imageDataUrl) {
        // Extract base64 data from data URL - handle both uppercase and lowercase
        const base64Match = imageDataUrl.match(/^data:image\/[a-zA-Z]+;base64,(.+)$/i)
        if (base64Match) {
          parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Match[1]
            }
          })
        }
      }
      
      parts.push({
        text: jsonMode 
          ? `${prompt}\n\nВърни САМО валиден JSON обект, без допълнителен текст.`
          : prompt
      })
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: Math.min(maxTokens, 16384),
            topP: topP
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
    maxRetries: number = 2,
    imageDataUrl?: string
  ): Promise<string> => {
    let lastError: Error | null = null
    
    const storedConfig = await window.spark.kv.get<AIModelConfig>('ai-model-config')
    const finalConfig = storedConfig || aiConfig || {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: '',
      useCustomKey: false,
      requestDelay: 20000,
      requestCount: 8
    }
    
    // Use AI Model Strategy settings from hook (already loaded at mount)
    // Fallback to stored value only if hook hasn't loaded yet, then to defaults
    const finalStrategy = aiModelStrategy || await window.spark.kv.get<AIModelStrategy>('ai-model-strategy') || {
      temperature: 0.7,
      maxTokens: 4000,
      topP: 0.9
    }
    
    const provider = finalConfig.provider
    const configuredModel = finalConfig.model
    const requestDelay = Math.max(finalConfig.requestDelay ?? 20000, 15000)
    const apiKey = finalConfig.apiKey || ''
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Липсва API ключ. Моля, добавете валиден API ключ в Admin панела.')
    }
    
    console.log(`🔍 [LLM CONFIG] Provider: "${provider}"`)
    console.log(`🔍 [LLM CONFIG] Model: "${configuredModel}"`)
    console.log(`🔍 [LLM CONFIG] Has API key: ${!!apiKey}`)
    console.log(`🔍 [LLM STRATEGY] Temperature: ${finalStrategy.temperature}, MaxTokens: ${finalStrategy.maxTokens}, TopP: ${finalStrategy.topP}`)
    
    addLog('info', `✓ AI Конфигурация заредена: ${provider} / ${configuredModel}`)
    addLog('info', `🔧 Режим: ${provider} / ${configuredModel} | Забавяне: ${requestDelay}ms`)
    addLog('info', `⚙️ AI Strategy: temp=${finalStrategy.temperature}, maxTokens=${finalStrategy.maxTokens}, topP=${finalStrategy.topP}`)
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const waitTime = 20000
          addLog('warning', `Изчакване ${(waitTime / 1000).toFixed(0)}s преди опит ${attempt}/${maxRetries}...`)
          await sleep(waitTime)
        }
        
        addLog('info', `LLM заявка (опит ${attempt}/${maxRetries}) към ${provider}/${configuredModel}...`)
        console.log(`🤖 [LLM] Заявка ${attempt}/${maxRetries} към ${provider} с модел ${configuredModel}`)
        
        addLog('info', `→ ✅ Извикване на ${provider} API с модел ${configuredModel}`)
        console.log(`🔑 [API CALL] Използване на ${provider} API${imageDataUrl ? ' с изображение' : ''}`)
        const response = await callExternalAPI(
          prompt,
          provider,
          configuredModel,
          apiKey,
          jsonMode,
          imageDataUrl,
          finalStrategy  // Pass strategy with temperature, maxTokens, topP
        )
        
        if (response && response.length > 0) {
          addLog('success', `LLM отговори успешно (${response.length} символа)`)
          console.log(`✅ [LLM] Успешен отговор от ${provider}/${configuredModel}`)
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
            const backoffTime = 30000
            addLog('warning', `⏳ Изчакване ${(backoffTime / 60000).toFixed(1)} минути преди повторен опит...`)
            await sleep(backoffTime)
            continue
          } else {
            throw new Error(`Rate limit достигнат. Проверете вашия API лимит и изчакайте.`)
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

  const extractAnalysisPayload = (parsed: any): { analysis: any, source: string } | null => {
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    if (parsed.analysis && typeof parsed.analysis === 'object') {
      return { analysis: parsed.analysis, source: 'analysis' }
    }

    const altPaths = [
      { value: parsed.result?.analysis, source: 'result.analysis' },
      { value: parsed.data?.analysis, source: 'data.analysis' },
      { value: parsed.response?.analysis, source: 'response.analysis' }
    ] as const

    for (const { value, source } of altPaths) {
      if (value && typeof value === 'object') {
        return { analysis: value, source }
      }
    }

    const altKey = Object.keys(parsed).find(key =>
      key.toLowerCase().includes('analysis') && parsed[key] && typeof parsed[key] === 'object'
    )

    if (altKey) {
      return { analysis: parsed[altKey], source: altKey }
    }

    if (parsed.zones || parsed.artifacts || parsed.overallHealth || parsed.systemScores) {
      return {
        analysis: {
          zones: parsed.zones ?? [],
          artifacts: parsed.artifacts ?? [],
          overallHealth: parsed.overallHealth ?? 0,
          systemScores: parsed.systemScores ?? []
        },
        source: 'top-level fields'
      }
    }

    return null
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

        // Optionally kick off iris unwrapping via method1 backend (non-blocking).
        // Results will be ready by the time analyzeIris runs.
        if (unwrapBackendAvailable && !unwrapCalledRef.current) {
          unwrapCalledRef.current = true
          addLog('info', '🔄 Стартиране на разгъвка (method1 backend)...')
          unwrapImages(leftIris.dataUrl, rightIris.dataUrl).catch((e) => {
            addLog('warning', `⚠️ Разгъвката на ириса се провали: ${e instanceof Error ? e.message : String(e)}`)
          })
        }
        
        await sleep(500)
        
        if (!mounted) {
          console.log('⚠️ [ANALYSIS] Component unmounted during sleep, aborting')
          return
        }
        
        console.log('⚙️ [ANALYSIS] Зареждане на AI конфигурация от KV storage...')
        
        // Helper function to try loading config with retries
        const loadConfigWithRetries = async (maxRetries: number = 5, delayMs: number = 500): Promise<AIModelConfig | null> => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`🔄 [CONFIG] Опит ${attempt}/${maxRetries} за зареждане на конфигурация...`)
            
            // Try from KV storage (which now uses IndexedDB)
            const storedConfig = await window.spark.kv.get<AIModelConfig>('ai-model-config')
            if (storedConfig && storedConfig.apiKey && storedConfig.apiKey.trim() !== '') {
              console.log(`✅ [CONFIG] Конфигурация заредена от KV storage (опит ${attempt})`)
              return storedConfig
            }
            
            // Try from hook state
            if (aiConfig && aiConfig.apiKey && aiConfig.apiKey.trim() !== '') {
              console.log(`✅ [CONFIG] Конфигурация заредена от hook (опит ${attempt})`)
              return aiConfig
            }
            
            if (attempt < maxRetries) {
              console.log(`⏳ [CONFIG] Конфигурацията не е намерена, изчакване ${delayMs}ms...`)
              await sleep(delayMs)
              // Progressive backoff with 1.5x multiplier - gentler than 2x to avoid long waits
              // for a config that might be ready soon, while still providing increasing delays
              delayMs = Math.min(delayMs * 1.5, 2000)
            }
          }
          return null
        }
        
        const finalConfig = await loadConfigWithRetries(5, 300)
        
        if (!finalConfig || !finalConfig.apiKey || finalConfig.apiKey.trim() === '') {
          addLog('error', 'Липсва API ключ. Моля, добавете валиден API ключ в Admin панела.')
          throw new Error('Липсва API ключ за AI анализ')
        }
        
        const providerToUse = finalConfig.provider
        const modelToUse = finalConfig.model
        const apiKey = finalConfig.apiKey
        
        console.log('🔍 [CONFIG] finalConfig от KV:', finalConfig)
        console.log('🔍 [CONFIG] Provider:', providerToUse)
        console.log('🔍 [CONFIG] Model:', modelToUse)
        console.log('🔍 [CONFIG] Has API key:', !!apiKey)
        console.log('🔍 [CONFIG] API key length:', apiKey?.length || 0)
        
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
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: '',
        useCustomKey: false,
        requestDelay: 20000,
        requestCount: 8,
        usePipelineV9: true
      }
      
      const provider = finalConfig.provider
      const configuredModel = finalConfig.model
      const requestDelay = Math.max(finalConfig.requestDelay ?? 20000, 15000)
      const requestCount = finalConfig.requestCount || 8
      const apiKey = finalConfig.apiKey || ''
      const usePipelineV9 = finalConfig.usePipelineV9 ?? true
      
      if (!apiKey || apiKey.trim() === '') {
        addLog('error', 'Липсва API ключ. Моля, добавете валиден API ключ в Admin панела.')
        throw new Error('Липсва API ключ за AI анализ')
      }
      
      const actualModel = configuredModel
      const actualProvider = provider
      
      console.log(`🚀 [АНАЛИЗ] Provider: ${actualProvider}, модел: "${actualModel}", v9 pipeline: ${usePipelineV9}`)
      
      addLog('info', 'Стартиране на анализ...')
      addLog('info', `⚙️ AI Настройки: Provider=${actualProvider}, Model=${actualModel}`)
      addLog('info', `⚙️ Параметри: Забавяне=${requestDelay}ms, Заявки=${requestCount}`)
      addLog('info', `🔧 Pipeline: ${usePipelineV9 ? 'v9 (нов многоетапен)' : 'класически'}`)
      addLog('info', `Данни от въпросник: Възраст ${questionnaireData.age}, Пол ${questionnaireData.gender}`)
      addLog('info', `Здравни цели: ${questionnaireData.goals.join(', ')}`)
      console.log('🚀 [АНАЛИЗ] Стартиране на анализ...')
      console.log('⚙️ [АНАЛИЗ] AI Конфигурация:', finalConfig)
      console.log('🎯 [АНАЛИЗ] Provider който ще се използва:', actualProvider)
      console.log('🎯 [АНАЛИЗ] Модел който ще се използва:', actualModel)
      console.log('🎯 [АНАЛИЗ] Pipeline v9:', usePipelineV9)
      console.log('📊 [АНАЛИЗ] Данни от въпросник:', questionnaireData)
      
      const progressPerStep = 90 / requestCount
      let currentProgress = 5
      
      setProgress(currentProgress)
      
      let leftAnalysis: IrisAnalysis
      let rightAnalysis: IrisAnalysis
      
      // Load pipeline configuration from KV storage (prefer stored over hook value)
      const storedPipelineConfig = await window.spark.kv.get<PipelineConfig>('pipeline-config')
      const finalPipelineConfig = storedPipelineConfig || pipelineConfig || DEFAULT_PIPELINE_CONFIG
      
      // Log pipeline configuration being used
      const enabledSteps = finalPipelineConfig.steps.filter(s => s.enabled)
      addLog('info', `⚙️ Pipeline конфигурация: ${enabledSteps.length} активни стъпки`)
      enabledSteps.forEach(step => {
        addLog('info', `  📋 ${step.name} (${step.id})`)
      })
      
      // Use v9 pipeline if configured
      if (usePipelineV9) {
        addLog('info', '🆕 Използване на v9 pipeline с конфигурация от админ панела...')
        
        // Wrapper for callLLMWithRetry that matches the pipeline's expected signature
        const callLLMWrapper = async (prompt: string, jsonMode: boolean, retries: number, imageDataUrl?: string) => {
          return callLLMWithRetry(prompt, jsonMode, retries, imageDataUrl)
        }
        
        setStatus('V9 Pipeline: Анализ на ляв ирис...')
        leftAnalysis = await executeV9Pipeline(
          leftIris,
          'left',
          questionnaireData,
          callLLMWrapper,
          (step, stepProgress) => {
            setStatus(`V9 Pipeline (ляв): ${step}`)
            setProgress(5 + (stepProgress / 2) * 0.4)
          },
          addLog,
          finalPipelineConfig  // Pass pipeline config from admin panel
        )
        addLog('success', 'V9 Pipeline: Ляв ирис анализиран успешно')
        
        currentProgress = 45
        setProgress(currentProgress)
        addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
        await sleep(requestDelay)
        
        setStatus('V9 Pipeline: Анализ на десен ирис...')
        rightAnalysis = await executeV9Pipeline(
          rightIris,
          'right',
          questionnaireData,
          callLLMWrapper,
          (step, stepProgress) => {
            setStatus(`V9 Pipeline (десен): ${step}`)
            setProgress(45 + (stepProgress / 2) * 0.4)
          },
          addLog,
          finalPipelineConfig  // Pass pipeline config from admin panel
        )
        addLog('success', 'V9 Pipeline: Десен ирис анализиран успешно')
        
        currentProgress = 85
        setProgress(currentProgress)
        
      } else {
        // Use classic analysis method
        addLog('info', '📋 Използване на класически анализ...')
        
        setStatus('Анализиране на ляв ирис - структура...')
        addLog('info', 'Започване анализ на ляв ирис...')
        console.log('👁️ [АНАЛИЗ] Започване анализ на ляв ирис...')
        
        leftAnalysis = await analyzeIris(leftIris, 'left', questionnaireData)
        addLog('success', 'Ляв ирис анализиран успешно')
        console.log('✅ [АНАЛИЗ] Ляв ирис анализиран успешно:', leftAnalysis)
        
        currentProgress += progressPerStep
        setProgress(currentProgress)
        addLog('info', `⏳ Изчакване ${requestDelay/1000} сек. за избягване на rate limit...`)
        await sleep(requestDelay)
        
        setStatus('Анализиране на десен ирис - структура...')
        addLog('info', 'Започване анализ на десен ирис...')
        console.log('👁️ [АНАЛИЗ] Започване анализ на десен ирис...')
        
        rightAnalysis = await analyzeIris(rightIris, 'right', questionnaireData)
        addLog('success', 'Десен ирис анализиран успешно')
        console.log('✅ [АНАЛИЗ] Десен ирис анализиран успешно:', rightAnalysis)
        
        currentProgress += progressPerStep
        setProgress(currentProgress)
      }
      
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
      
      // Note: We create composite image with overlay for display purposes only
      // The AI analysis will use the ORIGINAL image WITHOUT overlay to avoid visual interference
      addLog('info', '📷 Подготовка на изображение за AI анализ...')
      console.log(`📷 [ИРИС ${side}] Използване на ОРИГИНАЛНО изображение БЕЗ overlay за AI анализ`)
      console.log(`📷 [ИРИС ${side}] Оригинално изображение размер: ${Math.round(iris.dataUrl.length / 1024)} KB`)

      // If the method1 backend produced an unwrapped image for this side, prefer it –
      // the unwrapped (mapped) image uses the standard minute×ring coordinate system
      // and gives the AI a normalised, scale-independent view of the iris.
      const unwrapResult = side === 'left' ? leftUnwrap : rightUnwrap
      const imageForAnalysis =
        unwrapResult?.found && unwrapResult.mapped
          ? `data:image/jpeg;base64,${unwrapResult.mapped}`
          : iris.dataUrl

      const usingUnwrapped = imageForAnalysis !== iris.dataUrl
      addLog(
        'success',
        usingUnwrapped
          ? `Изображение подготвено (разгъвка от backend – стандартна координатна система)`
          : `Изображение подготвено за анализ (${Math.round(imageForAnalysis.length / 1024)} KB - БЕЗ overlay)`
      )
      if (usingUnwrapped) {
        console.log(`✅ [ИРИС ${side}] Използва се разгъната карта от method1 backend (X=минута, Y=пръстен)`)
      } else {
        console.log(`✅ [ИРИС ${side}] Изображението ще се изпрати към AI БЕЗ топографска карта`)
      }
      
      // Get diagnostic setting from config (default: true)
      const enableDiagnostics = loadedConfig?.enableDiagnostics ?? aiConfig?.enableDiagnostics ?? true
      
      // OPTIONAL: Diagnostic pre-check - ask AI to describe what it sees in free text
      // This helps verify the image quality and that AI can see the iris properly
      // Can be disabled in Admin panel AIModelConfig
      if (enableDiagnostics) {
        addLog('info', '🔍 Диагностична проверка: Питане на AI какво вижда...')
        console.log(`🔍 [ИРИС ${side}] ДИАГНОСТИЧНА ПРОВЕРКА - Свободен текст анализ`)
        
        const diagnosticPrompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Ти си експертен иридолог. Получаваш чисто изображение на ${sideName} ирис БЕЗ топографска карта.

ЗАДАЧА: Опиши в СВОБОДЕН ТЕКСТ (4-6 изречения) какво РЕАЛНО виждаш:

1. КАЧЕСТВО НА ИЗОБРАЖЕНИЕТО:
   - Можеш ли ясно да видиш ириса и неговата структура?
   - Има ли проблеми с осветлението, фокуса или резолюцията?
   - Пречат ли ти светлинни отражения?

2. ВИДИМИ СТРУКТУРНИ НАХОДКИ в ириса:
   - Виждаш ли лакуни (тъмни процепи/празнини в тъканта)?
   - Виждаш ли крипти (малки дълбоки дупки)?
   - Виждаш ли пигментни петна (кафяви, оранжеви, жълти)?
   - Виждаш ли радиални линии (от центъра навън)?
   - Виждаш ли концентрични пръстени или промени в плътността?
   - Каква е общата текстура на тъканта?

3. ЗАКЛЮЧЕНИЕ:
   - Изглежда ли изображението подходящо за пълноценен иридологичен анализ?
   - Виждаш ли НЯКАКВИ проблемни находки или зони?
   - Ако НЕ виждаш находки - обясни защо (например "ирисът изглежда визуално чист и хомогенен")

Върни само ТЕКСТ на БЪЛГАРСКИ език, без JSON.`

        try {
          const diagnosticResponse = await callLLMWithRetry(diagnosticPrompt, false, 1, imageForAnalysis)
          addLog('success', `✅ Диагностика завършена: ${diagnosticResponse.substring(0, 100)}...`)
          console.log(`🔍 [ИРИС ${side}] =============== ДИАГНОСТИЧЕН ОТГОВОР ===============`)
          console.log(diagnosticResponse)
          console.log(`🔍 [ИРИС ${side}] ====================================================`)
          
          // Store diagnostic response in state
          setDiagnosticResponses(prev => ({ ...prev, [side]: diagnosticResponse }))
          
          // Log a short version to the UI logs
          const shortDiag = diagnosticResponse.length > 200 
            ? diagnosticResponse.substring(0, 200) + '...' 
            : diagnosticResponse
          addLog('info', `📊 AI диагностика: ${shortDiag}`)
        } catch (diagError) {
          addLog('warning', `⚠️ Диагностичната проверка се провали: ${diagError}`)
          console.warn(`⚠️ [ИРИС ${side}] Диагностична грешка:`, diagError)
          // Continue with main analysis even if diagnostic fails
        }
      }
      
      addLog('info', 'Зареждане на ръководство и prompt шаблон от Admin настройки...')
      
      // Use hook values first (already loaded at mount), fallback to storage if not ready
      const customManual = iridologyManual?.content || (await window.spark.kv.get<IridologyManual>('iridology-manual'))?.content || DEFAULT_IRIDOLOGY_MANUAL
      const customPromptContent = aiPromptTemplate?.content || (await window.spark.kv.get<AIPromptTemplate>('ai-prompt-template'))?.content || DEFAULT_AI_PROMPT
      
      addLog('success', `📚 Ръководство заредено: ${customManual.length} символа`)
      addLog('success', `📝 Prompt шаблон зареден: ${customPromptContent.length} символа`)
      
      // Build knowledge context - prefer custom manual, fallback to AIRIS_KNOWLEDGE
      const knowledgeContext = customManual.length > 0 ? customManual : `
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
      
      // Build template variables mapping for efficient interpolation
      addLog('info', 'Интерполиране на променливи в prompt шаблона...')
      const templateVariables: Record<string, string> = {
        side: sideName,
        imageHash: imageHash,
        age: String(questionnaire.age),
        gender: genderName,
        bmi: bmi,
        weight: String(questionnaire.weight),
        height: String(questionnaire.height),
        goals: goalsText,
        healthStatus: questionnaire.healthStatus?.join(', ') || '',
        complaints: complaintsText,
        dietaryHabits: questionnaire.dietaryHabits?.join(', ') || '',
        stressLevel: questionnaire.stressLevel || '',
        sleepHours: String(questionnaire.sleepHours || 0),
        sleepQuality: questionnaire.sleepQuality || '',
        activityLevel: questionnaire.activityLevel || '',
        medications: questionnaire.medications || '',
        allergies: questionnaire.allergies || '',
        knowledgeContext: knowledgeContext,
        isRight: side === 'right' ? 'true' : 'false',
        isLeft: side === 'left' ? 'true' : 'false'
      }
      
      // Interpolate all template variables in one pass using regex
      const interpolatePrompt = (template: string): string => {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return templateVariables[key] !== undefined ? templateVariables[key] : match
        })
      }
      
      // Use custom prompt template if it contains template variables
      const hasTemplateVariables = customPromptContent.includes('{{') && customPromptContent.includes('}}')
      
      let prompt: string
      if (hasTemplateVariables) {
        // Use custom prompt template with interpolation
        prompt = interpolatePrompt(customPromptContent)
        addLog('info', `✅ Използване на ПЕРСОНАЛИЗИРАН prompt шаблон от Admin настройки (${prompt.length} символа)`)
      } else {
        // Fallback to hardcoded prompt (for backward compatibility)
        addLog('info', 'Използване на вграден prompt (без шаблонни променливи в admin настройките)...')
        prompt = (window.spark.llmPrompt as unknown as (strings: TemplateStringsArray, ...values: any[]) => string)`Ти си опитен иридолог с 20 години клинична практика. Ще ти предоставя изображение на ${sideName} ирис (БЕЗ топографска карта) и данни от пациента.

⚠️ ВАЖНО: Получаваш ЧИСТО изображение на ириса БЕЗ наложени линии или етикети. Анализирай директно самата ирисова тъкан.

АНАЛИЗИРАЙ ИРИСА И ТЪРСИ АРТЕФАКТИ:

ДОПЪЛНИТЕЛЕН КОНТЕКСТ (AIRIS база знания):
${knowledgeContext}

ИГНОРИРАЙ при анализа:
- Ярки бели светлинни отражения (често в центъра)
- Огледални ефекти от осветлението

ТЪРСИ И ДОКУМЕНТИРАЙ всички реални находки:
- Структурни промени: лакуни (тъмни процепи), крипти (малки дупки)
- Дисколорации: пигментни петна, локални промени в цвета
- Радиални знаци: линии от центъра навън (ако са част от ириса)
- Концентрични пръстени: кръгове около зеницата (автономен пръстен)
- Плътност и текстура: промени в тъканта

ВАЖНО - БАЛАНСИРАН ПОДХОД:
- Бъди ОБЕКТИВЕН: Докладвай само това, което ВИЖДАШ в изображението
- Бъди ВНИМАТЕЛЕН: Не пропускай находки, дори малки или съмнителни
- Ако виждаш нещо съмнително, отбележи го - по-добре превантивно отколкото да пропуснеш
- НЕ създавай "виртуални" находки само защото има симптом

ДАННИ ЗА ПАЦИЕНТА (за контекст и приоритизиране):
Възраст: ${questionnaire.age} години | Пол: ${genderName} | BMI: ${bmi}
Оплаквания: ${complaintsText}
Здравни цели: ${goalsText}

РЕФЕРЕНТНА КАРТА (12h=0°, по часовниковата стрелка):
${AIRIS_KNOWLEDGE.irisMap.zones.map(z => `${z.hour}(${z.angle[0]}-${z.angle[1]}°): ${z.organ} (${z.system})`).join('\n')}

ЛОГИКА ЗА ОЦЕНКА НА ЗОНИТЕ:
1. ВИДИМА НАХОДКА + СЪОТВЕТЕН СИМПТОМ → status:"concern", priority:high (активен проблем)
2. ВИДИМА НАХОДКА БЕЗ СИМПТОМ → status:"attention", priority:medium (латентна слабост)
3. НЯМА НАХОДКА + ИМА СИМПТОМ → status:"normal" (не маркирай - проблемът е от друга система)
4. НЯМА НАХОДКА + НЯМА СИМПТОМ → status:"normal"

ЗАДАЧА: Анализирай ${sideName} ирис и върни JSON с:

1. ЗОНИ (12 зони, angle винаги 0-360°):
   Зона 1 (0-30°): Мозък/Нервна система
   Зона 2 (30-60°): Хипофиза/Ендокринна
   Зона 3 (60-90°): Щитовидна жлеза/Ендокринна
   Зона 4 (90-120°): Белодробна${side==='right'?' (дясна страна)':''}
   Зона 5 (120-150°): Черен дроб/Детоксикация
   Зона 6 (150-180°): Стомах/Храносмилателна
   Зона 7 (180-210°): Панкреас/Храносмилателна
   Зона 8 (210-240°): Бъбреци/Урогенитална
   Зона 9 (240-270°): Надбъбречни жлези/Ендокринна
   Зона 10 (270-300°): Сърце/Сърдечно-съдова${side==='left'?' (лява страна)':''}
   Зона 11 (300-330°): Далак/Имунна
   Зона 12 (330-360°): Лимфна система/Имунна

За всяка зона посочи:
- id: 1-12
- name: Име на зоната на български
- organ: Орган на български  
- status: "normal" | "attention" | "concern"
- findings: Кратко описание (max 80 символа) на ВИЗУАЛНО ВИДИМОТО:
  * Ако е чисто: "Визуално чиста зона без забележими находки"
  * Ако има находка: "Две малки тъмни лакуни в долния сектор" (описвай само видимото!)
- angle: [начален_ъгъл, краен_ъгъл] (ВИНАГИ между 0-360)

2. АРТЕФАКТИ (0-много, всички които ВИЖДАШ):
За всеки артефакт:
- type: Вид артефакт на български (Лакуни, Крипти, Пигментни петна, Радиални линии и др.)
- location: Позиция като часовник (напр. "3:00-4:00", "около 6h")
- description: Визуално описание (max 60 символа)
- severity: "low" | "medium" | "high"

⚠️ Ако НЕ виждаш артефакти в ириса, върни празен масив: []
⚠️ Ако виждаш дори и малки/съмнителни артефакти, включи ги!

3. ОБЩО ЗДРАВЕ (0-100):
Базирай оценката на:
- Брой и тежест на находките
- Общо състояние на тъканта
- Видими структурни промени
Стандарт: 70-85 (средно), 85-95 (добро), 50-70 (нужда от внимание), <50 (сериозни проблеми)

4. СИСТЕМНИ ОЦЕНКИ (6 системи, 0-100):
За всяка система: Храносмилателна, Имунна, Нервна, Сърдечно-съдова, Детоксикация, Ендокринна
- system: Име на системата
- score: Оценка 0-100 базирана на находки в съответните зони
- description: Кратко описание (max 60 символа)

ФОРМАТ НА ОТГОВОРА:
- САМО валиден JSON
- БЕЗ markdown блокове (\`\`\`json или \`\`\`)
- БЕЗ нови редове (\\n) в текстовете
- БЕЗ вътрешни двойни кавички в strings
- САМО БЪЛГАРСКИ език

{
  "analysis": {
    "zones": [
      {"id": 1, "name": "Мозъчна зона", "organ": "Мозък", "status": "normal", "findings": "Визуално чиста зона", "angle": [0, 30]},
      {"id": 2, "name": "Хипофизна зона", "organ": "Хипофиза", "status": "attention", "findings": "Лека дисколорация в горния сектор", "angle": [30, 60]}
    ],
    "artifacts": [
      {"type": "Лакуни", "location": "3:00-4:00", "description": "Две малки тъмни лакуни", "severity": "low"}
    ],
    "overallHealth": 75,
    "systemScores": [
      {"system": "Храносмилателна", "score": 70, "description": "Умерени находки в стомашната зона"},
      {"system": "Имунна", "score": 80, "description": "Добро състояние"},
      {"system": "Нервна", "score": 85, "description": "Без значими находки"},
      {"system": "Сърдечно-съдова", "score": 75, "description": "Леки периферни знаци"},
      {"system": "Детоксикация", "score": 65, "description": "Пигментация в чернодробната зона"},
      {"system": "Ендокринна", "score": 78, "description": "Леки промени в щитовидната зона"}
    ]
  }
}`
      } // End of else block for fallback prompt

      addLog('info', `Изпращане на prompt + изображение до LLM (${prompt.length} символа)...`)
      console.log(`🤖 [ИРИС ${side}] Изпращане на prompt + изображение до LLM...`)
      console.log(`📄 [ИРИС ${side}] Prompt дължина: ${prompt.length} символа`)
      console.log(`📷 [ИРИС ${side}] Изображение дължина: ${Math.round(imageForAnalysis.length / 1024)} KB (БЕЗ overlay)`)
      
      addLog('warning', 'Изчакване на отговор от AI модела... (това може да отнеме 10-30 сек)')
      const response = await callLLMWithRetry(prompt, true, 2, imageForAnalysis)
      
      addLog('success', `Получен отговор от LLM (${response.length} символа)`)
      console.log(`✅ [ИРИС ${side}] Получен отговор от LLM`)
      console.log(`📄 [ИРИС ${side}] Отговор дължина: ${response.length} символа`)
      console.log(`📄 [ИРИС ${side}] RAW отговор:`, response)
      
      addLog('info', 'Парсиране на JSON отговор...')
      const parsed = await robustJSONParse(response, `ИРИС ${side}`)

      addLog('success', 'JSON парсиран успешно')
      console.log(`✅ [ИРИС ${side}] JSON парсиран успешно`)
      console.log(`📊 [ИРИС ${side}] Парсиран обект:`, parsed)

      const extractedAnalysis = extractAnalysisPayload(parsed)

      if (!extractedAnalysis) {
        addLog('error', `Липсва 'analysis' property в отговора!`)
        console.error(`❌ [ИРИС ${side}] ГРЕШКА: Липсва 'analysis' property в отговора!`)
        throw new Error(`Невалиден формат на отговор - липсва 'analysis' property`)
      }

      if (extractedAnalysis.source !== 'analysis') {
        addLog('warning', `Открит алтернативен 'analysis' ключ (${extractedAnalysis.source}) - използваме него`)
        console.warn(`⚠️ [ИРИС ${side}] Използван е ${extractedAnalysis.source} вместо стандартния 'analysis'`)
      }

      const analysisData = extractedAnalysis.analysis || {}
      const rawZones = Array.isArray(analysisData.zones) ? analysisData.zones : []
      const rawArtifacts = Array.isArray(analysisData.artifacts) ? analysisData.artifacts : []
      const overallHealth = typeof analysisData.overallHealth === 'number' ? analysisData.overallHealth : 0
      const systemScores = Array.isArray(analysisData.systemScores) ? analysisData.systemScores : []

      const normalizedZones = rawZones.map(zone => {
        const hasFindingText = typeof zone.findings === 'string' && zone.findings.trim().length > 0
        const isCleanPhrase = typeof zone.findings === 'string'
          ? zone.findings.toLowerCase().includes('визуално чист')
          : false
        const shouldElevate = zone.status === 'normal' && !isCleanPhrase && (hasFindingText || rawArtifacts.length > 0)

        return shouldElevate
          ? { ...zone, status: 'attention' as const }
          : zone
      })

      const elevatedCount = normalizedZones.filter((zone, index) => rawZones[index]?.status === 'normal' && zone.status !== 'normal').length
      if (elevatedCount > 0) {
        addLog('info', `⚡ Повишени ${elevatedCount} зони до 'attention' заради видими находки/артефакти`)
      }

      const result = {
        side,
        ...analysisData,
        zones: normalizedZones,
        artifacts: rawArtifacts,
        overallHealth,
        systemScores
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
                      ℹ️ Процесът с вашия {loadedConfig?.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API ключ отнема 1-2 минути.
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

            <div className="mt-8 flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="gap-2"
              >
                <Bug size={16} />
                {showDebug ? 'Скрий логове' : 'Покажи логове'}
              </Button>
              
              {(diagnosticResponses.left || diagnosticResponses.right) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="gap-2"
                >
                  <Sparkle size={16} />
                  {showDiagnostics ? 'Скрий диагностика' : 'Покажи AI диагностика'}
                </Button>
              )}
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
            
            {showDiagnostics && (diagnosticResponses.left || diagnosticResponses.right) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6"
              >
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkle size={20} className="text-primary" />
                    <h3 className="text-sm font-semibold">AI Диагностика - Какво Вижда Моделът</h3>
                  </div>
                  <div className="space-y-4 text-left">
                    {diagnosticResponses.left && (
                      <div className="p-3 bg-background rounded-lg border border-border">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">
                          👁️ ЛЯВ ИРИС:
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {diagnosticResponses.left}
                        </p>
                      </div>
                    )}
                    {diagnosticResponses.right && (
                      <div className="p-3 bg-background rounded-lg border border-border">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">
                          👁️ ДЕСЕН ИРИС:
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {diagnosticResponses.right}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 p-2 bg-accent/10 rounded text-xs text-muted-foreground">
                      ℹ️ Тази диагностика показва какво AI моделът реално вижда в изображенията преди структурирания анализ. 
                      Използвайте я за да проверите дали изображенията са качествени и дали AI може да открие находки.
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
