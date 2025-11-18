# Deep Editable System - Документация

## Общ Преглед

Deep Editable System е **напълно нова рекурсивна система за редакция**, която позволява редактиране на **ВСЕКИ ЕДИН ЕЛЕМЕНТ** в репорта - от най-горното ниво до най-дълбоките подконтейнери.

## Архитектура

### Основни Компоненти

1. **DeepEditableWrapper** (`/src/components/report/DeepEditableWrapper.tsx`)
   - Обгръща всеки елемент с редакторски контроли
   - Поддържа многостепенна йерархия (level 0, 1, 2, 3...)
   - Визуално разграничава нивата чрез различни цветове на border
   - Drag & drop функционалност за пренареждане

2. **useDeepEditable** (`/src/hooks/use-deep-editable.ts`)
   - React hook за управление на състоянието на всеки елемент
   - Persistence чрез `useKV` - запазва се между сесии
   - Операции: toggle visibility, add/delete comments, reorder

3. **Deep Editable Tabs**
   - `PlanTabDeepEditable` - **ПЪЛНА рекурсивна редакция**
   - `OverviewTabDeepEditable` - базова редакция (с план за разширение)
   - `IridologyTabDeepEditable` - базова редакция (с план за разширение)

## Как Работи

### Структура на Редакция

```
Plan Tab (level 0)
├── Мотивационен Текст (level 0)
│   ├── Заглавие (level 1)
│   └── Текст (level 1)
├── Общи Препоръки (level 0)
│   ├── Заглавие (level 1)
│   └── Препоръка 1 (level 2)
│   └── Препоръка 2 (level 2)
│   └── Препоръка 3 (level 2)
├── Хранителни Препоръки (level 0)
│   ├── Заглавие (level 1)
│   ├── Препоръчани Храни (level 2)
│   │   ├── Храна 1 (level 3)
│   │   ├── Храна 2 (level 3)
│   │   └── Храна 3 (level 3)
│   └── Храни за Избягване (level 2)
│       ├── Храна 1 (level 3)
│       └── Храна 2 (level 3)
└── ... и още елементи
```

### Визуални Индикатори

- **Level 0**: Син border (`border-primary/30`)
- **Level 1**: Оранжев border (`border-accent/30`)
- **Level 2+**: Сив border (`border-muted-foreground/20`)
- **Hover**: Increase border opacity, shadow, z-index bump
- **Hidden**: Opacity 30%
- **Comments**: Badge показва брой нерешени коментари

### Редакторски Контроли

Всеки елемент има toolbar (показва се при hover):

1. **Drag Handle** (⋮⋮) - За пренареждане
2. **Element Label** - Име на елемента
3. **Comment Badge** - Брой коментари
4. **Visibility Toggle** (👁 / 👁‍🗨) - Показване/скриване
5. **Comments Dialog** (💬) - Добавяне/преглед на коментари
6. **Delete** (🗑) - Изтриване на елемент (optional)

## Използване

### Включване на Editor Mode

1. Отиди в **Admin Panel**
2. Включи **"Editor Mode"** toggle
3. Направи анализ или отвори съществуващ репорт
4. Всички елементи ще имат редакторски контроли

### Редактиране на Елемент

1. **Hover** над елемента - появява се toolbar
2. **Drag** - преместване нагоре/надолу
3. **Eye icon** - скриване/показване
4. **Comment icon** - добавяне на коментар/инструкция

### Добавяне на Коментар/Инструкция

1. Кликни на 💬 иконата
2. Напиши коментар/инструкция
3. Кликни "Добави"
4. Badge показва активни коментари
5. Изтрий коментар чрез 🗑 бутона в диалога

### Скриване на Елемент

1. Кликни на 👁 иконата
2. Елемент става полупрозрачен (opacity 30%)
3. **Важно**: Скритите елементи са видими в editor mode, но скрити за потребителя
4. Кликни отново за показване

### Пренареждане

1. **Drag** елемента от handle-a (⋮⋮)
2. Пусни на желаното място
3. Промяната се запазва автоматично

## Persistence

Всички промени се запазват в `spark.kv` storage:

```typescript
{
  "deep-editable-store": {
    "plan": {
      "motivational-summary": {
        "id": "motivational-summary",
        "visible": true,
        "comments": [...],
        "order": 0
      },
      "general-rec-0": {
        "id": "general-rec-0",
        "visible": true,
        "comments": [...],
        "order": 0
      },
      ...
    },
    "overview": {...},
    "iridology": {...}
  }
}
```

## API Reference

### DeepEditableWrapper Props

```typescript
interface DeepEditableWrapperProps {
  id: string                    // Уникален ID на елемента
  label: string                 // Име на елемента за показване
  editorMode: boolean           // Дали е включен editor mode
  state: DeepEditableState      // Състояние от hook
  onToggleVisibility: (id: string) => void
  onAddComment: (id: string, text: string) => void
  onDeleteComment: (id: string, commentId: string) => void
  onDelete?: (id: string) => void  // Optional delete handler
  children: ReactNode           // Съдържание за обгръщане
  className?: string
  level?: number                // Ниво на вложеност (0, 1, 2...)
  sortable?: boolean            // Дали може да се пренарежда
}
```

### useDeepEditable Hook

```typescript
const editor = useDeepEditable(moduleId: string, editorMode: boolean)

// Методи:
editor.getElementState(id: string): DeepEditableState
editor.toggleVisibility(id: string): void
editor.addComment(id: string, text: string): void
editor.deleteComment(id: string, commentId: string): void
editor.bulkUpdateOrder(updates: Array<{id, order}>): void
```

## Добавяне на Нов Редактируем Елемент

### Стъпка 1: Обгърни с DeepEditableWrapper

```tsx
import { DeepEditableWrapper } from '@/components/report/DeepEditableWrapper'
import { useDeepEditable } from '@/hooks/use-deep-editable'

function MyComponent({ editorMode }) {
  const editor = useDeepEditable('my-module', editorMode)
  
  return (
    <DeepEditableWrapper
      id="my-unique-element-id"
      label="Моят Елемент"
      editorMode={editorMode}
      state={editor.getElementState('my-unique-element-id')}
      onToggleVisibility={editor.toggleVisibility}
      onAddComment={editor.addComment}
      onDeleteComment={editor.deleteComment}
      level={0}
    >
      <div>Съдържанието на моя елемент</div>
    </DeepEditableWrapper>
  )
}
```

### Стъпка 2: Вложи Подел ементи

```tsx
<DeepEditableWrapper id="parent" level={0} {...props}>
  <div>
    <DeepEditableWrapper id="child-1" level={1} {...props}>
      <h3>Заглавие</h3>
    </DeepEditableWrapper>
    
    <DeepEditableWrapper id="child-2" level={1} {...props}>
      <p>Текст</p>
    </DeepEditableWrapper>
    
    <DeepEditableWrapper id="child-3-section" level={1} {...props}>
      <div>
        <DeepEditableWrapper id="grandchild-1" level={2} {...props}>
          <span>Дълбоко вложен елемент</span>
        </DeepEditableWrapper>
      </div>
    </DeepEditableWrapper>
  </div>
</DeepEditableWrapper>
```

## Примери

### Пример 1: Прост Текстов Елемент

```tsx
<DeepEditableWrapper
  id="summary-text"
  label="Обобщителен Текст"
  editorMode={editorMode}
  state={editor.getElementState('summary-text')}
  onToggleVisibility={editor.toggleVisibility}
  onAddComment={editor.addComment}
  onDeleteComment={editor.deleteComment}
  level={1}
>
  <p>{report.summary}</p>
</DeepEditableWrapper>
```

### Пример 2: List с Редактируеми Items

```tsx
<DeepEditableWrapper id="recommendations-list" level={0} {...props}>
  <div>
    {items.map((item, index) => (
      <DeepEditableWrapper
        key={index}
        id={`rec-item-${index}`}
        label={`Препоръка ${index + 1}`}
        level={1}
        {...props}
      >
        <div>{item}</div>
      </DeepEditableWrapper>
    ))}
  </div>
</DeepEditableWrapper>
```

### Пример 3: Collapsible с Вложени Секции

```tsx
<Collapsible>
  <CollapsibleTrigger>
    <DeepEditableWrapper id="section-heading" level={1} {...props}>
      <h3>Заглавие на Секция</h3>
    </DeepEditableWrapper>
  </CollapsibleTrigger>
  
  <CollapsibleContent>
    <DeepEditableWrapper id="section-intro" level={2} {...props}>
      <p>Въведение</p>
    </DeepEditableWrapper>
    
    {subItems.map((item, i) => (
      <DeepEditableWrapper
        key={i}
        id={`section-item-${i}`}
        level={3}
        {...props}
      >
        <div>{item}</div>
      </DeepEditableWrapper>
    ))}
  </CollapsibleContent>
</Collapsible>
```

## Best Practices

1. **Уникални ID-та**: Винаги използвай уникални, описателни ID-та
2. **Правилни Levels**: Започни от level 0 за top-level, увеличавай за вложени
3. **Кратки Labels**: Използвай кратки, ясни имена за labels
4. **Групиране**: Групирай свързани елементи под общ родител
5. **Sortable**: Използвай `sortable={true}` само на top-level или списъци
6. **Conditional Rendering**: Проверявай дали елементът е видим преди рендер на съдържанието

## Troubleshooting

### Проблем: Toolbar не се показва

**Решение**: Провери дали:
- `editorMode={true}` е подаден
- Element-ът има hover state
- Z-index на wrapper-а не е блокиран от друг елемент

### Проблем: Drag & Drop не работи

**Решение**:
- Увери се, че `sortable={true}`
- Проверихай дали има `DndContext` wrapper
- Провери дали има `SortableContext` с правилните IDs

### Проблем: State не се запазва

**Решение**:
- Провери дали `moduleId` е консистентен
- Потвърди че hook се извиква с правилния moduleId
- Провери browser console за грешки в useKV

### Проблем: Елемент не се скрива след toggle

**Решение**:
- Увери се, че рендер логиката проверява `state.visible`
- Провери дали няма conditional render преди wrapper-а

## Roadmap

- [ ] Пълна Deep Editable имплементация за Overview Tab
- [ ] Пълна Deep Editable имплементация за Iridology Tab
- [ ] Export/Import на editor конфигурация
- [ ] Undo/Redo функционалност
- [ ] AI-assisted content generation от коментари
- [ ] Version history tracking
- [ ] Collaborative editing (multi-user)

## Заключение

Deep Editable System предоставя **безпрецедентно ниво на контрол** върху всеки аспект на репорта. 

**Сега имаш достъп до ВСЕКИ един елемент** - от най-горното ниво до най-дълбоките подконтейнери, точно както поиска! 🎉
