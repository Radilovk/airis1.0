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
  Warning
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { AIModelConfig, IridologyTextbook } from '@/types'

interface AdminScreenProps {
  onBack: () => void
}

export default function AdminScreen({ onBack }: AdminScreenProps) {
  const [aiConfig, setAiConfig] = useKV<AIModelConfig>('ai-model-config', {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    useCustomKey: false
  })
  
  const [textbooks, setTextbooks] = useKV<IridologyTextbook[]>('iridology-textbooks', [])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [provider, setProvider] = useState<'openai' | 'gemini'>(aiConfig?.provider || 'openai')
  const [model, setModel] = useState(aiConfig?.model || 'gpt-4o')
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '')
  const [useCustomKey, setUseCustomKey] = useState(aiConfig?.useCustomKey || false)
  
  const [textbookName, setTextbookName] = useState('')
  const [textbookContent, setTextbookContent] = useState('')

  useEffect(() => {
    checkOwnership()
  }, [])

  useEffect(() => {
    if (aiConfig) {
      setProvider(aiConfig.provider)
      setModel(aiConfig.model)
      setApiKey(aiConfig.apiKey)
      setUseCustomKey(aiConfig.useCustomKey)
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
    if (useCustomKey && !apiKey.trim()) {
      toast.error('Моля, въведете API ключ')
      return
    }

    try {
      const config: AIModelConfig = {
        provider,
        model,
        apiKey: useCustomKey ? apiKey : '',
        useCustomKey
      }
      
      await setAiConfig(config)
      toast.success('Конфигурацията е запазена успешно')
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
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Доставчик на AI модел</Label>
                  <RadioGroup value={provider} onValueChange={(v) => setProvider(v as 'openai' | 'gemini')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="openai" id="openai" />
                      <Label htmlFor="openai" className="font-normal cursor-pointer">
                        OpenAI (GPT-4o, GPT-4 Turbo)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="gemini" id="gemini" />
                      <Label htmlFor="gemini" className="font-normal cursor-pointer">
                        Google Gemini (Gemini 2.0, Gemini 1.5)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Модел</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Изберете модел" />
                    </SelectTrigger>
                    <SelectContent>
                      {provider === 'openai' ? (
                        <>
                          {openaiModels.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </>
                      ) : (
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
                    </motion.div>
                  )}
                </div>
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
      </div>
    </div>
  )
}
