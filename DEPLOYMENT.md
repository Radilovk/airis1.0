# GitHub Pages Deployment - Инструкции

## Активиране на GitHub Pages

1. **Отидете на Settings:**
   https://github.com/Radilovk/airis1.0/settings/pages

2. **Конфигурирайте Source:**
   - Source: **GitHub Actions**
   
3. **Готово!** Workflow-ът автоматично ще deploy-не приложението.

## След активиране

Приложението ще бъде достъпно на:
**https://radilovk.github.io/airis1.0/**

## Автоматично deployment

При всеки push към `main` branch:
1. ✅ Кодът се build-ва
2. ✅ Тестовете се изпълняват (ако има)
3. ✅ Приложението се deploy-ва на GitHub Pages
4. ✅ Достъпно е през URL в рамките на 2-3 минути

## Проверка на deployment статус

Отидете на:
https://github.com/Radilovk/airis1.0/actions

Там ще видите всички deployment-и и техния статус.

## Ръчно deployment (алтернатива)

Ако предпочитате ръчно:

```bash
npm run build
npm run deploy
```

## Troubleshooting

### Ако страницата не се зарежда:

1. Проверете дали GitHub Pages е активиран
2. Изчакайте 2-3 минути след push
3. Проверете Actions за грешки
4. Уверете се, че Source е настроен на "GitHub Actions"

---

**След активиране на GitHub Pages, приложението ще работи пълноценно на:**
https://radilovk.github.io/airis1.0/
