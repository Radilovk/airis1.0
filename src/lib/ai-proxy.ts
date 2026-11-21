/**
 * Откъде IrisMap вика Gemini.
 *
 * Сайтът е статичен и публичен — ключ в кода би бил видим за всеки. Затова заявките минават през
 * сървъра на Nutriin, който пази ключа и пропуска само заявки с „билет за анализ“
 * (aidiet/iris-gate.js): 1 безплатен анализ на седмица на устройство, ≤ 3 на ден от мрежа, и общ
 * дневен таван на разхода. Билетът се взима веднъж в началото на анализа (acquireIrisTicket).
 *
 * Собствен ключ от настройките (за администратора) все още работи: тогава заявката отива директно
 * към Google, без билет.
 */
const SERVER = (import.meta.env.VITE_AI_PROXY_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://aidiet.radilov-k.workers.dev'
export const AI_PROXY_URL = `${SERVER}/api/iris/gemini`

let ticket = ''

/** Устройството — за безплатния лимит (1 анализ на седмица). Пази се локално. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem('irismap_device') || ''
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      const b = new Uint8Array(16); crypto.getRandomValues(b)
      id = 'd' + [...b].map(x => x.toString(16).padStart(2, '0')).join('')
      localStorage.setItem('irismap_device', id)
    }
    return id
  } catch {
    return 'd-anon-' + Math.random().toString(36).slice(2, 12)
  }
}

export class IrisTicketError extends Error {
  constructor(public code: string, message: string, public next?: number) { super(message) }
}

// ── Turnstile: безплатният анализ е само за хора ─────────────────────────
// Ключът идва от сървъра; без ключ проверката е изключена и нищо не се зарежда.
type Turnstile = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string
  remove: (id: string) => void
}
let siteKeyP: Promise<string> | null = null
let scriptP: Promise<Turnstile> | null = null
function siteKey(): Promise<string> {
  siteKeyP ??= fetch(`${SERVER}/api/turnstile/config`).then(r => r.json()).then(d => d?.siteKey || '').catch(() => '')
  return siteKeyP
}
function loadTurnstile(): Promise<Turnstile> {
  const w = window as unknown as { turnstile?: Turnstile }
  scriptP ??= new Promise<Turnstile>((resolve, reject) => {
    if (w.turnstile) return resolve(w.turnstile)
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error('turnstile')))
    s.onerror = () => { scriptP = null; reject(new Error('turnstile')) }
    document.head.appendChild(s)
  })
  return scriptP
}
/** Жетон за едно изпращане ('' — проверката е изключена или не се зареди). */
export async function humanToken(): Promise<string> {
  const key = await siteKey()
  if (!key) return ''
  let ts: Turnstile
  try { ts = await loadTurnstile() } catch { return '' }
  return new Promise<string>(resolve => {
    const box = document.createElement('div')
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-label', 'Проверка, че не сте робот')
    box.style.cssText = 'position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10060;display:none'
    document.body.appendChild(box)
    let id: string | null = null
    let done = false
    const finish = (t: string) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { if (id) ts.remove(id) } catch { /* вече махнат */ }
      box.remove()
      resolve(t)
    }
    const timer = setTimeout(() => finish(''), 60000)
    id = ts.render(box, {
      sitekey: key,
      appearance: 'interaction-only',
      language: (document.documentElement.lang || 'auto').slice(0, 2),
      callback: (t: string) => finish(t),
      'error-callback': () => { finish(''); return true },
      'before-interactive-callback': () => { box.style.display = 'block' },
      'after-interactive-callback': () => { box.style.display = 'none' },
    })
  })
}

/** Тестер на плащането (?billing=test в iris-billing.ts) — сървърът иска плащане и от него. */
const testerOn = () => { try { return localStorage.getItem('irismap_billing_test') === '1' } catch { return false } }

/** Билет за един анализ. Хвърля IrisTicketError с обяснение за човека при отказ. */
export async function acquireIrisTicket(): Promise<void> {
  const turnstile = await humanToken()
  let r: Response
  try {
    r = await fetch(`${SERVER}/api/iris/ticket`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId(), turnstile, tester: testerOn() }),
    })
  } catch {
    throw new IrisTicketError('network', 'Няма връзка със сървъра. Проверете интернета и опитайте пак.')
  }
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.ticket) {
    throw new IrisTicketError(d.error || 'denied', d.message || 'Анализът не може да започне в момента. Опитайте по-късно.', d.next)
  }
  ticket = d.ticket
}

export function geminiEndpoint(model: string, apiKey?: string): { url: string; headers: Record<string, string> } {
  const path = `/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const key = apiKey?.trim()
  if (key) {
    return {
      url: `https://generativelanguage.googleapis.com${path}`,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    }
  }
  return { url: `${AI_PROXY_URL}${path}`, headers: { 'Content-Type': 'application/json', 'X-Iris-Ticket': ticket } }
}
