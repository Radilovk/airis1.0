import { useState, useEffect, useMemo, useCallback } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle,
  Upload,
  X,
  File
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { QuestionnaireData, QuestionConfig, QuestionnaireConfig, UploadedDocument } from '@/types'
import { defaultQuestions } from '@/lib/defaultQuestions'
import {
  getVisibleQuestions,
  getFilteredOptions,
  sanitizeAnswers,
  normalizeQuestionnairePayload,
  applyCheckboxExclusion,
  getQuestionSectionLabel,
  QUESTIONNAIRE_CONFIG_VERSION,
} from '@/lib/questionnaire-logic'

interface QuestionnaireScreenProps {
  onComplete: (data: QuestionnaireData) => void
  initialData: QuestionnaireData | null
}

export default function QuestionnaireScreen({ onComplete, initialData }: QuestionnaireScreenProps) {
  const [questionnaireConfig] = useKVWithFallback<QuestionnaireConfig>('questionnaire-config', {
    questions: defaultQuestions,
    version: QUESTIONNAIRE_CONFIG_VERSION,
  })

  const allQuestions = useMemo(() => {
    const cfg = questionnaireConfig
    if (!cfg || cfg.version !== QUESTIONNAIRE_CONFIG_VERSION) return defaultQuestions
    return cfg.questions.length > 0 ? cfg.questions : defaultQuestions
  }, [questionnaireConfig])

  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    if (initialData) {
      return {
        ...initialData,
        customAnswers: initialData.customAnswers || {},
        uploadedDocuments: initialData.uploadedDocuments || []
      }
    }
    return {}
  })
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [otherValues, setOtherValues] = useState<Record<string, string>>({})
  const [showOther, setShowOther] = useState<Record<string, boolean>>({})
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocument[]>(
    initialData?.uploadedDocuments || []
  )

  const visibleQuestions = useMemo(
    () => getVisibleQuestions(allQuestions, answers),
    [allQuestions, answers]
  )

  const currentQuestion = visibleQuestions[currentQuestionIndex]
  const progress = visibleQuestions.length
    ? ((currentQuestionIndex + 1) / visibleQuestions.length) * 100
    : 0

  const setAnswersSanitized = useCallback(
    (next: Record<string, any>) => {
      setAnswers(sanitizeAnswers(next, allQuestions))
    },
    [allQuestions]
  )

  useEffect(() => {
    setAnswers(prev => {
      const cleaned = sanitizeAnswers(prev, allQuestions)
      const changed =
        JSON.stringify(cleaned.goals) !== JSON.stringify(prev.goals) ||
        JSON.stringify(cleaned.healthStatus) !== JSON.stringify(prev.healthStatus) ||
        cleaned.healthGate !== prev.healthGate ||
        cleaned.dietGate !== prev.dietGate ||
        cleaned.complaints !== prev.complaints ||
        cleaned.medications !== prev.medications
      if (changed) return cleaned
      return prev
    })
  }, [
    allQuestions,
    answers.gender,
    answers.age,
    answers.weight,
    answers.height,
    answers.goals,
    answers.healthGate,
    answers.dietGate,
  ])

  useEffect(() => {
    if (currentQuestionIndex >= visibleQuestions.length && visibleQuestions.length > 0) {
      setCurrentQuestionIndex(Math.max(0, visibleQuestions.length - 1))
    }
  }, [currentQuestionIndex, visibleQuestions.length])

  const validateAnswer = (question: QuestionConfig, value: any): boolean => {
    if (question.type === 'file') {
      return true
    }

    if (question.required && (value === undefined || value === null || value === '')) {
      toast.error('Това поле е задължително')
      return false
    }

    if (question.required && Array.isArray(value) && value.length === 0) {
      toast.error('Моля, изберете поне една опция')
      return false
    }

    if (question.type === 'number' && question.validation) {
      const numValue = Number(value)
      if (question.validation.min !== undefined && numValue < question.validation.min) {
        toast.error(`Стойността трябва да бъде поне ${question.validation.min}`)
        return false
      }
      if (question.validation.max !== undefined && numValue > question.validation.max) {
        toast.error(`Стойността трябва да бъде максимум ${question.validation.max}`)
        return false
      }
    }

    if (question.type === 'text' && question.validation?.min) {
      const textValue = String(value || '')
      if (textValue.length < question.validation.min) {
        toast.error(`Моля, въведете поне ${question.validation.min} символа`)
        return false
      }
    }

    return true
  }

  const handleNext = () => {
    const answer = answers[currentQuestion.id]
    
    if (!validateAnswer(currentQuestion, answer)) {
      return
    }

    advanceQuestion()
  }

  const handleSkip = () => {
    if (currentQuestion.required) return
    setAnswersSanitized({ ...answers, [currentQuestion.id]: currentQuestion.type === 'checkbox' ? [] : '' })
    advanceQuestion()
  }

  const advanceQuestion = () => {
    if (showOther[currentQuestion.id] && otherValues[currentQuestion.id]) {
      const otherValue = otherValues[currentQuestion.id]
      const answer = answers[currentQuestion.id]
      if (Array.isArray(answer)) {
        setAnswers({
          ...answers,
          [currentQuestion.id]: [...answer.filter(v => v !== 'other'), otherValue],
        })
      }
    }

    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      completeQuestionnaire()
    }
  }

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const completeQuestionnaire = () => {
    const mergedAnswers = { ...answers }
    for (const q of allQuestions) {
      if (showOther[q.id] && otherValues[q.id]) {
        const val = mergedAnswers[q.id]
        if (Array.isArray(val)) {
          mergedAnswers[q.id] = [...val.filter((v: string) => v !== 'other'), otherValues[q.id]]
        }
      }
    }

    onComplete(normalizeQuestionnairePayload(mergedAnswers, uploadedFiles, allQuestions))
  }

  const handleCheckboxChange = (questionId: string, value: string, checked: boolean) => {
    const current = (answers[questionId] || []) as string[]
    
    if (value === 'other') {
      setShowOther({ ...showOther, [questionId]: checked })
      if (!checked) {
        setOtherValues({ ...otherValues, [questionId]: '' })
      }
    }
    
    if (checked) {
      const next = applyCheckboxExclusion(questionId, current, value, true)
      setAnswersSanitized({ ...answers, [questionId]: next })
    } else {
      setAnswersSanitized({ ...answers, [questionId]: current.filter(v => v !== value) })
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newFiles: UploadedDocument[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Файлът ${file.name} е твърде голям (макс. 10MB)`)
        continue
      }

      try {
        const reader = new FileReader()
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const doc: UploadedDocument = {
          id: `doc-${Date.now()}-${i}`,
          name: file.name,
          dataUrl: fileData,
          type: file.type,
          size: file.size,
          uploadDate: new Date().toISOString()
        }

        newFiles.push(doc)
      } catch (error) {
        console.error('Error reading file:', error)
        toast.error(`Грешка при четене на ${file.name}`)
      }
    }

    setUploadedFiles([...uploadedFiles, ...newFiles])
    toast.success(`Качени ${newFiles.length} файла`)
  }

  const removeFile = (id: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id))
    toast.success('Файлът е премахнат')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const renderQuestion = () => {
    const question = currentQuestion
    const value = answers[question.id]
    const options = getFilteredOptions(question, answers)

    switch (question.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Input
              id={question.id}
              type="text"
              placeholder="Въведете отговор..."
              value={value || ''}
              onChange={(e) => setAnswersSanitized({ ...answers, [question.id]: e.target.value })}
              className="text-lg h-12"
              autoFocus
            />
          </div>
        )

      case 'number':
        return (
          <div className="space-y-2">
            <Input
              id={question.id}
              type="number"
              placeholder="Въведете число..."
              value={value || ''}
              onChange={(e) => setAnswersSanitized({ ...answers, [question.id]: e.target.value })}
              className="text-lg h-12"
              autoFocus
              min={question.validation?.min}
              max={question.validation?.max}
            />
          </div>
        )

      case 'textarea':
        return (
          <div className="space-y-2">
            <Textarea
              id={question.id}
              placeholder="Въведете отговор..."
              value={value || ''}
              onChange={(e) => setAnswersSanitized({ ...answers, [question.id]: e.target.value })}
              className="min-h-[150px] text-base resize-none"
              autoFocus
            />
          </div>
        )

      case 'radio':
        return (
          <RadioGroup
            value={value}
            onValueChange={(val) => setAnswersSanitized({ ...answers, [question.id]: val })}
            className="space-y-3"
          >
            {options.map((option) => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  value === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
                onClick={() => setAnswersSanitized({ ...answers, [question.id]: option.value })}
              >
                <RadioGroupItem value={option.value} id={option.value} className="mt-0.5" />
                <Label htmlFor={option.value} className="font-normal cursor-pointer flex-1 leading-snug">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )

      case 'checkbox':
        return (
          <div className="space-y-3">
            {options.map((option) => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  (value as string[])?.includes(option.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
                onClick={() => {
                  const isChecked = (value as string[])?.includes(option.value)
                  handleCheckboxChange(question.id, option.value, !isChecked)
                }}
              >
                <Checkbox
                  checked={(value as string[])?.includes(option.value)}
                  className="mt-0.5"
                  onCheckedChange={(checked) => handleCheckboxChange(question.id, option.value, !!checked)}
                />
                <Label className="font-normal cursor-pointer flex-1 leading-snug">
                  {option.label}
                </Label>
              </div>
            ))}
            
            {question.allowOther && (
              <>
                <div
                  className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    showOther[question.id]
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                  onClick={() => handleCheckboxChange(question.id, 'other', !showOther[question.id])}
                >
                  <Checkbox
                    checked={showOther[question.id]}
                    className="mt-0.5"
                    onCheckedChange={(checked) => handleCheckboxChange(question.id, 'other', !!checked)}
                  />
                  <Label className="font-normal cursor-pointer flex-1 leading-snug">
                    Друго
                  </Label>
                </div>
                
                {showOther[question.id] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-10"
                  >
                    <Input
                      placeholder="Опишете..."
                      value={otherValues[question.id] || ''}
                      onChange={(e) => setOtherValues({ ...otherValues, [question.id]: e.target.value })}
                      className="mt-2"
                    />
                  </motion.div>
                )}
              </>
            )}
          </div>
        )

      case 'slider':
        const sliderValue = value !== undefined ? Number(value) : (question.validation?.min || 0)
        return (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-center">
              <div className="text-5xl font-bold text-primary">
                {sliderValue}
              </div>
            </div>
            <Slider
              value={[sliderValue]}
              onValueChange={(val) => setAnswersSanitized({ ...answers, [question.id]: val[0] })}
              min={question.validation?.min || 0}
              max={question.validation?.max || 100}
              step={0.5}
              className="py-4"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{question.validation?.min || 0}</span>
              <span>{question.validation?.max || 100}</span>
            </div>
          </div>
        )

      case 'file':
        return (
          <div className="space-y-4">
            <Label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-all">
                <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Качете файлове</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG (макс. 10MB)</p>
              </div>
              <Input
                id="file-upload"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </Label>

            {uploadedFiles.length > 0 && (
              <ScrollArea className="h-[200px] rounded-lg border p-3">
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="w-8 h-8 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {formatFileSize(file.size)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(file.id)}
                        className="flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <p className="text-muted-foreground">Зареждане на въпросника...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-background to-muted/20 pb-28">
      <div className="flex-1 flex items-start justify-center p-4 pt-6 md:p-8 md:pt-10">
      <div className="max-w-lg w-full">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">
              Стъпка {currentQuestionIndex + 1} от {visibleQuestions.length}
            </p>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </motion.div>

        <Card className="border-0 shadow-lg shadow-primary/5 p-5 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                {getQuestionSectionLabel(currentQuestion.id) && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                    {getQuestionSectionLabel(currentQuestion.id)}
                  </p>
                )}
                <h2 className="text-xl md:text-2xl font-bold leading-snug tracking-tight">
                  {currentQuestion.question}
                  {currentQuestion.required && (
                    <span className="text-destructive ml-0.5" aria-hidden>*</span>
                  )}
                </h2>
                {currentQuestion.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentQuestion.description}
                  </p>
                )}
              </div>

              <div className="pt-4">
                {renderQuestion()}
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-lg px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {currentQuestionIndex > 0 ? (
            <Button variant="outline" onClick={handleBack} className="gap-2 shrink-0" size="lg">
              <ArrowLeft size={18} weight="bold" />
              <span className="hidden xs:inline">Назад</span>
            </Button>
          ) : (
            <div className="w-[72px] shrink-0" />
          )}

          {!currentQuestion.required && (
            <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground" size="lg">
              Пропусни
            </Button>
          )}

          <Button onClick={handleNext} className="gap-2 ml-auto flex-1 sm:flex-none" size="lg">
            {currentQuestionIndex === visibleQuestions.length - 1 ? (
              <>
                Към снимките
                <CheckCircle size={18} weight="bold" />
              </>
            ) : (
              <>
                Напред
                <ArrowRight size={18} weight="bold" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
