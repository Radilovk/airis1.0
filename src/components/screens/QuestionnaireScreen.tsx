import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
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

interface QuestionnaireScreenProps {
  onComplete: (data: QuestionnaireData) => void
  initialData: QuestionnaireData | null
}

export default function QuestionnaireScreen({ onComplete, initialData }: QuestionnaireScreenProps) {
  const [questionnaireConfig] = useKV<QuestionnaireConfig>('questionnaire-config', {
    questions: defaultQuestions,
    version: '1.0'
  })

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
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
  const [otherValues, setOtherValues] = useState<Record<string, string>>({})
  const [showOther, setShowOther] = useState<Record<string, boolean>>({})
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocument[]>(
    initialData?.uploadedDocuments || []
  )

  const questions = questionnaireConfig?.questions || defaultQuestions
  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

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

    if (showOther[currentQuestion.id] && otherValues[currentQuestion.id]) {
      const otherValue = otherValues[currentQuestion.id]
      if (Array.isArray(answer)) {
        setAnswers({
          ...answers,
          [currentQuestion.id]: [...answer.filter(v => v !== 'other'), otherValue]
        })
      }
    }

    if (currentQuestionIndex < questions.length - 1) {
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
    const finalData: QuestionnaireData = {
      name: answers.name || '',
      age: Number(answers.age) || 0,
      gender: answers.gender || 'other',
      weight: Number(answers.weight) || 0,
      height: Number(answers.height) || 0,
      goals: answers.goals || [],
      healthStatus: answers.healthStatus || [],
      complaints: answers.complaints || '',
      medicalConditions: answers.medicalConditions || '',
      familyHistory: answers.familyHistory || '',
      activityLevel: answers.activityLevel || 'moderate',
      stressLevel: answers.stressLevel || 'moderate',
      sleepHours: Number(answers.sleepHours) || 7,
      sleepQuality: answers.sleepQuality || 'good',
      hydration: Number(answers.hydration) || 8,
      dietaryProfile: answers.dietaryProfile || [],
      dietaryHabits: answers.dietaryHabits || [],
      foodIntolerances: answers.foodIntolerances || '',
      allergies: answers.allergies || '',
      medications: answers.medications || '',
      uploadedDocuments: uploadedFiles,
      customAnswers: answers
    }

    onComplete(finalData)
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
      setAnswers({ ...answers, [questionId]: [...current, value] })
    } else {
      setAnswers({ ...answers, [questionId]: current.filter(v => v !== value) })
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

    switch (question.type) {
      case 'text':
        return (
          <div className="space-y-2">
            <Input
              id={question.id}
              type="text"
              placeholder="Въведете отговор..."
              value={value || ''}
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
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
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
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
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
              className="min-h-[150px] text-base resize-none"
              autoFocus
            />
          </div>
        )

      case 'radio':
        return (
          <RadioGroup
            value={value}
            onValueChange={(val) => setAnswers({ ...answers, [question.id]: val })}
            className="space-y-3"
          >
            {question.options?.map((option) => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  value === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
                onClick={() => setAnswers({ ...answers, [question.id]: option.value })}
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
            {question.options?.map((option) => (
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
              onValueChange={(val) => setAnswers({ ...answers, [question.id]: val[0] })}
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
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Въпрос {currentQuestionIndex + 1} от {questions.length}
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              {currentQuestionIndex} / {questions.length}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>

        <Card className="p-6 md:p-8">
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
                <h2 className="text-2xl md:text-3xl font-bold">
                  {currentQuestion.question}
                  {currentQuestion.required && <span className="text-destructive ml-1">*</span>}
                </h2>
                {currentQuestion.description && (
                  <p className="text-muted-foreground">{currentQuestion.description}</p>
                )}
              </div>

              <div className="pt-4">
                {renderQuestion()}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between items-center mt-8 pt-6 border-t gap-4">
            {currentQuestionIndex > 0 ? (
              <Button
                variant="outline"
                onClick={handleBack}
                className="gap-2"
              >
                <ArrowLeft size={16} weight="bold" />
                Назад
              </Button>
            ) : (
              <div />
            )}
            
            <Button
              onClick={handleNext}
              className="gap-2 ml-auto"
            >
              {currentQuestionIndex === questions.length - 1 ? (
                <>
                  Напред към Снимките
                  <CheckCircle size={16} weight="bold" />
                </>
              ) : (
                <>
                  Напред
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
