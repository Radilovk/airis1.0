/**
 * Pipeline v9 Implementation
 * 
 * This module implements the new v9 multi-step iris analysis pipeline
 * with prompts loaded from frontend configuration (KV storage).
 * 
 * The prompts can be customized via the admin panel's Pipeline Manager tab.
 */

import type { QuestionnaireData, IrisImage, IrisAnalysis, PipelineConfig, PipelineStepConfig } from '@/types'

// Custom prompts interface for external configuration
export interface CustomPipelinePrompts {
  step1_geo_calibration?: string
  step2a_structural_detector?: string
  step2b_pigment_rings_detector?: string
  step5_frontend_report?: string
  one_prompt?: string  // Single comprehensive prompt for "one-step" mode
}

// Default step prompts - used as fallback when no custom prompts are configured
// These are embedded at build time to avoid runtime file loading issues
const DEFAULT_STEP_PROMPTS = {
  step1_geo_calibration: `ROLE: iris_geo_calibrator_v9
MODE: image_parse_only
INPUT: single_iris_image
SIDE: {{side}}
IMG_ID: {{imageHash}}

GOAL:
- Decide if image is usable for iris analysis.
- Establish v9 coordinates:
  - minutes 0..59: 12:00=0, 3:00=15, 6:00=30, 9:00=45 (clockwise)
  - 12 rings 0..11 along PUPIL_EDGE -> IRIS_EDGE
  - ring width = 1/12 of reference thickness measured on minute=15 ray

IGNORE:
sclera | pupil interior | eyelashes | eyelids | makeup | glare | reflections

AXIS (CRITICAL):
- Do NOT use upper eyelid as reference.
- Detect limbus ellipse:
  - irisCenter = center of limbus ellipse
  - limbus_left = leftmost visible limbus point
  - limbus_right = rightmost visible limbus point
- Define:
  - ex = normalize(limbus_right - irisCenter)  # 3:00 direction
  - ey = perpendicular(ex) chosen toward image-up  # 12:00 direction

QUALITY GATE:
Set ok=false if any:
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

FAILSAFE (if cannot comply):
Return ONLY:
{"error":{"stage":"STEP1","code":"FORMAT_FAIL|LOW_QUALITY|NO_LIMBUS|NO_PUPIL_EDGE","message":"short","canRetry":true}}`,

  step2a_structural_detector: `ROLE: iris_detector_struct_v9
MODE: image_parse_only
INPUT: single_iris_image
SIDE: {{side}}
GEO: {{step1_json}}

PREREQ:
- If GEO.ok != true: return error JSON (do not continue).

TARGET:
IRIS_STRUCTURE_ONLY (NO meaning, NO diagnosis)

IGNORE:
sclera | pupil interior | lashes | eyelids | makeup | GEO.invalidRegions

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
{"error":{"stage":"STEP2A","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`,

  step2b_pigment_rings_detector: `ROLE: iris_detector_pigment_rings_v9
MODE: image_parse_only
INPUT: single_iris_image
SIDE: {{side}}
GEO: {{step1_json}}

PREREQ:
- If GEO.ok != true: return error JSON (do not continue).

TARGET:
IRIS_STRUCTURE_ONLY (NO meaning, NO diagnosis)

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
      "type":"pigment_spot|pigment_cloud|pigment_band|brushfield_like_spots|nerve_rings|lymphatic_rosary|scurf_rim|sodium_ring",
      "subtype":"(pigment_spot only) orange_rust|brown_black|yellow|other",
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
{"error":{"stage":"STEP2B","code":"PREREQ_FAIL|FORMAT_FAIL","message":"short","canRetry":true}}`,

  step5_frontend_report: `ROLE: iris_frontend_report_generator_bg_v9
MODE: strict_json_only

INPUTS:
- GEO={{step1_json}}
- STRUCT={{step2a_json}}
- PIG={{step2b_json}}
- QUESTIONNAIRE={{questionnaire}}

PREREQ:
- If any input contains error OR GEO.ok != true: return error JSON.

CORE TRUTH RULE:
- ORGAN and SYSTEM MUST come ONLY from v9 mapping in findings.

VALIDATION PRIORITY:
1) ВИСОК: потвърдено от въпросника
2) СРЕДЕН: не е споменато (превантивно)
3) НИСЪК: противоречи (отбележи, не акцентирай)

OUTPUT CONSTRAINTS:
- JSON ONLY
- UI текстовете да са на български
- Без markdown
- zones[].findings <=60
- artifacts[].description <=60
- systemScores[].description <=60
- advice bullets <=120
- severity enum: low|medium|high
- angle винаги 0..360

FIXED 12 UI ZONES:
1:[0,30] 2:[30,60] 3:[60,90] 4:[90,120] 5:[120,150] 6:[150,180]
7:[180,210] 8:[210,240] 9:[240,270] 10:[270,300] 11:[300,330] 12:[330,360]

ZONE NAMES:
1 "12-1ч" 2 "1-2ч" 3 "2-3ч" 4 "3-4ч" 5 "4-5ч" 6 "5-6ч"
7 "6-7ч" 8 "7-8ч" 9 "8-9ч" 10 "9-10ч" 11 "10-11ч" 12 "11-12ч"

SYSTEM SCORES (always 6):
- Храносмилателна, Имунна, Нервна, Сърдечно-съдова, Детоксикация, Ендокринна
- score 0–100 based on findings

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
}

// Mutable prompts object - can be updated with custom prompts from frontend
let STEP_PROMPTS = { ...DEFAULT_STEP_PROMPTS }

/**
 * Update the pipeline prompts with custom values from frontend configuration
 * @param customPrompts Custom prompts from the admin panel
 */
export function updatePipelinePrompts(customPrompts: CustomPipelinePrompts): void {
  STEP_PROMPTS = {
    ...DEFAULT_STEP_PROMPTS,
    ...(customPrompts.step1_geo_calibration && { step1_geo_calibration: customPrompts.step1_geo_calibration }),
    ...(customPrompts.step2a_structural_detector && { step2a_structural_detector: customPrompts.step2a_structural_detector }),
    ...(customPrompts.step2b_pigment_rings_detector && { step2b_pigment_rings_detector: customPrompts.step2b_pigment_rings_detector }),
    ...(customPrompts.step5_frontend_report && { step5_frontend_report: customPrompts.step5_frontend_report }),
  }
  console.log('🔄 [Pipeline] Промптите са обновени от frontend конфигурацията')
}

/**
 * Reset prompts to default values
 */
export function resetPipelinePrompts(): void {
  STEP_PROMPTS = { ...DEFAULT_STEP_PROMPTS }
  console.log('🔄 [Pipeline] Промптите са възстановени до стойности по подразбиране')
}

/**
 * Get current prompts (for inspection/debugging)
 */
export function getCurrentPrompts(): typeof STEP_PROMPTS {
  return STEP_PROMPTS
}

// Pipeline step interface
interface PipelineStep {
  id: string
  name: string
  prompt: string
  requiresImage: boolean
}

// Pipeline result interface
interface PipelineStepResult {
  stepId: string
  success: boolean
  data: any
  error?: string
}

// V9 Pipeline configuration - dynamic getter to use current prompts
function getV9PipelineSteps(): PipelineStep[] {
  return [
    {
      id: 'step1_geo_calibration',
      name: 'Геометрична калибрация',
      prompt: STEP_PROMPTS.step1_geo_calibration,
      requiresImage: true
    },
    {
      id: 'step2a_structural_detector',
      name: 'Структурен детектор',
      prompt: STEP_PROMPTS.step2a_structural_detector,
      requiresImage: true
    },
    {
      id: 'step2b_pigment_rings_detector',
      name: 'Пигмент и пръстени',
      prompt: STEP_PROMPTS.step2b_pigment_rings_detector,
      requiresImage: true
    },
    {
      id: 'step5_frontend_report',
      name: 'Генериране на репорт',
      prompt: STEP_PROMPTS.step5_frontend_report,
      requiresImage: false
    }
  ]
}

/**
 * Replace template variables in a prompt
 */
function interpolatePrompt(
  prompt: string,
  variables: Record<string, string>
): string {
  let result = prompt
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

/**
 * Convert minute to clock position string
 */
function minuteToClockPosition(minute: number): string {
  const hour = Math.floor(minute / 5)
  const mins = (minute % 5) * 12
  return `${hour}:${mins.toString().padStart(2, '0')}`
}

/**
 * Map v9 findings to legacy IrisZone format
 */
function mapFindingsToZones(
  geoResult: any,
  structResult: any,
  pigResult: any,
  side: 'left' | 'right'
): any[] {
  const zones: any[] = []
  
  // Create 12 zones based on v9 mapping
  const zoneNames = [
    '12-1ч', '1-2ч', '2-3ч', '3-4ч', '4-5ч', '5-6ч',
    '6-7ч', '7-8ч', '8-9ч', '9-10ч', '10-11ч', '11-12ч'
  ]
  
  const organsByZone = [
    'Мозък/ЦНС', 'Хипофиза', 'Щитовидна жлеза', 'Бял дроб',
    'Черен дроб', 'Стомах', 'Панкреас', 'Бъбреци',
    'Надбъбречни', 'Сърце', 'Далак', 'Лимфна система'
  ]
  
  for (let i = 0; i < 12; i++) {
    const startAngle = i * 30
    const endAngle = (i + 1) * 30
    const startMinute = Math.round(startAngle / 6)
    const endMinute = Math.round(endAngle / 6)
    
    // Find structural findings in this zone
    const structFindings = (structResult?.findings || []).filter((f: any) => {
      const fStart = f.minuteRange?.[0] || 0
      const fEnd = f.minuteRange?.[1] || 0
      return (fStart >= startMinute && fStart < endMinute) ||
             (fEnd > startMinute && fEnd <= endMinute) ||
             (fStart <= startMinute && fEnd >= endMinute)
    })
    
    // Find pigment findings in this zone
    const pigFindings = (pigResult?.findings || []).filter((f: any) => {
      const fStart = f.minuteRange?.[0] || 0
      const fEnd = f.minuteRange?.[1] || 0
      return (fStart >= startMinute && fStart < endMinute) ||
             (fEnd > startMinute && fEnd <= endMinute) ||
             (fStart <= startMinute && fEnd >= endMinute)
    })
    
    // Determine status based on findings
    let status: 'normal' | 'attention' | 'concern' = 'normal'
    const findingsDesc: string[] = []
    
    if (structFindings.length > 0 || pigFindings.length > 0) {
      const hasHighSeverity = [...structFindings, ...pigFindings].some(
        (f: any) => f.severity === 'high' || f.confidence > 0.8
      )
      status = hasHighSeverity ? 'concern' : 'attention'
      
      // Build findings description
      structFindings.forEach((f: any) => {
        findingsDesc.push(`${f.type}${f.notes ? `: ${f.notes}` : ''}`)
      })
      pigFindings.forEach((f: any) => {
        findingsDesc.push(`${f.type}${f.subtype ? ` (${f.subtype})` : ''}`)
      })
    }
    
    zones.push({
      id: i + 1,
      name: zoneNames[i],
      organ: organsByZone[i],
      status,
      findings: findingsDesc.length > 0 
        ? findingsDesc.slice(0, 2).join('; ').substring(0, 60) 
        : 'Визуално чиста зона',
      angle: [startAngle, endAngle]
    })
  }
  
  return zones
}

/**
 * Convert v9 findings to legacy artifacts format
 */
function convertToArtifacts(structResult: any, pigResult: any): any[] {
  const artifacts: any[] = []
  
  const allFindings = [
    ...(structResult?.findings || []),
    ...(pigResult?.findings || [])
  ]
  
  // Sort by confidence and take top findings
  const sortedFindings = allFindings
    .filter((f: any) => f.confidence >= 0.6)
    .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 5)
  
  for (const finding of sortedFindings) {
    const startClock = minuteToClockPosition(finding.minuteRange?.[0] || 0)
    const endClock = minuteToClockPosition(finding.minuteRange?.[1] || finding.minuteRange?.[0] || 0)
    
    artifacts.push({
      type: finding.type,
      location: startClock === endClock ? startClock : `${startClock}-${endClock}`,
      description: finding.notes || finding.type,
      severity: finding.severity || 'medium'
    })
  }
  
  return artifacts
}

/**
 * Calculate system scores based on v9 findings
 */
function calculateSystemScores(zones: any[]): any[] {
  const systemZones: Record<string, number[]> = {
    'Храносмилателна': [5, 6, 7], // Stomach, pancreas, intestines
    'Имунна': [11, 12], // Spleen, lymph
    'Нервна': [1], // Brain/CNS
    'Сърдечно-съдова': [10], // Heart
    'Детоксикация': [5, 8], // Liver, kidneys
    'Ендокринна': [2, 3, 9] // Pituitary, thyroid, adrenals
  }
  
  const scores: any[] = []
  
  for (const [system, zoneIds] of Object.entries(systemZones)) {
    const relevantZones = zones.filter((z: any) => zoneIds.includes(z.id))
    
    let score = 85 // Base score
    let concernCount = 0
    let attentionCount = 0
    
    for (const zone of relevantZones) {
      if (zone.status === 'concern') {
        concernCount++
        score -= 15
      } else if (zone.status === 'attention') {
        attentionCount++
        score -= 8
      }
    }
    
    score = Math.max(30, Math.min(100, score))
    
    let description = ''
    if (concernCount > 0) {
      description = `${concernCount} зони изискват внимание`
    } else if (attentionCount > 0) {
      description = `${attentionCount} зони за наблюдение`
    } else {
      description = 'Добро състояние'
    }
    
    scores.push({
      system,
      score,
      description
    })
  }
  
  return scores
}

/**
 * Execute the v9 pipeline for a single iris
 */
export async function executeV9Pipeline(
  iris: IrisImage,
  side: 'left' | 'right',
  questionnaire: QuestionnaireData,
  callLLM: (prompt: string, jsonMode: boolean, retries: number, imageDataUrl?: string) => Promise<string>,
  onProgress: (step: string, progress: number) => void,
  addLog: (level: 'info' | 'success' | 'error' | 'warning', message: string) => void
): Promise<IrisAnalysis> {
  // Generate a simple hash from the data URL for tracking
  const generateSimpleHash = (dataUrl: string): string => {
    // Validate it's a data URL
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return `invalid_${Date.now()}`
    }
    // Use a combination of length, timestamp, and a sample of the content
    const len = dataUrl.length
    const sample = dataUrl.substring(Math.floor(len * 0.25), Math.floor(len * 0.25) + 20)
    return `img_${len}_${sample.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)}`
  }
  
  const imageHash = generateSimpleHash(iris.dataUrl)
  const sideCode = side === 'left' ? 'L' : 'R'
  
  const stepResults: Record<string, any> = {}
  
  try {
    // Step 1: Geo Calibration
    addLog('info', `[V9] Step 1: Геометрична калибрация за ${side === 'left' ? 'ляв' : 'десен'} ирис...`)
    onProgress('Геометрична калибрация', 10)
    
    const step1Prompt = interpolatePrompt(STEP_PROMPTS.step1_geo_calibration, {
      side: sideCode,
      imageHash
    })
    
    const step1Response = await callLLM(step1Prompt, true, 2, iris.dataUrl)
    stepResults.step1 = JSON.parse(step1Response)
    
    if (!stepResults.step1.ok) {
      addLog('warning', `[V9] Геокалибрацията показа проблеми с качеството: ${stepResults.step1.rejectReasons?.join(', ') || 'unknown'}`)
    }
    addLog('success', `[V9] Step 1 завършен - качество: ${stepResults.step1.quality?.score0_100 || 'N/A'}/100`)
    
    // Step 2A: Structural Detector
    addLog('info', '[V9] Step 2A: Структурен анализ...')
    onProgress('Структурен анализ', 30)
    
    const step2aPrompt = interpolatePrompt(STEP_PROMPTS.step2a_structural_detector, {
      side: sideCode,
      imageHash,
      step1_json: JSON.stringify(stepResults.step1)
    })
    
    const step2aResponse = await callLLM(step2aPrompt, true, 2, iris.dataUrl)
    stepResults.step2a = JSON.parse(step2aResponse)
    addLog('success', `[V9] Step 2A завършен - ${stepResults.step2a.findings?.length || 0} структурни находки`)
    
    // Step 2B: Pigment & Rings Detector
    addLog('info', '[V9] Step 2B: Пигментен анализ...')
    onProgress('Пигментен анализ', 50)
    
    const step2bPrompt = interpolatePrompt(STEP_PROMPTS.step2b_pigment_rings_detector, {
      side: sideCode,
      imageHash,
      step1_json: JSON.stringify(stepResults.step1)
    })
    
    const step2bResponse = await callLLM(step2bPrompt, true, 2, iris.dataUrl)
    stepResults.step2b = JSON.parse(step2bResponse)
    addLog('success', `[V9] Step 2B завършен - ${stepResults.step2b.findings?.length || 0} пигментни находки`)
    addLog('info', `[V9] Конституция: ${stepResults.step2b.global?.constitution || 'unclear'}, Диспозиция: ${stepResults.step2b.global?.disposition || 'unclear'}`)
    
    // Map findings to zones and artifacts
    onProgress('Съставяне на резултати', 80)
    
    const zones = mapFindingsToZones(stepResults.step1, stepResults.step2a, stepResults.step2b, side)
    const artifacts = convertToArtifacts(stepResults.step2a, stepResults.step2b)
    const systemScores = calculateSystemScores(zones)
    
    // Calculate overall health score
    const avgSystemScore = systemScores.reduce((sum: number, s: any) => sum + s.score, 0) / systemScores.length
    const concernZones = zones.filter((z: any) => z.status === 'concern').length
    const attentionZones = zones.filter((z: any) => z.status === 'attention').length
    
    let overallHealth = Math.round(avgSystemScore)
    overallHealth -= concernZones * 5
    overallHealth -= attentionZones * 2
    overallHealth = Math.max(30, Math.min(100, overallHealth))
    
    addLog('success', `[V9] Pipeline завършен за ${side === 'left' ? 'ляв' : 'десен'} ирис`)
    addLog('info', `[V9] Резултат: ${zones.length} зони, ${artifacts.length} артефакти, здраве: ${overallHealth}/100`)
    
    return {
      side,
      zones,
      artifacts,
      overallHealth,
      systemScores
    }
    
  } catch (error) {
    addLog('error', `[V9] Грешка в pipeline: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

/**
 * Get pipeline step names for progress display
 */
export function getV9PipelineStepNames(): string[] {
  return getV9PipelineSteps().map(step => step.name)
}
