import { useState, useEffect, useCallback } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  GitBranch,
  Key,
  Plus,
  Trash,
  CaretDown,
  CaretUp,
  CheckCircle,
  ArrowsDownUp,
  FloppyDisk,
  ArrowCounterClockwise,
  Plugs,
  Warning,
  Gear,
  TextT,
  ListNumbers
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GitHubAdminConfig, PipelineConfig, PipelineStepConfig } from '@/types'
import { getGitHubApiService, initializeGitHubApiService, DEFAULT_PIPELINE_CONFIG } from '@/lib/github-api'

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'gpt-4-turbo', 'gpt-4']
const GEMINI_MODELS = ['gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']

export default function PipelineManagerTab() {
  // GitHub Config state
  const [githubConfig, setGithubConfig] = useKVWithFallback<GitHubAdminConfig>('github-admin-config', {
    apiKey: '',
    repoOwner: 'Radilovk',
    repoName: 'airis1.0',
    branch: 'main',
    pipelinePath: 'pipeline-config.json'
  })

  const [apiKey, setApiKey] = useState('')
  const [repoOwner, setRepoOwner] = useState('Radilovk')
  const [repoName, setRepoName] = useState('airis1.0')
  const [branch, setBranch] = useState('main')
  const [pipelinePath, setPipelinePath] = useState('pipeline-config.json')

  // Pipeline state
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig | null>(null)
  const [configSha, setConfigSha] = useState<string | undefined>()
  const [stepShas, setStepShas] = useState<Record<string, string>>({})

  // UI state
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [editingStep, setEditingStep] = useState<PipelineStepConfig | null>(null)
  const [isNewStepDialogOpen, setIsNewStepDialogOpen] = useState(false)
  const [newStepForm, setNewStepForm] = useState<Partial<PipelineStepConfig>>({
    name: '',
    description: '',
    prompt: '',
    modelSettings: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 3000,
      topP: 0.9
    }
  })

  // Load saved config
  useEffect(() => {
    if (githubConfig) {
      setApiKey(githubConfig.apiKey || '')
      setRepoOwner(githubConfig.repoOwner || 'Radilovk')
      setRepoName(githubConfig.repoName || 'airis1.0')
      setBranch(githubConfig.branch || 'main')
      setPipelinePath(githubConfig.pipelinePath || 'pipeline-config.json')

      // Initialize service if we have an API key
      if (githubConfig.apiKey) {
        initializeGitHubApiService(githubConfig)
        setIsConnected(true)
      }
    }
  }, [githubConfig])

  // Test connection
  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error('Моля, въведете GitHub API ключ')
      return
    }

    setIsLoading(true)
    try {
      const config: GitHubAdminConfig = {
        apiKey,
        repoOwner,
        repoName,
        branch,
        pipelinePath
      }
      
      const service = initializeGitHubApiService(config)
      const result = await service.testConnection()

      if (result.success) {
        toast.success('✓ Успешна връзка с GitHub!')
        setIsConnected(true)
        
        // Save config
        await setGithubConfig(config)
        
        // Load pipeline config
        await loadPipelineConfig()
      } else {
        toast.error(`Грешка: ${result.message}`)
        setIsConnected(false)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Грешка при връзка: ${message}`)
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Load pipeline config from GitHub
  const loadPipelineConfig = async () => {
    setIsLoading(true)
    try {
      const service = getGitHubApiService()
      
      // Try to load config from GitHub
      const result = await service.getPipelineConfig()
      
      if (result) {
        setPipelineConfig(result.config)
        setConfigSha(result.sha)
        toast.success('Pipeline конфигурацията е заредена')
        
        // Load prompts for each step
        await loadStepPrompts(result.config.steps)
      } else {
        // Initialize with default config
        setPipelineConfig(DEFAULT_PIPELINE_CONFIG)
        toast.info('Използва се конфигурация по подразбиране')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Грешка при зареждане: ${message}`)
      setPipelineConfig(DEFAULT_PIPELINE_CONFIG)
    } finally {
      setIsLoading(false)
    }
  }

  // Load prompts for steps
  const loadStepPrompts = async (steps: PipelineStepConfig[]) => {
    const service = getGitHubApiService()
    const newShas: Record<string, string> = {}
    
    for (const step of steps) {
      try {
        const result = await service.getStepPrompt(step.id)
        if (result) {
          step.prompt = result.content
          newShas[step.id] = result.sha
        }
      } catch {
        console.log(`No prompt found for step ${step.id}`)
      }
    }
    
    setStepShas(newShas)
  }

  // Save pipeline config to GitHub
  const handleSaveConfig = async () => {
    if (!pipelineConfig) return
    
    setIsLoading(true)
    try {
      const service = getGitHubApiService()
      
      // Update last modified
      const updatedConfig: PipelineConfig = {
        ...pipelineConfig,
        lastModified: new Date().toISOString()
      }
      
      // Save main config
      const result = await service.savePipelineConfig(updatedConfig, configSha)
      setConfigSha(result.sha)
      
      // Save individual step prompts
      for (const step of updatedConfig.steps) {
        if (step.prompt) {
          const sha = stepShas[step.id]
          const promptResult = await service.saveStepPrompt(step.id, step.prompt, sha)
          setStepShas(prev => ({ ...prev, [step.id]: promptResult.sha }))
        }
      }
      
      setPipelineConfig(updatedConfig)
      toast.success('✓ Конфигурацията е запазена успешно!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Грешка при запазване: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle step expansion
  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }, [])

  // Update step
  const updateStep = (stepId: string, updates: Partial<PipelineStepConfig>) => {
    if (!pipelineConfig) return
    
    setPipelineConfig(prev => {
      if (!prev) return prev
      return {
        ...prev,
        steps: prev.steps.map(step =>
          step.id === stepId
            ? { ...step, ...updates, lastModified: new Date().toISOString() }
            : step
        )
      }
    })
  }

  // Move step up/down
  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    if (!pipelineConfig) return
    
    const steps = [...pipelineConfig.steps]
    const index = steps.findIndex(s => s.id === stepId)
    
    if (direction === 'up' && index > 0) {
      [steps[index], steps[index - 1]] = [steps[index - 1], steps[index]]
    } else if (direction === 'down' && index < steps.length - 1) {
      [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]]
    }
    
    // Update order numbers
    steps.forEach((step, i) => {
      step.order = i + 1
    })
    
    // Update input/output connections
    steps.forEach((step, i) => {
      step.inputFrom = i > 0 ? steps[i - 1].id : null
      step.outputTo = i < steps.length - 1 ? steps[i + 1].id : null
    })
    
    setPipelineConfig(prev => prev ? { ...prev, steps } : prev)
  }

  // Add new step
  const handleAddStep = () => {
    if (!pipelineConfig || !newStepForm.name) return
    
    const id = newStepForm.name.toLowerCase().replace(/\s+/g, '_')
    const newStep: PipelineStepConfig = {
      id,
      name: newStepForm.name || '',
      description: newStepForm.description || '',
      order: pipelineConfig.steps.length + 1,
      enabled: true,
      prompt: newStepForm.prompt || '',
      modelSettings: newStepForm.modelSettings || {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 3000,
        topP: 0.9
      },
      inputFrom: pipelineConfig.steps.length > 0 ? pipelineConfig.steps[pipelineConfig.steps.length - 1].id : null,
      outputTo: null,
      lastModified: new Date().toISOString()
    }
    
    // Update previous last step to point to new step
    const updatedSteps = pipelineConfig.steps.map(step => 
      step.outputTo === null ? { ...step, outputTo: id } : step
    )
    
    setPipelineConfig(prev => prev ? {
      ...prev,
      steps: [...updatedSteps, newStep]
    } : prev)
    
    setIsNewStepDialogOpen(false)
    setNewStepForm({
      name: '',
      description: '',
      prompt: '',
      modelSettings: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 3000,
        topP: 0.9
      }
    })
    
    toast.success(`Стъпка "${newStep.name}" е добавена`)
  }

  // Delete step
  const handleDeleteStep = (stepId: string) => {
    if (!pipelineConfig) return
    
    const stepToDelete = pipelineConfig.steps.find(s => s.id === stepId)
    if (!stepToDelete) return
    
    // Update connections
    const prevStep = pipelineConfig.steps.find(s => s.outputTo === stepId)
    const nextStep = pipelineConfig.steps.find(s => s.inputFrom === stepId)
    
    let updatedSteps = pipelineConfig.steps.filter(s => s.id !== stepId)
    
    if (prevStep && nextStep) {
      updatedSteps = updatedSteps.map(step => {
        if (step.id === prevStep.id) {
          return { ...step, outputTo: nextStep.id }
        }
        if (step.id === nextStep.id) {
          return { ...step, inputFrom: prevStep.id }
        }
        return step
      })
    } else if (prevStep) {
      updatedSteps = updatedSteps.map(step => 
        step.id === prevStep.id ? { ...step, outputTo: null } : step
      )
    } else if (nextStep) {
      updatedSteps = updatedSteps.map(step => 
        step.id === nextStep.id ? { ...step, inputFrom: null } : step
      )
    }
    
    // Update order numbers
    updatedSteps.forEach((step, i) => {
      step.order = i + 1
    })
    
    setPipelineConfig(prev => prev ? { ...prev, steps: updatedSteps } : prev)
    toast.success(`Стъпка "${stepToDelete.name}" е изтрита`)
  }

  // Reset to default
  const handleResetToDefault = () => {
    setPipelineConfig(DEFAULT_PIPELINE_CONFIG)
    setConfigSha(undefined)
    setStepShas({})
    toast.info('Конфигурацията е възстановена до стойности по подразбиране')
  }

  return (
    <div className="space-y-6">
      {/* GitHub Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <GitBranch className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
            <span>GitHub Връзка</span>
            {isConnected && (
              <Badge variant="default" className="ml-2 bg-emerald-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Свързан
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-sm">
            Въведете GitHub API ключ за управление на pipeline-а директно от GitHub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="github-api-key" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                GitHub API Ключ
              </Label>
              <Input
                id="github-api-key"
                type="password"
                placeholder="ghp_xxxx..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Генерирайте от Settings → Developer settings → Personal access tokens
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="repo-owner">Собственик на репо</Label>
              <Input
                id="repo-owner"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="repo-name">Име на репо</Label>
              <Input
                id="repo-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="branch">Клон (branch)</Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleTestConnection} 
              disabled={isLoading || !apiKey.trim()}
              className="flex-1"
            >
              <Plugs className="w-4 h-4 mr-2" />
              {isLoading ? 'Свързване...' : 'Тествай връзката'}
            </Button>
            
            {isConnected && (
              <Button 
                onClick={loadPipelineConfig} 
                variant="outline"
                disabled={isLoading}
              >
                <ArrowCounterClockwise className="w-4 h-4 mr-2" />
                Презареди
              </Button>
            )}
          </div>
          
          <Alert>
            <Warning className="h-4 w-4" />
            <AlertDescription className="text-xs">
              API ключът се съхранява само локално в браузъра ви. Никога не се изпраща на трети страни.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Pipeline Steps Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg md:text-xl">
            <div className="flex items-center gap-2">
              <ListNumbers className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
              <span>Pipeline Стъпки</span>
            </div>
            <div className="flex gap-2">
              <Dialog open={isNewStepDialogOpen} onOpenChange={setIsNewStepDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" />
                    Нова стъпка
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Добавяне на нова стъпка</DialogTitle>
                    <DialogDescription>
                      Конфигурирайте новата стъпка в pipeline-а
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Име на стъпката</Label>
                      <Input
                        value={newStepForm.name || ''}
                        onChange={(e) => setNewStepForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="напр. Custom Analyzer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Описание</Label>
                      <Input
                        value={newStepForm.description || ''}
                        onChange={(e) => setNewStepForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Кратко описание на стъпката"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>AI Модел</Label>
                      <Select 
                        value={newStepForm.modelSettings?.model || 'gpt-4o'}
                        onValueChange={(value) => setNewStepForm(prev => ({
                          ...prev,
                          modelSettings: { ...prev.modelSettings!, model: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewStepDialogOpen(false)}>
                      Отказ
                    </Button>
                    <Button onClick={handleAddStep} disabled={!newStepForm.name}>
                      <Plus className="w-4 h-4 mr-1" />
                      Добави
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button 
                size="sm" 
                onClick={handleSaveConfig}
                disabled={isLoading || !pipelineConfig}
              >
                <FloppyDisk className="w-4 h-4 mr-1" />
                Запази в GitHub
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-sm">
            Управлявайте стъпките, промптовете и настройките на моделите
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pipelineConfig ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Свържете се с GitHub за да заредите pipeline конфигурацията</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setPipelineConfig(DEFAULT_PIPELINE_CONFIG)}
              >
                Използвай конфигурация по подразбиране
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                <AnimatePresence>
                  {pipelineConfig.steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Collapsible 
                        open={expandedSteps.has(step.id)}
                        onOpenChange={() => toggleStep(step.id)}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="w-8 h-8 flex items-center justify-center p-0">
                                  {step.order}
                                </Badge>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{step.name}</span>
                                    {!step.enabled && (
                                      <Badge variant="secondary" className="text-xs">Деактивирана</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{step.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'up') }}
                                  disabled={index === 0}
                                >
                                  <CaretUp className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'down') }}
                                  disabled={index === pipelineConfig.steps.length - 1}
                                >
                                  <CaretDown className="w-4 h-4" />
                                </Button>
                                {expandedSteps.has(step.id) ? (
                                  <CaretUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <CaretDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="p-4 space-y-4 border-t">
                              {/* Step Settings */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Име</Label>
                                  <Input
                                    value={step.name}
                                    onChange={(e) => updateStep(step.id, { name: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Описание</Label>
                                  <Input
                                    value={step.description}
                                    onChange={(e) => updateStep(step.id, { description: e.target.value })}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={step.enabled}
                                    onCheckedChange={(checked) => updateStep(step.id, { enabled: checked })}
                                  />
                                  <Label>Активирана</Label>
                                </div>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => handleDeleteStep(step.id)}
                                >
                                  <Trash className="w-4 h-4 mr-1" />
                                  Изтрий
                                </Button>
                              </div>
                              
                              <Separator />
                              
                              {/* Model Settings */}
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <Gear className="w-4 h-4" />
                                  <Label className="text-base font-medium">Настройки на модела</Label>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Доставчик</Label>
                                    <Select 
                                      value={step.modelSettings.provider}
                                      onValueChange={(value: 'openai' | 'gemini') => updateStep(step.id, {
                                        modelSettings: { ...step.modelSettings, provider: value }
                                      })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                        <SelectItem value="gemini">Google Gemini</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label>Модел</Label>
                                    <Select 
                                      value={step.modelSettings.model}
                                      onValueChange={(value) => updateStep(step.id, {
                                        modelSettings: { ...step.modelSettings, model: value }
                                      })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {step.modelSettings.provider === 'openai' 
                                          ? OPENAI_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)
                                          : GEMINI_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)
                                        }
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <Label>Temperature: {step.modelSettings.temperature.toFixed(2)}</Label>
                                      <Badge variant="outline">{step.modelSettings.temperature.toFixed(2)}</Badge>
                                    </div>
                                    <Slider
                                      value={[step.modelSettings.temperature]}
                                      onValueChange={([value]) => updateStep(step.id, {
                                        modelSettings: { ...step.modelSettings, temperature: Math.round(value * 100) / 100 }
                                      })}
                                      min={0}
                                      max={1}
                                      step={0.05}
                                    />
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <Label>Max Tokens: {step.modelSettings.maxTokens}</Label>
                                      <Badge variant="outline">{step.modelSettings.maxTokens}</Badge>
                                    </div>
                                    <Slider
                                      value={[step.modelSettings.maxTokens]}
                                      onValueChange={([value]) => updateStep(step.id, {
                                        modelSettings: { ...step.modelSettings, maxTokens: value }
                                      })}
                                      min={500}
                                      max={8000}
                                      step={100}
                                    />
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <Label>Top P: {step.modelSettings.topP.toFixed(2)}</Label>
                                      <Badge variant="outline">{step.modelSettings.topP.toFixed(2)}</Badge>
                                    </div>
                                    <Slider
                                      value={[step.modelSettings.topP]}
                                      onValueChange={([value]) => updateStep(step.id, {
                                        modelSettings: { ...step.modelSettings, topP: Math.round(value * 100) / 100 }
                                      })}
                                      min={0.1}
                                      max={1}
                                      step={0.05}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <Separator />
                              
                              {/* Prompt Editor */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <TextT className="w-4 h-4" />
                                  <Label className="text-base font-medium">Промпт</Label>
                                </div>
                                <Textarea
                                  value={step.prompt}
                                  onChange={(e) => updateStep(step.id, { prompt: e.target.value })}
                                  className="min-h-[200px] font-mono text-xs"
                                  placeholder="Въведете промпт за тази стъпка..."
                                />
                              </div>
                              
                              {/* Connection Info */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ArrowsDownUp className="w-4 h-4" />
                                <span>
                                  Вход от: {step.inputFrom || 'Начало'} → Изход към: {step.outputTo || 'Финал'}
                                </span>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
          
          <Separator className="my-4" />
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleResetToDefault}
              className="flex-1"
            >
              <ArrowCounterClockwise className="w-4 h-4 mr-2" />
              Възстанови по подразбиране
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
