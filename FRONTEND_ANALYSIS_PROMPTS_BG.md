# Как фронтендът използва prompt-овете за анализ (просто обяснение)

## Къде живеят стъпките
- Всички официални prompt файлове са в папката `steps/` в корена на проекта (`STEP1_geo_calibration.txt`, `STEP2A_structural_detector.txt`, `STEP2B_pigment_rings_detector.txt`, `STEP2C_consistency_validator.txt`, `STEP3_mapper_v9.txt`, `STEP4_profile_builder.txt`, `STEP5_frontend_report_bg.txt`).
- `src/lib/pipeline-prompts.ts` ги импортира като `?raw` файлове, дава им четими заглавия и добавя checksum, за да се вижда коя версия е заредена.

## Как се зареждат в приложението
- `pipelinePromptCatalog` връща речник `{ STEP1 ... STEP5 }`, в който всеки елемент съдържа:
  - `body`: текста на prompt-а от файл в `steps/`
  - `source`: пътя до файла (показва се в логовете/експорта)
  - `checksum` и `version`: за проследяване на версията.
- Помощните функции `getPromptForStage` и `getPromptSummaries` четат директно от каталога и се ползват от orchestrator-а, за да логват откъде идва всеки prompt.

## Как се използват в мулти-стъпковия pipeline
- `runMultistepPipeline` (в `src/lib/multi-step-pipeline.ts`) взема каталога и пълни template-ите със свежи данни за пациента:
  - `{{side}}`, `{{imageHash}}` за самото изображение.
  - `{{step1_json}}`, `{{step2c_json}}`, `{{coord_v9_json}}` и т.н. за вече изчислените резултати и карта на ириса.
  - Данни от въпросника като възраст, пол, BMI, оплаквания и цели.
- След попълване на template-а функцията вика `llm.callModel(prompt, allowJson, maxRetries, imageDataUrl)` и парсва JSON резултатите за всяка стъпка.
- `iris-pipeline-orchestrator.ts` изпълнява стъпките в правилен ред, пази логове, проверява prerequisites и записва коя версия/източник на prompt е използвана.

## Къде се стартира анализът във фронтенда
- В `AnalysisScreen` при стартиране на анализ за ляв/десен ирис се извиква `runMultistepPipeline` с избраното изображение и данните от формата.
- По избор се изпълнява кратка диагностична проверка (с отделен свободен prompt), но основният анализ винаги минава през `steps/` pipeline-а.
- Ако някоя стъпка върне грешка, UI-то логва проблема и автоматично минава към резервния (legacy) prompt, който ползва база знанията, но това е fallback, не основният поток.

## Бърз пример как да проследиш prompt-а
1) Отвори `steps/STEP3_mapper_v9.txt` и виж текста на стъпка 3.
2) В `pipeline-prompts.ts` намери `STEP3` – там ще видиш `source: 'steps/STEP3_mapper_v9.txt'` и автоматичния checksum.
3) В `multi-step-pipeline.ts` потърси `pipelinePromptCatalog.prompts.STEP3.body` – тук prompt-ът се пълни с реалните стойности и се изпраща към LLM.

## Идеи за бързо подобрение
- Добавяне на малък UI панел (например в admin екрана) за визуализация на `getPromptSummaries()` – ще покаже коя версия и checksum са в употреба, което помага при дебъг на погрешно заредени стъпки.
- Лесен превключвател за `pipelinePromptCatalog` (например А/Б тест между версии), така че да може да се зарежда нов сет `steps` без да се пипа кодът.
- Автоматичен health-check: кратък бутон „Провери стъпките“, който вика `getPromptSummaries()` и маркира липсващи или повредени файлове преди стартиране на анализ.
