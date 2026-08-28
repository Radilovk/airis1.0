# Тестове с известна истина

## Обзор

| Тест | Какво валидира | LLM |
|------|----------------|-----|
| `coordinate-truth.html` | Геометрия + координатна верига (96/96) | Не |
| `finding-reliability.html` | Нормализация, recall/precision, seam agreement, discrimination | Не |
| `__real-eye-test.html` | Flash-eye fixture, quality, strip размери | Не |
| `__gemini-live.html` | Жив pipeline с Gemini (по избор) | Да |

### Какво означава „достоверност“ тук

Pipeline-ът **не** претендира клинична диагностична точност на иридологията
(систематични прегледи, напр. [NHMRC 2024](https://www.health.gov.au/sites/default/files/2025-03/natural-therapies-review-2024-iridology-evidence-evaluation.pdf),
намират ръчната иридология ≈ **50% — на нивото на шанса**).

Валидираме **консистентността на detection pipeline-а**:

1. **Test–retest** — двойно разгъване (шев 12:00 / 6:00): съвпада ли **мястото** на находката?
   (стандарт от quantitative imaging — ICC / proportion agreement)
2. **Location-first matching** — типът от LLM може да се размени; координатата (сектор + пръstenен пояс) трябва да е стабилна (`mergeSeamReadings`)
3. **Precision / recall** — при synthetic ground truth: намерени ли са маркерите на правилната клетка?
4. **Discrimination guards** — отхвърлят ли се невалидни пръстени, типове, unreadable/partial клетки?

За object-detection подход с етикетиран корпус (precision/recall/mAP) виж
[YOLOv8 tension rings validation](https://doi.org/10.55905/oelv22n9-135) — приложим при бъдещ labeled dataset.

---

## `finding-reliability.html`

Синтетичен benchmark **без API ключ**. Модул: `src/lib/finding-reliability.ts`.

### Пускане

```bash
npm run test:reliability
# или с вече пуснат dev server на 5199:
SKIP_SERVER=1 npm run test:reliability

# пълен browser suite (координати + reliability + flash + optional Gemini):
npm run test:browser
```

### Очаквано

```
PASS: normalization guard: 4/6 invalid rejected
PASS: location recall 5/5
PASS: seam test–retest: …% location agreement
RESULT: PASS
```

---

## `coordinate-truth.html`

Проверява веригата от координати върху **синтетичен ирис**, чиито размери и
позиции на маркерите са известни точно. Две отделни части:

- **A. Геометрия** — намира ли `detectIrisGeometry` зеницата и лимбуса при
  осем различни радиуса. Изображението е БЕЗ маркери.
- **B. Координати** — стига ли маркер, поставен в клетка (сектор, пръстен), до
  същата клетка на разгънатата лента. Геометрията тук се **подава** като
  известна, вместо да се засича: така провалът сочи към разгъването, а не към
  детектора. (Маркерите сами изместват намерения лимбус — ако двете се смесят,
  тестът престава да разграничава къде е грешката.)

Проверява се **и лявото, и дясното око**. Лявата карта не е огледален индекс на
дясната: сърцето и далакът съществуват само в лявото око, черният дроб — само в
дясното, така че грешка в лявата верига не би се проявила при тест само на
дясно.

### Пускане

```bash
npm run dev                       # на порт 5199
cp test/coordinate-truth.html public/__truth.html
# отвори http://127.0.0.1:5199/__truth.html
```

Или без браузър, през Playwright (Chromium е предварително инсталиран):

```js
const p = await browser.newPage()
await p.goto('http://127.0.0.1:5199/__truth.html')
await p.waitForFunction(() => window.__done)
console.log(await p.evaluate(() => window.__done))
process.exit(await p.evaluate(() => window.__ok) ? 0 : 1)
```

`window.__done` съдържа отчета, `window.__ok` е булев резултат.

### Очаквано състояние

```
КООРДИНАТИ: 96/96 маркера в очакваната клетка   ·   ГЕОМЕТРИЯ: 7/8 размера в допуска
```

Прагът за геометрията е 7 от 8 заради **известен пропуск** при R=430:
вертикалният център се измества с ~90 px, защото лимбусът се търси само в дъги
±35° около хоризонталата. Прагът е такъв, за да лови регресия, без да се прави,
че пропускът го няма — разширяване на допуска, докато мине, би било напасване
към синтетична мишена. Виж `МЕТОДИКА_2.md` §9.1.

---

## Gemini live (test–retest с реален модел)

С `GEMINI_API_KEY` и `FULL_PIPELINE=1`:

```bash
GEMINI_API_KEY=... npm run test:browser
```

Повтаряй анализа на **същата** flash-eye снимка два пъти и сравни location agreement
в отчета — това е най-близкият автоматизиран test–retest към production.

---

## Препоръчителен ред за бъдещ labeled benchmark

1. 20–50 снимки с **ръчно етикетирани** находки (sector, ring, type) от опитен иридолог
2. YOLO/COCO формат за circumferential signs; grid labels за focal signs
3. Метрики: mAP@50, location recall ±1 sector, seam agreement при dual-read
4. Отделен hold-out set (external validation) — друг апарат / друга клиника
