/**
 * Откъде IrisMap вика Gemini.
 *
 * Сайтът е статичен и публичен — ключ в кода би бил видим за всеки. Затова заявките минават през
 * сървъра на Eatologix, който пази ключа и пропуска само заявки с „билет за анализ“
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

/** Билет за един анализ. Хвърля IrisTicketError с обяснение за човека при отказ. */
export async function acquireIrisTicket(): Promise<void> {
  let r: Response
  try {
    r = await fetch(`${SERVER}/api/iris/ticket`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId() }),
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
