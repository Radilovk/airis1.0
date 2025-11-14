import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
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
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  Brain, 
  Key, 
  BookOpen, 
  Upload, 
  Trash, 
  CheckCircle,
  Warning,
  Image as ImageIcon,
  Eye
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AIModelConfig, IridologyTextbook, CustomOverlay } from '@/types'
import IridologyOverlay from '@/components/iris/IridologyOverlay'
import QuestionnaireManager from '@/components/admin/QuestionnaireManager'

interface AdminScreenProps {
  onBack: () => void
}

export default function AdminScreen({ onBack }: AdminScreenProps) {
  const [aiConfig, setAiConfig] = useKV<AIModelConfig>('ai-model-config', {
    provider: 'github-spark',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false,
    requestDelay: 60000,
    requestCount: 8
  })
  
  const [textbooks, setTextbooks] = useKV<IridologyTextbook[]>('iridology-textbooks', [])
  const [customOverlay, setCustomOverlay] = useKV<CustomOverlay | null>('custom-overlay', null)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [provider, setProvider] = useState<'openai' | 'gemini' | 'github-spark'>(aiConfig?.provider || 'github-spark')
  const [model, setModel] = useState(aiConfig?.model || 'gpt-4o')
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '')
  const [useCustomKey, setUseCustomKey] = useState(aiConfig?.useCustomKey || false)
  const [requestDelay, setRequestDelay] = useState(aiConfig?.requestDelay || 60000)
  const [requestCount, setRequestCount] = useState(aiConfig?.requestCount || 8)
  
  const [textbookName, setTextbookName] = useState('')
  const [textbookContent, setTextbookContent] = useState('')
  const [showOverlayPreview, setShowOverlayPreview] = useState(false)

  const getValidSparkModel = (model: string): string => {
    if (model === 'gpt-4o' || model === 'gpt-4o-mini') {
      return model
    }
    return 'gpt-4o'
  }

  useEffect(() => {
    checkOwnership()
  }, [])

  useEffect(() => {
    if (aiConfig) {
      setProvider(aiConfig.provider)
      setModel(aiConfig.model)
      setApiKey(aiConfig.apiKey)
      setUseCustomKey(aiConfig.useCustomKey)
      setRequestDelay(aiConfig.requestDelay || 60000)
      setRequestCount(aiConfig.requestCount || 8)
      
      if (aiConfig.provider === 'github-spark') {
        console.log(`ℹ️ [ADMIN] GitHub Spark Provider зареден - модел: ${aiConfig.model}`)
      }
    }
  }, [aiConfig])

  const checkOwnership = async () => {
    try {
      const user = await window.spark.user()
      setIsOwner(user?.isOwner || false)
    } catch (error) {
      console.error('Error checking ownership:', error)
      setIsOwner(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (useCustomKey && provider !== 'github-spark' && !apiKey.trim()) {
      toast.error('Моля, въведете API ключ')
      return
    }

    try {
      const config: AIModelConfig = {
        provider,
        model: model,
        apiKey: useCustomKey && provider !== 'github-spark' ? apiKey : '',
        useCustomKey: provider !== 'github-spark' ? useCustomKey : false,
        requestDelay,
        requestCount
      }
      
      console.log('💾 [ADMIN] Запазване на конфигурация:', config)
      
      await setAiConfig(config)
      
      if (provider === 'github-spark' || !useCustomKey) {
        toast.success(`✓ Конфигурацията е запазена: GitHub Spark / ${model}`, {
          duration: 5000
        })
      } else {
        toast.success(`✓ AI конфигурация запазена: ${provider} / ${model}`)
      }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Зареждане...</p>
        </div>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warning className="w-6 h-6 text-destructive" />
              Достъп отказан
            </CardTitle>
            <CardDescription>
              Само собственикът на приложението има достъп до административния панел.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад към началото
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const openaiModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
  const geminiModels = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash']
  const githubSparkModels = ['gpt-4o', 'gpt-4o-mini']

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Административен панел</h1>
            <p className="text-muted-foreground">
              Управление на AI модели и учебници по иридология
            </p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Настройки на AI модел
              </CardTitle>
              <CardDescription>
                Изберете AI модел и конфигурирайте API достъп за анализ на ирисите
              </CardDescription>
              
              {aiConfig && aiConfig.provider === 'github-spark' && !aiConfig.useCustomKey && (
                <div className="mt-3 p-3 bg-primary/10 rounded-lg border-2 border-primary/30">
                  <p className="text-sm font-bold text-primary flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    GitHub Spark API - Активен модел: {aiConfig.model}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    GitHub Spark поддържа <strong>gpt-4o</strong> и <strong>gpt-4o-mini</strong>. 
                    За достъп до други модели (GPT-4 Turbo, Gemini и др.), добавете 
                    <strong> собствен API ключ</strong> от OpenAI или Google.
                  </p>
                </div>
              )}
              
              {aiConfig && (
                <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium text-primary">
                    ✓ Активна конфигурация: {aiConfig.provider === 'github-spark' || !aiConfig.useCustomKey ? (
                      <>
                        <span className="font-mono">GitHub Spark / {aiConfig.model}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (поддържа gpt-4o и gpt-4o-mini)
                        </span>
                      </>
                    ) : (
                      <span className="font-mono">{aiConfig.provider} / {aiConfig.model}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Забавяне: {aiConfig.requestDelay || 30000}ms | Заявки: {aiConfig.requestCount || 8} | 
                    Очаквано време: ~{Math.round((aiConfig.requestDelay || 30000) * (aiConfig.requestCount || 8) / 60000)} мин
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Доставчик на AI модел</Label>
                  <RadioGroup value={provider} onValueChange={(v) => setProvider(v as 'openai' | 'gemini' | 'github-spark')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="github-spark" id="github-spark" />
                      <Label htmlFor="github-spark" className="font-normal cursor-pointer">
                        GitHub Spark (вграден - поддържа gpt-4o и gpt-4o-mini)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="openai" id="openai" />
                      <Label htmlFor="openai" className="font-normal cursor-pointer">
                        OpenAI (изисква API ключ - позволява избор на модел)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gemini" id="gemini" />
                      <Label htmlFor="gemini" className="font-normal cursor-pointer">
                        Google Gemini (изисква API ключ - позволява избор на модел)
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {provider === 'github-spark' && (
                    <div className="mt-2 p-2 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">
                        ℹ️ GitHub Spark API поддържа <strong>gpt-4o</strong> и <strong>gpt-4o-mini</strong>. 
                        Изборът ви по-долу ще бъде използван. За достъп до други модели (GPT-4 Turbo, Gemini), 
                        използвайте собствен API ключ.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Модел</Label>
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
                      Препоръчително: 30000ms (30 сек) за GitHub Spark, 5000ms (5 сек) за собствен API ключ
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

                {provider !== 'github-spark' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="use-custom-key">Използвай собствен API ключ</Label>
                          <p className="text-sm text-muted-foreground">
                            Активирайте, за да използвате собствения си API ключ
                          </p>
                        </div>
                        <Switch
                          id="use-custom-key"
                          checked={useCustomKey}
                          onCheckedChange={setUseCustomKey}
                        />
                      </div>

                      {!useCustomKey && (
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground">
                            ⚠️ <strong>Използва се GitHub Spark вграден модел</strong><br/>
                            Анализът ще отнеме по-дълго време (90-150 сек.) и може да срещнете rate limit грешки при много заявки. За по-бързо и стабилно изпълнение, използвайте собствен API ключ.
                          </p>
                        </div>
                      )}

                      {useCustomKey && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2"
                        >
                          <Label htmlFor="api-key" className="flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            API ключ
                          </Label>
                          <Input
                            id="api-key"
                            type="password"
                            placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground">
                            {provider === 'openai' 
                              ? 'Вашият OpenAI API ключ (започва с sk-)'
                              : 'Вашият Google AI API ключ'
                            }
                          </p>
                          <div className="mt-3 p-3 bg-accent/10 rounded-lg border border-accent/20">
                            <p className="text-xs text-accent-foreground">
                              💡 <strong>Предимства на собствен API ключ:</strong>
                            </p>
                            <ul className="text-xs text-accent-foreground/80 mt-2 space-y-1 list-disc list-inside">
                              <li>По-бързо време за анализ (30-60 сек. вместо 90-150 сек.)</li>
                              <li>Без GitHub Spark rate limit ограничения</li>
                              <li>Възможност за избор на различни модели (включително Gemini)</li>
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Button onClick={handleSaveConfig} className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Запази настройките
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Учебници по иридология
              </CardTitle>
              <CardDescription>
                Качете учебници и референтни материали за подобряване на анализа
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="textbook-file" className="flex items-center gap-2">
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
                  <Label htmlFor="textbook-name">Име на учебника</Label>
                  <Input
                    id="textbook-name"
                    placeholder="напр. Основи на иридологията - Д-р Иванов"
                    value={textbookName}
                    onChange={(e) => setTextbookName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textbook-content">Съдържание</Label>
                  <Textarea
                    id="textbook-content"
                    placeholder="Въведете или поставете текста от учебника..."
                    value={textbookContent}
                    onChange={(e) => setTextbookContent(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Този текст ще бъде използван като контекст при AI анализа
                  </p>
                </div>

                <Button onClick={handleAddTextbook} className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Добави учебник
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Налични учебници ({textbooks?.length || 0})</Label>
                </div>

                {textbooks && textbooks.length > 0 ? (
                  <ScrollArea className="h-[300px] rounded-md border p-4">
                    <div className="space-y-3">
                      {textbooks.map((textbook) => (
                        <motion.div
                          key={textbook.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card"
                        >
                          <div className="flex-1 space-y-1">
                            <p className="font-medium">{textbook.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <QuestionnaireManager />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                Иридологичен Overlay Map
              </CardTitle>
              <CardDescription>
                Качете персонализиран overlay шаблон за използване при оразмеряване на изображения
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {customOverlay ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{customOverlay.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">
                            {customOverlay.type.toUpperCase()}
                          </Badge>
                          <span>•</span>
                          <span>
                            {new Date(customOverlay.uploadDate).toLocaleDateString('bg-BG')}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowOverlayPreview(!showOverlayPreview)}
                          className="gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          {showOverlayPreview ? 'Скрий' : 'Преглед'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveOverlay}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash className="w-4 h-4" />
                          Премахни
                        </Button>
                      </div>
                    </div>
                    
                    {showOverlayPreview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 flex justify-center p-4 bg-black/5 rounded-lg"
                      >
                        <div className="relative w-64 h-64">
                          <IridologyOverlay size={256} className="opacity-90" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">
                      💡 Персонализираният overlay се използва при оразмеряване на изображения и остава върху запазените снимки за визуализация.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium mb-2">
                      Използва се стандартния overlay шаблон
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Качете персонализиран SVG или PNG файл
                    </p>
                    <Label htmlFor="overlay-upload" className="cursor-pointer">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                        <Upload className="w-4 h-4" />
                        Качи Overlay Map
                      </div>
                      <Input
                        id="overlay-upload"
                        type="file"
                        accept=".svg,.png,image/svg+xml,image/png"
                        onChange={handleOverlayUpload}
                        className="hidden"
                      />
                    </Label>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Предварителен преглед на стандартния overlay:</p>
                    <div className="flex justify-center p-4 bg-black/5 rounded-lg border">
                      <div className="relative w-64 h-64">
                        <IridologyOverlay size={256} className="opacity-90" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-xs font-semibold mb-2">📋 Изисквания за overlay:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Формат: SVG (препоръчва се) или PNG</li>
                      <li>• Квадратен формат с еднакви размери (напр. 800x800px)</li>
                      <li>• Центриран дизайн с концентрични кръгове</li>
                      <li>• Прозрачен фон или светъл overlay</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {customOverlay && (
                <div className="pt-4">
                  <Label htmlFor="overlay-replace" className="cursor-pointer block">
                    <Button variant="outline" className="w-full gap-2" asChild>
                      <div>
                        <Upload className="w-4 h-4" />
                        Качи нов Overlay Map
                      </div>
                    </Button>
                    <Input
                      id="overlay-replace"
                      type="file"
                      accept=".svg,.png,image/svg+xml,image/png"
                      onChange={handleOverlayUpload}
                      className="hidden"
                    />
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
