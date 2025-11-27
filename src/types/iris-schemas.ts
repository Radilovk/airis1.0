import { type StepStage } from './iris-pipeline'

const rangeSchema = {
  type: 'array',
  items: [{ type: 'number' }, { type: 'number' }],
  minItems: 2,
  maxItems: 2,
} as const

const excludedRegionSchema = {
  type: 'object',
  required: ['type', 'minuteRange', 'ringRange'],
  properties: {
    type: { const: 'specular' },
    minuteRange: rangeSchema,
    ringRange: rangeSchema,
  },
} as const

const structuralFindingSchema = {
  type: 'object',
  required: ['type', 'minuteRange', 'ringRange', 'size', 'notes', 'confidence'],
  properties: {
    type: {
      enum: [
        'lacuna',
        'crypt',
        'giant_lacuna',
        'atrophic_area',
        'collarette_defect_lesion',
        'radial_furrow',
        'deep_radial_cleft',
        'transversal_fiber',
        'structural_asymmetry',
      ],
    },
    minuteRange: rangeSchema,
    ringRange: rangeSchema,
    size: { enum: ['xs', 's', 'm', 'l'] },
    notes: { type: 'string' },
    confidence: { type: 'number' },
  },
} as const

const globalDispositionSchema = {
  type: 'object',
  required: ['constitution', 'disposition', 'diathesis'],
  properties: {
    constitution: { enum: ['LYM', 'HEM', 'BIL', 'unclear'] },
    disposition: { enum: ['SILK', 'LINEN', 'BURLAP', 'unclear'] },
    diathesis: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'confidence'],
        properties: { code: { enum: ['HAC', 'LRS', 'LIP', 'DYS'] }, confidence: { type: 'number' } },
      },
    },
  },
} as const

const collaretteSchema = {
  type: 'object',
  required: ['ANW_status', 'minuteRange', 'ringRange', 'confidence'],
  properties: {
    ANW_status: { enum: ['expanded', 'contracted', 'broken', 'normal', 'unclear'] },
    minuteRange: rangeSchema,
    ringRange: rangeSchema,
    confidence: { type: 'number' },
  },
} as const

const pigmentFindingSchema = {
  type: 'object',
  required: ['type', 'minuteRange', 'ringRange', 'severity', 'notes', 'confidence'],
  properties: {
    type: {
      enum: [
        'pigment_spot',
        'pigment_cloud',
        'pigment_band',
        'brushfield_like_spots',
        'nerve_rings',
        'lymphatic_rosary',
        'scurf_rim',
        'sodium_ring',
      ],
    },
    subtype: { enum: ['orange_rust', 'brown_black', 'yellow', 'other'], nullable: true },
    minuteRange: rangeSchema,
    ringRange: rangeSchema,
    severity: { enum: ['low', 'medium', 'high'] },
    notes: { type: 'string' },
    confidence: { type: 'number' },
  },
} as const

const evidenceSchema = {
  type: 'object',
  required: ['fid', 'zoneId'],
  properties: { fid: { type: 'string' }, zoneId: { type: 'string' } },
} as const

const stepErrorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['stage', 'code', 'message', 'canRetry'],
      properties: {
        stage: { enum: ['STEP1', 'STEP2A', 'STEP2B', 'STEP2C', 'STEP3', 'STEP4', 'STEP5'] satisfies StepStage[] },
        code: { type: 'string' },
        message: { type: 'string' },
        canRetry: { type: 'boolean' },
      },
    },
  },
} as const

export const stepSchemas = {
  STEP1: {
    type: 'object',
    required: [
      'imgId',
      'side',
      'ok',
      'rejectReasons',
      'quality',
      'geo',
      'refRay15Usable',
      'usableUpperIris',
      'invalidRegions',
    ],
    properties: {
      imgId: { type: 'string' },
      side: { enum: ['R', 'L'] },
      ok: { type: 'boolean' },
      rejectReasons: { type: 'array', items: { type: 'string' } },
      quality: {
        type: 'object',
        required: ['score0_100', 'focus', 'glare', 'occlusion', 'issues'],
        properties: {
          score0_100: { type: 'number' },
          focus: { enum: ['good', 'med', 'poor'] },
          glare: { enum: ['none', 'low', 'med', 'high'] },
          occlusion: { enum: ['none', 'low', 'med', 'high'] },
          issues: { type: 'array', items: { type: 'string' } },
        },
      },
      geo: {
        type: 'object',
        required: ['mins', 'rings', 'degPerMin', 'refMinute', 'ringGroups'],
        properties: {
          mins: { const: 60 },
          rings: { const: 12 },
          degPerMin: { const: 6 },
          refMinute: { const: 15 },
          ringGroups: {
            type: 'object',
            required: ['IPB', 'STOM', 'ANW', 'ORG', 'LYM', 'SCU'],
            properties: {
              IPB: rangeSchema,
              STOM: rangeSchema,
              ANW: rangeSchema,
              ORG: rangeSchema,
              LYM: rangeSchema,
              SCU: rangeSchema,
            },
          },
        },
      },
      refRay15Usable: { type: 'boolean' },
      usableUpperIris: { type: 'boolean' },
      invalidRegions: {
        type: 'array',
        items: {
          ...excludedRegionSchema,
          properties: { ...excludedRegionSchema.properties, confidence: { type: 'number' } },
          required: [...excludedRegionSchema.required, 'confidence'],
        },
      },
    },
  },
  STEP2A: {
    type: 'object',
    required: ['imgId', 'side', 'findings', 'excluded'],
    properties: {
      imgId: { type: 'string' },
      side: { enum: ['R', 'L'] },
      findings: { type: 'array', items: structuralFindingSchema },
      excluded: { type: 'array', items: excludedRegionSchema },
    },
  },
  STEP2B: {
    type: 'object',
    required: ['imgId', 'side', 'global', 'collarette', 'findings', 'excluded'],
    properties: {
      imgId: { type: 'string' },
      side: { enum: ['R', 'L'] },
      global: globalDispositionSchema,
      collarette: collaretteSchema,
      findings: { type: 'array', items: pigmentFindingSchema },
      excluded: { type: 'array', items: excludedRegionSchema },
    },
  },
  STEP2C: {
    type: 'object',
    required: [
      'imgId',
      'side',
      'findings_struct_clean',
      'findings_pigment_clean',
      'collarette_clean',
      'global_clean',
      'dropped',
      'warnings',
    ],
    properties: {
      imgId: { type: 'string' },
      side: { enum: ['R', 'L'] },
      findings_struct_clean: { type: 'array', items: structuralFindingSchema },
      findings_pigment_clean: { type: 'array', items: pigmentFindingSchema },
      collarette_clean: collaretteSchema,
      global_clean: globalDispositionSchema,
      dropped: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'reason'],
          properties: {
            type: { type: 'string' },
            reason: { enum: ['contradiction', 'specular', 'too_wide', 'low_confidence', 'duplicate'] },
          },
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  },
  STEP3: {
    type: 'object',
    required: ['imgId', 'side', 'mappedFindings', 'zoneSummary', 'unmapped', 'warnings'],
    properties: {
      imgId: { type: 'string' },
      side: { enum: ['R', 'L'] },
      mappedFindings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fid', 'type', 'minuteRange', 'ringRange', 'confidence', 'zone', 'mapped'],
          properties: {
            fid: { type: 'string' },
            type: { type: 'string' },
            minuteRange: rangeSchema,
            ringRange: rangeSchema,
            confidence: { type: 'number' },
            zone: {
              type: 'object',
              required: ['id', 'baseId', 'organ_bg', 'system_bg'],
              properties: {
                id: { type: 'string' },
                baseId: { type: 'string' },
                organ_bg: { type: 'string' },
                system_bg: { type: 'string' },
              },
            },
            mapped: { type: 'boolean' },
          },
        },
      },
      zoneSummary: {
        type: 'array',
        items: {
          type: 'object',
          required: ['zoneId', 'organ_bg', 'system_bg', 'evidenceCount', 'topTypes'],
          properties: {
            zoneId: { type: 'string' },
            organ_bg: { type: 'string' },
            system_bg: { type: 'string' },
            evidenceCount: { type: 'number' },
            topTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      unmapped: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fid', 'type', 'reason'],
          properties: {
            fid: { type: 'string' },
            type: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
      warnings: { type: 'array', items: { type: 'string' } },
    },
  },
  STEP4: {
    type: 'object',
    required: ['imgId', 'side', 'base', 'axesScore', 'elimChannels', 'hypotheses', 'verificationQuestions'],
    properties: {
      imgId: { type: 'string' },
      side: { enum: ['R', 'L'] },
      base: {
        type: 'object',
        required: ['constitution', 'disposition', 'diathesis', 'ANW_status'],
        properties: {
          constitution: { enum: ['LYM', 'HEM', 'BIL', 'unclear'] },
          disposition: { enum: ['SILK', 'LINEN', 'BURLAP', 'unclear'] },
          diathesis: { type: 'array', items: { enum: ['HAC', 'LRS', 'LIP', 'DYS'] } },
          ANW_status: { enum: ['expanded', 'contracted', 'broken', 'normal', 'unclear'] },
        },
      },
      axesScore: {
        type: 'object',
        required: ['stress0_100', 'digestive0_100', 'immune0_100'],
        properties: {
          stress0_100: { type: 'number' },
          digestive0_100: { type: 'number' },
          immune0_100: { type: 'number' },
        },
      },
      elimChannels: {
        type: 'array',
        items: {
          type: 'object',
          required: ['channel', 'status', 'evidence'],
          properties: {
            channel: { enum: ['gut_ANW', 'kidney_6', 'lymph', 'skin_scu'] },
            status: { enum: ['normal', 'attention', 'concern'] },
            evidence: { type: 'array', items: evidenceSchema },
          },
        },
      },
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'claim', 'evidence', 'confidence0_1', 'applicability'],
          properties: {
            title: { type: 'string' },
            claim: { type: 'string' },
            evidence: { type: 'array', items: evidenceSchema },
            confidence0_1: { type: 'number' },
            applicability: { type: 'string' },
          },
        },
      },
      verificationQuestions: { type: 'array', items: { type: 'string' } },
    },
  },
  STEP5: {
    type: 'object',
    required: ['analysis', 'advice'],
    properties: {
      analysis: {
        type: 'object',
        required: ['zones', 'artifacts', 'overallHealth', 'systemScores'],
        properties: {
          zones: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'name', 'organ', 'status', 'findings', 'angle'],
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                organ: { type: 'string' },
                status: { enum: ['normal', 'attention', 'concern'] },
                findings: { type: 'string' },
                angle: rangeSchema,
              },
            },
          },
          artifacts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'location', 'description', 'severity'],
              properties: {
                type: { type: 'string' },
                location: { type: 'string' },
                description: { type: 'string' },
                severity: { enum: ['low', 'medium', 'high'] },
              },
            },
          },
          overallHealth: { type: 'number' },
          systemScores: {
            type: 'array',
            items: {
              type: 'object',
              required: ['system', 'score', 'description'],
              properties: {
                system: { type: 'string' },
                score: { type: 'number' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
      advice: {
        type: 'object',
        required: ['priorities', 'nutrition', 'lifestyle', 'followUp'],
        properties: {
          priorities: { type: 'array', items: { type: 'string' } },
          nutrition: {
            type: 'object',
            required: ['focus', 'limit'],
            properties: {
              focus: { type: 'array', items: { type: 'string' } },
              limit: { type: 'array', items: { type: 'string' } },
            },
          },
          lifestyle: {
            type: 'object',
            required: ['sleep', 'stress', 'activity'],
            properties: {
              sleep: { type: 'array', items: { type: 'string' } },
              stress: { type: 'array', items: { type: 'string' } },
              activity: { type: 'array', items: { type: 'string' } },
            },
          },
          followUp: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  error: stepErrorSchema,
} as const

export type StepSchemaKey = keyof typeof stepSchemas

