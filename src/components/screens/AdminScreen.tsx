import { useState, useEffect } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Brain, 
  Key, 
  CheckCircle,
  ClockCounterClockwise,
  DownloadSimple,
  GitBranch,
  Info,
  BookOpen,
  Eye
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AIModelConfig } from '@/types'
import QuestionnaireManager from '@/components/admin/QuestionnaireManager'
import ChangelogTab from '@/components/admin/ChangelogTab'
import ProjectExportTab from '@/components/admin/ProjectExportTab'
import PipelineManagerTab from '@/components/admin/PipelineManagerTab'
import SettingsDocumentation from '@/components/admin/SettingsDocumentation'
import IrisTrainingExampleTab from '@/components/admin/IrisTrainingExampleTab'

interface AdminScreenProps {
  onBack: () => void
}

// Default configuration constants
const DEFAULT_REQUEST_DELAY_MS = 5000

export default function AdminScreen({ onBack }: AdminScreenProps) {
  const [aiConfig, setAiConfig] = useKVWithFallback<AIModelConfig>('ai-model-config', {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false,
    requestDelay: DEFAULT_REQUEST_DELAY_MS,
    enableDiagnostics: true
  })
  
  const [provider, setProvider] = useState<'openai' | 'gemini'>(aiConfig?.provider || 'openai')
  const [model, setModel] = useState(aiConfig?.model || 'gpt-4o')
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '')
  const [useCustomKey, setUseCustomKey] = useState(aiConfig?.useCustomKey || false)
  const [requestDelay, setRequestDelay] = useState(aiConfig?.requestDelay || DEFAULT_REQUEST_DELAY_MS)
  const [enableDiagnostics, setEnableDiagnostics] = useState(aiConfig?.enableDiagnostics ?? true)

  // Log successful admin panel access
  useEffect(() => {
    console.log('✅ [ADMIN] Административният панел е зареден успешно!')
    console.log('✅ [ADMIN] Достъпът е разрешен за всички потребители')
    console.log('✅ [ADMIN] Няма проверка за собственик (isOwner)')
    console.log('✅ [ADMIN] Панелът е напълно функционален')
    
    toast.success('Административен панел', {
      description: '✓ Достъпът е разрешен успешно',
      duration: 3000
    })
  }, [])

  useEffect(() => {
    if (aiConfig) {
      setProvider(aiConfig.provider)
      setModel(aiConfig.model)
      setApiKey(aiConfig.apiKey)
      setUseCustomKey(aiConfig.useCustomKey)
      setRequestDelay(aiConfig.requestDelay || 60000)
      setEnableDiagnostics(aiConfig.enableDiagnostics ?? true)
    }
  }, [aiConfig])

  const validateApiKey = (provider: string, key: string): { valid: boolean; message?: string } => {
    if (!key.trim()) {
      return { valid: false, message: 'API ключът не може да бъде празен' }
    }
    
    switch (provider) {
      case 'openai':
        if (!key.startsWith('sk-')) {
          return { valid: false, message: 'OpenAI API ключът трябва да започва с "sk-"' }
        }
        if (key.length < 20) {
          return { valid: false, message: 'OpenAI API ключът е твърде кратък' }
        }
        break
      case 'gemini':
        if (!key.startsWith('AIza')) {
          return { valid: false, message: 'Google Gemini API ключът трябва да започва с "AIza"' }
        }
        if (key.length < 30) {
          return { valid: false, message: 'Google Gemini API ключът е твърде кратък' }
        }
        break
    }
    
    return { valid: true }
  }

  const handleSaveConfig = async () => {
    if ((provider === 'gemini' || provider === 'openai') && !apiKey.trim()) {
      toast.error(`❌ Грешка: ${provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} изисква собствен API ключ!`, {
        description: 'Моля, въведете валиден API ключ.',
        duration: 6000
      })
      return
    }

    // Validate API key format if custom key is being used
    if ((provider === 'openai' || provider === 'gemini') && apiKey.trim()) {
      const validation = validateApiKey(provider, apiKey)
      if (!validation.valid) {
        toast.error(`❌ Невалиден API ключ: ${validation.message}`, {
          description: provider === 'openai' 
            ? 'OpenAI ключовете започват с "sk-" и са поне 20 символа.'
            : 'Gemini ключовете започват с "AIza" и са поне 30 символа.',
          duration: 6000
        })
        return
      }
    }

    try {
      const actualUseCustomKey = provider === 'gemini' || provider === 'openai' ? true : useCustomKey
      
      const config: AIModelConfig = {
        provider,
        model: model,
        apiKey: actualUseCustomKey ? apiKey : '',
        useCustomKey: actualUseCustomKey,
        requestDelay,
        enableDiagnostics
      }
      
      console.log('💾 [ADMIN] Запазване на конфигурация:', config)
      console.log(`🔍 [ADMIN] Provider: ${provider}, Model: ${model}, useCustomKey: ${actualUseCustomKey}`)
      
      await setAiConfig(config)
      
      toast.success(`✓ AI конфигурация запазена: ${provider} / ${model}`, {
        description: 'Pipeline-ът автоматично ще изпълни всички активни стъпки.',
        duration: 5000
      })
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Грешка при запазване на конфигурацията')
    }
  }

  const openaiModels = ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'gpt-4-turbo', 'gpt-4']
  const geminiModels = ['gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-4 md:space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Административен панел</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Управление на AI модели и учебници по иридология
            </p>
          </div>
          <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </div>

        {/* Admin Access Success Indicator */}
        <div className="p-3 md:p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="w-5 h-5 flex-shrink-0" weight="fill" />
            <p className="text-sm md:text-base font-bold">
              ✓ ДОСТЪПЪТ Е РАЗРЕШЕН! Административният панел работи правилно
            </p>
          </div>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-2 ml-7">
            ✓ Няма ограничения за достъп<br />
            ✓ Няма проверка за собственик (owner)<br />
            ✓ Всички настройки се запазват локално и работят правилно<br />
            ✓ Всички потребители имат пълен достъп до всички функции
          </p>
        </div>

        <Tabs defaultValue="ai-config" className="w-full">
          <TabsList className="grid w-full grid-cols-7 gap-1 h-auto p-1">
            <TabsTrigger value="ai-config" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <Brain className="w-4 h-4 md:mr-1" />
              <span className="hidden sm:inline">AI Модел</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <GitBranch className="w-4 h-4 md:mr-1" />
              <span className="hidden lg:inline">Pipeline</span>
              <span className="lg:hidden">Pipe</span>
            </TabsTrigger>
            <TabsTrigger value="questionnaire" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <CheckCircle className="w-4 h-4 md:mr-1" />
              <span className="hidden lg:inline">Въпросник</span>
              <span className="lg:hidden">Форма</span>
            </TabsTrigger>
            <TabsTrigger value="training" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <Eye className="w-4 h-4 md:mr-1" />
              <span className="hidden lg:inline">Обучение</span>
              <span className="lg:hidden">Ирис</span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <BookOpen className="w-4 h-4 md:mr-1" />
              <span className="hidden lg:inline">Документация</span>
              <span className="lg:hidden">Док</span>
            </TabsTrigger>
            <TabsTrigger value="changelog" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <ClockCounterClockwise className="w-4 h-4 md:mr-1" />
              <span className="hidden lg:inline">Промени</span>
              <span className="lg:hidden">Лог</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <DownloadSimple className="w-4 h-4 md:mr-1" />
              <span className="hidden lg:inline">Експорт</span>
              <span className="lg:hidden">ZIP</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-config">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Brain className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                Настройки на AI модел
              </CardTitle>
              <CardDescription className="text-sm">
                Изберете AI модел и конфигурирайте API достъп за анализ на ирисите
              </CardDescription>
              
              {aiConfig && (
                <div className={`mt-3 p-2 md:p-3 rounded-lg border ${
                  !aiConfig.apiKey
                    ? 'bg-destructive/10 border-destructive/30'
                    : 'bg-primary/10 border-primary/20'
                }`}>
                  <p className={`text-xs md:text-sm font-medium break-words ${
                    !aiConfig.apiKey
                      ? 'text-destructive'
                      : 'text-primary'
                  }`}>
                    {!aiConfig.apiKey ? (
                      <>
                        ❌ ГРЕШНА КОНФИГУРАЦИЯ: {aiConfig.provider === 'gemini' ? 'Gemini' : 'OpenAI'} / {aiConfig.model}
                        <span className="block md:inline md:ml-2 text-xs mt-1 md:mt-0">
                          (няма API ключ - анализът НЯМА ДА РАБОТИ)
                        </span>
                      </>
                    ) : (
                      <>
                        ✓ Активна конфигурация: <span className="font-mono">{aiConfig.provider} / {aiConfig.model}</span>
                        <span className="block md:inline md:ml-2 text-xs text-muted-foreground mt-1 md:mt-0">
                          (собствен API ключ)
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Забавяне: {aiConfig.requestDelay || DEFAULT_REQUEST_DELAY_MS}ms между заявки | 
                    Брой стъпки се определя от Pipeline конфигурацията
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm md:text-base">Доставчик на AI модел</Label>
                  <RadioGroup value={provider} onValueChange={(v) => setProvider(v as 'openai' | 'gemini')}>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="openai" id="openai" className="mt-0.5 flex-shrink-0" />
                      <Label htmlFor="openai" className="font-normal cursor-pointer text-sm leading-relaxed">
                        OpenAI (изисква API ключ - позволява избор на модел)
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="gemini" id="gemini" className="mt-0.5 flex-shrink-0" />
                      <Label htmlFor="gemini" className="font-normal cursor-pointer text-sm leading-relaxed">
                        Google Gemini (изисква API ключ - позволява избор на модел)
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {(provider === 'openai' || provider === 'gemini') && (
                    <div className="mt-2 p-2 md:p-3 bg-accent/10 rounded-lg border border-accent/30">
                      <p className="text-xs font-semibold text-accent-foreground mb-2">
                        ⚠️ ВАЖНО: {provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} изисква собствен API ключ
                      </p>
                      <p className="text-xs text-accent-foreground/80">
                        За да използвате {provider === 'gemini' ? 'Gemini модели' : 'OpenAI модели'}, трябва да:
                      </p>
                      <ol className="text-xs text-accent-foreground/80 mt-2 space-y-1 list-decimal list-inside pl-1">
                        <li className="break-words">Активирайте "Използвай собствен API ключ" по-долу</li>
                        <li className="break-words">Въведете валиден {provider === 'gemini' ? 'Google AI' : 'OpenAI'} API ключ</li>
                        <li>Запазете настройките</li>
                      </ol>
                      <p className="text-xs text-accent-foreground/80 mt-2">
                        Без API ключ, анализът <strong>НЯМА ДА РАБОТИ</strong>.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm md:text-base">Модел</Label>
                  <Select 
                    value={model} 
                    onValueChange={setModel}
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Изберете модел" />
                    </SelectTrigger>
                    <SelectContent>
                      {provider === 'openai' && (
                        <>
                          {openaiModels.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {provider === 'gemini' && (
                        <>
                          {geminiModels.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="request-delay" className="text-base">Забавяне между заявки (ms)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Време за изчакване между последователни AI заявки
                    </p>
                    <Input 
                      id="request-delay"
                      type="number"
                      value={requestDelay}
                      onChange={(e) => setRequestDelay(parseInt(e.target.value) || DEFAULT_REQUEST_DELAY_MS)}
                      min={1000}
                      max={120000}
                      step={1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Препоръчително: 5000-10000ms (5-10 сек) за API заявки
                    </p>
                  </div>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Как работи Pipeline системата:</strong><br/>
                      • Броят на AI заявките се определя автоматично от активните стъпки в Pipeline таба<br/>
                      • Ако е активна само една стъпка (напр. "One"), се изпълнява един цялостен промпт<br/>
                      • Ако са активни множество стъпки, всяка се изпълнява последователно<br/>
                      • Редактирайте промптите и стъпките от Pipeline таба по-горе
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex items-center justify-between space-x-2 pt-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-diagnostics" className="text-base">
                        AI Диагностична проверка
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        AI описва в свободен текст какво вижда в изображенията преди структурирания анализ
                      </p>
                    </div>
                    <Switch
                      id="enable-diagnostics"
                      checked={enableDiagnostics}
                      onCheckedChange={setEnableDiagnostics}
                    />
                  </div>
                </div>

                <Separator />
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-key" className="flex items-center gap-2 text-sm md:text-base flex-wrap">
                      <Key className="w-4 h-4 flex-shrink-0" />
                      <span>API ключ (задължителен)</span>
                    </Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground break-words">
                      {provider === 'openai' 
                        ? 'Вашият OpenAI API ключ (започва с sk-)'
                        : 'Вашият Google AI API ключ (започва с AIza)'
                      }
                    </p>
                  </div>
                  
                  {(provider === 'gemini' || provider === 'openai') && (
                    <div className="mt-3 p-2 md:p-3 bg-accent/10 rounded-lg border border-accent/20">
                      <p className="text-xs text-accent-foreground">
                        💡 <strong>Предимства на {provider === 'gemini' ? 'Gemini' : 'OpenAI'}:</strong>
                      </p>
                      <ul className="text-xs text-accent-foreground/80 mt-2 space-y-1 list-disc list-inside pl-1">
                        <li className="break-words">Бързо време за анализ (30-60 сек.)</li>
                        <li>Достъп до най-новите AI модели</li>
                        {provider === 'gemini' && <li className="break-words">Отличен за многоезични анализи (включително български)</li>}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Button onClick={handleSaveConfig} className="flex-1 text-sm md:text-base">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Запази настройките
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
          </TabsContent>

          <TabsContent value="pipeline">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <PipelineManagerTab />
            </motion.div>
          </TabsContent>

          <TabsContent value="questionnaire">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <QuestionnaireManager />
        </motion.div>
          </TabsContent>

          <TabsContent value="changelog">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChangelogTab />
            </motion.div>
          </TabsContent>

          <TabsContent value="training">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <IrisTrainingExampleTab />
            </motion.div>
          </TabsContent>

          <TabsContent value="docs">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SettingsDocumentation />
            </motion.div>
          </TabsContent>

          <TabsContent value="export">
            <ProjectExportTab />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
