/**
 * airis-ai — прокси към Gemini за AIRIS.
 *
 * Приложението е статичен сайт (GitHub Pages): всичко в него е публично и
 * ключ в кода може да бъде изваден от всеки. Затова ключът стои тук, като
 * таен (`wrangler secret put GEMINI_API_KEY`), а приложението праща заявките
 * без ключ. Така анализът работи за всеки клиент без настройки.
 *
 * Пропуска само:
 *   • POST /v1beta/models/<gemini-модел>:generateContent
 *   • от разрешен произход (сайтът на AIRIS, локална разработка,
 *     допълнителни в променливата ALLOWED_ORIGINS, разделени със запетая)
 *   • тяло до 12 MB (няколко снимки на ирис в base64)
 */
const BUILTIN_ORIGINS = [
  /^https:\/\/radilovk\.github\.io$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
]
const PATH_RE = /^\/v1beta\/models\/(gemini-[a-z0-9.\-]+):generateContent$/
const MAX_BODY = 12 * 1024 * 1024

function originAllowed(origin, env) {
  if (!origin) return false
  if (BUILTIN_ORIGINS.some(re => re.test(origin))) return true
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .includes(origin)
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(status, message, headers = {}) {
  return new Response(JSON.stringify({ error: { code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowed = originAllowed(origin, env)
    const corsHeaders = allowed ? cors(origin) : {}

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: allowed ? 204 : 403, headers: corsHeaders })
    }
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: Boolean(env.GEMINI_API_KEY) }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    if (!allowed) return json(403, 'origin not allowed')
    if (request.method !== 'POST') return json(405, 'method not allowed', corsHeaders)

    const match = url.pathname.match(PATH_RE)
    if (!match) return json(404, 'not found', corsHeaders)
    if (!env.GEMINI_API_KEY) return json(503, 'GEMINI_API_KEY is not configured', corsHeaders)

    const length = Number(request.headers.get('Content-Length') || 0)
    if (length > MAX_BODY) return json(413, 'request too large', corsHeaders)
    const body = await request.arrayBuffer()
    if (body.byteLength > MAX_BODY) return json(413, 'request too large', corsHeaders)

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${match[1]}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body,
      }
    )
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json', ...corsHeaders },
    })
  },
}
