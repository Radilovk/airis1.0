/**
 * Добавките от плана → налични продукти от BIOCODE (biocode-bg.com).
 *
 * Изборът е на сървъра на NutriPlan (/api/supplement-products) — едни и
 * същи правила за двете приложения: съвпадение по вещество и форма, без
 * противопоказаните при лекарствата от въпросника и само налични.
 * От AIRIS отиват само имената на добавките, лекарствата и дали режимът е
 * веган — нищо друго от анализа.
 */
import { useEffect, useState } from 'react'
import type { QuestionnaireData, SupplementRecommendation } from '@/types'

const API = 'https://aidiet.radilov-k.workers.dev/api/supplement-products'

export interface BiocodeProduct {
  group_id: string
  name: string
  brand: string
  image: string
  price: number | null
  promo: boolean
  packs: string[]
  url: string
}

const memo = new Map<string, Record<string, BiocodeProduct[]>>()

export function useBiocodeProducts(
  supplements: SupplementRecommendation[],
  questionnaire?: Partial<QuestionnaireData>,
): Record<string, BiocodeProduct[]> {
  const body = JSON.stringify({
    supplements: supplements.slice(0, 8).map(s => ({ name: s.name, dosage: s.dosage })),
    medications: questionnaire?.medications ? 'Да' : '',
    medicationsDetails: questionnaire?.medications || '',
    vegan: (questionnaire?.dietaryProfile || []).includes('Веган'),
    from: 'airis',
  })
  const [products, setProducts] = useState<Record<string, BiocodeProduct[]>>(() => memo.get(body) || {})

  useEffect(() => {
    if (!supplements.length || memo.has(body)) {
      if (memo.has(body)) setProducts(memo.get(body) || {})
      return
    }
    let cancelled = false
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      .then(r => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.success || cancelled) return
        const map: Record<string, BiocodeProduct[]> = {}
        for (const item of data.items || []) map[item.supplement] = item.products || []
        memo.set(body, map)
        setProducts(map)
      })
      .catch(() => {
        // без връзка — добавките остават без продукти
      })
    return () => {
      cancelled = true
    }
  }, [body, supplements.length])

  return products
}

export function formatPrice(v: number | null): string {
  return v ? `${v.toFixed(2).replace('.', ',')} €` : ''
}
