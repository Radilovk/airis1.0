#!/usr/bin/env node
/**
 * Live Gemini reliability benchmark — synthetic iris + ground truth markers.
 * Usage: GEMINI_API_KEY=... npm run test:gemini
 */
import { spawn } from 'node:child_process'
import { copyFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('Set GEMINI_API_KEY')
  process.exit(1)
}

const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const base = process.env.TEST_BASE || 'http://127.0.0.1:5199'
const port = new URL(base).port || '5199'

copyFileSync('test/gemini-reliability.html', 'public/__gemini-reliability.html')

const server = spawn('npx', ['vite', '--port', port, '--host', '127.0.0.1'], {
  stdio: 'pipe',
  shell: true,
})

await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Vite timeout')), 45000)
  server.stdout?.on('data', d => {
    if (String(d).includes('Local:')) {
      clearTimeout(t)
      resolve()
    }
  })
  server.on('error', reject)
})
await new Promise(r => setTimeout(r, 1000))

console.log(`\n=== Gemini live reliability (${model}) ===\n`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const q = new URLSearchParams({ key: apiKey, model, retest: '1' })
await page.goto(`${base}/__gemini-reliability.html?${q}`, {
  waitUntil: 'networkidle',
  timeout: 600000,
})
  await page.waitForFunction(() => window.__done, null, { timeout: 300000 })
const text = await page.evaluate(() => window.__done)
const ok = await page.evaluate(() => window.__ok)
const metrics = await page.evaluate(() => window.__metrics)

console.log(text)
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`)

const reportPath = 'test/reports/gemini-reliability-latest.json'
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      model,
      ok,
      metrics,
      log: text,
    },
    null,
    2
  )
)
console.log(`Report: ${reportPath}`)

await browser.close()
server.kill('SIGTERM')
process.exit(ok ? 0 : 1)
