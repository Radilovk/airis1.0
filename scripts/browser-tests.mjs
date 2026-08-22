import { chromium } from 'playwright'

const apiKey = process.env.GEMINI_API_KEY || ''
const base = process.env.TEST_BASE || 'http://127.0.0.1:5199'
const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
const full = process.env.FULL_PIPELINE === '1'

async function runPage(page, url, label) {
  console.log(`\n=== ${label} ===`)
  console.log(url.replace(apiKey, '***'))
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 })
  const text = await page.evaluate(() => window.__done)
  const ok = await page.evaluate(() => window.__ok)
  console.log(text)
  console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`)
  return ok
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

let allOk = true
allOk = (await runPage(page, `${base}/__truth.html`, 'Coordinate truth')) && allOk

if (apiKey) {
  const q = new URLSearchParams({ key: apiKey, model })
  if (full) q.set('full', '1')
  allOk = (await runPage(page, `${base}/__gemini-live.html?${q}`, 'Gemini live')) && allOk
} else {
  console.log('\n=== Gemini live ===\nSKIP: GEMINI_API_KEY not set')
}

await browser.close()
process.exit(allOk ? 0 : 1)
