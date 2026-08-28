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
  const markerOk = await page.evaluate(() => {
    const m = window.__done?.match(/КООРДИНАТИ: (\d+)\/(\d+)/)
    return m ? Number(m[1]) === Number(m[2]) : false
  })
  console.log(text)
  console.log(`RESULT: ${markerOk ? 'PASS (markers)' : 'FAIL'} — geometry synthetic test is informational`)
  return markerOk
}

async function runReliabilityTest(page) {
  console.log('\n=== Finding reliability (synthetic benchmark) ===')
  await page.goto(`${base}/__reliability.html`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 })
  const text = await page.evaluate(() => window.__done)
  const pass = await page.evaluate(() => window.__ok)
  console.log(text)
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`)
  return pass
}

async function runFlashEyeTest(page) {
  console.log('\n=== Flash eye fixture (realistic upload) ===')
  await page.goto(`${base}/__real-eye-test.html`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.evaluate(async () => {
    const { drawFlashEyeFixture } = await import('/src/lib/flash-eye-fixture.ts')
    const eye = drawFlashEyeFixture()
    window.__flashDataUrl = eye.dataUrl
  })
  await page.evaluate(async () => {
    const img = window.__flashDataUrl
    const { detectIrisGeometry, concentricGeometry } = await import('/src/lib/iris-geometry.ts')
    const { analyseIrisQualityFromDataUrl } = await import('/src/lib/iris-quality.ts')
    const { unwrapAnalysisFromDataUrl } = await import('/src/lib/iris-unwrap.ts')
    const L = []
    const el = document.createElement('img')
    el.src = img
    await new Promise(r => { el.onload = r })
    let geo = concentricGeometry(detectIrisGeometry(el))
    const q = await analyseIrisQualityFromDataUrl(img, { geometry: geo, manualGeometry: true })
    const views = await unwrapAnalysisFromDataUrl(img, geo, 'left')
    const strip = views.readings[0].structure
    const s = document.createElement('img')
    s.src = strip.dataUrl
    await new Promise(r => { s.onload = r })
    L.push(`Flash eye: ${el.naturalWidth}×${el.naturalHeight}`)
    L.push(`Quality: ${q.score}/100 ${q.verdict}, flash glare ${(q.metrics.pupilSpecular * 100).toFixed(1)}%`)
    L.push(`AI strip: ${s.naturalWidth}×${s.naturalHeight}, coverage ${Math.round(strip.coverage * 100)}%`)
    window.__done = L.join('\n')
    window.__ok = q.verdict !== 'reject' && s.naturalWidth >= 1600
  })
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
allOk = (await runReliabilityTest(page)) && allOk
allOk = (await runFlashEyeTest(page)) && allOk

if (apiKey) {
  const q = new URLSearchParams({ key: apiKey, model, flash: '1' })
  if (full) q.set('full', '1')
  allOk = (await runPage(page, `${base}/__gemini-live.html?${q}`, 'Gemini live')) && allOk
} else {
  console.log('\n=== Gemini live ===\nSKIP: GEMINI_API_KEY not set')
}

await browser.close()
process.exit(allOk ? 0 : 1)
