/**
 * protocol-unlock.ts — платеният протокол на IrisMap (препоръките: хранене, добавки, режим).
 *
 * Политиката (aidiet/docs/FINANCIAL_POLICY.md): снимките, разпознаването и анализът са безплатни;
 * протоколът — еднократно плащане за анализ (Stripe Checkout през worker-а на Eatologix).
 * Отключването се помни на устройството и на сървъра (KV iris_unlock:<id>) — друг браузър
 * или изчистен кеш го взима обратно с проверка по идентификатора на анализа.
 */
import type { AnalysisReport } from '@/types'

const WORKER = 'https://aidiet.radilov-k.workers.dev'
const LOCAL = 'irismap_unlocked'

function localSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LOCAL) || '[]')) } catch { return new Set() }
}
export function markUnlocked(id: string) {
  const s = localSet(); s.add(id)
  try { localStorage.setItem(LOCAL, JSON.stringify([...s].slice(-200))) } catch { /* частен режим */ }
}
export function isUnlocked(report: AnalysisReport): boolean {
  return !!report.demo || !!report.protocolUnlocked || localSet().has(report.id)
}

export interface BillingStatus { ready: boolean; mode: 'test' | 'live'; price: number }
let statusMemo: Promise<BillingStatus> | null = null
export function billingStatus(): Promise<BillingStatus> {
  statusMemo ??= fetch(`${WORKER}/api/billing/status`)
    .then(r => r.json())
    .then(d => ({ ready: !!d.ready, mode: d.mode === 'live' ? 'live' : 'test', price: Number(d?.prices?.products?.iris_protocol?.price) || 9.99 } as BillingStatus))
    .catch(() => ({ ready: false, mode: 'test', price: 9.99 } as BillingStatus))
  return statusMemo
}

/**
 * Включено ли е заплащането за този посетител: в реалния режим — за всички;
 * в тестовия — само за тестери (адрес с ?billing=test; ?billing=off го маха).
 * Докато плащането не е включено, протоколът е отворен — никой не остава без препоръки.
 */
export function testerFlag(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('billing')
    if (q === 'test') localStorage.setItem('irismap_billing_test', '1')
    if (q === 'off') localStorage.removeItem('irismap_billing_test')
    return localStorage.getItem('irismap_billing_test') === '1'
  } catch { return false }
}
export const paywallActive = (s: BillingStatus) => s.ready && (s.mode === 'live' || testerFlag())

/** Отключен ли е на сървъра (друго устройство / изчистен браузър). */
export async function checkServerUnlock(id: string): Promise<boolean> {
  try {
    const d = await (await fetch(`${WORKER}/api/billing/iris-unlock?analysisId=${encodeURIComponent(id)}`)).json()
    if (d?.unlocked) markUnlocked(id)
    return !!d?.unlocked
  } catch { return false }
}

/** Към плащането (Stripe). Връща грешка за показване или пренасочва. */
export async function startProtocolCheckout(reportId: string): Promise<string | null> {
  try {
    const r = await fetch(`${WORKER}/api/billing/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'iris_protocol', analysisId: reportId, returnUrl: location.origin + location.pathname + `?report=${encodeURIComponent(reportId)}` }),
    })
    const d = await r.json()
    if (d?.url) { location.href = d.url; return null }
    return d?.error === 'no_stripe' ? 'Плащането още се подготвя. Опитайте по-късно.' : (d?.message || 'Плащането не тръгна. Опитайте пак.')
  } catch {
    return 'Няма връзка. Опитайте пак.'
  }
}

/** Връщане от Stripe (?paid=cs_…): потвърждение → id на отключения анализ (или null). */
export async function confirmFromUrl(): Promise<string | null> {
  const url = new URL(location.href)
  const paid = url.searchParams.get('paid')
  if (!paid) return null
  url.searchParams.delete('paid')
  history.replaceState(null, '', url.pathname + url.search + url.hash)
  try {
    const r = await fetch(`${WORKER}/api/billing/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: paid }) })
    const d = await r.json()
    if (d?.ok && d.product === 'iris_protocol' && d.analysisId) { markUnlocked(d.analysisId); return d.analysisId }
  } catch { /* без връзка — проверката по id ще го хване */ }
  return null
}
