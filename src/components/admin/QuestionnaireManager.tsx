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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  Plus, 
  Trash, 
  PencilSimple,
  ArrowUp,
  ArrowDown,
  ListChecks
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import type { QuestionConfig, QuestionnaireConfig, QuestionType, QuestionOption } from '@/types'
import { defaultQuestions } from '@/lib/defaultQuestions'

export default function QuestionnaireManager() {
  const [questionnaireConfig, setQuestionnaireConfig] = useKV<QuestionnaireConfig>('questionnaire-config', {
    questions: defaultQuestions,
    version: '1.0'
  })

  const [editingQuestion, setEditingQuestion] = useState<QuestionConfig | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newOptionValue, setNewOptionValue] = useState('')

  const questions = questionnaireConfig?.questions || []

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
    setIsDialogOpen(true)
  }

  const handleEditQuestion = (question: QuestionConfig) => {
    setEditingQuestion({ ...question })
    setIsDialogOpen(true)
  }

  const handleSaveQuestion = async () => {
    if (!editingQuestion) return

    if (!editingQuestion.question.trim()) {
      toast.error('Моля, въведете текст на въпроса')
      return
    }

    try {
      const existingIndex = questions.findIndex(q => q.id === editingQuestion.id)
      let updatedQuestions: QuestionConfig[]

      if (existingIndex >= 0) {
        updatedQuestions = [...questions]
        updatedQuestions[existingIndex] = editingQuestion
      } else {
        updatedQuestions = [...questions, editingQuestion]
      }

      await setQuestionnaireConfig({
        questions: updatedQuestions,
        version: questionnaireConfig?.version || '1.0'
      })

      toast.success('Въпросът е запазен успешно')
      setIsDialogOpen(false)
      setEditingQuestion(null)
    } catch (error) {
      console.error('Error saving question:', error)
      toast.error('Грешка при запазване на въпроса')
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

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return
    }

    try {
      const newIndex = direction === 'up' ? index - 1 : index + 1
      const updatedQuestions = [...questions]
      const temp = updatedQuestions[index]
      updatedQuestions[index] = updatedQuestions[newIndex]
      updatedQuestions[newIndex] = temp

      await setQuestionnaireConfig({
        questions: updatedQuestions,
        version: questionnaireConfig?.version || '1.0'
      })
    } catch (error) {
      console.error('Error moving question:', error)
      toast.error('Грешка при преместване')
    }
  }

  const handleResetToDefault = async () => {
    if (!confirm('Сигурни ли сте, че искате да възстановите въпросника по подразбиране? Всички персонализирани въпроси ще бъдат изтрити.')) {
      return
    }

    try {
      await setQuestionnaireConfig({
        questions: defaultQuestions,
        version: '1.0'
      })
      toast.success('Въпросникът е възстановен до настройките по подразбиране')
    } catch (error) {
      console.error('Error resetting questionnaire:', error)
      toast.error('Грешка при възстановяване')
    }
  }

  const addOption = () => {
    if (!editingQuestion || !newOptionValue.trim()) return

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
    if (!editingQuestion) return

    const updatedOptions = [...(editingQuestion.options || [])]
    updatedOptions.splice(index, 1)

    setEditingQuestion({
      ...editingQuestion,
      options: updatedOptions
    })
  }

  const questionTypeLabels: Record<QuestionType, string> = {
    text: 'Текстово поле',
    number: 'Число',
    textarea: 'Текстова област',
    radio: 'Радио бутони',
    checkbox: 'Чекбоксове',
    dropdown: 'Падащо меню',
    slider: 'Плъзгач',
    file: 'Файл'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              Управление на Въпросника
            </CardTitle>
            <CardDescription>
              Добавяйте, редактирайте или премахвайте въпроси от анкетата
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleResetToDefault}>
              Възстанови по подразбиране
            </Button>
            <Button onClick={handleAddQuestion} className="gap-2">
              <Plus className="w-4 h-4" />
              Добави въпрос
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            <AnimatePresence>
              {questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {index + 1}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {questionTypeLabels[question.type]}
                        </Badge>
                        {question.required && (
                          <Badge variant="destructive" className="text-xs">
                            Задължително
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{question.question}</p>
                      {question.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {question.description}
                        </p>
                      )}
                      {question.options && question.options.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {question.options.slice(0, 3).map((opt, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {opt.label}
                            </Badge>
                          ))}
                          {question.options.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{question.options.length - 3} още
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveQuestion(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveQuestion(index, 'down')}
                        disabled={index === questions.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditQuestion(question)}
                      >
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteQuestion(question.id)}
                      >
                        <Trash className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {questions.length === 0 && (
              <div className="text-center py-12 border rounded-lg">
                <ListChecks className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  Все още няма въпроси във въпросника
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

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

            {editingQuestion && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="question-type">Тип въпрос</Label>
                  <Select
                    value={editingQuestion.type}
                    onValueChange={(value) =>
                      setEditingQuestion({ ...editingQuestion, type: value as QuestionType })
                    }
                  >
                    <SelectTrigger id="question-type">
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
                  <Label htmlFor="question-text">Въпрос *</Label>
                  <Input
                    id="question-text"
                    value={editingQuestion.question}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, question: e.target.value })
                    }
                    placeholder="Въведете текст на въпроса..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question-desc">Описание</Label>
                  <Textarea
                    id="question-desc"
                    value={editingQuestion.description || ''}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, description: e.target.value })
                    }
                    placeholder="Допълнителна информация за въпроса..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="required">Задължително поле</Label>
                    <p className="text-xs text-muted-foreground">
                      Потребителят трябва да отговори на този въпрос
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
                    <Label>Опции</Label>
                    <div className="space-y-2">
                      {editingQuestion.options?.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input value={option.label} disabled className="flex-1" />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index)}
                          >
                            <Trash className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
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
                          className="flex-1"
                        />
                        <Button onClick={addOption} size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="allow-other">Позволи "Друго"</Label>
                        <p className="text-xs text-muted-foreground">
                          Потребителят може да въведе свободен текст
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-value">Минимална стойност</Label>
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-value">Максимална стойност</Label>
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
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отказ
              </Button>
              <Button onClick={handleSaveQuestion}>
                Запази
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
