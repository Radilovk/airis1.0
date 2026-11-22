/**
 * iris-billing.ts — плащането на анализа в IrisMap (aidiet/docs/FINANCIAL_POLICY.md).
 *
 *  - Анализът (разчитане + насоки) е 6,99 € — плаща се преди него (Stripe през worker-а на Nutriin)
 *    и дава кредит за един анализ на това устройство.
 *  - С план от Nutriin е включен: профилът там дава пропуск (?pass=…) → кредит на устройството.
 *  - Платеното се приспада от първия план в Nutriin до 30 дни: ваучер (?voucher=… към цените).
 *  - Докато плащането е в тестов режим, плаща се само от тестери (?billing=test; ?billing=off го маха);
 *    останалите имат безплатния анализ веднъж на седмица.
 */
import { deviceId } from '@/lib/ai-proxy'

const WORKER = 'https://aidiet.radilov-k.workers.dev'
const VOUCHER = 'irismap_voucher'
export const PRICING_URL = 'https://nutriin.app/pricing.html'
export const NUTRIIN_PROFILE = 'https://nutriin.app/profile.html'

export function testerFlag(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('billing')
    if (q === 'test') localStorage.setItem('irismap_billing_test', '1')
    if (q === 'off') localStorage.removeItem('irismap_billing_test')
    return localStorage.getItem('irismap_billing_test') === '1'
  } catch { return false }
}

export const formatPrice = (v: number) => (Math.round(v) === v ? String(v) : v.toFixed(2).replace('.', ',')) + ' €'

export interface IrisStatus { credit: number; payRequired: boolean; price: number }
/** Какво чака човека преди анализа: има ли кредит, плаща ли се, цената. */
export async function irisStatus(): Promise<IrisStatus> {
  try {
    const r = await fetch(`${WORKER}/api/iris/status?deviceId=${encodeURIComponent(deviceId())}&tester=${testerFlag() ? '1' : ''}`)
    const d = await r.json()
    return { credit: Number(d.credit) || 0, payRequired: !!d.payRequired, price: Number(d.price) || 6.99 }
  } catch {
    return { credit: 0, payRequired: false, price: 6.99 }   // без връзка — билетът ще каже
  }
}

/** Към плащането (Stripe). Връщането е с ?paid=…&resume=analysis. Връща грешка за показване или пренасочва. */
export async function startAnalysisCheckout(): Promise<string | null> {
  try {
    const r = await fetch(`${WORKER}/api/billing/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'iris_analysis', deviceId: deviceId(), returnUrl: `${location.origin}${location.pathname}?resume=analysis` }),
    })
    const d = await r.json()
    if (d?.url) { location.href = d.url; return null }
    return d?.error === 'no_stripe' ? 'Плащането още се подготвя. Опитайте по-късно.' : (d?.message || 'Плащането не тръгна. Опитайте пак.')
  } catch {
    return 'Няма връзка. Опитайте пак.'
  }
}

function dropParams(...names: string[]) {
  try {
    const u = new URL(location.href)
    names.forEach(n => u.searchParams.delete(n))
    history.replaceState(null, '', u.pathname + u.search + u.hash)
  } catch { /* стар браузър */ }
}

/** Връщане от Stripe (?paid=cs_…): потвърждение → кредит за анализ и ваучер за плана. true = платено. */
export async function confirmFromUrl(): Promise<boolean> {
  const paid = new URLSearchParams(location.search).get('paid')
  if (!paid) return false
  dropParams('paid')
  try {
    const r = await fetch(`${WORKER}/api/billing/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: paid }) })
    const d = await r.json()
    if (d?.ok && d.product === 'iris_analysis') {
      if (d.voucher) saveVoucher({ code: d.voucher, until: d.voucherUntil, amount: d.amount })
      return true
    }
  } catch { /* без връзка — webhook-ът го записва */ }
  return false
}

/** Пропуск от Nutriin (?pass=…): анализът е включен в плана. → { ok } или съобщение. */
export async function redeemPassFromUrl(): Promise<{ ok: boolean; message?: string } | null> {
  const pass = new URLSearchParams(location.search).get('pass')
  if (!pass) return null
  dropParams('pass')
  try {
    const r = await fetch(`${WORKER}/api/iris/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pass, deviceId: deviceId() }) })
    const d = await r.json()
    return d?.ok ? { ok: true } : { ok: false, message: d?.message || 'Пропускът не мина. Отворете IrisMap отново от профила си в Nutriin.' }
  } catch {
    return { ok: false, message: 'Няма връзка. Опитайте пак.' }
  }
}

export const resumeRequested = () => new URLSearchParams(location.search).get('resume') === 'analysis'
export const clearResume = () => dropParams('resume')

export interface Voucher { code: string; until: number; amount: number }
function saveVoucher(v: Voucher) { try { localStorage.setItem(VOUCHER, JSON.stringify(v)) } catch { /* частен режим */ } }
/** Ваучерът за плана, ако е още годен. */
export function loadVoucher(): Voucher | null {
  try {
    const v = JSON.parse(localStorage.getItem(VOUCHER) || 'null') as Voucher | null
    return v && v.until > Date.now() ? v : null
  } catch { return null }
}
