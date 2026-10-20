/**
 * AIRIS → NutriPlan.
 *
 * AIRIS води към NutriPlan (хранителен план, менюто и проследяването) и му
 * предава обобщението на анализа и отговорите от въпросника. Обратно не
 * идва нищо: NutriPlan пази пратката под еднократен линк и я добавя към
 * профила само след съгласие на човека на своя страница.
 *
 * Не се изпращат снимките на очите, разгънатите ленти, документите и
 * суровите находки — само това, което планът може да използва.
 */
import type { AnalysisReport } from '@/types'
import { CONSTITUTIONS } from '@/lib/iris-map'
import { constitutionKey } from '@/lib/iris-reading'

const NUTRIPLAN_HANDOFF_URL = 'https://aidiet.radilov-k.workers.dev/api/handoff'
const NUTRIPLAN_SITE = 'https://biocode.website'
const FROM_KEY = 'airis_from'

/** Запомня, ако AIRIS е отворен от NutriPlan (?from=nutriplan) — за текста на бутона. */
export function rememberEntrySource(): void {
  try {
    const from = new URLSearchParams(window.location.search).get('from')
    if (from === 'nutriplan') sessionStorage.setItem(FROM_KEY, 'nutriplan')
  } catch {
    // без sessionStorage бутонът просто остава „Продължи в NutriPlan“
  }
}

export function cameFromNutriPlan(): boolean {
  try {
    return sessionStorage.getItem(FROM_KEY) === 'nutriplan'
  } catch {
    return false
  }
}

/** Ключът на конституцията → текст за човек (NutriPlan не познава ключовете на AIRIS). */
function constitutionLabel(value?: string): string {
  const key = constitutionKey(value)
  return key ? CONSTITUTIONS[key].label : value || ''
}

const list = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, max) : []

/** Пратката: отговорите от въпросника + обобщението на анализа. */
export function buildNutriPlanHandoff(report: AnalysisReport) {
  const q = report.questionnaireData || ({} as AnalysisReport['questionnaireData'])
  const c = report.calibrated
  const plan = report.detailedPlan
  return {
    source: 'airis',
    v: 1,
    completedAt: report.timestamp,
    questionnaire: {
      name: q.name,
      age: q.age,
      gender: q.gender,
      weight: q.weight,
      height: q.height,
      goals: list(q.goals),
      activityLevel: q.activityLevel,
      stressLevel: q.stressLevel,
      sleepHours: q.sleepHours,
      sleepQuality: q.sleepQuality,
      hydration: q.hydration,
      dietaryProfile: list(q.dietaryProfile),
      dietaryHabits: list(q.dietaryHabits),
      foodIntolerances: q.foodIntolerances,
      allergies: q.allergies,
      medications: q.medications,
      medicalConditions: q.medicalConditions,
      complaints: [q.complaints, q.familyHistory ? `Фамилна обремененост: ${q.familyHistory}` : ''].filter(Boolean).join('. '),
    },
    analysis: {
      constitution: constitutionLabel(c?.constitution),
      summary: report.briefSummary || report.summary || '',
      systems: (c?.systems || []).map(s => ({ key: s.key, label: s.label, score: s.score, priority: s.priority })),
      drivers: (c?.drivers || []).map(d => ({ system: d.system, strength: d.strength, observation: d.observation, action: d.action, source: d.source })),
      eatMore: list(plan?.recommendedFoods, 15),
      eatLess: list(plan?.avoidFoods, 15),
      supplements: (plan?.supplements || []).slice(0, 8).map(s => ({ name: s.name, dosage: s.dosage })),
      recommendedTests: list(plan?.recommendedTests, 10),
      notices: (c?.notices || []).map(n => ({ level: n.level, title: n.title, body: n.body })),
      eyeReferral: c?.eyeHealth?.referral || 'none',
    },
  }
}

/**
 * Изпраща пратката и връща линка към NutriPlan. При липса на връзка —
 * линк към въпросника на NutriPlan без пратка (човекът пак стига до плана).
 */
export async function createNutriPlanLink(report: AnalysisReport): Promise<{ url: string; withData: boolean }> {
  try {
    const res = await fetch(NUTRIPLAN_HANDOFF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildNutriPlanHandoff(report)),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && typeof data.url === 'string' && data.url.startsWith(NUTRIPLAN_SITE)) {
      return { url: data.url, withData: true }
    }
  } catch {
    // към въпросника без пратка
  }
  return { url: `${NUTRIPLAN_SITE}/questionnaire2.html?from=airis`, withData: false }
}
