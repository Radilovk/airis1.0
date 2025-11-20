import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { toast } from 'sonner'
import { 
  Plus, 
  Trash, 
  PencilSimple,
  DotsSixVertical,
  ListChecks,
  Copy,
  ArrowCounterClockwise
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useIsMobile } from '@/hooks/use-mobile'
import type { QuestionConfig, QuestionnaireConfig, QuestionType, QuestionOption } from '@/types'
import { defaultQuestions } from '@/lib/defaultQuestions'

interface SortableQuestionProps {
  question: QuestionConfig
  index: number
  onEdit: (question: QuestionConfig) => void
  onDelete: (id: string) => void
  onDuplicate: (question: QuestionConfig) => void
}

function SortableQuestion({ question, index, onEdit, onDelete, onDuplicate }: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const questionTypeLabels: Record<QuestionType, string> = {
    text: 'Текст',
    number: 'Число',
    textarea: 'Област',
    radio: 'Радио',
    checkbox: 'Чек',
    dropdown: 'Меню',
    slider: 'Плъзгач',
    file: 'Файл'
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`p-3 md:p-4 rounded-lg border bg-card ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-2 md:gap-3">
        <button
          className="touch-none cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded transition-colors flex-shrink-0 mt-1"
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
        </button>

        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {index + 1}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {questionTypeLabels[question.type]}
            </Badge>
            {question.required && (
              <Badge variant="destructive" className="text-xs">
                *
              </Badge>
            )}
          </div>
          
          <p className="font-medium text-sm md:text-base line-clamp-2">
            {question.question}
          </p>
          
          {question.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {question.description}
            </p>
          )}
          
          {question.options && question.options.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {question.options.slice(0, 2).map((opt, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {opt.label}
                </Badge>
              ))}
              {question.options.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{question.options.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(question)}
          >
            <PencilSimple className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDuplicate(question)}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDelete(question.id)}
          >
            <Trash className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

interface QuestionEditorProps {
  question: QuestionConfig | null
  onSave: (question: QuestionConfig) => void
  onCancel: () => void
}

function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [editingQuestion, setEditingQuestion] = useState<QuestionConfig | null>(question)
  const [newOptionValue, setNewOptionValue] = useState('')

  if (!editingQuestion) return null

  const handleSave = () => {
    if (!editingQuestion.question.trim()) {
      toast.error('Моля, въведете текст на въпроса')
      return
    }
    onSave(editingQuestion)
  }

  const addOption = () => {
    if (!newOptionValue.trim()) return

    const newOption: QuestionOption = {
      value: newOptionValue,
      label: newOptionValue
    }

    setEditingQuestion({
      ...editingQuestion,
      options: [...(editingQuestion.options || []), newOption]
    })
    setNewOptionValue('')
  }

  const removeOption = (index: number) => {
    const updatedOptions = [...(editingQuestion.options || [])]
    updatedOptions.splice(index, 1)

    setEditingQuestion({
      ...editingQuestion,
      options: updatedOptions
    })
  }

  const updateOption = (index: number, newLabel: string) => {
    const updatedOptions = [...(editingQuestion.options || [])]
    updatedOptions[index] = { ...updatedOptions[index], label: newLabel, value: newLabel }
    
    setEditingQuestion({
      ...editingQuestion,
      options: updatedOptions
    })
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="question-type" className="text-sm font-medium">
          Тип въпрос
        </Label>
        <Select
          value={editingQuestion.type}
          onValueChange={(value) =>
            setEditingQuestion({ ...editingQuestion, type: value as QuestionType })
          }
        >
          <SelectTrigger id="question-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Текстово поле</SelectItem>
            <SelectItem value="number">Число</SelectItem>
            <SelectItem value="textarea">Текстова област</SelectItem>
            <SelectItem value="radio">Радио бутони</SelectItem>
            <SelectItem value="checkbox">Чекбоксове</SelectItem>
            <SelectItem value="dropdown">Падащо меню</SelectItem>
            <SelectItem value="slider">Плъзгач</SelectItem>
            <SelectItem value="file">Файл</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="question-text" className="text-sm font-medium">
          Въпрос <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="question-text"
          value={editingQuestion.question}
          onChange={(e) =>
            setEditingQuestion({ ...editingQuestion, question: e.target.value })
          }
          placeholder="Въведете текст на въпроса..."
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="question-desc" className="text-sm font-medium">
          Описание
        </Label>
        <Textarea
          id="question-desc"
          value={editingQuestion.description || ''}
          onChange={(e) =>
            setEditingQuestion({ ...editingQuestion, description: e.target.value })
          }
          placeholder="Допълнителна информация..."
          rows={2}
          className="resize-none"
        />
      </div>

      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="required" className="text-sm font-medium">
            Задължително поле
          </Label>
          <p className="text-xs text-muted-foreground">
            Изисква отговор
          </p>
        </div>
        <Switch
          id="required"
          checked={editingQuestion.required}
          onCheckedChange={(checked) =>
            setEditingQuestion({ ...editingQuestion, required: checked })
          }
        />
      </div>

      {['radio', 'checkbox', 'dropdown'].includes(editingQuestion.type) && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Опции за избор</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {editingQuestion.options?.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input 
                  value={option.label} 
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 h-9" 
                  placeholder={`Опция ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => removeOption(index)}
                >
                  <Trash className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <Input
              placeholder="Нова опция..."
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addOption()
                }
              }}
              className="flex-1 h-9"
            />
            <Button onClick={addOption} size="icon" className="h-9 w-9 flex-shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="allow-other" className="text-sm font-medium">
                Позволи "Друго"
              </Label>
              <p className="text-xs text-muted-foreground">
                Свободен текст
              </p>
            </div>
            <Switch
              id="allow-other"
              checked={editingQuestion.allowOther}
              onCheckedChange={(checked) =>
                setEditingQuestion({ ...editingQuestion, allowOther: checked })
              }
            />
          </div>
        </div>
      )}

      {['number', 'slider'].includes(editingQuestion.type) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="min-value" className="text-sm font-medium">
              Минимум
            </Label>
            <Input
              id="min-value"
              type="number"
              value={editingQuestion.validation?.min || ''}
              onChange={(e) =>
                setEditingQuestion({
                  ...editingQuestion,
                  validation: {
                    ...editingQuestion.validation,
                    min: Number(e.target.value)
                  }
                })
              }
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-value" className="text-sm font-medium">
              Максимум
            </Label>
            <Input
              id="max-value"
              type="number"
              value={editingQuestion.validation?.max || ''}
              onChange={(e) =>
                setEditingQuestion({
                  ...editingQuestion,
                  validation: {
                    ...editingQuestion.validation,
                    max: Number(e.target.value)
                  }
                })
              }
              className="h-9"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Отказ
        </Button>
        <Button onClick={handleSave} className="flex-1">
          Запази
        </Button>
      </div>
    </div>
  )
}

export default function QuestionnaireManager() {
  const [questionnaireConfig, setQuestionnaireConfig] = useKV<QuestionnaireConfig>('questionnaire-config', {
    questions: defaultQuestions,
    version: '1.0'
  })

  const [editingQuestion, setEditingQuestion] = useState<QuestionConfig | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const isMobile = useIsMobile()

  const questions = questionnaireConfig?.questions || []

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id)
      const newIndex = questions.findIndex((q) => q.id === over.id)

      const reorderedQuestions = arrayMove(questions, oldIndex, newIndex)

      await setQuestionnaireConfig({
        questions: reorderedQuestions,
        version: questionnaireConfig?.version || '1.0'
      })
    }
  }

  const createNewQuestion = (): QuestionConfig => ({
    id: `custom-${Date.now()}`,
    type: 'text',
    question: '',
    description: '',
    required: false,
    options: []
  })

  const handleAddQuestion = () => {
    setEditingQuestion(createNewQuestion())
    if (isMobile) {
      setIsDrawerOpen(true)
    } else {
      setIsDialogOpen(true)
    }
  }

  const handleEditQuestion = (question: QuestionConfig) => {
    setEditingQuestion({ ...question })
    if (isMobile) {
      setIsDrawerOpen(true)
    } else {
      setIsDialogOpen(true)
    }
  }

  const handleSaveQuestion = async (question: QuestionConfig) => {
    try {
      const existingIndex = questions.findIndex(q => q.id === question.id)
      let updatedQuestions: QuestionConfig[]

      if (existingIndex >= 0) {
        updatedQuestions = [...questions]
        updatedQuestions[existingIndex] = question
      } else {
        updatedQuestions = [...questions, question]
      }

      await setQuestionnaireConfig({
        questions: updatedQuestions,
        version: questionnaireConfig?.version || '1.0'
      })

      toast.success('Въпросът е запазен')
      setIsDialogOpen(false)
      setIsDrawerOpen(false)
      setEditingQuestion(null)
    } catch (error) {
      console.error('Error saving question:', error)
      toast.error('Грешка при запазване')
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    try {
      const updatedQuestions = questions.filter(q => q.id !== id)
      await setQuestionnaireConfig({
        questions: updatedQuestions,
        version: questionnaireConfig?.version || '1.0'
      })
      toast.success('Въпросът е изтрит')
    } catch (error) {
      console.error('Error deleting question:', error)
      toast.error('Грешка при изтриване')
    }
  }

  const handleDuplicateQuestion = async (question: QuestionConfig) => {
    try {
      const duplicated: QuestionConfig = {
        ...question,
        id: `custom-${Date.now()}`,
        question: `${question.question} (копие)`
      }
      
      const updatedQuestions = [...questions, duplicated]
      await setQuestionnaireConfig({
        questions: updatedQuestions,
        version: questionnaireConfig?.version || '1.0'
      })
      
      toast.success('Въпросът е дублиран')
    } catch (error) {
      console.error('Error duplicating question:', error)
      toast.error('Грешка при дублиране')
    }
  }

  const handleResetToDefault = async () => {
    if (!confirm('Сигурни ли сте, че искате да възстановите въпросника по подразбиране? Всички персонализирани промени ще бъдат изтрити.')) {
      return
    }

    try {
      await setQuestionnaireConfig({
        questions: defaultQuestions,
        version: '1.0'
      })
      toast.success('Въпросникът е възстановен')
    } catch (error) {
      console.error('Error resetting questionnaire:', error)
      toast.error('Грешка при възстановяване')
    }
  }

  const handleCancel = () => {
    setIsDialogOpen(false)
    setIsDrawerOpen(false)
    setEditingQuestion(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <ListChecks className="w-5 h-5 text-primary flex-shrink-0" />
              <span>Управление на Въпросника</span>
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Редактирайте въпроси чрез плъзгане за подредба
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              onClick={handleResetToDefault}
              className="gap-2"
            >
              <ArrowCounterClockwise className="w-4 h-4" />
              {!isMobile && "Нулиране"}
            </Button>
            <Button 
              onClick={handleAddQuestion} 
              size={isMobile ? "sm" : "default"}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Добави
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-xs md:text-sm text-primary flex items-start gap-2">
            <DotsSixVertical className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Използвайте иконата за плъзгане, за да преподредите въпросите</span>
          </p>
        </div>

        <ScrollArea className="h-[500px] md:h-[600px] pr-2 md:pr-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={questions.map(q => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 md:space-y-3">
                <AnimatePresence>
                  {questions.map((question, index) => (
                    <SortableQuestion
                      key={question.id}
                      question={question}
                      index={index}
                      onEdit={handleEditQuestion}
                      onDelete={handleDeleteQuestion}
                      onDuplicate={handleDuplicateQuestion}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>

          {questions.length === 0 && (
            <div className="text-center py-12 border rounded-lg">
              <ListChecks className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                Все още няма въпроси във въпросника
              </p>
              <Button onClick={handleAddQuestion} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Добави първи въпрос
              </Button>
            </div>
          )}
        </ScrollArea>

        {!isMobile ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingQuestion?.id?.startsWith('custom-') && questions.every(q => q.id !== editingQuestion?.id)
                    ? 'Добави нов въпрос'
                    : 'Редактирай въпрос'}
                </DialogTitle>
                <DialogDescription>
                  Конфигурирайте настройките на въпроса
                </DialogDescription>
              </DialogHeader>
              <QuestionEditor
                question={editingQuestion}
                onSave={handleSaveQuestion}
                onCancel={handleCancel}
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerContent className="max-h-[90vh]">
              <DrawerHeader className="text-left">
                <DrawerTitle>
                  {editingQuestion?.id?.startsWith('custom-') && questions.every(q => q.id !== editingQuestion?.id)
                    ? 'Добави нов въпрос'
                    : 'Редактирай въпрос'}
                </DrawerTitle>
                <DrawerDescription>
                  Конфигурирайте настройките
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <QuestionEditor
                  question={editingQuestion}
                  onSave={handleSaveQuestion}
                  onCancel={handleCancel}
                />
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </CardContent>
    </Card>
  )
}
