# 🌟 AIRIS - AI Иридологичен Анализ

Модерно уеб приложение за AI-базиран иридологичен анализ с персонализирани здравни препоръки.

---

## 🎯 Основни функционалности

✅ **Детайлен здравен въпросник** - 20+ въпроса за пълна анамнеза  
✅ **Iris изображения upload** - Camera + file upload с автоматична компресия  
✅ **Iris Crop Editor** - Позициониране, zoom и align с иридологичен шаблон  
✅ **AI Анализ** - GPT-4o/Gemini базиран топографски зонов анализ  
✅ **Интерактивен репорт** - 7 типа визуализации и графики  
✅ **История на анализи** - Auto-save с storage management  
✅ **Admin панел** - AI конфигурация, textbooks, prompts, editor mode  
✅ **Пълен проект експорт** - 120+ файла в JSON формат (НОВ!)  

---

## 🚀 Бърз старт

### Локална разработка

```bash
# Инсталация
npm install

# Dev server
npm run dev

# Build
npm run build
```

Отворете [http://localhost:5173](http://localhost:5173)

---

## 📦 НОВА ФУНКЦИЯ: Пълен Репозиторий Експорт

### Експортирайте ВСИЧКИ файлове от проекта

1. Отворете Admin панел → Експорт на проекта
2. Натиснете "Изтегли ПЪЛЕН проект като JSON"
3. Използвайте extraction скрипта:

```bash
# Node.js вариант
node extract-project.js airis-full-project-export-2024-01-15.json

# Python вариант
python3 extract-project.py airis-full-project-export-2024-01-15.json
```

4. Инсталирайте и стартирайте:

```bash
cd airis-extracted
npm install
npm run dev
```

**Какво е включено:**
- 120+ файла - root config, source код, компоненти (screens/admin/iris/report/ui), hooks, libraries, типове, стилове
- Extraction скриптове (Node.js + Python)
- DEPLOYMENT_README.md с пълни deployment инструкции
- Готово за GitHub Pages, Vercel, Netlify, Cloudflare Pages

👉 Вижте [EXPORT_README.md](./EXPORT_README.md) за детайли

---

## 🏗️ Технологии

- **React 19** + TypeScript
- **Vite 6** - Build tool
- **Tailwind CSS v4** - Styling
- **shadcn/ui v4** - 46 UI компонента
- **Framer Motion** - Анимации
- **Recharts** - Визуализации
- **Spark KV** - Persistence
- **GPT-4o / Gemini** - AI анализ

---

## 📚 Документация

### Как Работи AI Анализа?
- 🔬 **[Какво "Вижда" AI Модела?](./КАКВО_ВИЖДА_AI_МОДЕЛА.md)** - Детайлно обяснение как AI модела анализира ириса, как се ориентира и как открива артефакти
- 📖 **[Принципи за Ирисов Анализ](./ПРИНЦИПИ_ИРИСОВ_АНАЛИЗ.md)** - Методология за обективен анализ и интерпретация

### Общи Документи
- **[PRD.md](./PRD.md)** - Product Requirements Document
- **[EXPORT_README.md](./EXPORT_README.md)** - Пълна документация за експорт функционалността
- **[ITERATION_76_FULL_EXPORT.md](./ITERATION_76_FULL_EXPORT.md)** - Резюме на последната итерация
- **[CHANGELOG.md](./CHANGELOG.md)** - История на промените

---

## 🔧 Конфигурация

### AI Модели (Admin панел)

Поддържани providers:
- **GitHub Spark API** (вграден)
- **OpenAI API** (собствен key)
- **Google Gemini API** (собствен key)

### Storage

- Auto-cleanup на изображения > 30 дни
- Storage monitoring и alerts
- Manual cleanup от History екран

---

## 🌐 Deployment

### GitHub Pages

```bash
npm run build
# Push към gh-pages branch
```

### Vercel

```bash
npm i -g vercel
vercel
```

### Netlify / Cloudflare Pages

1. Свържете GitHub repository
2. Build command: `npm run build`
3. Output: `dist`

---

## 🔒 Сигурност

- ✅ Всички данни локално в браузъра (IndexedDB)
- ✅ API keys криптирани в localStorage
- ✅ Изображения не се качват никъде (освен AI API)
- ✅ Auto-cleanup на sensitive data

---

## 🐛 Troubleshooting

### Rate limit exceeded
→ Използвайте собствен API key в Admin панела

### Storage пълен
→ Изтрийте стари анализи от History (auto-cleanup работи при startup)

### Изображения не се качват
→ Уверете се че са < 200KB

### AI анализ не работи
→ Проверете Diagnostics екрана за повече info

---

## 📄 Лиценз

MIT License - Copyright GitHub, Inc.

---

## ⚠️ Важно

Това приложение предоставя информационни AI-базирани анализи и **НЕ заменя професионална медицинска консултация**. Винаги консултирайте се с квалифициран здравен специалист.

---

**Създадено с GitHub Spark и ❤️**
