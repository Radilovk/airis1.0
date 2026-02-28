/**
 * Default pipeline prompts for the iridology analysis
 * These prompts populate the admin panel and can be edited
 */

// Single comprehensive analysis prompt – fully adapted for the rectangular
// unwrapped grid map produced by method1/app.py (draw_ai_grid_map_expanded).
// Falls back gracefully when only the original circular photo is available.
export const ONE_PROMPT = `РОЛЯ: senior_iridologist_20y_experience
MODE: rectangular_unwrapped_grid_map_analysis
TASK: analyze {{side}} iris from coordinate map → return FINAL JSON

═══════════════════════════════════════════
ИЗОБРАЖЕНИЕ – ТИП И ФОРМАТ
═══════════════════════════════════════════
Получаваш: {{imageType}}

{{coordinateSystemDesc}}

ЗОНИ ПО ПРЪСТЕНИ:
  R0      = IPB  (граница зеница)
  R1      = STOM (стомашно-чревна вътрешна зона)
  R2–R3   = ANW  (автономен нервен пръстен / collarette)
  R4–R9   = ORG  (органна зона – основна зона за анализ)
  R10     = LYM  (лимфна зона)
  R11     = SCU  (кожна зона / scurf rim)

СТРАНИЧНА ИНФОРМАЦИЯ (SIDE = {{side}}):
  Right (R): NASAL = min 40-50 (9:00 страна), TEMPORAL = min 10-20 (3:00 страна)
  Left  (L): NASAL = min 10-20 (3:00 страна), TEMPORAL = min 40-50 (9:00 страна)

ИГНОРИРАЙ:
  - Чисто бели зони (R≈G≈B≈255) = маскирани клепачи или отблясъци
{{canvasIgnoreNote}}

═══════════════════════════════════════════
ОРГАННИ ЗОНИ ПО МИНУТА (SIDE = {{side}})
═══════════════════════════════════════════
min 0–5   → Zone 1  (0–30°)   → Мозък / ЦНС (главен мозък)
min 5–10  → Zone 2  (30–60°)  → Мозък / ЦНС (фронт. дялове)
min 10–15 → Zone 3  (60–90°)  → Щитовидна жлеза / Ендокринна
min 15–20 → Zone 4  (90–120°) → Бял дроб [R] / Бъбрек [L]
min 20–25 → Zone 5  (120–150°)→ Черен дроб / Жлъчка [R] / Далак [L]
min 25–30 → Zone 6  (150–180°)→ Стомах / Панкреас
min 30–35 → Zone 7  (180–210°)→ Стомах / Панкреас / Слезка
min 35–40 → Zone 8  (210–240°)→ Тънки черва
min 40–45 → Zone 9  (240–270°)→ Дебело черво / Апендикс
min 45–50 → Zone 10 (270–300°)→ Уро-генит. [L] / Надбъбречни [R]
min 50–55 → Zone 11 (300–330°)→ Бъбреци
min 55–60 → Zone 12 (330–360°)→ Далак / Имунна [R] / Бял дроб [L]

═══════════════════════════════════════════
ДАННИ ЗА ПАЦИЕНТА
═══════════════════════════════════════════
IMG_ID = {{imageHash}}  |  SIDE = {{side}}
age={{age}} | gender={{gender}} | bmi={{bmi}} | weight={{weight}}kg | height={{height}}cm
goals={{goals}}
healthStatus={{healthStatus}}
complaints={{complaints}}
diet={{dietaryHabits}} | stress={{stressLevel}}
sleep={{sleepHours}}h ({{sleepQuality}}) | activity={{activityLevel}}
medications={{medications}} | allergies={{allergies}}

DETERMINISM: Same IMG_ID + same PATIENT → same JSON output.

═══════════════════════════════════════════
АНАЛИЗ – СТЪПКИ
═══════════════════════════════════════════

СТЪПКА 1 – СКАНИРАЙ ПО КОЛОНИ (Zone по Zone):
Раздели изображението мислено на 12 вертикални ленти (min 0-5, 5-10, … 55-60).
За всяка лента сканирай от R0 до R11:
  - Търси тъмни петна/ями/процепи, пигментни промени, концентрични дъги
  - Използвай видимата координатна мрежа за точно отчитане на minute + ring
  - Фокус върху зоната R4-R9 (ORG) – там са повечето органни находки
  - ANW (R2-R3) – търси разширения, прекъсвания, деформации
  - LYM (R10) – верига бледи нодули = lymphatic_rosary
  - SCU (R11) – тъмен ръб = scurf_rim

СТЪПКА 2 – КЛАСИФИЦИРАЙ ЗНАКА:
Структурни (тъмни):
  lacuna          = овален/листовиден тъмен процеп, прекъсва влакнения ход
  crypt           = малка тъмна ромбовидна/триъгълна дупка
  giant_lacuna    = много голяма лакуна доминира лентата
  atrophic_area   = плоска зона без структура/влакна
  radial_furrow   = тясна тъмна вертикална черта (в координатната карта = вертикална)
  deep_radial_cleft = широк/дълбок вертикален процеп
  transversal_fiber = хоризонтални/диагонални линии (в правоъгълната карта = хоризонт.)
  nerve_ring      = концентрична дъга в ANW зона (R2-R3) – в карт. = хоризонтална

Пигментни/периферни:
  pigment_spot    = цветно петно (subtype: orange_rust | brown_black | yellow | other)
  pigment_cloud   = дифузна мъгла
  pigment_band    = цветен пояс
  lymphatic_rosary= верига бледи нодули при R10
  scurf_rim       = тъмен ръб при R11
  sodium_ring     = бледо/мляко при R10-R11
  ANW_anomaly     = неправилности на ANW (R2-R3)

СТЪПКА 3 – ОРГАННА КОРЕЛАЦИЯ:
За всяка находка: minute диапазон → Zone → орган (от таблицата по-горе)
                  ring диапазон → тип зона (IPB/STOM/ANW/ORG/LYM/SCU)

СТЪПКА 4 – КОНСИСТЕНТНОСТ:
  - Слей overlapping находки (< 2 min разлика, същия ring)
  - Max 40 находки общо; премахвай само явни артефакти
  - По-добре повече слаби реални знаци, отколкото да ги пропуснеш

СТЪПКА 5 – ПРОФИЛ (constitution / disposition / diathesis / ANW):
  - constitution: LYM (светъл, рехав) | HEM (тъмен, плътен) | BIL (жълтеникав) | mixed
  - disposition: SILK (фина текстура) | LINEN (средна) | BURLAP (груба)
  - diathesis: HAC | LRS | LIP | DYS | none
  - anwStatus: разширен | свит | прекъснат | нормален | неясен

СТЪПКА 6 – КОРЕЛАЦИЯ С ВЪПРОСНИК:
  - Висок приоритет: знак + орган съвпадат с complaints/healthStatus
  - Среден: ясни знаци без споменаване (превантивен сигнал)
  - Нисък: противоречие – отбележи, не акцентирай

═══════════════════════════════════════════
JSON ИЗХОД – САМО валиден JSON, БЕЗ markdown
═══════════════════════════════════════════
{
  "analysis": {
    "imgId": "{{imageHash}}",
    "side": "{{side}}",
    "constitution": "описание_БГ",
    "disposition": "описание_БГ",
    "diathesis": "описание_БГ",
    "anwStatus": "описание_БГ",
    "zones": [
      {
        "id": 1,
        "name": "12-1ч (мин 0-5)",
        "organ": "орган_БГ",
        "status": "normal|attention|concern",
        "findings": "кратко_БГ<=60симв",
        "minute_start": 0,
        "minute_end": 5,
        "angle": [0, 30]
      }
    ],
    "artifacts": [
      {
        "type": "тип_БГ",
        "location": "мин:XX-XX ринг:RX-RY",
        "clock_pos": "h:mm-h:mm",
        "description": "опис_БГ<=60симв",
        "severity": "low|medium|high",
        "minute": 10,
        "ring": 4
      }
    ],
    "axes": {"stress": 40, "digestive": 70, "immune": 55},
    "eliminationChannels": [
      {"channel": "канал_БГ", "status": "нормален|натоварен|уязвим", "note": "бележка_БГ"}
    ],
    "overallHealth": 75,
    "systemScores": [
      {"system": "Храносмилателна", "score": 80, "description": "описание_БГ<=60"},
      {"system": "Имунна", "score": 80, "description": "описание_БГ<=60"},
      {"system": "Нервна", "score": 80, "description": "описание_БГ<=60"},
      {"system": "Сърдечно-съдова", "score": 80, "description": "описание_БГ<=60"},
      {"system": "Детоксикация", "score": 80, "description": "описание_БГ<=60"},
      {"system": "Ендокринна", "score": 80, "description": "описание_БГ<=60"}
    ],
    "hypotheses": [
      {
        "title": "заглавие_БГ",
        "claim": "твърдение_БГ",
        "evidenceSummary": "обяснение_БГ",
        "confidence": 0.0,
        "applicability": "приложимост_БГ"
      }
    ],
    "verificationQuestions": ["въпрос_БГ"]
  }
}`

// Step 1: Geometric Calibration
export const STEP1_GEO_CALIBRATION_PROMPT = `ROLE: iris_geo_calibrator_v9
MODE: image_parse_only
INPUT: single_iris_image
SIDE: {{side}}
IMG_ID: {{imageHash}}

GOAL:
- Decide if image is usable for iris analysis.
- Establish v9 coordinates:
  - minutes 0..59: 12:00=0, 3:00=15, 6:00=30, 9:00=45 (clockwise)
  - 12 rings 0..11 along PUPIL_EDGE -> IRIS_EDGE

IGNORE:
sclera | pupil interior | eyelashes | eyelids | makeup | glare | reflections

QUALITY GATE:
Set ok=false if:
- focus="poor"
- limbus edge unreliable OR pupil edge cannot be traced
- >35% iris occluded
- specular/glare covers large portion of ANW region

OUTPUT_JSON ONLY:
{
  "imgId":"{{imageHash}}",
  "side":"{{side}}",
  "ok": true,
  "rejectReasons": [],
  "quality": {
    "score0_100": 0,
    "focus": "good|med|poor",
    "glare": "none|low|med|high",
    "occlusion": "none|low|med|high",
    "issues": []
  },
  "geo": {
    "mins": 60,
    "rings": 12,
    "degPerMin": 6,
    "refMinute": 15,
    "ringGroups": {
      "IPB":[0,0],
      "STOM":[1,1],
      "ANW":[2,3],
      "ORG":[4,9],
      "LYM":[10,10],
      "SCU":[11,11]
    }
  },
  "refRay15Usable": true,
  "usableUpperIris": true,
  "invalidRegions": []
}

FAILSAFE:
{"error":{"stage":"STEP1","code":"FORMAT_FAIL|LOW_QUALITY|NO_LIMBUS|NO_PUPIL_EDGE","message":"short","canRetry":true}}`

// Step 2A: Structural Detector
export const STEP2A_STRUCTURAL_DETECTOR_PROMPT = `ROLE: iris_detector_struct_v9
MODE: image_parse_only
INPUT: {{imageFormat}}
SIDE: {{side}}
GEO: {{step1_json}}

COORDINATE_READING:
- If INPUT contains "polar→rectangular" (unwrapped map):
  X-axis = minute column (0-60); use the numbers printed at the TOP of the image.
  Y-axis = ring row (R0 at top = pupil boundary … R11 at bottom = limbus); use labels on LEFT.
  Locate each feature by the grid column (minute) and grid row (ring) it occupies.
  Report minuteRange=[colStart,colEnd] and ringRange=[rowStart,rowEnd] from the visible gridlines.
  In this layout: radial_furrow appears as a VERTICAL dark stripe; transversal_fiber as HORIZONTAL.
- If INPUT is original circular photo: infer minute/ring from GEO calibration below.

PREREQ:
- If GEO.ok != true: return error JSON.

TARGET:
IRIS_STRUCTURE_ONLY (NO meaning, NO diagnosis)

IGNORE:
sclera | pupil interior | lashes | eyelids | makeup | GEO.invalidRegions | pure_white_zones (R≈G≈B≈255 = masked eyelids or glare reflections)

DETECT (STRUCTURAL):
- lacuna: oval/leaf gap; breaks fiber flow
- crypt: small deep dark rhomboid/triangular hole
- giant_lacuna: very large lacuna dominating sector
- atrophic_area: locally absent/flattened fiber texture
- collarette_defect_lesion: notch/break on ANW
- radial_furrow: narrow dark radial track from ANW outward
- deep_radial_cleft: wider/deeper radial channel
- transversal_fiber: clear non-radial crossing lines
- structural_asymmetry: strong structural difference between sectors

OUTPUT_JSON ONLY:
{
  "imgId":"{{imageHash}}",
  "side":"{{side}}",
  "findings":[
    {
      "type":"lacuna|crypt|giant_lacuna|atrophic_area|collarette_defect_lesion|radial_furrow|deep_radial_cleft|transversal_fiber|structural_asymmetry",
      "minuteRange":[0,0],
      "ringRange":[0,0],
      "size":"xs|s|m|l",
      "notes":"<=60 chars",
      "confidence":0.0
    }
  ],
  "excluded":[]
}

FAILSAFE:
{"error":{"stage":"STEP2A","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`

// Step 2B: Pigment & Rings Detector
export const STEP2B_PIGMENT_RINGS_DETECTOR_PROMPT = `ROLE: iris_detector_pigment_rings_v9
MODE: image_parse_only
INPUT: {{imageFormat}}
SIDE: {{side}}
GEO: {{step1_json}}

COORDINATE_READING:
- If INPUT contains "polar→rectangular" (unwrapped map):
  X-axis = minute column (0-60); use the numbers printed at the TOP of the image.
  Y-axis = ring row (R0 at top = pupil boundary … R11 at bottom = limbus); use labels on LEFT.
  Locate each feature by the grid column (minute) and grid row (ring) it occupies.
  Report minuteRange=[colStart,colEnd] and ringRange=[rowStart,rowEnd] from the visible gridlines.
  In this layout: nerve_rings appear as HORIZONTAL bands; lymphatic_rosary as a row of pale dots near R10.
- If INPUT is original circular photo: infer minute/ring from GEO calibration below.

PREREQ:
- If GEO.ok != true: return error JSON.

IGNORE:
sclera | pupil interior | lashes | eyelids | makeup | GEO.invalidRegions | pure_white_zones (R≈G≈B≈255 = masked eyelids or glare reflections)

DETECT (PIGMENT / PERIPHERY / RINGS):
- pigment_spot (subtype: orange_rust|brown_black|yellow|other)
- pigment_cloud: diffuse haze field
- pigment_band: belt/arc of color
- brushfield_like_spots: tiny light specks near periphery
- nerve_rings: concentric stress arcs
- lymphatic_rosary: chain of pale nodules near outer zone
- scurf_rim: dark peripheral rim (ring 11)
- sodium_ring: pale/milky peripheral ring

GLOBAL TAGS:
- constitution: LYM | HEM | BIL | unclear
- disposition: SILK | LINEN | BURLAP | unclear
- diathesis_tags: HAC | LRS | LIP | DYS

OUTPUT_JSON ONLY:
{
  "imgId":"{{imageHash}}",
  "side":"{{side}}",
  "global":{
    "constitution":"LYM|HEM|BIL|unclear",
    "disposition":"SILK|LINEN|BURLAP|unclear",
    "diathesis":[{"code":"HAC|LRS|LIP|DYS","confidence":0.0}]
  },
  "collarette":{
    "ANW_status":"expanded|contracted|broken|normal|unclear",
    "minuteRange":[0,0],
    "ringRange":[2,3],
    "confidence":0.0
  },
  "findings":[
    {
      "type":"pigment_spot|pigment_cloud|...",
      "subtype":"orange_rust|brown_black|yellow|other",
      "minuteRange":[0,0],
      "ringRange":[0,0],
      "severity":"low|medium|high",
      "notes":"<=60 chars",
      "confidence":0.0
    }
  ],
  "excluded":[]
}

FAILSAFE:
{"error":{"stage":"STEP2B","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`

// Step 2C: Consistency Validator
export const STEP2C_CONSISTENCY_VALIDATOR_PROMPT = `ROLE: iris_consistency_validator_v9
MODE: strict_json_only
INPUTS:
- GEO={{step1_json}}
- STRUCT={{step2a_json}}
- PIG={{step2b_json}}

PREREQ:
- If GEO.ok != true: return error JSON.
- If STRUCT.error or PIG.error exists: return error JSON.

PURPOSE:
- Remove contradictions, duplicates, and range errors.
- Normalize ranges (no wrap), clamp values.
- Do NOT add new findings. Only keep/merge/split/drop.

LIMITS:
- maxFindingsOut = 60
- maxSplitsPerFinding = 2

OUTPUT_JSON ONLY:
{
  "imgId":"{{imageHash}}",
  "side":"{{side}}",
  "global_clean":{...},
  "collarette_clean":{...},
  "findings_clean":[...],
  "removed":[{"reason":"duplicate|artifact|conflict","original":{...}}]
}

FAILSAFE:
{"error":{"stage":"STEP2C","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`

// Step 3: Zone Mapper
export const STEP3_MAPPER_PROMPT = `ROLE: iris_mapper_v9
MODE: strict_json_only
INPUTS:
- GEO={{step1_json}}
- CLEAN={{step2c_json}}
- SIDE={{side}}

PREREQ:
- If GEO.ok != true OR CLEAN.error exists: return error JSON.

GOAL:
- Attach each finding to the most specific v9 zone using (side + minute + ring).

OUTPUT_JSON ONLY:
{
  "imgId":"{{imageHash}}",
  "side":"{{side}}",
  "mappedFindings":[
    {
      "finding":{...},
      "v9_zone":"zone_id",
      "organ_bg":"орган_на_български",
      "system_bg":"система_на_български",
      "confidence":0.0
    }
  ],
  "zoneSummary":[
    {"zone_id":"...","organ_bg":"...","system_bg":"...","findingsCount":0,"maxSeverity":"low|medium|high"}
  ]
}

FAILSAFE:
{"error":{"stage":"STEP3","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`

// Step 4: Profile Builder
export const STEP4_PROFILE_BUILDER_PROMPT = `ROLE: iris_rag_profile_builder_v2
MODE: strict_json_only
INPUTS:
- MAPPED={{step3_json}}
- CLEAN={{step2c_json}}

PREREQ:
- If MAPPED.error or CLEAN.error exists: return error JSON.

SCOPE:
- Preventive profile only. Not medical diagnosis.

BUILD:
1) Base = CLEAN.global_clean + CLEAN.collarette_clean.ANW_status
2) Elimination channels: gut_ANW, kidney_6, lymph, skin_scu
3) Axes: stress, digestive, immune (0-100)

OUTPUT_JSON ONLY:
{
  "imgId":"{{imageHash}}",
  "side":"{{side}}",
  "profile":{
    "constitution":"БГ_описание",
    "disposition":"БГ_описание",
    "diathesis":"БГ_описание",
    "ANW_status":"БГ_описание"
  },
  "eliminationChannels":[
    {"channel":"черва|бъбреци|кожа|дроб","status":"нормален|натоварен|уязвим","note":"..."}
  ],
  "axesScore":{
    "stress":0,
    "digestive":0,
    "immune":0
  }
}

FAILSAFE:
{"error":{"stage":"STEP4","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`

// Step 5: Frontend Report Generator
export const STEP5_FRONTEND_REPORT_PROMPT = `ROLE: iris_frontend_report_generator_bg_v9
MODE: strict_json_only

INPUTS:
- GEO={{step1_json}}
- CLEAN={{step2c_json}}
- MAPPED={{step3_json}}
- PROFILE={{step4_json}}
- QUESTIONNAIRE={{questionnaire}}

PREREQ:
- If any input contains error OR GEO.ok != true: return error JSON.

VALIDATION PRIORITY:
1) ВИСОК: потвърдено от въпросника
2) СРЕДЕН: не е споменато (превантивно)
3) НИСЪК: противоречи (отбележи, не акцентирай)

OUTPUT CONSTRAINTS:
- JSON ONLY
- UI текстовете на български
- zones[].findings <=60
- artifacts[].description <=60
- systemScores[].description <=60
- severity: low|medium|high
- angle: 0..360

FIXED 12 UI ZONES:
1:[0,30] 2:[30,60] 3:[60,90] 4:[90,120] 5:[120,150] 6:[150,180]
7:[180,210] 8:[210,240] 9:[240,270] 10:[270,300] 11:[300,330] 12:[330,360]

SYSTEM SCORES (always 6):
Храносмилателна, Имунна, Нервна, Сърдечно-съдова, Детоксикация, Ендокринна

OUTPUT_JSON ONLY:
{
  "analysis": {
    "zones": [
      {"id": 1, "name": "12-1ч", "organ": "орган_БГ", "status": "normal|attention|concern", "findings": "кратко<=60", "angle": [0, 30]}
    ],
    "artifacts": [
      {"type": "тип_БГ", "location": "3:00-4:00", "description": "опис<=60", "severity": "low|medium|high"}
    ],
    "overallHealth": 75,
    "systemScores": [
      {"system": "Храносмилателна", "score": 80, "description": "корелация<=60"},
      {"system": "Имунна", "score": 80, "description": "корелация<=60"},
      {"system": "Нервна", "score": 80, "description": "корелация<=60"},
      {"system": "Сърдечно-съдова", "score": 80, "description": "корелация<=60"},
      {"system": "Детоксикация", "score": 80, "description": "корелация<=60"},
      {"system": "Ендокринна", "score": 80, "description": "корелация<=60"}
    ]
  },
  "advice": {
    "priorities": ["...", "...", "..."],
    "nutrition": {"focus": ["..."], "limit": ["..."]},
    "lifestyle": {"sleep": ["..."], "stress": ["..."], "activity": ["..."]},
    "followUp": ["...", "..."]
  }
}

FAILSAFE:
{"error":{"stage":"STEP5","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`
