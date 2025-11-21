import { useState, useEffect } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Brain, 
  Key, 
  BookOpen, 
  Upload, 
  Trash, 
  CheckCircle,
  Image as ImageIcon,
  Eye,
  FileText,
  Robot,
  PencilSimple,
  ClockCounterClockwise,
  DownloadSimple
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AIModelConfig, IridologyTextbook, CustomOverlay, IridologyManual, AIPromptTemplate } from '@/types'
import IridologyOverlay from '@/components/iris/IridologyOverlay'
import QuestionnaireManager from '@/components/admin/QuestionnaireManager'
import IridologyManualTab from '@/components/admin/IridologyManualTab'
import AIPromptTab from '@/components/admin/AIPromptTab'
import EditorModeTab from '@/components/admin/EditorModeTab'
import ChangelogTab from '@/components/admin/ChangelogTab'
import ProjectExportTab from '@/components/admin/ProjectExportTab'
import AIModelStrategyTab from '@/components/admin/AIModelStrategyTab'
import { DEFAULT_IRIDOLOGY_MANUAL, DEFAULT_AI_PROMPT } from '@/lib/default-prompts'

interface AdminScreenProps {
  onBack: () => void
}

export default function AdminScreen({ onBack }: AdminScreenProps) {
  const [aiConfig, setAiConfig] = useKVWithFallback<AIModelConfig>('ai-model-config', {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false,
    requestDelay: 60000,
    requestCount: 8
  })
  
  const [textbooks, setTextbooks] = useKVWithFallback<IridologyTextbook[]>('iridology-textbooks', [])
  const [customOverlay, setCustomOverlay] = useKVWithFallback<CustomOverlay | null>('custom-overlay', null)
  const [iridologyManual, setIridologyManual] = useKVWithFallback<IridologyManual>('iridology-manual', {
    content: DEFAULT_IRIDOLOGY_MANUAL,
    lastModified: new Date().toISOString()
  })
  const [aiPromptTemplate, setAiPromptTemplate] = useKVWithFallback<AIPromptTemplate>('ai-prompt-template', {
    content: DEFAULT_AI_PROMPT,
    lastModified: new Date().toISOString()
  })
  
  const [provider, setProvider] = useState<'openai' | 'gemini'>(aiConfig?.provider || 'openai')
  const [model, setModel] = useState(aiConfig?.model || 'gpt-4o')
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '')
  const [useCustomKey, setUseCustomKey] = useState(aiConfig?.useCustomKey || false)
  const [requestDelay, setRequestDelay] = useState(aiConfig?.requestDelay || 60000)
  const [requestCount, setRequestCount] = useState(aiConfig?.requestCount || 8)
  
  const [textbookName, setTextbookName] = useState('')
  const [textbookContent, setTextbookContent] = useState('')
  const [showOverlayPreview, setShowOverlayPreview] = useState(false)
  
  const [manualContent, setManualContent] = useState(iridologyManual?.content || DEFAULT_IRIDOLOGY_MANUAL)
  const [promptContent, setPromptContent] = useState(aiPromptTemplate?.content || DEFAULT_AI_PROMPT)

  const getValidSparkModel = (model: string): string => {
    if (model === 'gpt-4o' || model === 'gpt-4o-mini') {
      return model
    }
    return 'gpt-4o'
  }

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
      setRequestCount(aiConfig.requestCount || 8)
    }
  }, [aiConfig])

  useEffect(() => {
    if (iridologyManual) {
      setManualContent(iridologyManual.content)
    }
  }, [iridologyManual])

  useEffect(() => {
    if (aiPromptTemplate) {
      setPromptContent(aiPromptTemplate.content)
    }
  }, [aiPromptTemplate])

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
        requestCount
      }
      
      console.log('💾 [ADMIN] Запазване на конфигурация:', config)
      console.log(`🔍 [ADMIN] Provider: ${provider}, Model: ${model}, useCustomKey: ${actualUseCustomKey}`)
      
      await setAiConfig(config)
      
      toast.success(`✓ AI конфигурация запазена: ${provider} / ${model}`, {
        description: actualUseCustomKey ? 'Вашият собствен API ключ ще бъде използван за анализите.' : undefined,
        duration: 5000
      })
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Грешка при запазване на конфигурацията')
    }
  }

  const handleAddTextbook = async () => {
    if (!textbookName.trim() || !textbookContent.trim()) {
      toast.error('Моля, попълнете име и съдържание на учебника')
      return
    }

    try {
      const newTextbook: IridologyTextbook = {
        id: `textbook-${Date.now()}`,
        name: textbookName,
        content: textbookContent,
        uploadDate: new Date().toISOString(),
        fileSize: new Blob([textbookContent]).size
      }

      await setTextbooks((current) => [...(current || []), newTextbook])
      
      setTextbookName('')
      setTextbookContent('')
      toast.success('Учебникът е добавен успешно')
    } catch (error) {
      console.error('Error adding textbook:', error)
      toast.error('Грешка при добавяне на учебника')
    }
  }

  const handleDeleteTextbook = async (id: string) => {
    try {
      await setTextbooks((current) => (current || []).filter(tb => tb.id !== id))
      toast.success('Учебникът е изтрит успешно')
    } catch (error) {
      console.error('Error deleting textbook:', error)
      toast.error('Грешка при изтриване на учебника')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      toast.error('Моля, качете текстов файл (.txt или .md)')
      return
    }

    try {
      const content = await file.text()
      setTextbookName(file.name.replace(/\.(txt|md)$/, ''))
      setTextbookContent(content)
      toast.success('Файлът е зареден успешно')
    } catch (error) {
      console.error('Error reading file:', error)
      toast.error('Грешка при четене на файла')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const handleOverlayUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileType = file.type
    if (!fileType.includes('svg') && !fileType.includes('png')) {
      toast.error('Моля, качете SVG или PNG файл')
      return
    }

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        const overlay: CustomOverlay = {
          dataUrl,
          type: fileType.includes('svg') ? 'svg' : 'png',
          name: file.name,
          uploadDate: new Date().toISOString()
        }
        
        await setCustomOverlay(overlay)
        toast.success('Overlay map е качен успешно')
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading overlay:', error)
      toast.error('Грешка при качване на overlay map')
    }
  }

  const handleRemoveOverlay = async () => {
    try {
      await setCustomOverlay(null)
      toast.success('Overlay map е премахнат. Използва се стандартния.')
    } catch (error) {
      console.error('Error removing overlay:', error)
      toast.error('Грешка при премахване на overlay map')
    }
  }

  const handleSaveManual = async () => {
    try {
      await setIridologyManual({
        content: manualContent,
        lastModified: new Date().toISOString()
      })
      toast.success('Иридологичното ръководство е запазено успешно')
    } catch (error) {
      console.error('Error saving manual:', error)
      toast.error('Грешка при запазване на ръководството')
    }
  }

  const handleResetManual = async () => {
    setManualContent(DEFAULT_IRIDOLOGY_MANUAL)
    await setIridologyManual({
      content: DEFAULT_IRIDOLOGY_MANUAL,
      lastModified: new Date().toISOString()
    })
    toast.success('Ръководството е възстановено до оригиналната версия')
  }

  const handleSavePrompt = async () => {
    try {
      await setAiPromptTemplate({
        content: promptContent,
        lastModified: new Date().toISOString()
      })
      toast.success('AI промптът е запазен успешно')
    } catch (error) {
      console.error('Error saving prompt:', error)
      toast.error('Грешка при запазване на промпта')
    }
  }

  const handleResetPrompt = async () => {
    setPromptContent(DEFAULT_AI_PROMPT)
    await setAiPromptTemplate({
      content: DEFAULT_AI_PROMPT,
      lastModified: new Date().toISOString()
    })
    toast.success('Промптът е възстановен до оригиналната версия')
  }

  const openaiModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
  const geminiModels = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash']
  const githubSparkModels = ['gpt-4o', 'gpt-4o-mini']

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
          <TabsList className="grid w-full grid-cols-5 md:grid-cols-9 gap-1 h-auto p-1">
            <TabsTrigger value="ai-config" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <Brain className="w-4 h-4 md:mr-1" />
              <span className="hidden sm:inline">AI Модел</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="ai-strategy" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <Brain className="w-4 h-4 md:mr-1" />
              <span className="hidden sm:inline">AI Стратегия</span>
              <span className="sm:hidden">Страт</span>
            </TabsTrigger>
            <TabsTrigger value="editor" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <PencilSimple className="w-4 h-4 md:mr-1" />
              <span className="hidden sm:inline">Editor</span>
              <span className="sm:hidden">Edit</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <BookOpen className="w-4 h-4 md:mr-1" />
              <span className="hidden sm:inline">Ръководство</span>
              <span className="sm:hidden">Книга</span>
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <Robot className="w-4 h-4 md:mr-1" />
              <span className="hidden sm:inline">AI Промпт</span>
              <span className="sm:hidden">Промпт</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <FileText className="w-4 h-4 md:mr-1" />
              <span className="hidden sm:inline">Ресурси</span>
              <span className="sm:hidden">Файлове</span>
            </TabsTrigger>
            <TabsTrigger value="questionnaire" className="flex items-center justify-center gap-1 text-xs md:text-sm px-2 py-2 md:py-2.5">
              <CheckCircle className="w-4 h-4 md:mr-1" />
              <span className="hidden lg:inline">Въпросник</span>
              <span className="lg:hidden">Форма</span>
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
                    Забавяне: {aiConfig.requestDelay || 30000}ms | Заявки: {aiConfig.requestCount || 8} | 
                    Очаквано време: ~{Math.round((aiConfig.requestDelay || 30000) * (aiConfig.requestCount || 8) / 60000)} мин
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
                      {provider === 'github-spark' && (
                        <>
                          <SelectItem value="gpt-4o">
                            gpt-4o
                          </SelectItem>
                          <SelectItem value="gpt-4o-mini">
                            gpt-4o-mini
                          </SelectItem>
                        </>
                      )}
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
                      onChange={(e) => setRequestDelay(parseInt(e.target.value) || 30000)}
                      min={1000}
                      max={120000}
                      step={1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Препоръчително: 5000-10000ms (5-10 сек) за API заявки
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="request-count" className="text-base">Брой AI заявки</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Общ брой заявки за задълбочен мултивалентен анализ с корелация
                    </p>
                    <Select value={requestCount.toString()} onValueChange={(v) => setRequestCount(parseInt(v))}>
                      <SelectTrigger id="request-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 заявки - Базов анализ</SelectItem>
                        <SelectItem value="6">6 заявки - Разширен анализ</SelectItem>
                        <SelectItem value="8">8 заявки - Пълен корелиран анализ (препоръчително)</SelectItem>
                        <SelectItem value="10">10 заявки - Максимално детайлен анализ</SelectItem>
                        <SelectItem value="12">12 заявки - Изключително задълбочен анализ</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Повече заявки = по-прецизен, задълбочен и персонализиран анализ с множество слоеве на корелация между иридологични находки и данни от въпросника. 
                      8 заявки включва: ляв ирис, десен ирис, хранителен план, добавки, психология, специални препоръки, изследвания, детайлен анализ + резюмета.
                    </p>
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

          <TabsContent value="ai-strategy">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AIModelStrategyTab />
            </motion.div>
          </TabsContent>

          <TabsContent value="editor">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <EditorModeTab />
            </motion.div>
          </TabsContent>

          <TabsContent value="manual">
            <IridologyManualTab />
          </TabsContent>

          <TabsContent value="prompt">
            <AIPromptTab />
          </TabsContent>

          <TabsContent value="resources">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                Учебници по иридология
              </CardTitle>
              <CardDescription className="text-sm">
                Качете учебници и референтни материали за подобряване на анализа
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="textbook-file" className="flex items-center gap-2 text-sm md:text-base">
                    <Upload className="w-4 h-4" />
                    Качи файл (опционално)
                  </Label>
                  <Input
                    id="textbook-file"
                    type="file"
                    accept=".txt,.md"
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    Поддържани формати: .txt, .md
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textbook-name" className="text-sm md:text-base">Име на учебника</Label>
                  <Input
                    id="textbook-name"
                    placeholder="напр. Основи на иридологията - Д-р Иванов"
                    value={textbookName}
                    onChange={(e) => setTextbookName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textbook-content" className="text-sm md:text-base">Съдържание</Label>
                  <Textarea
                    id="textbook-content"
                    placeholder="Въведете или поставете текста от учебника..."
                    value={textbookContent}
                    onChange={(e) => setTextbookContent(e.target.value)}
                    className="min-h-[200px] font-mono text-xs md:text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Този текст ще бъде използван като контекст при AI анализа
                  </p>
                </div>

                <Button onClick={handleAddTextbook} className="w-full text-sm md:text-base">
                  <Upload className="w-4 h-4 mr-2" />
                  Добави учебник
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm md:text-base">Налични учебници ({textbooks?.length || 0})</Label>
                </div>

                {textbooks && textbooks.length > 0 ? (
                  <ScrollArea className="h-[250px] md:h-[300px] rounded-md border p-2 md:p-4">
                    <div className="space-y-3">
                      {textbooks.map((textbook) => (
                        <motion.div
                          key={textbook.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-start justify-between gap-2 md:gap-4 p-2 md:p-3 rounded-lg border bg-card"
                        >
                          <div className="flex-1 space-y-1 min-w-0">
                            <p className="font-medium text-sm md:text-base break-words">{textbook.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {formatFileSize(textbook.fileSize)}
                              </Badge>
                              <span>•</span>
                              <span>
                                {new Date(textbook.uploadDate).toLocaleDateString('bg-BG')}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTextbook(textbook.id)}
                            className="flex-shrink-0"
                          >
                            <Trash className="w-4 h-4 text-destructive" />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 border rounded-lg">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Все още няма качени учебници
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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

          <TabsContent value="export">
            <ProjectExportTab />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}
